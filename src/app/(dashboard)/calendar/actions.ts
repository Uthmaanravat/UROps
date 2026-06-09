'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"
import { sendMeetingReminders } from "@/lib/reminders"

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
        const companyId = await ensureAuth()

        const meeting = await prisma.meeting.create({
            data: {
                companyId,
                title: data.title,
                date: data.date,
                duration: data.duration || 60,
                location: data.location,
                notes: data.notes,
                clientId: data.clientId || null,
                projectId: data.projectId || null
            }
        })

        // Dispatch email and WhatsApp reminders to managers asynchronously
        try {
            await sendMeetingReminders(meeting.id)
        } catch (reminderError) {
            console.error("Failed to send meeting reminders:", reminderError)
        }

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
        const companyId = await ensureAuth()

        await prisma.meeting.deleteMany({
            where: {
                id,
                companyId
            }
        })
        revalidatePath("/calendar")
        return { success: true }
    } catch (error) {
        console.error("Error deleting meeting:", error)
        return { success: false, error: "Failed to delete meeting" }
    }
}

