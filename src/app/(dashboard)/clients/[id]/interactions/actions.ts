'use server'

import { getAuthCompanyId, ensureAuth } from "@/lib/auth-actions"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { InteractionType } from "@prisma/client"

export async function createInteraction(data: {
    clientId: string
    type: string
    content: string
    date?: Date
}) {
    if (!data.content || !data.clientId) {
        return { success: false, error: "Missing required fields" }
    }

    const companyId = await ensureAuth()

    // Verify client belongs to this company
    const client = await prisma.client.findFirst({
        where: { id: data.clientId, companyId }
    })
    if (!client) {
        return { success: false, error: "Client not found or unauthorized" }
    }

    try {
        const interaction = await prisma.interaction.create({
            data: {
                clientId: data.clientId,
                companyId,
                type: data.type as InteractionType,
                content: data.content,
                date: data.date || new Date()
            }
        })

        revalidatePath(`/clients/${data.clientId}`)
        return { success: true, data: interaction }
    } catch (error) {
        console.error("Error creating interaction:", error)
        return { success: false, error: "Failed to create interaction" }
    }
}

export async function deleteInteraction(id: string, clientId: string) {
    const companyId = await ensureAuth()

    try {
        // Enforce companyId scoping on delete
        const result = await prisma.interaction.deleteMany({
            where: { id, companyId }
        })
        if (result.count === 0) {
            return { success: false, error: "Interaction not found or unauthorized" }
        }
        revalidatePath(`/clients/${clientId}`)
        return { success: true }
    } catch (error) {
        console.error("Error deleting interaction:", error)
        return { success: false, error: "Failed to delete interaction" }
    }
}
