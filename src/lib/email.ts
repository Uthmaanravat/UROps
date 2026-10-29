import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendRealEmail(data: {
    to: string | string[];
    from?: string;
    replyTo?: string;
    subject: string;
    body: string;
    html?: string;
}) {
    if (!resend) {
        const err = "Email provider not configured. Please add RESEND_API_KEY to your environment variables.";
        console.error("[Email Service]", err);
        return { success: false, error: err };
    }

    try {
        const recipients = Array.isArray(data.to) ? data.to : [data.to];
        // Clean reply-to address
        const rawCompanyEmail = data.replyTo || (data.from?.includes('<') ? data.from.replace(/.*<([^>]+)>.*/, '$1') : data.from) || 'info@aerowash.co.za';
        const replyTo = rawCompanyEmail.includes('@') ? rawCompanyEmail : undefined;

        // Determine initial from address
        let fromAddress = data.from || 'AeroWash <onboarding@resend.dev>';

        let response = await resend.emails.send({
            from: fromAddress,
            replyTo: replyTo,
            to: recipients,
            subject: data.subject,
            text: data.body,
            html: data.html || `<div style="font-family: sans-serif; white-space: pre-wrap;">${data.body}</div>`,
        });

        // If domain is not verified on Resend, automatically fall back to Resend default sender with reply-to
        if (response.error && (response.error.message?.includes('not verified') || response.error.name === 'validation_error')) {
            console.warn(`[Email Service] Domain in "${fromAddress}" not verified on Resend. Falling back to default sender <onboarding@resend.dev> with reply-to: ${replyTo}`);
            
            const displayName = data.from?.includes('<') ? data.from.split('<')[0].trim() : 'UROps';
            const fallbackFrom = `${displayName} <onboarding@resend.dev>`;

            response = await resend.emails.send({
                from: fallbackFrom,
                replyTo: replyTo,
                to: recipients,
                subject: data.subject,
                text: data.body,
                html: data.html || `<div style="font-family: sans-serif; white-space: pre-wrap;">${data.body}</div>`,
            });
        }

        // Handle Resend sandbox restriction: if domain is unverified and recipient is not account owner,
        // reroute to verified account owner (utiravat@gmail.com) so notifications never get lost in testing
        if (response.error && response.error.message?.includes('testing emails to your own email address')) {
            console.warn(`[Email Service] Sandbox mode: rerouting to registered account owner (utiravat@gmail.com) for recipients [${recipients.join(', ')}]`);
            const sandboxSubject = `[Sandbox Delivery for ${recipients.join(', ')}] ${data.subject}`;
            const sandboxNote = `\n\n---\n[Resend Notice: Delivered to utiravat@gmail.com because aerowash.co.za DNS records are pending verification. Intended recipient: ${recipients.join(', ')}]`;
            
            const sandboxResponse = await resend.emails.send({
                from: 'AeroWash <onboarding@resend.dev>',
                replyTo: replyTo,
                to: ['utiravat@gmail.com'],
                subject: sandboxSubject,
                text: data.body + sandboxNote,
                html: `<div style="background: #fff3cd; color: #856404; padding: 12px; margin-bottom: 16px; border-radius: 6px; font-family: sans-serif; font-size: 13px;">
                    <strong>Resend Sandbox Delivery:</strong> Delivered to <code>utiravat@gmail.com</code> because <code>aerowash.co.za</code> DNS records are pending verification.<br/>
                    <strong>Intended Recipient(s):</strong> ${recipients.join(', ')}
                </div>` + (data.html || `<div style="font-family: sans-serif; white-space: pre-wrap;">${data.body}</div>`),
            });

            if (!sandboxResponse.error) {
                return {
                    success: true,
                    id: sandboxResponse.data?.id,
                    sandboxRerouted: true,
                    deliveredTo: 'utiravat@gmail.com',
                    note: `Delivered to registered Resend account (utiravat@gmail.com) while aerowash.co.za DNS verification is pending.`
                };
            }
        }

        if (response.error) {
            console.error("[Email Service] Resend Error:", response.error);
            return { success: false, error: response.error.message };
        }

        return { success: true, id: response.data?.id };
    } catch (error) {
        console.error("[Email Service] Failed to send real email:", error);
        return { success: false, error: String(error) };
    }
}
