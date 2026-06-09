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
