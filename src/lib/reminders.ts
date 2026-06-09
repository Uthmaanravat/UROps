import { prisma } from "@/lib/prisma"
import { sendRealEmail } from "@/lib/email"
import { sendWhatsAppMessage } from "@/lib/whatsapp"

export async function sendMeetingReminders(meetingId: string) {
    try {
        const meeting = await prisma.meeting.findUnique({
            where: { id: meetingId },
            include: {
                client: true,
                project: true
            }
        })

        if (!meeting) {
            console.error(`[REMINDERS] Meeting ${meetingId} not found`);
            return;
        }

        const managers = await prisma.user.findMany({
            where: {
                companyId: meeting.companyId,
                role: 'MANAGER'
            }
        })

        if (managers.length === 0) {
            console.log(`[REMINDERS] No managers found in company ${meeting.companyId} to notify.`);
            return;
        }

        const formattedDate = new Date(meeting.date).toLocaleString('default', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        const clientName = meeting.client?.name || 'N/A';
        const projectName = meeting.project?.name || 'N/A';

        // Retrieve Company Settings to find the email sender details and fallback phone number
        const companySettings = await prisma.companySettings.findUnique({
            where: { companyId: meeting.companyId }
        });

        const fromEmail = companySettings?.email || 'onboarding@resend.dev';
        const fromName = companySettings?.name || 'UROps';
        const formattedFrom = fromEmail.includes('<') ? fromEmail : `${fromName} <${fromEmail}>`;

        for (const manager of managers) {
            const managerName = manager.name || manager.email.split('@')[0];

            // 1. Send Email Reminder
            const emailSubject = `[Meeting Scheduled] ${meeting.title} - ${formattedDate}`;
            const emailBody = `Hi ${managerName},

A new meeting has been scheduled.

Details of the meeting:
- Title: ${meeting.title}
- Date & Time: ${formattedDate}
- Location: ${meeting.location || 'N/A'}
- Notes: ${meeting.notes || 'N/A'}
- Client: ${clientName}
- Project: ${projectName}

Best regards,
The UROps Team`;

            console.log(`[REMINDERS] Dispatching email to manager ${manager.email}`);
            await sendRealEmail({
                to: manager.email,
                from: formattedFrom,
                subject: emailSubject,
                body: emailBody
            });

            // 2. Send WhatsApp Reminder
            const whatsappBody = `*Meeting Scheduled Reminder* 📅

*Title:* ${meeting.title}
*Date/Time:* ${formattedDate}
*Location:* ${meeting.location || 'N/A'}
*Notes:* ${meeting.notes || 'N/A'}
*Client:* ${clientName}
*Project:* ${projectName}`;

            // Use manager's phone if set, otherwise fallback to company phone or a placeholder for mock
            const targetPhone = manager.phone || companySettings?.phone || '+27791234567'; // Placeholder mock phone
            
            console.log(`[REMINDERS] Dispatching WhatsApp to manager ${managerName} (${targetPhone})`);
            await sendWhatsAppMessage({
                to: targetPhone,
                body: whatsappBody
            });
        }
    } catch (e) {
        console.error("[REMINDERS ERROR] Failed to send meeting reminders:", e);
    }
}
