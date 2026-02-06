'use server'

import { getAuthCompanyId } from "@/lib/auth-actions"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { InteractionType } from "@prisma/client"

export async function createInteraction(data: {
    clientId: string
    type: string
    content: string
    date?: Date
}) {
    // Basic validation
    if (!data.content || !data.clientId) {
        return { success: false, error: "Missing required fields" }
    }

    const companyId = await getAuthCompanyId();
    if (!companyId) {
        return { success: false, error: "Unauthorized" }
    }

    try {
        const interaction = await prisma.interaction.create({
            data: {
                clientId: data.clientId,
                companyId,
                type: data.type as InteractionType, // unsafe cast if not validated, but UI provides valid types
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
    try {
        await prisma.interaction.delete({
            where: { id }
        })
        revalidatePath(`/clients/${clientId}`)
        return { success: true }
    } catch (error) {
        console.error("Error deleting interaction:", error)
        return { success: false, error: "Failed to delete interaction" }
    }
}
