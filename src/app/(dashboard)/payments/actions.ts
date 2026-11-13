'use server'

import { prisma } from "@/lib/prisma"
import { ensureAuth, getAuthUser } from "@/lib/auth-actions"
import { revalidatePath } from "next/cache"
import { sendRealEmail } from "@/lib/email"
import { formatCurrency } from "@/lib/utils"
import { composeBrandedEmail } from "@/lib/email-compose"
import { formatLongDate, formatMoneyZA, resolveGreetingName, isAeroWashCompany } from "@/lib/email-templates"
import { isVatEffective } from "@/lib/vat-utils"
import { buildAeroWashDocumentPdf } from "@/lib/server-document-pdf"

export async function sendOverdueReminderAction(invoiceId: string, customMessage?: string) {
    try {
        const companyId = await ensureAuth()

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId, companyId },
            include: {
                client: true,
                contact: true,
                payments: true,
                company: { include: { settings: true } }
            }
        })

        if (!invoice) throw new Error("Invoice not found")

        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
        const balanceDue = invoice.total - totalPaid

        if (balanceDue <= 0) {
            throw new Error("This invoice is already paid in full.")
        }

        const settings = invoice.company?.settings
        const clientEmail = invoice.client.email
        if (!clientEmail || !clientEmail.includes('@')) {
            throw new Error(`Client ${invoice.client.name} has no valid email address on file.`)
        }

        const formattedNumber = invoice.quoteNumber || `INV-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`
        const currency = settings?.currency || 'R'
        const docLabel = isVatEffective(invoice.date, settings) ? 'Tax Invoice' : 'Invoice'
        const authUser = await getAuthUser()

        // Same PDF as the invoice (AeroWash can be generated server-side; no attachment is claimed otherwise)
        const pdf = await buildAeroWashDocumentPdf(invoice.id)

        const greetingName = resolveGreetingName({
            contactName: invoice.contact?.name,
            attentionTo: invoice.attentionTo,
            clientAttentionTo: invoice.client.attentionTo,
            clientCompanyName: invoice.client.companyName,
            clientName: invoice.client.name,
        })

        const custom = customMessage?.trim()
        const isAero = isAeroWashCompany(companyId, settings);
        const senderName = isAero ? undefined : ((authUser?.name || '').trim() || undefined);
        const composed = await composeBrandedEmail({
            companyId,
            settings,
            fallbackSenderEmail: isAero ? undefined : authUser?.email,
            extraAttachments: pdf ? [{ filename: pdf.filename, content: pdf.buffer, contentType: 'application/pdf' }] : [],
            email: custom
                ? {
                    subject: `Payment reminder: ${docLabel} ${formattedNumber} (${formatMoneyZA(balanceDue, currency)} outstanding)`,
                    paragraphs: custom.split(/\n{2,}/),
                }
                : {
                    subject: `Payment reminder: ${docLabel} ${formattedNumber} (${formatMoneyZA(balanceDue, currency)} outstanding)`,
                    greeting: `Hi ${greetingName},`,
                    paragraphs: [
                        `This is a friendly reminder that ${docLabel.toLowerCase()} ${formattedNumber} has an outstanding balance.`,
                        pdf ? 'A copy of the invoice is attached for your convenience.' : '',
                    ],
                    rows: [
                        { label: 'Invoice number', value: formattedNumber },
                        { label: 'Balance due', value: formatMoneyZA(balanceDue, currency), strong: true },
                        ...(invoice.dueDate ? [{ label: 'Due date', value: formatLongDate(invoice.dueDate) }] : []),
                        ...(invoice.site ? [{ label: 'Site', value: invoice.site }] : []),
                    ],
                    afterParagraphs: [
                        ...(settings?.bankDetails && settings.bankDetails.trim()
                            ? [`Banking details:\n${settings.bankDetails.trim()}\nPayment reference: ${formattedNumber}`]
                            : []),
                        'If payment has already been made, please reply with proof of payment so we can update your account.',
                    ],
                    signOff: isAero ? undefined : { name: senderName },
                },
        })

        const res = await sendRealEmail({
            to: clientEmail,
            from: composed.from,
            replyTo: composed.replyTo,
            subject: composed.subject,
            body: composed.text,
            html: composed.html,
            attachments: composed.attachments,
            companyId,
            companyName: composed.brand.name,
            actorUserId: authUser?.id,
            actorName: authUser?.name || authUser?.email,
            triggeredByUserAction: true,
        })

        if (!res.success) {
            return { success: false, error: res.error || "Failed to send email reminder." }
        }

        // Record reminder log in invoice metadata
        const meta = (invoice.metadata as any) || {}
        const reminderLogs = Array.isArray(meta.reminderLogs) ? meta.reminderLogs : []
        const newLog = {
            sentAt: new Date().toISOString(),
            recipient: clientEmail,
            balanceDue,
            status: 'SENT'
        }

        await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
                metadata: {
                    ...meta,
                    reminderLogs: [...reminderLogs, newLog],
                    lastReminderSentAt: new Date().toISOString()
                }
            }
        })

        revalidatePath('/payments')
        revalidatePath('/invoices')
        revalidatePath(`/invoices/${invoice.id}`)

        return { success: true }
    } catch (e: any) {
        console.error("sendOverdueReminderAction error:", e)
        return { success: false, error: e.message || "Failed to send reminder" }
    }
}

export async function toggleClientRemindersAction(clientId: string, enabled: boolean) {
    try {
        const companyId = await ensureAuth()
        const client = await prisma.client.findUnique({
            where: { id: clientId, companyId }
        })
        if (!client) throw new Error("Client not found")

        const customFields = (client.customFields as any) || {}
        await prisma.client.update({
            where: { id: clientId },
            data: {
                customFields: {
                    ...customFields,
                    automatedRemindersDisabled: !enabled
                }
            }
        })

        revalidatePath('/payments')
        revalidatePath('/clients')
        return { success: true, enabled }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
