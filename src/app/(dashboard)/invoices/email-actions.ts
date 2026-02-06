'use server'

import { sendRealEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"

export async function sendInvoiceEmail(invoiceId: string, recipients?: string[]) {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { client: true }
        })

        if (!invoice) {
            return { success: false, error: "Invoice not found" }
        }

        const toEmails = recipients && recipients.length > 0 ? recipients : [invoice.client.email].filter(Boolean) as string[];

        if (toEmails.length === 0) {
            return { success: false, error: "No recipient emails provided" }
        }

        const subject = `${invoice.type} #${invoice.number} from UROps`
        const body = `Hi ${invoice.client.name},

Please find attached your ${invoice.type.toLowerCase()} #${invoice.number}.
Total Amount: R${invoice.total.toFixed(2)}

Best regards,
The UROps Team`

        const settings = await prisma.companySettings.findUnique({ where: { id: "default" } });
        const fromEmail = settings?.email || 'onboarding@resend.dev';
        const fromName = settings?.name || 'UROps';

        // Formatter for Resend from address: "Name <email@domain.com>"
        const formattedFrom = fromEmail.includes('<') ? fromEmail : `${fromName} <${fromEmail}>`;

        console.log(`[EMAIL ACTION] Sending real email for ${invoiceId} to ${toEmails.join(', ')} from ${formattedFrom}`);
        const emailResult = await sendRealEmail({
            to: toEmails,
            from: formattedFrom,
            subject,
            body
        });

        if (emailResult.success) {
            // Log as interaction
            await prisma.interaction.create({
                data: {
                    clientId: invoice.clientId,
                    companyId: invoice.companyId,
                    type: "EMAIL",
                    content: `Sent ${invoice.type}: ${subject} \n\nTo: ${toEmails.join(', ')} `
                }
            });
            console.log(`[EMAIL ACTION] Email sent successfully for ${invoiceId}`);
            return { success: true }
        } else {
            console.error(`[EMAIL ACTION] Email failed for ${invoiceId}: `, emailResult.error);
            return { success: false, error: emailResult.error }
        }
    } catch (error) {
        console.error("Error sending invoice email:", error)
        return { success: false, error: String(error) }
    }
}
