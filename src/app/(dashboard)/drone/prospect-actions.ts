'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"

const VALID_STATUSES = ["new", "contacted", "interested", "not_interested", "follow_up_pending", "won", "passed"]

async function getOwnedProspect(prospectId: string) {
    const companyId = await ensureAuth()
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } })
    if (!prospect || prospect.companyId !== companyId) {
        throw new Error("Prospect not found or unauthorized")
    }
    return { companyId, prospect }
}

function appendLog(existing: any, entry: { method: string; outcome: string; draft_sent?: string | null }) {
    const log = Array.isArray(existing) ? existing : []
    return [...log, { date: new Date().toISOString(), ...entry }]
}

export async function updateProspectStatusAction(
    prospectId: string,
    status: string,
    nextFollowupDate?: string | null
) {
    try {
        if (!VALID_STATUSES.includes(status)) {
            return { success: false, error: `Invalid status: ${status}` }
        }
        const { prospect } = await getOwnedProspect(prospectId)

        const now = new Date()
        const isContactStatus = ["contacted", "interested", "not_interested", "won"].includes(status)

        const updated = await prisma.prospect.update({
            where: { id: prospectId },
            data: {
                status,
                ...(isContactStatus ? {
                    firstContactDate: prospect.firstContactDate ?? now,
                    lastContactDate: now
                } : {}),
                // Not interested → automatic 90-day recontact window
                nextFollowupDate: nextFollowupDate
                    ? new Date(nextFollowupDate)
                    : status === "not_interested"
                        ? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
                        : status === "won" || status === "passed"
                            ? null
                            : prospect.nextFollowupDate,
                contactLog: appendLog(prospect.contactLog, {
                    method: "status",
                    outcome: `Status changed to ${status}`
                })
            }
        })

        revalidatePath("/drone")
        return { success: true, data: JSON.parse(JSON.stringify(updated)) }
    } catch (error: any) {
        console.error("Error updating prospect status:", error)
        return { success: false, error: error.message || "Failed to update status" }
    }
}

export async function logProspectContactAction(
    prospectId: string,
    method: "email" | "call" | "whatsapp",
    outcome: string,
    draftSent?: string | null
) {
    try {
        const { prospect } = await getOwnedProspect(prospectId)
        const now = new Date()

        const updated = await prisma.prospect.update({
            where: { id: prospectId },
            data: {
                firstContactDate: prospect.firstContactDate ?? now,
                lastContactDate: now,
                status: prospect.status === "new" ? "contacted" : prospect.status,
                contactLog: appendLog(prospect.contactLog, {
                    method,
                    outcome,
                    draft_sent: draftSent ?? null
                })
            }
        })

        revalidatePath("/drone")
        return { success: true, data: JSON.parse(JSON.stringify(updated)) }
    } catch (error: any) {
        console.error("Error logging prospect contact:", error)
        return { success: false, error: error.message || "Failed to log contact" }
    }
}

export async function setProspectFollowupAction(prospectId: string, date: string | null) {
    try {
        await getOwnedProspect(prospectId)
        const updated = await prisma.prospect.update({
            where: { id: prospectId },
            data: {
                nextFollowupDate: date ? new Date(date) : null,
                ...(date ? { status: "follow_up_pending" } : {})
            }
        })
        revalidatePath("/drone")
        return { success: true, data: JSON.parse(JSON.stringify(updated)) }
    } catch (error: any) {
        console.error("Error setting prospect follow-up:", error)
        return { success: false, error: error.message || "Failed to set follow-up" }
    }
}

export async function saveProspectNotesAction(prospectId: string, notes: string) {
    try {
        await getOwnedProspect(prospectId)
        const updated = await prisma.prospect.update({
            where: { id: prospectId },
            data: { notes }
        })
        revalidatePath("/drone")
        return { success: true, data: JSON.parse(JSON.stringify(updated)) }
    } catch (error: any) {
        console.error("Error saving prospect notes:", error)
        return { success: false, error: error.message || "Failed to save notes" }
    }
}

export interface ProspectInput {
    name: string
    location?: string
    ownersEntity?: string
    propertyManagerName?: string
    propertyManagerEmail?: string
    propertyManagerPhone?: string
    receptionistEmail?: string
    companyMainPhone?: string
    category?: string
    accessMoat?: string
    whyDronesMatter?: string
    estimatedValue?: string
    notes?: string
}

const clean = (v?: string) => {
    const t = (v ?? "").trim()
    return t.length > 0 ? t : null
}

export async function addProspectAction(input: ProspectInput) {
    try {
        const companyId = await ensureAuth()
        if (!input.name?.trim()) {
            return { success: false, error: "Building name is required" }
        }

        const created = await prisma.prospect.create({
            data: {
                name: input.name.trim(),
                location: clean(input.location),
                ownersEntity: clean(input.ownersEntity),
                propertyManagerName: clean(input.propertyManagerName),
                propertyManagerEmail: clean(input.propertyManagerEmail),
                propertyManagerPhone: clean(input.propertyManagerPhone),
                receptionistEmail: clean(input.receptionistEmail),
                companyMainPhone: clean(input.companyMainPhone),
                category: clean(input.category) ?? "Niche",
                accessMoat: clean(input.accessMoat),
                whyDronesMatter: clean(input.whyDronesMatter),
                estimatedValue: clean(input.estimatedValue) ?? "medium",
                notes: input.notes?.trim() ?? "",
                status: "new",
                source: "user_discovery",
                contactLog: [],
                companyId
            }
        })

        revalidatePath("/drone")
        return { success: true, data: JSON.parse(JSON.stringify(created)) }
    } catch (error: any) {
        console.error("Error adding prospect:", error)
        return { success: false, error: error.message || "Failed to add prospect" }
    }
}

export async function updateProspectDetailsAction(prospectId: string, input: ProspectInput) {
    try {
        await getOwnedProspect(prospectId)
        if (!input.name?.trim()) {
            return { success: false, error: "Building name is required" }
        }

        const updated = await prisma.prospect.update({
            where: { id: prospectId },
            data: {
                name: input.name.trim(),
                location: clean(input.location),
                ownersEntity: clean(input.ownersEntity),
                propertyManagerName: clean(input.propertyManagerName),
                propertyManagerEmail: clean(input.propertyManagerEmail),
                propertyManagerPhone: clean(input.propertyManagerPhone),
                receptionistEmail: clean(input.receptionistEmail),
                companyMainPhone: clean(input.companyMainPhone),
                category: clean(input.category) ?? "Niche",
                accessMoat: clean(input.accessMoat),
                whyDronesMatter: clean(input.whyDronesMatter),
                estimatedValue: clean(input.estimatedValue) ?? "medium"
            }
        })

        revalidatePath("/drone")
        return { success: true, data: JSON.parse(JSON.stringify(updated)) }
    } catch (error: any) {
        console.error("Error updating prospect details:", error)
        return { success: false, error: error.message || "Failed to update prospect" }
    }
}

export async function deleteProspectAction(prospectId: string) {
    try {
        const { prospect } = await getOwnedProspect(prospectId)
        if (prospect.source === "fable_37") {
            return { success: false, error: "Fable-37 prospects are permanent and cannot be deleted. Mark as 'passed' instead." }
        }

        await prisma.prospect.delete({ where: { id: prospectId } })
        revalidatePath("/drone")
        return { success: true }
    } catch (error: any) {
        console.error("Error deleting prospect:", error)
        return { success: false, error: error.message || "Failed to delete prospect" }
    }
}
