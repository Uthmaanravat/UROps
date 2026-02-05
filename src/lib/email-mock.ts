'use server'

import { prisma } from "@/lib/prisma"
import { createInteraction } from "@/app/(dashboard)/clients/[id]/interactions/actions"

export async function sendEmailMock(data: {
    to: string
    subject: string
    body: string
    clientId?: string
    metadata?: any
}) {
    console.log(`[MOCK EMAIL SENT]
To: ${data.to}
Subject: ${data.subject}
Body: ${data.body}
Metadata: ${JSON.stringify(data.metadata)}
`);

    // If clientId is provided, log as interaction
    if (data.clientId) {
        await createInteraction({
            clientId: data.clientId,
            type: "EMAIL",
            content: `Sent Email: ${data.subject}\n\nTo: ${data.to}\n\nSummary: ${data.body.substring(0, 100)}...`
        })
    }

    return { success: true, messageId: "mock-" + Math.random().toString(36).substring(7) }
}
