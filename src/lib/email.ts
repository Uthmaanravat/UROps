import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendRealEmail(data: {
    to: string | string[];
    from?: string;
    subject: string;
    body: string;
    html?: string;
}) {
    if (!resend) {
        console.warn("RESEND_API_KEY is not set. Email not sent.");
        return {
            success: false,
            error: "Email provider not configured. Please add RESEND_API_KEY to your .env file. You can get a free key at resend.com"
        };
    }

    try {
        const fromAddress = data.from || 'UROps <onboarding@resend.dev>';

        const response = await resend.emails.send({
            from: fromAddress,
            to: Array.isArray(data.to) ? data.to : [data.to],
            subject: data.subject,
            text: data.body,
            html: data.html || `<div style="font-family: sans-serif; white-space: pre-wrap;">${data.body}</div>`,
        });

        if (response.error) {
            console.error("Resend Error:", response.error);
            return { success: false, error: response.error.message };
        }

        return { success: true, id: response.data?.id };
    } catch (error) {
        console.error("Failed to send real email:", error);
        return { success: false, error: String(error) };
    }
}
