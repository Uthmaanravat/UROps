'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { sendRealEmail } from "@/lib/email"
import { calculateVatAndTotal, isVatEffective, getVatRate } from "@/lib/vat-utils"
import { generateAeroWashQuotePdf } from "@/lib/aerowash-quote-pdf"

export async function acceptQuotePublicAction(data: {
    quoteId: string
    acceptedByName: string
    acceptedByPosition: string
    acceptedByEmail: string
    poNumber?: string
    termsAccepted: boolean
    signatureDataUrl: string
}) {
    try {
        if (!data.quoteId) throw new Error("Missing quote ID")
        if (!data.acceptedByName?.trim()) throw new Error("Name is required for acceptance")
        if (!data.acceptedByPosition?.trim()) throw new Error("Position is required for acceptance")
        if (!data.acceptedByEmail?.trim() || !data.acceptedByEmail.includes("@")) throw new Error("Valid email is required")
        if (!data.termsAccepted) throw new Error("You must agree to the quotation terms before accepting")
        if (!data.signatureDataUrl || !data.signatureDataUrl.startsWith("data:image/")) throw new Error("On-screen signature is required")

        const headerList = headers()
        const clientIp = headerList.get("x-forwarded-for") || headerList.get("x-real-ip") || "Unknown IP"

        const quote = await prisma.invoice.findUnique({
            where: { id: data.quoteId },
            include: {
                client: true,
                items: { orderBy: { position: 'asc' } },
                company: { include: { settings: true } }
            }
        })
        if (!quote) throw new Error("Quotation not found")

        const companyId = quote.companyId
        const settings = quote.company?.settings
        const isAeroWash = companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' || settings?.theme === 'dark-orange'

        // 1. Check Approval Threshold Lock (Server-Side)
        const threshold = settings?.approvalThreshold
        const currentMeta = (quote.metadata as any) || {}
        if (threshold && threshold > 0 && quote.total > threshold && currentMeta.approvalStatus !== 'APPROVED') {
            throw new Error("This quotation exceeds the company approval threshold and is pending final authorization. Acceptance cannot proceed until authorized.")
        }

        // 2. Check Validity Period Expiration
        const validityDays = (quote as any).validityDays || (quote.metadata as any)?.validityDays || settings?.validityDays || 30
        const quoteDate = new Date(quote.date)
        const expiryDate = new Date(quoteDate.getTime() + validityDays * 24 * 60 * 60 * 1000)
        if (new Date() > expiryDate) {
            throw new Error(`This quotation expired on ${expiryDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}. Please request a reissued quotation.`)
        }

        if (quote.status === 'ACCEPTED') {
            return { success: true, message: "Quotation was already accepted." }
        }

        const now = new Date()
        const acceptanceRecord = {
            acceptedAt: now.toISOString(),
            acceptedByName: data.acceptedByName.trim(),
            acceptedByPosition: data.acceptedByPosition.trim(),
            acceptedByEmail: data.acceptedByEmail.trim(),
            poNumber: data.poNumber?.trim() || null,
            clientIp,
            signatureDataUrl: data.signatureDataUrl
        }

        const updatedMeta = {
            ...currentMeta,
            acceptance: acceptanceRecord
        }

        // 3. Mark Quote as ACCEPTED
        await prisma.invoice.update({
            where: { id: quote.id },
            data: {
                status: 'ACCEPTED',
                clientPoNumber: data.poNumber?.trim() || quote.clientPoNumber,
                metadata: updatedMeta
            }
        })

        // 4. Update Prospect if linked
        const prospect = await (prisma as any).prospect.findFirst({
            where: {
                companyId,
                OR: [
                    { name: { contains: quote.client.name, mode: 'insensitive' } },
                    ...(quote.site ? [{ location: { contains: quote.site, mode: 'insensitive' } }] : [])
                ]
            }
        })
        if (prospect) {
            const existingLog = (prospect.contactLog as any[]) || []
            await prisma.prospect.update({
                where: { id: prospect.id },
                data: {
                    status: 'won',
                    lastContactDate: now,
                    contactLog: [
                        ...existingLog,
                        {
                            date: now.toISOString(),
                            method: 'client_acceptance',
                            outcome: `Quotation ${quote.quoteNumber || quote.number} accepted by ${data.acceptedByName} (${data.acceptedByPosition}) - Deal won!`,
                            quoteId: quote.id
                        }
                    ]
                }
            })
        }

        // 5. Auto-Create Project via existing project flow
        let projectId = quote.projectId
        if (!projectId) {
            const newProject = await prisma.project.create({
                data: {
                    companyId,
                    name: `${quote.client.name} - ${quote.site || 'Facade Maintenance'}`,
                    clientId: quote.clientId,
                    status: 'SCHEDULED',
                    workflowStage: 'SOW',
                    commercialStatus: data.poNumber ? 'PO_RECEIVED' : 'AWAITING_PO',
                    description: `Project auto-created upon client acceptance of Quote ${quote.quoteNumber || quote.number} by ${data.acceptedByName} (${data.acceptedByPosition})`
                }
            })
            projectId = newProject.id
            await prisma.invoice.update({
                where: { id: quote.id },
                data: { projectId }
            })
        } else {
            await prisma.project.update({
                where: { id: projectId },
                data: {
                    status: 'SCHEDULED',
                    commercialStatus: data.poNumber ? 'PO_RECEIVED' : undefined
                }
            })
        }

        // 6. Auto-Create 60% DEPOSIT Invoice
        const depositPercentage = 60
        const depositSubtotal = Math.round((quote.subtotal * (depositPercentage / 100)) * 100) / 100
        const vatEffective = isVatEffective(now, settings)
        const vatRate = getVatRate(settings)
        const { taxRate, taxAmount, total: depositTotal } = calculateVatAndTotal(depositSubtotal, vatEffective, vatRate)

        const year = now.getFullYear()
        let nextInvoiceNumber = 1
        const lastInv = await prisma.invoice.findFirst({
            where: { companyId, type: 'INVOICE' },
            orderBy: { number: 'desc' }
        })
        nextInvoiceNumber = Math.max(settings?.lastInvoiceNumber || 0, lastInv?.number || 0) + 1
        await prisma.companySettings.update({
            where: { companyId },
            data: { lastInvoiceNumber: nextInvoiceNumber }
        })
        const formattedInvoiceNumber = `INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`

        const depositInvoice = await prisma.invoice.create({
            data: {
                companyId,
                clientId: quote.clientId,
                projectId,
                type: 'INVOICE',
                status: 'SENT',
                number: nextInvoiceNumber,
                quoteNumber: formattedInvoiceNumber,
                reference: quote.quoteNumber || `Quote #${quote.number}`,
                clientPoNumber: data.poNumber?.trim() || quote.clientPoNumber,
                subtotal: depositSubtotal,
                taxRate,
                taxAmount,
                total: depositTotal,
                site: quote.site,
                paymentNotes: `Deposit invoice (60% advance payment) as per accepted quotation ${quote.quoteNumber || quote.number}. Balance of 40% due upon project completion.`,
                firstPaymentPercentage: depositPercentage,
                date: now,
                metadata: {
                    isDepositInvoice: true,
                    originalQuoteId: quote.id,
                    depositPercentage: 60,
                    acceptedBy: data.acceptedByName
                },
                items: {
                    create: [
                        {
                            description: `60% Deposit Payment – ${quote.quoteNumber || 'Quotation'} (${quote.site || 'Facade Maintenance'})`,
                            quantity: 1,
                            unit: 'sum',
                            unitPrice: depositSubtotal,
                            total: depositSubtotal,
                            position: 0
                        }
                    ]
                }
            }
        })

        // 7. Email Deposit Invoice to Client
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app'
        const depositViewUrl = `${appUrl}/invoices/${depositInvoice.id}`
        const clientEmail = data.acceptedByEmail.trim()
        const clientName = data.acceptedByName.trim()

        await sendRealEmail({
            to: clientEmail,
            from: 'AeroWash Accounts <info@aerowash.co.za>',
            replyTo: 'info@aerowash.co.za',
            subject: `Deposit Tax Invoice ${formattedInvoiceNumber} (60%) – AeroWash`,
            body: `Dear ${clientName},\n\nThank you for accepting quotation ${quote.quoteNumber || quote.number} for ${quote.client.name}.\n\nPlease find your 60% deposit invoice details below:\nInvoice Number: ${formattedInvoiceNumber}\nAmount Due: R${depositTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nSite: ${quote.site || 'N/A'}\n\nYou can view and download your deposit invoice here:\n${depositViewUrl}\n\nBank Details:\n${settings?.bankDetails || 'Standard Bank - AeroWash (Pty) Ltd'}\n\nUpon payment receipt, our scheduling team will contact you to confirm the access schedule.\n\nWarm regards,\nAeroWash Operations Team`
        })

        // 8. Notify Owner (uthmaan@aerowash.co.za + info@aerowash.co.za)
        const ownerEmails = ['uthmaan@aerowash.co.za']
        if (settings?.copyNotificationsTo && !ownerEmails.includes(settings.copyNotificationsTo)) {
            ownerEmails.push(settings.copyNotificationsTo)
        }

        await sendRealEmail({
            to: ownerEmails,
            from: 'AeroWash Notifications <info@aerowash.co.za>',
            replyTo: 'info@aerowash.co.za',
            subject: `🎉 Quote Accepted: ${quote.quoteNumber || quote.number} (${quote.client.name} — R${quote.total.toLocaleString()})`,
            body: `Great news!\n\nQuotation ${quote.quoteNumber || quote.number} for ${quote.client.name} has been officially accepted by ${data.acceptedByName} (${data.acceptedByPosition}).\n\nDetails:\n- Total Quote Value: R${quote.total.toFixed(2)}\n- PO Number: ${data.poNumber || 'None provided'}\n- Client Email: ${data.acceptedByEmail}\n- Project auto-created: ${quote.client.name} - ${quote.site || 'Facade Maintenance'}\n- 60% Deposit Invoice issued: ${formattedInvoiceNumber} (R${depositTotal.toFixed(2)})\n\nView the accepted quote:\n${appUrl}/invoices/${quote.id}\n\nUROps Automated Workflow`
        })

        revalidatePath(`/quote/${quote.id}`)
        revalidatePath(`/invoices/${quote.id}`)
        revalidatePath(`/projects`)
        revalidatePath(`/financial-dashboard`)

        return {
            success: true,
            depositInvoiceId: depositInvoice.id,
            depositInvoiceNumber: formattedInvoiceNumber,
            depositTotal
        }
    } catch (e: any) {
        console.error("acceptQuotePublicAction error:", e)
        return { success: false, error: e.message || "Failed to accept quotation" }
    }
}

export async function requestQuoteChangesPublicAction(data: {
    quoteId: string
    name: string
    email: string
    message: string
}) {
    try {
        if (!data.quoteId) throw new Error("Missing quote ID")
        if (!data.name?.trim()) throw new Error("Name is required")
        if (!data.email?.trim() || !data.email.includes("@")) throw new Error("Valid email is required")
        if (!data.message?.trim()) throw new Error("Please provide the changes or notes requested")

        const quote = await prisma.invoice.findUnique({
            where: { id: data.quoteId },
            include: {
                client: true,
                company: { include: { settings: true } }
            }
        })
        if (!quote) throw new Error("Quotation not found")

        const currentMeta = (quote.metadata as any) || {}
        const existingChanges = Array.isArray(currentMeta.clientRequestedChanges) ? currentMeta.clientRequestedChanges : []

        const newChangeEntry = {
            requestedAt: new Date().toISOString(),
            name: data.name.trim(),
            email: data.email.trim(),
            message: data.message.trim()
        }

        await prisma.invoice.update({
            where: { id: quote.id },
            data: {
                metadata: {
                    ...currentMeta,
                    clientRequestedChanges: [...existingChanges, newChangeEntry]
                }
            }
        })

        // Notify owner
        const settings = quote.company?.settings
        const ownerEmails = ['uthmaan@aerowash.co.za']
        if (settings?.copyNotificationsTo && !ownerEmails.includes(settings.copyNotificationsTo)) {
            ownerEmails.push(settings.copyNotificationsTo)
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app'
        const quoteUrl = `${appUrl}/invoices/${quote.id}`

        await sendRealEmail({
            to: ownerEmails,
            from: 'AeroWash Review <info@aerowash.co.za>',
            replyTo: 'info@aerowash.co.za',
            subject: `Client Revision Request: ${quote.quoteNumber || quote.number} (${quote.client.name})`,
            body: `Hello Uthmaan,\n\n${data.name} (${data.email}) from ${quote.client.name} has requested changes to quotation ${quote.quoteNumber || quote.number}:\n\n"${data.message.trim()}"\n\nOpen and revise the quotation here:\n${quoteUrl}\n\nUROps Client Review System`
        })

        revalidatePath(`/quote/${quote.id}`)
        revalidatePath(`/invoices/${quote.id}`)

        return { success: true }
    } catch (e: any) {
        console.error("requestQuoteChangesPublicAction error:", e)
        return { success: false, error: e.message || "Failed to submit revision request" }
    }
}
