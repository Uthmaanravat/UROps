'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"

const VALID_STATUSES = [
    "new",
    "contacted",
    "interested",
    "quoted",
    "won",
    "lost",
    "not_interested",
    "follow_up_pending",
    "passed"
]

function addSixMonths(startDate: Date): Date {
    const result = new Date(startDate)
    result.setMonth(result.getMonth() + 6)
    result.setHours(9, 0, 0, 0)
    return result
}

function addWorkingDays(startDate: Date, days: number): Date {
    const result = new Date(startDate)
    let added = 0
    while (added < days) {
        result.setDate(result.getDate() + 1)
        const dayOfWeek = result.getDay()
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            added++
        }
    }
    result.setHours(9, 0, 0, 0)
    return result
}

async function getOwnedProspect(prospectId: string) {
    const companyId = await ensureAuth()
    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } })
    if (!prospect || prospect.companyId !== companyId) {
        throw new Error("Prospect not found or unauthorized")
    }
    return { companyId, prospect }
}

function appendLog(existing: any, entry: { method: string; outcome: string; draft_sent?: string | null; clientId?: string; quoteId?: string; projectId?: string }) {
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
        const isContactStatus = ["contacted", "interested", "quoted", "won", "not_interested"].includes(status)

        const updated = await prisma.prospect.update({
            where: { id: prospectId },
            data: {
                status,
                ...(isContactStatus ? {
                    firstContactDate: prospect.firstContactDate ?? now,
                    lastContactDate: now
                } : {}),
                // Not interested -> automatic 180-day window
                nextFollowupDate: nextFollowupDate
                    ? new Date(nextFollowupDate)
                    : status === "not_interested"
                        ? addSixMonths(now)
                        : status === "won" || status === "passed" || status === "lost"
                            ? null
                            : prospect.nextFollowupDate,
                contactLog: appendLog(prospect.contactLog, {
                    method: "status",
                    outcome: `Status changed to ${status}`
                })
            }
        })

        revalidatePath("/drone"); revalidatePath("/prospects")
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

        revalidatePath("/drone"); revalidatePath("/prospects")
        return { success: true, data: JSON.parse(JSON.stringify(updated)) }
    } catch (error: any) {
        console.error("Error logging prospect contact:", error)
        return { success: false, error: error.message || "Failed to log contact" }
    }
}

export async function setProspectFollowupAction(prospectId: string, date: string | null, title?: string) {
    try {
        const { companyId, prospect } = await getOwnedProspect(prospectId)
        const followupDate = date ? new Date(date) : null

        const updated = await prisma.prospect.update({
            where: { id: prospectId },
            data: {
                nextFollowupDate: followupDate,
                ...(followupDate ? { status: "follow_up_pending" } : {})
            }
        })

        if (followupDate) {
            try {
                await prisma.meeting.create({
                    data: {
                        companyId,
                        title: title || `Follow-up: ${prospect.name}`,
                        date: followupDate,
                        location: prospect.location || undefined,
                        notes: `Sales pipeline follow-up for ${prospect.name}`
                    }
                })
            } catch (mErr) {
                console.warn("Could not create calendar meeting:", mErr)
            }
        }

        revalidatePath("/drone"); revalidatePath("/prospects")
        revalidatePath("/calendar")
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
        revalidatePath("/drone"); revalidatePath("/prospects")
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

        revalidatePath("/drone"); revalidatePath("/prospects")
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

        revalidatePath("/drone"); revalidatePath("/prospects")
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
            return { success: false, error: "Core Target prospects are permanent and cannot be deleted. Mark as 'passed' instead." }
        }

        const { count } = await prisma.prospect.deleteMany({ where: { id: prospectId, companyId: prospect.companyId } })
        if (count === 0) return { success: false, error: 'Prospect not found or unauthorized' }
        revalidatePath("/drone"); revalidatePath("/prospects")
        return { success: true }
    } catch (error: any) {
        console.error("Error deleting prospect:", error)
        return { success: false, error: error.message || "Failed to delete prospect" }
    }
}

// ---- PART 4 PIPELINE & CONVERSION ACTIONS ----

export async function markProspectInterestedAndCreateClientAction(prospectId: string) {
    try {
        const { companyId, prospect } = await getOwnedProspect(prospectId)
        const now = new Date()

        // Match on name first to prevent duplicates
        let client = await prisma.client.findFirst({
            where: {
                companyId,
                name: { equals: prospect.name, mode: 'insensitive' }
            }
        })

        if (!client) {
            client = await prisma.client.create({
                data: {
                    name: prospect.name,
                    companyName: prospect.ownersEntity || prospect.name,
                    email: prospect.propertyManagerEmail || prospect.receptionistEmail || null,
                    phone: prospect.propertyManagerPhone || prospect.companyMainPhone || null,
                    address: prospect.location || null,
                    notes: `Origin: Core Target Prospect ${prospect.name}\n${prospect.notes || ''}`.trim(),
                    tags: ['prospect', 'core-target'],
                    customFields: {
                        prospectId: prospect.id,
                        prospectName: prospect.name,
                        category: prospect.category
                    },
                    companyId
                }
            })
        } else {
            const existingCustom = (client.customFields as any) || {}
            client = await prisma.client.update({
                where: { id: client.id },
                data: {
                    customFields: {
                        ...existingCustom,
                        prospectId: prospect.id,
                        prospectName: prospect.name
                    }
                }
            })
        }

        const updated = await prisma.prospect.update({
            where: { id: prospectId },
            data: {
                status: 'interested',
                firstContactDate: prospect.firstContactDate ?? now,
                lastContactDate: now,
                contactLog: appendLog(prospect.contactLog, {
                    method: 'call',
                    outcome: `Marked Interested. Converted to Client: ${client.name}`,
                    clientId: client.id
                })
            }
        })

        revalidatePath("/drone"); revalidatePath("/prospects")
        revalidatePath("/clients")
        revalidatePath(`/clients/${client.id}`)
        revalidatePath("/dashboard")

        return {
            success: true,
            prospect: JSON.parse(JSON.stringify(updated)),
            client: JSON.parse(JSON.stringify(client))
        }
    } catch (error: any) {
        console.error("Error converting prospect to client:", error)
        return { success: false, error: error.message || "Failed to convert prospect to client" }
    }
}

export async function logResultAction(
    prospectId: string,
    result: 'no_answer' | 'interested' | 'callback' | 'not_interested',
    details?: { date?: string; reason?: string }
) {
    try {
        const { companyId, prospect } = await getOwnedProspect(prospectId)
        const now = new Date()

        if (result === 'no_answer') {
            const nextFollowup = addWorkingDays(now, 2)
            const updated = await prisma.prospect.update({
                where: { id: prospectId },
                data: {
                    status: prospect.status === 'new' ? 'contacted' : prospect.status,
                    firstContactDate: prospect.firstContactDate ?? now,
                    lastContactDate: now,
                    nextFollowupDate: nextFollowup,
                    contactLog: appendLog(prospect.contactLog, {
                        method: 'call',
                        outcome: 'No answer - follow-up set for 2 working days'
                    })
                }
            })

            try {
                await prisma.meeting.create({
                    data: {
                        companyId,
                        title: `Follow-up Call: ${prospect.name}`,
                        date: nextFollowup,
                        location: prospect.location || undefined,
                        notes: `Automated 2-day follow-up after no answer on ${now.toLocaleDateString('en-ZA')}`
                    }
                })
            } catch (mErr) {
                console.warn("Could not create meeting:", mErr)
            }

            revalidatePath("/drone"); revalidatePath("/prospects")
            revalidatePath("/calendar")
            return { success: true, prospect: JSON.parse(JSON.stringify(updated)) }
        }

        if (result === 'interested') {
            return await markProspectInterestedAndCreateClientAction(prospectId)
        }

        if (result === 'callback') {
            const followupDate = details?.date ? new Date(details.date) : addWorkingDays(now, 1)
            const updated = await prisma.prospect.update({
                where: { id: prospectId },
                data: {
                    status: 'follow_up_pending',
                    firstContactDate: prospect.firstContactDate ?? now,
                    lastContactDate: now,
                    nextFollowupDate: followupDate,
                    contactLog: appendLog(prospect.contactLog, {
                        method: 'call',
                        outcome: `Call back scheduled for ${followupDate.toLocaleDateString('en-ZA')}`
                    })
                }
            })

            try {
                await prisma.meeting.create({
                    data: {
                        companyId,
                        title: `Call Back: ${prospect.name}`,
                        date: followupDate,
                        location: prospect.location || undefined,
                        notes: `Scheduled callback for ${prospect.name}`
                    }
                })
            } catch (mErr) {
                console.warn("Could not create meeting:", mErr)
            }

            revalidatePath("/drone"); revalidatePath("/prospects")
            revalidatePath("/calendar")
            return { success: true, prospect: JSON.parse(JSON.stringify(updated)) }
        }

        if (result === 'not_interested') {
            const sixMonths = addSixMonths(now)
            const reason = details?.reason?.trim() || "No specific reason provided"
            const updated = await prisma.prospect.update({
                where: { id: prospectId },
                data: {
                    status: 'not_interested',
                    firstContactDate: prospect.firstContactDate ?? now,
                    lastContactDate: now,
                    nextFollowupDate: sixMonths,
                    contactLog: appendLog(prospect.contactLog, {
                        method: 'call',
                        outcome: `Not interested: ${reason} (Follow-up scheduled in 6 months)`
                    })
                }
            })

            revalidatePath("/drone"); revalidatePath("/prospects")
            return { success: true, prospect: JSON.parse(JSON.stringify(updated)) }
        }

        return { success: false, error: "Invalid result type" }
    } catch (error: any) {
        console.error("Error logging result:", error)
        return { success: false, error: error.message || "Failed to log result" }
    }
}
