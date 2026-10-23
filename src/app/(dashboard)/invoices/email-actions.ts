'use server'

import { sendRealEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"

export async function sendInvoiceEmail(invoiceId: string, recipients?: string[], customBody?: string) {
    try {
        const companyId = await ensureAuth()
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            include: { client: true, items: true }
        })

        if (!invoice) {
            return { success: false, error: "Invoice not found or unauthorized" }
        }

        if (!invoice.items || invoice.items.length === 0) {
            return { success: false, error: "Cannot send document: Document has no line items." }
        }

        const invalidItems = invoice.items.filter(item => !item.quantity || Number(item.quantity) <= 0 || !item.unitPrice || Number(item.unitPrice) <= 0);
        if (invalidItems.length > 0) {
            return {
                success: false,
                error: `Cannot send document: ${invalidItems.length} line item(s) have zero or blank prices/quantities. Please review and price all items first.`
            }
        }

        const toEmails = recipients && recipients.length > 0 ? recipients : [invoice.client.email].filter(Boolean) as string[];

        if (toEmails.length === 0) {
            return { success: false, error: "No recipient emails provided" }
        }

        const formattedNumber = invoice.quoteNumber || (invoice.type === 'QUOTE' ? `Q-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}` : `INV-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`);
        const subject = `${invoice.type} ${formattedNumber} from UROps`
        const body = customBody || `Hi ${invoice.client.name},

Please find attached your ${invoice.type.toLowerCase()} ${formattedNumber}.
Total Amount: R${invoice.total.toFixed(2)}

Best regards,
The UROps Team`

        const settings = await prisma.companySettings.findUnique({ where: { companyId: invoice.companyId } });
        const fromEmail = settings?.email || 'onboarding@resend.dev';
        const fromName = settings?.name || 'UROps';

        // Formatter for Resend from address: "Name <email@domain.com>"
        const formattedFrom = fromEmail.includes('<') ? fromEmail : `${fromName} <${fromEmail}>`;

        // Send via Resend
        const result = await sendRealEmail({
            to: toEmails,
            subject,
            body: body,
            from: formattedFrom,
        })

        if (!result.success) {
            return { success: false, error: result.error || "Failed to send email" }
        }

        // Record the send activity/interaction
        await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
                status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status
            }
        })

        return { success: true, messageId: (result as any).id || (result as any).data?.id }
    } catch (error: any) {
        console.error("sendInvoiceEmail error:", error)
        return { success: false, error: error.message || "Failed to send email" }
    }
}
