'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth, getAuthUser } from "@/lib/auth-actions"
import { uploadQuotePhoto, getSignedPhotoUrl } from "@/lib/supabase-storage"
import { suggestNextAvailableJobDate, getOpenMeteoSiteForecastForDate, evaluateFlightWeatherStatus } from "@/lib/weather"
import { isVatEffective, getVatRate, calculateVatAndTotal } from "@/lib/vat-utils"
import { sendRealEmail } from "@/lib/email"

export interface PreFlightChecklistState {
    weatherChecked: boolean
    exclusionZoneSetUp: boolean
    ppeOn: boolean
    spotterInPosition: boolean
    aircraftCheck: boolean
    waterPumpPressurised: boolean
}

const REQUIRED_CHECKLIST_KEYS: Array<keyof PreFlightChecklistState> = [
    "weatherChecked",
    "exclusionZoneSetUp",
    "ppeOn",
    "spotterInPosition",
    "aircraftCheck",
    "waterPumpPressurised"
]

function isChecklistComplete(c?: Partial<PreFlightChecklistState> | null): boolean {
    if (!c) return false
    return REQUIRED_CHECKLIST_KEYS.every(k => c[k] === true)
}

async function authorizeProjectForCaller(projectId: string) {
    const companyId = await ensureAuth()
    const authUser = await getAuthUser()
    if (!authUser || authUser.companyId !== companyId) {
        throw new Error("Unauthorized")
    }

    const project = await prisma.project.findFirst({
        where: { id: projectId, companyId },
        include: {
            client: true,
            jobSheet: true,
            parentProject: {
                include: {
                    invoices: {
                        where: { type: 'QUOTE' },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            },
            invoices: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!project) {
        throw new Error("Job not found")
    }

    if (authUser.role === 'CREW') {
        const assigned = project.assignedCrewIds || []
        if (!assigned.includes(authUser.id) && project.pilotUserId !== authUser.id) {
            throw new Error("Access denied: You are not assigned to this job.")
        }
    }

    return { companyId, authUser, project }
}

async function getNotificationRecipients(companyId: string) {
    const [owners, settings] = await Promise.all([
        prisma.user.findMany({
            where: {
                companyId,
                OR: [{ isOwner: true }, { role: 'ADMIN' }]
            },
            select: { email: true, notificationEmail: true }
        }),
        prisma.companySettings.findUnique({ where: { companyId } })
    ])

    const emails = Array.from(
        new Set([
            ...owners.map(o => (o.notificationEmail || o.email || '').trim()).filter(Boolean),
            ...(settings?.copyNotificationsTo ? [settings.copyNotificationsTo.trim()] : [])
        ])
    )
    return { emails, settings }
}

export async function assignCrewAndAircraftAction(input: {
    projectId: string
    assignedCrewIds: string[]
    pilotUserId?: string | null
    droneId?: string | null
    applyToFutureVisits?: boolean
}) {
    try {
        const companyId = await ensureAuth()
        const authUser = await getAuthUser()
        if (!authUser || authUser.role === 'CREW') {
            return { success: false, error: "Only administrators or managers can assign crew." }
        }

        const project = await prisma.project.findFirst({
            where: { id: input.projectId, companyId }
        })
        if (!project) return { success: false, error: "Project not found." }

        const cleanCrewIds = Array.from(
            new Set([
                ...(input.assignedCrewIds || []),
                ...(input.pilotUserId ? [input.pilotUserId] : [])
            ].filter(Boolean))
        )

        await prisma.project.update({
            where: { id: project.id },
            data: {
                assignedCrewIds: cleanCrewIds,
                pilotUserId: input.pilotUserId || null,
                droneId: input.droneId || null
            }
        })

        await prisma.jobSheet.upsert({
            where: { projectId: project.id },
            update: {
                pilotUserId: input.pilotUserId || null,
                droneId: input.droneId || null
            },
            create: {
                companyId,
                projectId: project.id,
                pilotUserId: input.pilotUserId || null,
                droneId: input.droneId || null
            }
        })

        // Optionally apply crew/pilot/drone to future recurring visits
        if (input.applyToFutureVisits) {
            const parentId = project.isRecurring ? project.id : project.parentProjectId
            if (parentId) {
                await prisma.project.updateMany({
                    where: {
                        companyId,
                        parentProjectId: parentId,
                        status: { notIn: ['COMPLETED', 'CANCELLED', 'PAID'] as any }
                    },
                    data: {
                        assignedCrewIds: cleanCrewIds,
                        pilotUserId: input.pilotUserId || null,
                        droneId: input.droneId || null
                    }
                })
            }
        }

        revalidatePath(`/projects/${project.id}`)
        revalidatePath("/projects")
        revalidatePath("/my-jobs")
        revalidatePath(`/my-jobs/${project.id}`)
        return { success: true }
    } catch (e: any) {
        console.error("assignCrewAndAircraftAction error:", e)
        return { success: false, error: e.message || "Failed to assign crew" }
    }
}

export async function saveJobPreFlightAndMetaAction(input: {
    projectId: string
    checklist?: Partial<PreFlightChecklistState>
    pilotUserId?: string | null
    droneId?: string | null
    elevationFlights?: Record<string, { flightStart?: string; flightEnd?: string; durationMinutes?: number }>
    totalFlightMinutes?: number | null
    issuesNotes?: string
}) {
    try {
        const { companyId, project } = await authorizeProjectForCaller(input.projectId)
        const existing = project.jobSheet

        const updatePayload: any = {}
        if (input.checklist !== undefined) {
            updatePayload.checklist = {
                ...((existing?.checklist as any) || {}),
                ...input.checklist
            }
        }
        if (input.pilotUserId !== undefined) updatePayload.pilotUserId = input.pilotUserId || null
        if (input.droneId !== undefined) updatePayload.droneId = input.droneId || null
        if (input.elevationFlights !== undefined) updatePayload.elevationFlights = input.elevationFlights
        if (input.totalFlightMinutes !== undefined) updatePayload.totalFlightMinutes = input.totalFlightMinutes
        if (input.issuesNotes !== undefined) updatePayload.issuesNotes = input.issuesNotes

        const sheet = await prisma.jobSheet.upsert({
            where: { projectId: project.id },
            update: updatePayload,
            create: {
                companyId,
                projectId: project.id,
                ...updatePayload
            }
        })

        return { success: true, jobSheetId: sheet.id }
    } catch (e: any) {
        console.error("saveJobPreFlightAndMetaAction error:", e)
        return { success: false, error: e.message || "Failed to save job sheet" }
    }
}

export async function startJobAction(input: {
    projectId: string
    checklist: PreFlightChecklistState
    pilotUserId?: string | null
    droneId?: string | null
}) {
    try {
        const { companyId, authUser, project } = await authorizeProjectForCaller(input.projectId)

        if (!isChecklistComplete(input.checklist)) {
            return {
                success: false,
                error: "All 6 pre-flight checklist items must be ticked before starting the job."
            }
        }

        const now = new Date()
        const existing = project.jobSheet
        const prevLogs = Array.isArray(existing?.timeLogs) ? (existing!.timeLogs as any[]) : []

        // Snapshot current site forecast at job start
        const settings = await prisma.companySettings.findUnique({ where: { companyId } })
        const siteStr = project.invoices?.[0]?.site || project.client?.address || project.name
        const forecast = await getOpenMeteoSiteForecastForDate(siteStr, project.startDate || now)
        const evaluatedWeather = evaluateFlightWeatherStatus(forecast, settings as any)

        const checklistRecord = {
            ...input.checklist,
            completedAt: now.toISOString(),
            completedBy: authUser.name || authUser.email
        }

        const nextLogs = [
            ...prevLogs,
            {
                action: existing?.startedAt ? "RESUME" : "START",
                timestamp: now.toISOString(),
                actorId: authUser.id,
                actorName: authUser.name || authUser.email
            }
        ]

        await prisma.$transaction([
            prisma.jobSheet.upsert({
                where: { projectId: project.id },
                update: {
                    status: "IN_PROGRESS",
                    checklist: checklistRecord,
                    startedAt: existing?.startedAt || now,
                    pilotUserId: input.pilotUserId || existing?.pilotUserId || authUser.id,
                    droneId: input.droneId !== undefined ? (input.droneId || null) : existing?.droneId,
                    timeLogs: nextLogs,
                    weatherSnapshot: evaluatedWeather as any
                },
                create: {
                    companyId,
                    projectId: project.id,
                    status: "IN_PROGRESS",
                    checklist: checklistRecord,
                    startedAt: now,
                    pilotUserId: input.pilotUserId || authUser.id,
                    droneId: input.droneId || null,
                    timeLogs: nextLogs,
                    weatherSnapshot: evaluatedWeather as any
                }
            }),
            prisma.project.update({
                where: { id: project.id },
                data: { status: "IN_PROGRESS" }
            })
        ])

        revalidatePath("/my-jobs")
        revalidatePath(`/my-jobs/${project.id}`)
        revalidatePath(`/projects/${project.id}`)
        revalidatePath("/projects")
        return { success: true, startedAt: now.toISOString() }
    } catch (e: any) {
        console.error("startJobAction error:", e)
        return { success: false, error: e.message || "Failed to start job" }
    }
}

export async function pauseJobAction(input: {
    projectId: string
    reason: "WIND" | "RAIN" | "CLIENT_REQUEST" | "ACCESS"
    note?: string
}) {
    try {
        const { companyId, authUser, project } = await authorizeProjectForCaller(input.projectId)
        const now = new Date()
        const existing = project.jobSheet
        const prevLogs = Array.isArray(existing?.timeLogs) ? (existing!.timeLogs as any[]) : []

        const nextLogs = [
            ...prevLogs,
            {
                action: "PAUSE",
                reason: input.reason,
                note: input.note?.trim() || null,
                timestamp: now.toISOString(),
                actorId: authUser.id,
                actorName: authUser.name || authUser.email
            }
        ]

        const isWeatherReason = input.reason === "WIND" || input.reason === "RAIN"
        const isStandbyReason = input.reason === "CLIENT_REQUEST" || input.reason === "ACCESS"

        const updateData: any = {
            status: "PAUSED",
            timeLogs: nextLogs
        }

        if (isStandbyReason) {
            updateData.standbyFlagged = true
            updateData.standbyReason = input.reason
            updateData.standbyNotes = input.note?.trim() || null
            updateData.standbyStatus = "PENDING_APPROVAL"
        }

        await prisma.jobSheet.upsert({
            where: { projectId: project.id },
            update: updateData,
            create: {
                companyId,
                projectId: project.id,
                ...updateData
            }
        })

        let suggestedDate: string | null = null
        let suggestedWeatherSummary: string | null = null

        if (isWeatherReason) {
            const [scheduledJobs, settings] = await Promise.all([
                prisma.project.findMany({
                    where: {
                        companyId,
                        id: { not: project.id },
                        startDate: { gte: now },
                        status: { in: ["SCHEDULED", "IN_PROGRESS"] as any }
                    },
                    select: { startDate: true }
                }),
                prisma.companySettings.findUnique({ where: { companyId } })
            ])
            const busyDates = scheduledJobs
                .map(j => j.startDate ? new Date(j.startDate).toISOString().split("T")[0] : "")
                .filter(Boolean)

            const siteStr = project.invoices?.[0]?.site || project.client?.address || project.name
            const suggestion = await suggestNextAvailableJobDate({
                fromDate: project.startDate ? new Date(project.startDate) : now,
                busyDateStrings: busyDates,
                addressOrSite: siteStr,
                limits: settings as any
            })
            suggestedDate = suggestion.suggestedDate
            const sf = suggestion.evaluated.forecast
            suggestedWeatherSummary = sf
                ? `${suggestion.evaluated.badgeLabel} · Wind ${sf.windSpeedKmh} km/h (gusts ${sf.windGustsKmh} km/h), Rain ${sf.rainMm} mm`
                : suggestion.evaluated.badgeLabel
        }

        if (isStandbyReason) {
            const { emails } = await getNotificationRecipients(companyId)
            const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ur-ops.vercel.app"
            if (emails.length > 0) {
                await sendRealEmail({
                    to: emails,
                    from: "AeroWash Flight Ops <info@aerowash.co.za>",
                    replyTo: "info@aerowash.co.za",
                    subject: `Standby / Return Attendance Flagged: ${project.name}`,
                    body:
                        `A site job was paused due to ${input.reason === "ACCESS" ? "Site Access Unavailable" : "Client Stop Request"}.\n\n` +
                        `Job: ${project.name}\n` +
                        `Client: ${project.client?.name || "Client"}\n` +
                        `Crew Member: ${authUser.name || authUser.email}\n` +
                        `Crew Note: ${input.note?.trim() || "None provided"}\n\n` +
                        `Per AeroWash Commercial Terms, a Standby / Return Attendance charge has been flagged for your approval:\n` +
                        `${appUrl}/projects/${project.id}\n`
                }).catch(err => console.warn("Standby email warning:", err))
            }
        }

        revalidatePath("/my-jobs")
        revalidatePath(`/my-jobs/${project.id}`)
        revalidatePath(`/projects/${project.id}`)
        revalidatePath("/", "layout")
        return {
            success: true,
            isWeatherReason,
            isStandbyReason,
            suggestedDate,
            suggestedWeatherSummary
        }
    } catch (e: any) {
        console.error("pauseJobAction error:", e)
        return { success: false, error: e.message || "Failed to pause job" }
    }
}

export async function resumeJobAction(projectId: string) {
    try {
        const { authUser, project } = await authorizeProjectForCaller(projectId)
        const now = new Date()
        const existing = project.jobSheet
        const prevLogs = Array.isArray(existing?.timeLogs) ? (existing!.timeLogs as any[]) : []

        await prisma.$transaction([
            prisma.jobSheet.update({
                where: { projectId: project.id },
                data: {
                    status: "IN_PROGRESS",
                    timeLogs: [
                        ...prevLogs,
                        {
                            action: "RESUME",
                            timestamp: now.toISOString(),
                            actorId: authUser.id,
                            actorName: authUser.name || authUser.email
                        }
                    ]
                }
            }),
            prisma.project.update({
                where: { id: project.id },
                data: { status: "IN_PROGRESS" }
            })
        ])

        revalidatePath("/my-jobs")
        revalidatePath(`/my-jobs/${project.id}`)
        revalidatePath(`/projects/${project.id}`)
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to resume job" }
    }
}

export async function rescheduleWeatherPausedJobAction(input: {
    projectId: string
    newDateStr: string // YYYY-MM-DD
}) {
    try {
        const { companyId, authUser, project } = await authorizeProjectForCaller(input.projectId)
        if (!input.newDateStr) {
            return { success: false, error: "Please select a reschedule date." }
        }

        const newStart = new Date(`${input.newDateStr}T08:00:00.000+02:00`)
        const newEnd = new Date(`${input.newDateStr}T16:00:00.000+02:00`)
        const now = new Date()
        const existing = project.jobSheet
        const prevLogs = Array.isArray(existing?.timeLogs) ? (existing!.timeLogs as any[]) : []

        await prisma.$transaction([
            prisma.project.update({
                where: { id: project.id },
                data: {
                    startDate: newStart,
                    endDate: newEnd,
                    status: "SCHEDULED"
                }
            }),
            prisma.jobSheet.upsert({
                where: { projectId: project.id },
                update: {
                    status: "RESCHEDULED",
                    // Reset pre-flight checklist so crew re-verifies safety on the new flight day
                    checklist: {
                        weatherChecked: false,
                        exclusionZoneSetUp: false,
                        ppeOn: false,
                        spotterInPosition: false,
                        aircraftCheck: false,
                        waterPumpPressurised: false
                    },
                    timeLogs: [
                        ...prevLogs,
                        {
                            action: "RESCHEDULE_WEATHER",
                            targetDate: input.newDateStr,
                            note: "Rescheduled due to unsafe wind/rain — No charge (per AeroWash weather term)",
                            timestamp: now.toISOString(),
                            actorId: authUser.id,
                            actorName: authUser.name || authUser.email
                        }
                    ]
                },
                create: {
                    companyId,
                    projectId: project.id,
                    status: "RESCHEDULED"
                }
            })
        ])

        const { emails } = await getNotificationRecipients(companyId)
        if (emails.length > 0) {
            await sendRealEmail({
                to: emails,
                from: "AeroWash Flight Ops <info@aerowash.co.za>",
                replyTo: "info@aerowash.co.za",
                subject: `Weather Reschedule (No Charge): ${project.name} -> ${input.newDateStr}`,
                body:
                    `Job "${project.name}" (${project.client?.name || "Client"}) was paused on site for weather and rescheduled to ${input.newDateStr} at no charge per the AeroWash weather term.\n\n` +
                    `Recorded by: ${authUser.name || authUser.email}\n`
            }).catch(() => null)
        }

        revalidatePath("/my-jobs")
        revalidatePath(`/my-jobs/${project.id}`)
        revalidatePath("/calendar")
        revalidatePath("/projects")
        revalidatePath(`/projects/${project.id}`)
        return { success: true, newDateStr: input.newDateStr }
    } catch (e: any) {
        console.error("rescheduleWeatherPausedJobAction error:", e)
        return { success: false, error: e.message || "Failed to reschedule job" }
    }
}

export async function uploadJobPhotoAction(input: {
    projectId: string
    photoId: string
    kind: "ELEVATION_BEFORE" | "ELEVATION_AFTER" | "ISSUE"
    elevationKey?: string
    caption?: string
    dataUrl: string
    takenAt: string
}) {
    try {
        const { companyId, project } = await authorizeProjectForCaller(input.projectId)
        if (!input.dataUrl || !input.dataUrl.startsWith("data:image/")) {
            return { success: false, error: "Invalid image payload" }
        }

        const safeElev = (input.elevationKey || "general").replace(/[^a-zA-Z0-9_-]/g, "_")
        const filename = `${input.kind.toLowerCase()}_${safeElev}_${input.photoId}.jpg`
        const storagePath = await uploadQuotePhoto(
            companyId,
            `jobs/${project.id}`,
            filename,
            input.dataUrl
        )

        const existing = await prisma.jobSheet.findUnique({
            where: { projectId: project.id }
        })

        const photoEntry = {
            id: input.photoId,
            path: storagePath,
            caption: input.caption || "",
            takenAt: input.takenAt
        }

        if (input.kind === "ISSUE") {
            const prevIssues = Array.isArray(existing?.issuePhotos) ? (existing!.issuePhotos as any[]) : []
            const deduped = prevIssues.filter(p => p.id !== input.photoId)
            const nextIssues = [...deduped, photoEntry]

            await prisma.jobSheet.upsert({
                where: { projectId: project.id },
                update: { issuePhotos: nextIssues },
                create: { companyId, projectId: project.id, issuePhotos: nextIssues }
            })
        } else {
            const key = input.elevationKey || "Elevation 1"
            const prevMap = ((existing?.elevationPhotos as any) || {}) as Record<string, { before?: any[]; after?: any[] }>
            const currentSlot = prevMap[key] || { before: [], after: [] }
            const slotName = input.kind === "ELEVATION_BEFORE" ? "before" : "after"
            const existingList = Array.isArray(currentSlot[slotName]) ? currentSlot[slotName]! : []
            const deduped = existingList.filter((p: any) => p.id !== input.photoId)

            const nextMap = {
                ...prevMap,
                [key]: {
                    ...currentSlot,
                    [slotName]: [...deduped, photoEntry]
                }
            }

            await prisma.jobSheet.upsert({
                where: { projectId: project.id },
                update: { elevationPhotos: nextMap },
                create: { companyId, projectId: project.id, elevationPhotos: nextMap }
            })
        }

        const signedUrl = await getSignedPhotoUrl(storagePath)
        return {
            success: true,
            photo: {
                ...photoEntry,
                signedUrl
            }
        }
    } catch (e: any) {
        console.error("uploadJobPhotoAction error:", e)
        return { success: false, error: e.message || "Photo upload failed" }
    }
}

export async function finishJobAction(input: {
    projectId: string
    pilotUserId?: string | null
    droneId?: string | null
    elevationFlights?: Record<string, { flightStart?: string; flightEnd?: string; durationMinutes?: number }>
    totalFlightMinutes?: number | null
    issuesNotes?: string
    signOffName?: string
    signOffSignature?: string
    clientUnavailable?: boolean
    clientUnavailableReason?: string
    pendingOfflinePhotosCount?: number
    crewConfirmedPendingPhotos?: boolean
}) {
    try {
        const { companyId, authUser, project } = await authorizeProjectForCaller(input.projectId)

        // 1. Offline Photo Queue Gate
        if ((input.pendingOfflinePhotosCount || 0) > 0 && !input.crewConfirmedPendingPhotos) {
            return {
                success: false,
                error: `${input.pendingOfflinePhotosCount} photo(s) are still waiting to upload. Wait for upload or tick the confirmation box to finish anyway.`
            }
        }

        // 2. Client Sign-off Validation
        const unavailable = Boolean(input.clientUnavailable)
        if (unavailable) {
            if (!input.clientUnavailableReason?.trim()) {
                return {
                    success: false,
                    error: "Please enter a reason why the client was not available to sign off."
                }
            }
        } else {
            if (!input.signOffName?.trim()) {
                return { success: false, error: "Client sign-off name is required." }
            }
            if (!input.signOffSignature || !input.signOffSignature.startsWith("data:image/")) {
                return { success: false, error: "Client on-screen signature is required." }
            }
        }

        const now = new Date()
        const existing = await prisma.jobSheet.findUnique({
            where: { projectId: project.id }
        })

        if (!existing?.startedAt && !isChecklistComplete(existing?.checklist as any)) {
            return { success: false, error: "Job must be started (with completed pre-flight checklist) before finishing." }
        }

        const prevLogs = Array.isArray(existing?.timeLogs) ? (existing!.timeLogs as any[]) : []
        const nextLogs = [
            ...prevLogs,
            {
                action: "FINISH",
                timestamp: now.toISOString(),
                actorId: authUser.id,
                actorName: authUser.name || authUser.email,
                pendingOfflinePhotosCount: input.pendingOfflinePhotosCount || 0
            }
        ]

        // Compute total flight time if not explicitly entered
        let computedFlightMins = input.totalFlightMinutes ?? existing?.totalFlightMinutes ?? null
        const elevFlights = input.elevationFlights || (existing?.elevationFlights as any) || {}
        if (computedFlightMins == null) {
            let sum = 0
            for (const ef of Object.values(elevFlights) as any[]) {
                if (ef?.durationMinutes && Number(ef.durationMinutes) > 0) {
                    sum += Number(ef.durationMinutes)
                }
            }
            if (sum > 0) {
                computedFlightMins = Math.round(sum)
            } else if (existing?.startedAt) {
                computedFlightMins = Math.max(1, Math.round((now.getTime() - new Date(existing.startedAt).getTime()) / 60000))
            }
        }

        const finalPilotId = input.pilotUserId || existing?.pilotUserId || authUser.id
        const finalDroneId = input.droneId !== undefined ? (input.droneId || null) : (existing?.droneId || null)

        const [pilotUser, drone, settingsData] = await Promise.all([
            finalPilotId ? prisma.user.findUnique({ where: { id: finalPilotId }, select: { name: true, email: true } }) : null,
            finalDroneId ? prisma.drone.findUnique({ where: { id: finalDroneId } }) : null,
            getNotificationRecipients(companyId)
        ])

        // 3. Create Completion Report (AEROWASH_COMPLETION) with job Before & After photos + flight log metadata
        const acceptedQuote =
            project.invoices.find(i => i.type === "QUOTE" && i.status === "ACCEPTED") ||
            project.invoices.find(i => i.type === "QUOTE") ||
            project.parentProject?.invoices?.[0] ||
            null

        const quoteMeta = ((acceptedQuote?.metadata as any) || {})
        const elevations: any[] = Array.isArray(quoteMeta.elevations) && quoteMeta.elevations.length > 0
            ? quoteMeta.elevations
            : [{ id: "elev-1", name: "Main Facade" }]

        const elevationPhotosMap = ((existing?.elevationPhotos as any) || {}) as Record<string, { before?: any[]; after?: any[] }>
        const issuePhotosList = Array.isArray(existing?.issuePhotos) ? (existing!.issuePhotos as any[]) : []
        const finalIssuesNotes = input.issuesNotes !== undefined ? input.issuesNotes : (existing?.issuesNotes || "")

        const siteAddress = acceptedQuote?.site || project.client?.address || project.name
        const weatherSnap = (existing?.weatherSnapshot as any)?.forecast
        const weatherDesc = weatherSnap
            ? `Wind ${weatherSnap.windSpeedKmh} km/h (gusts ${weatherSnap.windGustsKmh} km/h), Rain ${weatherSnap.rainMm} mm`
            : "Daylight VFR within limits"

        const report = await prisma.report.create({
            data: {
                companyId,
                projectId: project.id,
                clientId: project.clientId,
                title: `Facade Maintenance Completion Report – ${project.name}`,
                description: `On-site facade cleaning completion and handover record for ${siteAddress}.`,
                conclusion: unavailable
                    ? `Work completed per scope. Client representative unavailable at handover (${input.clientUnavailableReason?.trim()}).`
                    : `Work completed and signed off on site by ${input.signOffName?.trim()}.`,
                date: now,
                type: "AEROWASH_COMPLETION",
                metadata: {
                    propertyAddress: siteAddress,
                    inspectionType: "AeroWash Service Completion Report",
                    weather: weatherDesc,
                    pilotName: pilotUser?.name || pilotUser?.email || authUser.name || authUser.email,
                    equipmentUsed: drone ? `${drone.name} (SN: ${drone.serialNumber})` : "AeroWash JTC10 System",
                    flightTime: computedFlightMins ? `${computedFlightMins} mins` : "Recorded on site",
                    totalFlightMinutes: computedFlightMins,
                    pilotUserId: finalPilotId,
                    droneId: finalDroneId,
                    elevationFlights: elevFlights,
                    quoteNumber: acceptedQuote?.quoteNumber || acceptedQuote?.number || null,
                    poNumber: acceptedQuote?.clientPoNumber || null,
                    startedAt: existing?.startedAt ? new Date(existing.startedAt).toISOString() : now.toISOString(),
                    finishedAt: now.toISOString(),
                    signOff: unavailable
                        ? {
                            clientUnavailable: true,
                            reason: input.clientUnavailableReason?.trim(),
                            recordedAt: now.toISOString()
                        }
                        : {
                            clientUnavailable: false,
                            name: input.signOffName?.trim(),
                            signatureDataUrl: input.signOffSignature,
                            signedAt: now.toISOString()
                        }
                }
            }
        })

        // Add ReportItems per elevation with Before + After photos
        let itemOrder = 0
        for (const elev of elevations) {
            const key = elev.id || elev.name
            const slot = elevationPhotosMap[key] || elevationPhotosMap[elev.name] || { before: [], after: [] }
            const beforePaths = (slot.before || []).map((p: any) => p.path).filter(Boolean)
            const afterPaths = (slot.after || []).map((p: any) => p.path).filter(Boolean)
            const allPaths = [...beforePaths, ...afterPaths]
            const ef = elevFlights[key] || elevFlights[elev.name]
            const flightInfo = ef?.flightStart || ef?.flightEnd
                ? ` Flight window: ${ef.flightStart || "—"} to ${ef.flightEnd || "—"}${ef.durationMinutes ? ` (${ef.durationMinutes} min)` : ""}.`
                : ""

            await prisma.reportItem.create({
                data: {
                    reportId: report.id,
                    title: `${elev.name || key} — Before (${beforePaths.length}) & After (${afterPaths.length})`,
                    description:
                        `Completed exterior maintenance clean on ${elev.name || key}` +
                        (elev.width && elev.height ? ` (${elev.width}m × ${elev.height}m)` : "") +
                        `.${flightInfo}`,
                    location: elev.name || key,
                    severity: "COMPLETED",
                    imageUrl: allPaths[0] || null,
                    imageUrls: allPaths,
                    order: itemOrder++
                }
            })
        }

        if (finalIssuesNotes?.trim() || issuePhotosList.length > 0) {
            const issuePaths = issuePhotosList.map((p: any) => p.path).filter(Boolean)
            await prisma.reportItem.create({
                data: {
                    reportId: report.id,
                    title: "Site Observations & Crew Notes",
                    description: finalIssuesNotes?.trim() || "Photographic observation recorded by crew on site.",
                    location: siteAddress,
                    severity: "NOTE",
                    imageUrl: issuePaths[0] || null,
                    imageUrls: issuePaths,
                    order: itemOrder++
                }
            })
        }

        // 4. Update JobSheet & Project to COMPLETED
        await prisma.$transaction([
            prisma.jobSheet.update({
                where: { projectId: project.id },
                data: {
                    status: "COMPLETED",
                    finishedAt: now,
                    timeLogs: nextLogs,
                    pilotUserId: finalPilotId,
                    droneId: finalDroneId,
                    elevationFlights: elevFlights,
                    totalFlightMinutes: computedFlightMins,
                    issuesNotes: finalIssuesNotes,
                    signOffName: unavailable ? null : input.signOffName?.trim(),
                    signOffSignature: unavailable ? null : input.signOffSignature,
                    signedOffAt: unavailable ? null : now,
                    clientUnavailable: unavailable,
                    clientUnavailableReason: unavailable ? input.clientUnavailableReason?.trim() : null,
                    completionReportId: report.id
                }
            }),
            prisma.project.update({
                where: { id: project.id },
                data: { status: "COMPLETED" }
            })
        ])

        // 5. Draft Balance Invoice (Phase 1 40% flow for once-off jobs, or visit invoice draft for recurring visits)
        let draftedInvoiceId: string | null = null
        let draftedInvoiceNumber: string | null = null

        const settings = settingsData.settings
        const existingBalanceInv = project.invoices.find(
            inv => inv.type === "INVOICE" && ((inv.metadata as any)?.isBalanceInvoice || (inv.metadata as any)?.isVisitInvoice)
        )

        if (existingBalanceInv) {
            draftedInvoiceId = existingBalanceInv.id
            draftedInvoiceNumber = existingBalanceInv.quoteNumber || `INV-${existingBalanceInv.number}`
            // Attach completionReportId onto existing draft invoice metadata
            await prisma.invoice.update({
                where: { id: existingBalanceInv.id },
                data: {
                    metadata: {
                        ...((existingBalanceInv.metadata as any) || {}),
                        completionReportId: report.id
                    }
                }
            })
        } else if (acceptedQuote) {
            const isRecurringVisit = Boolean(project.parentProjectId)
            const pct = isRecurringVisit ? 100 : 40
            const baseSubtotal = Math.round((acceptedQuote.subtotal * (pct / 100)) * 100) / 100

            const vatEffective = isVatEffective(now, settings)
            const vatRate = getVatRate(settings)
            const { taxRate, taxAmount, total: invTotal } = calculateVatAndTotal(baseSubtotal, vatEffective, vatRate)

            const year = now.getFullYear()
            const lastInv = await prisma.invoice.findFirst({
                where: { companyId, type: "INVOICE" },
                orderBy: { number: "desc" }
            })
            const nextInvoiceNumber = Math.max(settings?.lastInvoiceNumber || 0, lastInv?.number || 0) + 1
            if (settings) {
                await prisma.companySettings.update({
                    where: { companyId },
                    data: { lastInvoiceNumber: nextInvoiceNumber }
                })
            }
            const formattedInvoiceNumber = `INV-${year}-${nextInvoiceNumber.toString().padStart(3, "0")}`

            const createdInv = await prisma.invoice.create({
                data: {
                    companyId,
                    clientId: project.clientId,
                    projectId: project.id,
                    type: "INVOICE",
                    status: "DRAFT",
                    number: nextInvoiceNumber,
                    quoteNumber: formattedInvoiceNumber,
                    reference: acceptedQuote.quoteNumber || `Quote #${acceptedQuote.number}`,
                    clientPoNumber: acceptedQuote.clientPoNumber,
                    subtotal: baseSubtotal,
                    taxRate,
                    taxAmount,
                    total: invTotal,
                    site: siteAddress,
                    paymentNotes: isRecurringVisit
                        ? `Scheduled maintenance visit invoice for ${project.name}. Completion report attached.`
                        : `Final balance invoice (40%) on project completion as per accepted quotation ${acceptedQuote.quoteNumber || acceptedQuote.number}.`,
                    date: now,
                    metadata: {
                        isBalanceInvoice: !isRecurringVisit,
                        isVisitInvoice: isRecurringVisit,
                        originalQuoteId: acceptedQuote.id,
                        balancePercentage: pct,
                        completionReportId: report.id
                    },
                    items: {
                        create: [
                            {
                                description: isRecurringVisit
                                    ? `Completed Scheduled Facade Maintenance Visit – ${project.name}`
                                    : `40% Balance Due on Project Completion – ${acceptedQuote.quoteNumber || "Quotation"} (${siteAddress})`,
                                quantity: 1,
                                unit: "sum",
                                unitPrice: baseSubtotal,
                                total: baseSubtotal,
                                position: 0
                            }
                        ]
                    }
                }
            })

            draftedInvoiceId = createdInv.id
            draftedInvoiceNumber = formattedInvoiceNumber
        }

        // 6. Notify Owner
        if (settingsData.emails.length > 0) {
            const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ur-ops.vercel.app"
            await sendRealEmail({
                to: settingsData.emails,
                from: "AeroWash Flight Ops <info@aerowash.co.za>",
                replyTo: "info@aerowash.co.za",
                subject: `Job Completed on Site: ${project.name}${draftedInvoiceNumber ? ` (${draftedInvoiceNumber} Drafted)` : ""}`,
                body:
                    `Job "${project.name}" (${project.client?.name || "Client"}) has been finished on site.\n\n` +
                    `• Pilot: ${pilotUser?.name || pilotUser?.email || authUser.name || authUser.email}\n` +
                    `• Aircraft: ${drone ? `${drone.name} (${drone.serialNumber})` : "On file"}\n` +
                    `• Total Flight Time: ${computedFlightMins ?? "—"} mins\n` +
                    `• Client Sign-Off: ${unavailable ? `Unavailable (${input.clientUnavailableReason?.trim()})` : `Signed by ${input.signOffName?.trim()}`}\n\n` +
                    `Completion Report: ${appUrl}/reports/${report.id}\n` +
                    (draftedInvoiceId ? `Draft Balance Invoice: ${appUrl}/invoices/${draftedInvoiceId}\n` : "")
            }).catch(err => console.warn("Completion email warning:", err))
        }

        revalidatePath("/my-jobs")
        revalidatePath(`/my-jobs/${project.id}`)
        revalidatePath(`/projects/${project.id}`)
        revalidatePath("/projects")
        revalidatePath("/reports")
        revalidatePath("/invoices")
        return {
            success: true,
            reportId: report.id,
            draftedInvoiceId,
            draftedInvoiceNumber
        }
    } catch (e: any) {
        console.error("finishJobAction error:", e)
        return { success: false, error: e.message || "Failed to finish job" }
    }
}

export async function resolveStandbyChargeAction(input: {
    projectId: string
    decision: "APPROVE" | "DISMISS"
    amountZar?: number
    description?: string
}) {
    try {
        const companyId = await ensureAuth()
        const authUser = await getAuthUser()
        if (!authUser || (authUser.role !== "ADMIN" && !authUser.isOwner)) {
            return { success: false, error: "Only the owner or administrator can approve standby charges." }
        }

        const project = await prisma.project.findFirst({
            where: { id: input.projectId, companyId },
            include: {
                jobSheet: true,
                invoices: { orderBy: { createdAt: "desc" } }
            }
        })
        if (!project || !project.jobSheet) {
            return { success: false, error: "Job sheet not found." }
        }

        if (input.decision === "DISMISS") {
            await prisma.jobSheet.update({
                where: { id: project.jobSheet.id },
                data: { standbyStatus: "DISMISSED" }
            })
            revalidatePath(`/projects/${project.id}`)
            revalidatePath("/", "layout")
            return { success: true }
        }

        const amount = Number(input.amountZar || 0)
        if (!amount || amount <= 0) {
            return { success: false, error: "Enter a valid Standby / Return Attendance amount (R)." }
        }

        const settings = await prisma.companySettings.findUnique({ where: { companyId } })
        const now = new Date()
        const vatEffective = isVatEffective(now, settings)
        const vatRate = getVatRate(settings)

        const lineDesc =
            input.description?.trim() ||
            `Standby / Return Attendance Charge (${project.jobSheet.standbyReason === "ACCESS" ? "Site access unavailable" : "Work stopped at client request"})`

        // Append to existing DRAFT invoice on project if present, otherwise create a new DRAFT invoice
        const draftInvoice = project.invoices.find(i => i.type === "INVOICE" && i.status === "DRAFT")
        let targetInvoiceId: string

        if (draftInvoice) {
            const newSubtotal = Math.round((draftInvoice.subtotal + amount) * 100) / 100
            const { taxRate, taxAmount, total } = calculateVatAndTotal(newSubtotal, vatEffective, vatRate)
            const count = await prisma.invoiceItem.count({ where: { invoiceId: draftInvoice.id } })

            await prisma.$transaction([
                prisma.invoiceItem.create({
                    data: {
                        invoiceId: draftInvoice.id,
                        description: lineDesc,
                        quantity: 1,
                        unit: "visit",
                        unitPrice: amount,
                        total: amount,
                        position: count
                    }
                }),
                prisma.invoice.update({
                    where: { id: draftInvoice.id },
                    data: { subtotal: newSubtotal, taxRate, taxAmount, total }
                })
            ])
            targetInvoiceId = draftInvoice.id
        } else {
            const { taxRate, taxAmount, total } = calculateVatAndTotal(amount, vatEffective, vatRate)
            const year = now.getFullYear()
            const lastInv = await prisma.invoice.findFirst({
                where: { companyId, type: "INVOICE" },
                orderBy: { number: "desc" }
            })
            const nextInvoiceNumber = Math.max(settings?.lastInvoiceNumber || 0, lastInv?.number || 0) + 1
            if (settings) {
                await prisma.companySettings.update({
                    where: { companyId },
                    data: { lastInvoiceNumber: nextInvoiceNumber }
                })
            }
            const formattedInvoiceNumber = `INV-${year}-${nextInvoiceNumber.toString().padStart(3, "0")}`
            const created = await prisma.invoice.create({
                data: {
                    companyId,
                    clientId: project.clientId,
                    projectId: project.id,
                    type: "INVOICE",
                    status: "DRAFT",
                    number: nextInvoiceNumber,
                    quoteNumber: formattedInvoiceNumber,
                    site: project.name,
                    subtotal: amount,
                    taxRate,
                    taxAmount,
                    total,
                    paymentNotes: "Standby / Return Attendance variation invoice (drafted for review).",
                    metadata: { isStandbyInvoice: true },
                    items: {
                        create: [
                            {
                                description: lineDesc,
                                quantity: 1,
                                unit: "visit",
                                unitPrice: amount,
                                total: amount,
                                position: 0
                            }
                        ]
                    }
                }
            })
            targetInvoiceId = created.id
        }

        await prisma.jobSheet.update({
            where: { id: project.jobSheet.id },
            data: { standbyStatus: "APPROVED" }
        })

        revalidatePath(`/projects/${project.id}`)
        revalidatePath(`/invoices/${targetInvoiceId}`)
        revalidatePath("/", "layout")
        return { success: true, invoiceId: targetInvoiceId }
    } catch (e: any) {
        console.error("resolveStandbyChargeAction error:", e)
        return { success: false, error: e.message || "Failed to approve standby charge" }
    }
}
