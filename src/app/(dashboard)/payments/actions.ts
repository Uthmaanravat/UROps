'use server'

import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { revalidatePath } from "next/cache"
import { sendRealEmail } from "@/lib/email"
import { formatCurrency } from "@/lib/utils"

export async function sendOverdueReminderAction(invoiceId: string, customMessage?: string) {
    try {
        const companyId = await ensureAuth()

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId, companyId },
            include: {
                client: true,
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
        const dueDateStr = invoice.dueDate
            ? new Date(invoice.dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'Payment upon presentation'

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app'
        const invoiceUrl = `${appUrl}/invoices/${invoice.id}`

        const defaultBody = `Dear ${invoice.attentionTo || invoice.client.name},\n\nThis is a friendly reminder that invoice ${formattedNumber} for ${invoice.client.name} has an outstanding balance of ${formatCurrency(balanceDue, 'R')}.\n\nInvoice Details:\n- Invoice Number: ${formattedNumber}\n- Balance Due: R${balanceDue.toFixed(2)}\n- Due Date: ${dueDateStr}\n- Site: ${invoice.site || 'N/A'}\n\nYou can view and download your tax invoice online here:\n${invoiceUrl}\n\nBanking Details:\n${settings?.bankDetails || 'Standard Bank - AeroWash (Pty) Ltd'}\n\nIf payment has already been dispatched, please reply with proof of payment so we can update your account.\n\nWarm regards,\nAccounts Department\n${settings?.name || 'AeroWash (Pty) Ltd'}`

        const body = customMessage?.trim() ? customMessage.trim() : defaultBody

        const res = await sendRealEmail({
            to: clientEmail,
            from: 'AeroWash Accounts <info@aerowash.co.za>',
            replyTo: 'info@aerowash.co.za',
            subject: `Overdue Payment Reminder: Invoice ${formattedNumber} (${formatCurrency(balanceDue, 'R')})`,
            body
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
