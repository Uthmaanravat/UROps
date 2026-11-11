'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { sendRealEmail } from "@/lib/email"
import { calculateVatAndTotal, isVatEffective, getVatRate } from "@/lib/vat-utils"
import { generateAeroWashQuotePdf } from "@/lib/aerowash-quote-pdf"
import { composeBrandedEmail } from "@/lib/email-compose"
import { formatMoneyZA } from "@/lib/email-templates"
import { buildAeroWashDocumentPdf } from "@/lib/server-document-pdf"
import { getAppUrl } from "@/lib/app-url"

export async function acceptQuotePublicAction(data: {
    quoteId: string
    acceptedByName: string
    acceptedByPosition: string
    acceptedByEmail: string
    poNumber?: string
    termsAccepted: boolean
    signatureDataUrl: string
    chosenOptionId?: string
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
        const hasOptions = Boolean(currentMeta?.hasOptions && Array.isArray(currentMeta?.options) && currentMeta.options.length > 0)
        const chosenOption = hasOptions
            ? (currentMeta.options.find((o: any) => o.id === data.chosenOptionId) || currentMeta.options[0])
            : null

        const acceptanceRecord = {
            acceptedAt: now.toISOString(),
            acceptedByName: data.acceptedByName.trim(),
            acceptedByPosition: data.acceptedByPosition.trim(),
            acceptedByEmail: data.acceptedByEmail.trim(),
            poNumber: data.poNumber?.trim() || null,
            clientIp,
            signatureDataUrl: data.signatureDataUrl,
            chosenOptionId: chosenOption ? chosenOption.id : null,
            chosenOptionName: chosenOption ? chosenOption.name : null
        }

        const updatedMeta = {
            ...currentMeta,
            chosenOption: chosenOption || undefined,
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

        // 6. Invoicing on Acceptance (Option Conversion & Payment Terms)
        const isEftOnCompletion = currentMeta?.paymentTermsOption === 'EFT_ON_COMPLETION'
        const baseSubtotal = chosenOption ? (chosenOption.subtotal || quote.subtotal) : quote.subtotal
        const depositPercentage = isEftOnCompletion ? 0 : 60
        const invoiceSubtotal = isEftOnCompletion
            ? baseSubtotal
            : Math.round((baseSubtotal * (depositPercentage / 100)) * 100) / 100
        const vatEffective = isVatEffective(now, settings)
        const vatRate = getVatRate(settings)
        const { taxRate, taxAmount, total: invoiceTotalAmount } = calculateVatAndTotal(invoiceSubtotal, vatEffective, vatRate)
        const depositTotal = invoiceTotalAmount

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

        const optionTitleSuffix = chosenOption ? ` — ${chosenOption.name}` : ''

        // Prepare line items: if chosen option has items, or single deposit line
        const invoiceLines = (isEftOnCompletion && chosenOption?.items && chosenOption.items.length > 0)
            ? chosenOption.items.map((it: any, idx: number) => ({
                description: it.description || it.name,
                quantity: it.quantity || 1,
                unit: it.unit || 'sum',
                unitPrice: it.unitPrice !== undefined ? it.unitPrice : it.amount,
                total: it.total !== undefined ? it.total : it.amount,
                position: idx
            }))
            : [
                {
                    description: isEftOnCompletion
                        ? `Services as per accepted quotation ${quote.quoteNumber || quote.number}${optionTitleSuffix}`
                        : `60% Deposit Payment – ${quote.quoteNumber || 'Quotation'}${optionTitleSuffix} (${quote.site || 'Facade Maintenance'})`,
                    quantity: 1,
                    unit: 'sum',
                    unitPrice: invoiceSubtotal,
                    total: invoiceSubtotal,
                    position: 0
                }
            ]

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
                subtotal: invoiceSubtotal,
                taxRate,
                taxAmount,
                total: invoiceTotalAmount,
                site: quote.site,
                paymentNotes: isEftOnCompletion
                    ? `Invoice payable by EFT on completion as per accepted quotation ${quote.quoteNumber || quote.number}${optionTitleSuffix}.`
                    : `Deposit invoice (60% advance payment) as per accepted quotation ${quote.quoteNumber || quote.number}${optionTitleSuffix}. Balance of 40% due upon project completion.`,
                firstPaymentPercentage: isEftOnCompletion ? 0 : depositPercentage,
                date: now,
                metadata: {
                    isDepositInvoice: !isEftOnCompletion,
                    isEftOnCompletion,
                    originalQuoteId: quote.id,
                    chosenOptionId: chosenOption?.id || null,
                    chosenOptionName: chosenOption?.name || null,
                    depositPercentage: isEftOnCompletion ? 0 : 60,
                    acceptedBy: data.acceptedByName
                },
                items: {
                    create: invoiceLines
                }
            }
        })

        // 7. Email Invoice to Client (branded, PDF attached; no login-only links)
        const appUrl = getAppUrl()
        const clientEmail = data.acceptedByEmail.trim()
        const clientName = data.acceptedByName.trim()
        const currency = settings?.currency || 'R'
        const quoteLabel = quote.quoteNumber || String(quote.number)

        const depositPdf = await buildAeroWashDocumentPdf(depositInvoice.id)
        const depositEmail = await composeBrandedEmail({
            companyId,
            settings,
            extraAttachments: depositPdf
                ? [{ filename: depositPdf.filename, content: depositPdf.buffer, contentType: 'application/pdf' }]
                : [],
            email: {
                subject: (b) => isEftOnCompletion
                    ? `${vatEffective ? 'Tax Invoice' : 'Invoice'} ${formattedInvoiceNumber} from ${b.shortName}`
                    : `Deposit ${vatEffective ? 'Tax Invoice' : 'Invoice'} ${formattedInvoiceNumber} (60%) from ${b.shortName}`,
                greeting: `Hi ${clientName},`,
                paragraphs: [
                    `Thank you for accepting quotation ${quoteLabel}${optionTitleSuffix}.`,
                    depositPdf
                        ? `Please find attached your ${isEftOnCompletion ? '' : '60% deposit '}${vatEffective ? 'tax invoice' : 'invoice'} ${formattedInvoiceNumber}.`
                        : `Your ${isEftOnCompletion ? '' : '60% deposit '}${vatEffective ? 'tax invoice' : 'invoice'} ${formattedInvoiceNumber} is ready.`,
                ],
                rows: [
                    { label: 'Invoice number', value: formattedInvoiceNumber },
                    {
                        label: isEftOnCompletion ? 'Total Due' : 'Deposit due (60%)',
                        value: formatMoneyZA(invoiceTotalAmount, currency),
                        strong: true
                    },
                    ...(isEftOnCompletion ? [{ label: 'Payment Terms', value: 'Payment by EFT on completion' }] : []),
                    { label: 'Site', value: quote.site || 'N/A' },
                ],
                afterParagraphs: [
                    ...(settings?.bankDetails && settings.bankDetails.trim()
                        ? [`Banking details:\n${settings.bankDetails.trim()}\nPayment reference: ${formattedInvoiceNumber}`]
                        : []),
                    isEftOnCompletion
                        ? 'Our operations team will contact you shortly to coordinate access and confirm the work schedule.'
                        : 'Once payment is received, our scheduling team will contact you to confirm the access schedule.',
                ],
                signOff: {},
            },
        })

        await sendRealEmail({
            to: clientEmail,
            from: depositEmail.from,
            replyTo: depositEmail.replyTo,
            subject: depositEmail.subject,
            body: depositEmail.text,
            html: depositEmail.html,
            attachments: depositEmail.attachments,
            companyId,
            companyName: depositEmail.brand.name,
            actorName: data.acceptedByName,
            triggeredByUserAction: true,
        })

        // 8. Notify Owner (uthmaan@aerowash.co.za + info@aerowash.co.za)
        const ownerEmails = ['uthmaan@aerowash.co.za']
        if (settings?.copyNotificationsTo && !ownerEmails.includes(settings.copyNotificationsTo)) {
            ownerEmails.push(settings.copyNotificationsTo)
        }

        const acceptedNotice = await composeBrandedEmail({
            companyId,
            settings,
            email: {
                subject: `Quote Accepted: ${quoteLabel} (${quote.client.name} — ${formatMoneyZA(quote.total, currency)})`,
                greeting: 'Hello,',
                paragraphs: [
                    `Quotation ${quoteLabel} for ${quote.client.name} has been accepted by ${data.acceptedByName} (${data.acceptedByPosition}).`,
                ],
                rows: [
                    { label: 'Total quote value', value: formatMoneyZA(quote.total, currency), strong: true },
                    { label: 'PO number', value: data.poNumber || 'None provided' },
                    { label: 'Client email', value: data.acceptedByEmail },
                    { label: 'Project', value: `${quote.client.name} - ${quote.site || 'Facade Maintenance'}` },
                    { label: isEftOnCompletion ? 'Invoice generated' : '60% deposit invoice', value: `${formattedInvoiceNumber} (${formatMoneyZA(depositTotal, currency)})` },
                ],
                cta: { label: 'View accepted quote', url: `${appUrl}/invoices/${quote.id}` },
            },
        })

        await sendRealEmail({
            to: ownerEmails,
            from: acceptedNotice.from,
            replyTo: acceptedNotice.replyTo,
            subject: acceptedNotice.subject,
            body: acceptedNotice.text,
            html: acceptedNotice.html,
            attachments: acceptedNotice.attachments,
            companyId,
            companyName: acceptedNotice.brand.name,
            actorName: data.acceptedByName,
            triggeredByUserAction: true,
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

        const appUrl = getAppUrl()
        const quoteUrl = `${appUrl}/invoices/${quote.id}`
        const quoteLabel = quote.quoteNumber || String(quote.number)

        const changeNotice = await composeBrandedEmail({
            companyId: quote.companyId,
            settings,
            email: {
                subject: `Client Revision Request: ${quoteLabel} (${quote.client.name})`,
                greeting: 'Hello,',
                paragraphs: [
                    `${data.name} (${data.email}) from ${quote.client.name} has requested changes to quotation ${quoteLabel}:`,
                    `"${data.message.trim()}"`,
                ],
                cta: { label: 'Open & revise quotation', url: quoteUrl },
            },
        })

        await sendRealEmail({
            to: ownerEmails,
            from: changeNotice.from,
            replyTo: changeNotice.replyTo,
            subject: changeNotice.subject,
            body: changeNotice.text,
            html: changeNotice.html,
            attachments: changeNotice.attachments,
            companyId: quote.companyId,
            companyName: changeNotice.brand.name,
            actorName: data.name,
            triggeredByUserAction: true,
        })

        revalidatePath(`/quote/${quote.id}`)
        revalidatePath(`/invoices/${quote.id}`)

        return { success: true }
    } catch (e: any) {
        console.error("requestQuoteChangesPublicAction error:", e)
        return { success: false, error: e.message || "Failed to submit revision request" }
    }
}
