'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ensureAuth } from "@/lib/auth-actions"

export async function createProject(data: {
    name: string
    clientId: string
    description?: string
    startDate?: Date
    endDate?: Date
    status?: string
}) {
    const companyId = await ensureAuth()
    try {
        const project = await prisma.project.create({
            data: {
                companyId,
                name: data.name,
                clientId: data.clientId,
                description: data.description,
                status: data.status || 'PLANNING' as any,
                startDate: data.startDate,
                endDate: data.endDate
            }
        })

        revalidatePath("/projects")
        revalidatePath(`/clients/${data.clientId}`)
        return { success: true, data: project }
    } catch (error) {
        console.error("Error creating project:", error)
        return { success: false, error: "Failed to create project" }
    }
}

export async function updateProject(id: string, data: any) {
    const companyId = await ensureAuth()
    try {
        const project = await prisma.project.update({
            where: { id, companyId },
            data
        })
        revalidatePath(`/projects/${id}`)
        return { success: true, data: project }
    } catch (error) {
        console.error("Error updating project:", error)
        return { success: false, error: "Failed to update project" }
    }
}

export async function deleteProject(id: string) {
    const companyId = await ensureAuth()
    try {
        await prisma.project.delete({
            where: { id, companyId }
        })
        revalidatePath("/projects")
        return { success: true }
    } catch (error) {
        console.error("Error deleting project:", error)
        return { success: false, error: "Failed to delete project" }
    }
}

export async function updateProjectStatus(id: string, status: string) {
    const companyId = await ensureAuth()
    try {
        let finalStatus = status;
        if (status === 'QUOTED') {
            finalStatus = 'SCHEDULED';
        }

        await prisma.project.update({
            where: { id, companyId },
            data: { status: finalStatus as any }
        })

        revalidatePath(`/projects/${id}`)
        return { success: true }
    } catch (error) {
        console.error("Error updating project status:", error)
        return { success: false, error: "Failed to update status" }
    }
}

export async function updateProjectCommercialStatus(id: string, commercialStatus: any) {
    const companyId = await ensureAuth()
    try {
        await (prisma as any).project.update({
            where: { id, companyId },
            data: { commercialStatus }
        })
        revalidatePath("/projects")
        revalidatePath(`/projects/${id}`)
        return { success: true }
    } catch (error) {
        console.error("Error updating commercial status:", error)
        return { success: false, error: "Failed to update commercial status" }
    }
}

export async function updateProjectSchedule(
    id: string,
    data: {
        startDate?: Date | string | null
        endDate?: Date | string | null
        status?: string
    }
) {
    const companyId = await ensureAuth()
    try {
        const updateData: any = {}
        if (data.startDate !== undefined) {
            updateData.startDate = data.startDate ? new Date(data.startDate) : null
        }
        if (data.endDate !== undefined) {
            updateData.endDate = data.endDate ? new Date(data.endDate) : null
        }
        if (data.status) {
            updateData.status = data.status
        }

        const project = await prisma.project.update({
            where: { id, companyId },
            data: updateData
        })

        revalidatePath("/projects")
        revalidatePath(`/projects/${id}`)
        return { success: true, data: project }
    } catch (error) {
        console.error("Error updating project schedule:", error)
        return { success: false, error: "Failed to update project schedule" }
    }
}


import { calculateRecurringDates, type RecurrenceFrequency } from "@/lib/project-recurrence-utils"
export type { RecurrenceFrequency }

export async function createRecurringProjectAction(data: {
    name: string
    clientId: string
    description?: string
    startDate: string
    frequency: RecurrenceFrequency
    interval?: number
    intervalUnit?: 'weeks' | 'months'
    count?: number
    untilDate?: string
    pricePerVisit?: number
    jobSpecs?: any
}) {
    const companyId = await ensureAuth()
    try {
        const start = new Date(data.startDate)
        const recurrenceRule = {
            frequency: data.frequency,
            interval: data.interval || 1,
            intervalUnit: data.intervalUnit || 'months',
            count: data.count,
            untilDate: data.untilDate,
            pricePerVisit: data.pricePerVisit || 0
        }

        // 1. Create Parent Contract Project
        const parentProject = await prisma.project.create({
            data: {
                companyId,
                name: data.name,
                clientId: data.clientId,
                description: data.description,
                status: 'SCHEDULED' as any,
                startDate: start,
                isRecurring: true,
                recurrenceRule,
                jobSpecs: data.jobSpecs || null
            }
        })

        // 2. Automatically generate rolling 12 months of individual visits
        const dates = calculateRecurringDates(start, data.frequency, {
            interval: data.interval,
            intervalUnit: data.intervalUnit,
            count: data.count,
            untilDate: data.untilDate ? new Date(data.untilDate) : undefined
        })

        const visits = []
        for (let i = 0; i < dates.length; i++) {
            const visitDate = dates[i]
            const visitEndDate = new Date(visitDate.getTime() + 8 * 3600 * 1000)
            const visitName = `${data.name} (Visit ${i + 1})`

            const visit = await prisma.project.create({
                data: {
                    companyId,
                    name: visitName,
                    clientId: data.clientId,
                    description: `Recurring contract visit ${i + 1} of ${dates.length} for ${data.name}`,
                    status: 'SCHEDULED' as any,
                    commercialStatus: 'AWAITING_PO' as any,
                    startDate: visitDate,
                    endDate: visitEndDate,
                    parentProjectId: parentProject.id,
                    isRecurring: false,
                    jobSpecs: data.jobSpecs || null
                }
            })

            // If price per visit provided, attach initial quote/invoice
            if (data.pricePerVisit && data.pricePerVisit > 0) {
                try {
                    await prisma.invoice.create({
                        data: {
                            companyId,
                            clientId: data.clientId,
                            projectId: visit.id,
                            type: 'QUOTE',
                            status: 'DRAFT',
                            quoteNumber: `AW-VISIT-${visit.id.substring(0, 6).toUpperCase()}`,
                            total: data.pricePerVisit,
                            subtotal: data.pricePerVisit / 1.15,
                            taxAmount: data.pricePerVisit - (data.pricePerVisit / 1.15),
                            date: visitDate,
                            items: {
                                create: [
                                    {
                                        description: `Routine scheduled exterior facade drone wash - ${visitName}`,
                                        quantity: 1,
                                        unitPrice: data.pricePerVisit / 1.15,
                                        total: data.pricePerVisit / 1.15,
                                        position: 0
                                    }
                                ]
                            }
                        }
                    })
                } catch (invErr) {
                    console.warn("Could not create visit quote:", invErr)
                }
            }

            visits.push(visit)
        }

        revalidatePath("/projects")
        revalidatePath("/calendar")
        revalidatePath(`/clients/${data.clientId}`)
        return { success: true, parentProject, visits }
    } catch (error: any) {
        console.error("Error creating recurring contract:", error)
        return { success: false, error: error.message || "Failed to create recurring project" }
    }
}

export async function rescheduleProjectVisitAction(
    visitId: string,
    newStartDate: string,
    mode: 'THIS_VISIT' | 'ALL_FUTURE_VISITS'
) {
    const companyId = await ensureAuth()
    try {
        const visit = await prisma.project.findUnique({
            where: { id: visitId, companyId }
        })

        if (!visit) return { success: false, error: "Project visit not found" }

        const targetDate = new Date(newStartDate)
        const currentStart = visit.startDate ? new Date(visit.startDate) : new Date()
        const diffMs = targetDate.getTime() - currentStart.getTime()

        if (mode === 'THIS_VISIT' || !visit.parentProjectId) {
            await prisma.project.update({
                where: { id: visitId },
                data: {
                    startDate: targetDate,
                    endDate: new Date(targetDate.getTime() + 8 * 3600 * 1000)
                }
            })
        } else {
            // Shift this visit and all subsequent future visits
            const subsequentVisits = await prisma.project.findMany({
                where: {
                    companyId,
                    parentProjectId: visit.parentProjectId,
                    startDate: { gte: currentStart }
                }
            })

            for (const v of subsequentVisits) {
                if (v.startDate) {
                    const shifted = new Date(v.startDate.getTime() + diffMs)
                    await prisma.project.update({
                        where: { id: v.id },
                        data: {
                            startDate: shifted,
                            endDate: new Date(shifted.getTime() + 8 * 3600 * 1000)
                        }
                    })
                }
            }
        }

        revalidatePath("/projects")
        revalidatePath("/calendar")
        return { success: true }
    } catch (error: any) {
        console.error("Error rescheduling visit:", error)
        return { success: false, error: error.message || "Failed to reschedule" }
    }
}

export async function updateProjectJobSpecsAction(
    projectId: string,
    jobSpecs: any
) {
    const companyId = await ensureAuth()
    try {
        const updated = await prisma.project.update({
            where: { id: projectId, companyId },
            data: { jobSpecs }
        })
        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: updated }
    } catch (error: any) {
        console.error("Error updating job specs:", error)
        return { success: false, error: error.message || "Failed to update specs" }
    }
}
