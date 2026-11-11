/**
 * Converts any South African phone number format to international 27 format for wa.me links:
 * Example: 0821234567 -> 27821234567
 * Example: +27 82 123 4567 -> 27821234567
 */
export function formatWhatsAppNumberZA(phone?: string | null): string {
    if (!phone) return "";
    const digits = String(phone).replace(/[^0-9]/g, "");
    if (!digits) return "";
    if (digits.startsWith("0027")) {
        return "27" + digits.slice(4);
    }
    if (digits.startsWith("27")) {
        return digits;
    }
    if (digits.startsWith("0") && digits.length === 10) {
        return "27" + digits.slice(1);
    }
    if (digits.length === 9) {
        return "27" + digits;
    }
    return digits;
}

export interface WhatsAppQuickMessage {
    label: string;
    description: string;
    href: string;
    text: string;
}

export function buildWhatsAppQuickMessages(params: {
    phone?: string | null;
    clientName?: string | null;
    quoteNumber?: string | null;
    site?: string | null;
    companyName?: string | null;
    viewUrl?: string | null;
    dateScheduled?: string | null;
}): { waNumber: string; messages: WhatsAppQuickMessage[] } {
    const waNumber = formatWhatsAppNumberZA(params.phone);
    if (!waNumber) {
        return { waNumber: "", messages: [] };
    }

    const name = (params.clientName || "there").trim();
    const quoteNum = (params.quoteNumber || "your quotation").trim();
    const siteClean = (params.site || "").replace(/^site:\s*/i, "").trim();
    const siteText = siteClean ? ` for ${siteClean}` : "";
    const company = (params.companyName || "AeroWash").trim();
    const urlText = params.viewUrl ? ` View quotation: ${params.viewUrl}` : "";
    const schedText = params.dateScheduled ? ` on ${params.dateScheduled}` : "";

    const quoteSentText = `Hi ${name}, your quotation ${quoteNum}${siteText} from ${company} has been sent to your email.${urlText} Please let us know if you have any questions.`;
    const reminderText = `Hi ${name}, following up on quotation ${quoteNum}${siteText} from ${company}. Please let us know if you have any questions or if you would like us to reserve your schedule.`;
    const jobBookedText = `Hi ${name}, your job for quotation ${quoteNum}${siteText} has been confirmed and booked${schedText} with ${company}. We will confirm details prior to attending site.`;

    const messages: WhatsAppQuickMessage[] = [
        {
            label: "Quote sent",
            description: "Notify client quotation was dispatched with link",
            text: quoteSentText,
            href: `https://wa.me/${waNumber}?text=${encodeURIComponent(quoteSentText)}`
        },
        {
            label: "Reminder",
            description: "Follow up on outstanding quotation",
            text: reminderText,
            href: `https://wa.me/${waNumber}?text=${encodeURIComponent(reminderText)}`
        },
        {
            label: "Job booked",
            description: "Confirm job booking and scheduling",
            text: jobBookedText,
            href: `https://wa.me/${waNumber}?text=${encodeURIComponent(jobBookedText)}`
        },
        {
            label: "Blank chat",
            description: "Open direct WhatsApp conversation",
            text: "",
            href: `https://wa.me/${waNumber}`
        }
    ];

    return { waNumber, messages };
}

export async function sendWhatsAppMessage(data: { to: string; body: string }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox number

    console.log(`[WHATSAPP MOCK LOG] Attempting to send message to ${data.to}: "${data.body}"`);

    if (!accountSid || !authToken) {
        console.log(`[WHATSAPP MOCK LOG] Twilio credentials not set in .env. Falling back to mock console output.`);
        console.log(`
====== MOCK WHATSAPP MESSAGE ======
To: ${data.to}
From: ${from}
Message: ${data.body}
==================================
`);
        return { success: true, mock: true };
    }

    try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        // Twilio requires numbers to be prefixed with 'whatsapp:'
        const formattedTo = data.to.startsWith('whatsapp:') ? data.to : `whatsapp:${data.to}`;
        const formattedFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                To: formattedTo,
                From: formattedFrom,
                Body: data.body
            }).toString()
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("[WHATSAPP ERROR] Twilio rejected request:", result);
            return { success: false, error: result.message || "Twilio request failed" };
        }

        console.log(`[WHATSAPP SUCCESS] Twilio Message SID: ${result.sid}`);
        return { success: true, sid: result.sid };
    } catch (e) {
        console.error("[WHATSAPP EXCEPTION] Failed to send message via Twilio:", e);
        return { success: false, error: String(e) };
    }
}
