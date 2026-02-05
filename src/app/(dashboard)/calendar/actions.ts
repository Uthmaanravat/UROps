'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createMeeting(data: {
    title: string
    date: Date
    duration?: number
    location?: string
    notes?: string
    clientId?: string
    projectId?: string
}) {
    try {
        const meeting = await (prisma as any).meeting.create({
            data: {
                title: data.title,
                date: data.date,
                duration: data.duration || 60,
                location: data.location,
                notes: data.notes,
                clientId: data.clientId || null,
                projectId: data.projectId || null
            }
        })

        revalidatePath("/calendar")
        if (data.clientId) revalidatePath(`/clients/${data.clientId}`)
        if (data.projectId) revalidatePath(`/projects/${data.projectId}`)

        return { success: true, data: meeting }
    } catch (error) {
        console.error("Error creating meeting:", error)
        return { success: false, error: "Failed to create meeting" }
    }
}

export async function deleteMeeting(id: string) {
    try {
        await (prisma as any).meeting.delete({
            where: { id }
        })
        revalidatePath("/calendar")
        return { success: true }
    } catch (error) {
        console.error("Error deleting meeting:", error)
        return { success: false, error: "Failed to delete meeting" }
    }
}
