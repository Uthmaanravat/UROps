"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ensureAuth, getAuthUser } from "@/lib/auth-actions"
import { backfillCompanyJobSheetFlightLogs } from "@/lib/flight-log-sync"
import {
    ALL_COMPLIANCE_CATEGORY_META,
    type AllComplianceCategory,
    evaluateComplianceDocument,
    evaluateDroneMaintenance,
} from "@/lib/compliance-status"
import {
    deleteComplianceFile,
    getComplianceSignedUrl,
    uploadComplianceFile,
} from "@/lib/compliance-storage"
import { checkAndNotifyCompanyComplianceAlerts } from "@/lib/compliance-alerts"

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
])

async function requireNonCrewCaller() {
    const companyId = await ensureAuth()
    const authUser = await getAuthUser()
    if (!authUser || authUser.companyId !== companyId || authUser.role === "CREW") {
        throw new Error("Unauthorized")
    }
    return { companyId, authUser }
}

async function requireAdminCaller() {
    const { companyId, authUser } = await requireNonCrewCaller()
    if (authUser.role !== "ADMIN" && !authUser.isOwner) {
        throw new Error("Administrator permissions required.")
    }
    return { companyId, authUser }
}

function parseOptionalDate(val?: string | null): Date | null {
    if (!val || !val.trim()) return null
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
}

// ============================================================================
// 1. FLIGHT LOG ACTIONS
// ============================================================================

export async function syncFlightLogsFromJobSheetsAction() {
    try {
        const { companyId } = await requireNonCrewCaller()
        const syncedCount = await backfillCompanyJobSheetFlightLogs(companyId)
        revalidatePath("/compliance")
        return { success: true, syncedCount }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to sync job sheets" }
    }
}

export async function createManualFlightLogAction(input: {
    flightDate: string
    pilotUserId: string
    droneId: string
    projectId?: string | null
    durationMinutes: number
    sorties?: number
    purpose?: "COMMERCIAL_OPS" | "SITE_RECON" | "TRAINING" | "MAINTENANCE_TEST" | "OTHER"
    siteLocation?: string
    weatherSummary?: string
    batteryIdsUsed?: string[]
    incrementSelectedBatteries?: boolean
    incidentOccurred?: boolean
    notes?: string
}) {
    try {
        const { companyId, authUser } = await requireNonCrewCaller()
        const duration = Math.round(Number(input.durationMinutes || 0))
        if (duration <= 0) {
            return { success: false, error: "Flight duration must be greater than 0 minutes." }
        }
        if (!input.pilotUserId || !input.droneId) {
            return { success: false, error: "Please select both a pilot and an aircraft." }
        }

        const [pilot, drone] = await Promise.all([
            prisma.user.findFirst({
                where: { id: input.pilotUserId, companyId },
                select: { id: true, name: true, email: true },
            }),
            prisma.drone.findFirst({
                where: { id: input.droneId, companyId },
                select: { id: true, name: true, serialNumber: true },
            }),
        ])

        if (!pilot || !drone) {
            return { success: false, error: "Selected pilot or aircraft does not belong to this workspace." }
        }

        const flightDate = parseOptionalDate(input.flightDate) || new Date()
        const cleanBatteryIds = Array.from(new Set((input.batteryIdsUsed || []).filter(Boolean)))

        const entry = await prisma.$transaction(async tx => {
            const created = await tx.flightLogEntry.create({
                data: {
                    companyId,
                    projectId: input.projectId || null,
                    pilotUserId: pilot.id,
                    pilotNameSnapshot: pilot.name || pilot.email,
                    droneId: drone.id,
                    droneNameSnapshot: `${drone.name} (${drone.serialNumber})`,
                    flightDate,
                    durationMinutes: duration,
                    sorties: Math.max(1, Math.round(Number(input.sorties || 1))),
                    purpose: input.purpose || "COMMERCIAL_OPS",
                    siteLocation: input.siteLocation?.trim() || null,
                    weatherSummary: input.weatherSummary?.trim() || null,
                    batteryIdsUsed: cleanBatteryIds,
                    incidentOccurred: Boolean(input.incidentOccurred),
                    notes: input.notes?.trim() || null,
                    source: "MANUAL",
                },
            })

            if (input.incrementSelectedBatteries && cleanBatteryIds.length > 0) {
                const batteries = await tx.droneBattery.findMany({
                    where: { companyId, id: { in: cleanBatteryIds } },
                })
                for (const bat of batteries) {
                    const nextCycles = (bat.currentCycles || 0) + 1
                    await tx.droneBattery.update({
                        where: { id: bat.id },
                        data: {
                            currentCycles: nextCycles,
                            lastChargedAt: flightDate,
                        },
                    })
                    await tx.batteryChargeLog.create({
                        data: {
                            companyId,
                            batteryId: bat.id,
                            flightLogId: created.id,
                            loggedAt: flightDate,
                            loggedByUserId: authUser.id,
                            loggedByName: authUser.name || authUser.email,
                            cyclesAdded: 1,
                            cycleCountAfter: nextCycles,
                            healthPercent: bat.healthPercent,
                            notes: `Auto-logged from flight (${drone.name})`,
                        },
                    })
                }
            }

            return created
        })

        revalidatePath("/compliance")
        revalidatePath("/", "layout")
        return { success: true, entryId: entry.id }
    } catch (e: any) {
        console.error("createManualFlightLogAction error:", e)
        return { success: false, error: e.message || "Failed to log flight" }
    }
}

export async function deleteFlightLogEntryAction(entryId: string) {
    try {
        const { companyId } = await requireAdminCaller()
        const existing = await prisma.flightLogEntry.findFirst({
            where: { id: entryId, companyId },
        })
        if (!existing) return { success: false, error: "Flight log entry not found." }
        if (existing.source === "JOB_SHEET" && existing.jobSheetId) {
            return {
                success: false,
                error: "Job-synced flight entries are controlled by their Job Sheet.",
            }
        }
        await prisma.flightLogEntry.delete({ where: { id: existing.id } })
        revalidatePath("/compliance")
        revalidatePath("/", "layout")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to delete flight entry" }
    }
}

// ============================================================================
// 2. DRONE FLEET & MAINTENANCE ACTIONS
// ============================================================================

export async function upsertComplianceDroneAction(input: {
    id?: string
    name: string
    serialNumber: string
    model?: string
    sacaaRegNumber?: string
    commissionDate?: string | null
    airworthinessStatus?: "SERVICEABLE" | "MAINTENANCE_DUE" | "GROUNDED" | "RETIRED"
    maintenanceIntervalDays?: number
    maintenanceIntervalMinutes?: number
    manualBaseFlightMinutes?: number
    nextMaintenanceDueDate?: string | null
    isActive?: boolean
}) {
    try {
        const { companyId } = await requireAdminCaller()
        if (!input.name?.trim() || !input.serialNumber?.trim()) {
            return { success: false, error: "Aircraft name and serial number are required." }
        }

        const payload = {
            name: input.name.trim(),
            serialNumber: input.serialNumber.trim(),
            model: input.model?.trim() || "JTC10",
            sacaaRegNumber: input.sacaaRegNumber?.trim() || null,
            commissionDate: parseOptionalDate(input.commissionDate),
            airworthinessStatus: input.airworthinessStatus || "SERVICEABLE",
            maintenanceIntervalDays: Math.max(1, Math.round(Number(input.maintenanceIntervalDays ?? 90))),
            maintenanceIntervalMinutes: Math.max(60, Math.round(Number(input.maintenanceIntervalMinutes ?? 3000))),
            manualBaseFlightMinutes: Math.max(0, Math.round(Number(input.manualBaseFlightMinutes ?? 0))),
            nextMaintenanceDueDate: parseOptionalDate(input.nextMaintenanceDueDate),
            isActive: input.isActive !== undefined ? input.isActive : input.airworthinessStatus !== "RETIRED",
        }

        if (input.id) {
            const existing = await prisma.drone.findFirst({ where: { id: input.id, companyId } })
            if (!existing) return { success: false, error: "Aircraft not found." }
            await prisma.drone.update({
                where: { id: existing.id },
                data: payload,
            })
        } else {
            await prisma.drone.create({
                data: {
                    companyId,
                    ...payload,
                },
            })
        }

        revalidatePath("/compliance")
        revalidatePath("/settings")
        revalidatePath("/projects")
        revalidatePath("/my-jobs")
        revalidatePath("/", "layout")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to save aircraft" }
    }
}

export async function logDroneMaintenanceAction(input: {
    droneId: string
    performedAt?: string
    performedBy?: string
    type: "SCHEDULED_SERVICE" | "UNSCHEDULED_REPAIR" | "WASH_RIG_INSPECTION" | "FIRMWARE_CALIBRATION"
    workSummary: string
    partsReplaced?: string
    cost?: number | null
    resetServiceCounter?: boolean
    nextDueDate?: string | null
    airworthinessStatusAfter?: "SERVICEABLE" | "MAINTENANCE_DUE" | "GROUNDED"
}) {
    try {
        const { companyId, authUser } = await requireNonCrewCaller()
        if (!input.workSummary?.trim()) {
            return { success: false, error: "Please enter a summary of maintenance work performed." }
        }

        const drone = await prisma.drone.findFirst({
            where: { id: input.droneId, companyId },
        })
        if (!drone) return { success: false, error: "Aircraft not found." }

        const flightAgg = await prisma.flightLogEntry.aggregate({
            where: { companyId, droneId: drone.id },
            _sum: { durationMinutes: true },
        })
        const currentTotalMins =
            (drone.manualBaseFlightMinutes || 0) + (flightAgg._sum.durationMinutes || 0)

        const performedDate = parseOptionalDate(input.performedAt) || new Date()
        const shouldReset = input.resetServiceCounter !== false
        const computedNextDueDate =
            parseOptionalDate(input.nextDueDate) ||
            (shouldReset
                ? new Date(performedDate.getTime() + (drone.maintenanceIntervalDays || 90) * 86400000)
                : drone.nextMaintenanceDueDate)

        const nextAirframeMins = shouldReset
            ? currentTotalMins + (drone.maintenanceIntervalMinutes || 3000)
            : null

        await prisma.$transaction([
            prisma.droneMaintenanceLog.create({
                data: {
                    companyId,
                    droneId: drone.id,
                    performedAt: performedDate,
                    performedBy: input.performedBy?.trim() || authUser.name || authUser.email,
                    type: input.type,
                    airframeMinutesAtService: currentTotalMins,
                    workSummary: input.workSummary.trim(),
                    partsReplaced: input.partsReplaced?.trim() || null,
                    cost: input.cost != null && !isNaN(Number(input.cost)) ? Number(input.cost) : null,
                    nextDueDate: computedNextDueDate,
                    nextDueAirframeMinutes: nextAirframeMins,
                },
            }),
            prisma.drone.update({
                where: { id: drone.id },
                data: {
                    lastMaintenanceDate: shouldReset ? performedDate : drone.lastMaintenanceDate,
                    flightMinutesAtLastService: shouldReset
                        ? currentTotalMins
                        : drone.flightMinutesAtLastService,
                    nextMaintenanceDueDate: computedNextDueDate,
                    airworthinessStatus: input.airworthinessStatusAfter || "SERVICEABLE",
                },
            }),
        ])

        revalidatePath("/compliance")
        revalidatePath("/", "layout")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to log maintenance" }
    }
}

// ============================================================================
// 3. BATTERY FLEET & CHARGE CYCLE ACTIONS
// ============================================================================

export async function upsertDroneBatteryAction(input: {
    id?: string
    label: string
    pairGroup?: string
    assignedDroneId?: string | null
    model?: string
    serialNumber?: string
    purchaseDate?: string | null
    currentCycles?: number
    maxRecommendedCycles?: number
    healthPercent?: number | null
    nextInspectionDueDate?: string | null
    status?: "ACTIVE" | "MAINTENANCE_DUE" | "SWOLLEN_QUARANTINE" | "RETIRED"
    notes?: string
}) {
    try {
        const { companyId } = await requireNonCrewCaller()
        if (!input.label?.trim()) {
            return { success: false, error: "Battery label (e.g. BAT-01A) is required." }
        }

        const cycles = Math.max(0, Math.round(Number(input.currentCycles ?? 0)))
        const maxCycles = Math.max(10, Math.round(Number(input.maxRecommendedCycles ?? 200)))
        const health =
            input.healthPercent != null && String(input.healthPercent).trim() !== ""
                ? Math.min(100, Math.max(0, Math.round(Number(input.healthPercent))))
                : null

        const data = {
            label: input.label.trim(),
            pairGroup: input.pairGroup?.trim() || null,
            assignedDroneId: input.assignedDroneId || null,
            model: input.model?.trim() || null,
            serialNumber: input.serialNumber?.trim() || null,
            purchaseDate: parseOptionalDate(input.purchaseDate),
            currentCycles: cycles,
            maxRecommendedCycles: maxCycles,
            healthPercent: health,
            nextInspectionDueDate: parseOptionalDate(input.nextInspectionDueDate),
            status: input.status || "ACTIVE",
            notes: input.notes?.trim() || null,
        }

        if (input.id) {
            const existing = await prisma.droneBattery.findFirst({
                where: { id: input.id, companyId },
            })
            if (!existing) return { success: false, error: "Battery not found." }
            await prisma.droneBattery.update({
                where: { id: existing.id },
                data,
            })
        } else {
            await prisma.droneBattery.create({
                data: {
                    companyId,
                    initialCycles: cycles,
                    ...data,
                },
            })
        }

        revalidatePath("/compliance")
        return { success: true }
    } catch (e: any) {
        if (e.code === "P2002") {
            return { success: false, error: "A battery with this label already exists." }
        }
        return { success: false, error: e.message || "Failed to save battery" }
    }
}

export async function incrementBatteryCyclesAction(input: {
    batteryIds: string[]
    cyclesAdded?: number
    healthPercent?: number | null
    voltageDeviationMv?: number | null
    swellingObserved?: boolean
    notes?: string
}) {
    try {
        const { companyId, authUser } = await requireNonCrewCaller()
        const ids = Array.from(new Set((input.batteryIds || []).filter(Boolean)))
        if (ids.length === 0) {
            return { success: false, error: "Select at least one battery." }
        }

        const delta = Math.max(1, Math.round(Number(input.cyclesAdded ?? 1)))
        const now = new Date()

        await prisma.$transaction(async tx => {
            const batteries = await tx.droneBattery.findMany({
                where: { companyId, id: { in: ids } },
            })
            for (const bat of batteries) {
                const nextCycles = (bat.currentCycles || 0) + delta
                const nextHealth =
                    input.healthPercent != null
                        ? Math.min(100, Math.max(0, Math.round(Number(input.healthPercent))))
                        : bat.healthPercent
                const nextStatus = input.swellingObserved
                    ? "SWOLLEN_QUARANTINE"
                    : nextCycles >= (bat.maxRecommendedCycles || 200) && bat.status === "ACTIVE"
                    ? "MAINTENANCE_DUE"
                    : bat.status

                await tx.droneBattery.update({
                    where: { id: bat.id },
                    data: {
                        currentCycles: nextCycles,
                        healthPercent: nextHealth,
                        lastChargedAt: now,
                        status: nextStatus,
                    },
                })

                await tx.batteryChargeLog.create({
                    data: {
                        companyId,
                        batteryId: bat.id,
                        loggedAt: now,
                        loggedByUserId: authUser.id,
                        loggedByName: authUser.name || authUser.email,
                        cyclesAdded: delta,
                        cycleCountAfter: nextCycles,
                        healthPercent: nextHealth,
                        voltageDeviationMv:
                            input.voltageDeviationMv != null
                                ? Math.round(Number(input.voltageDeviationMv))
                                : null,
                        swellingObserved: Boolean(input.swellingObserved),
                        notes: input.notes?.trim() || null,
                    },
                })
            }
        })

        revalidatePath("/compliance")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to log charge cycle(s)" }
    }
}

export async function deleteDroneBatteryAction(batteryId: string) {
    try {
        const { companyId } = await requireAdminCaller()
        await prisma.droneBattery.deleteMany({
            where: { id: batteryId, companyId },
        })
        revalidatePath("/compliance")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to delete battery" }
    }
}

// ============================================================================
// 4. COMPLIANCE DOCUMENTS & VENDOR PACK ACTIONS
// ============================================================================

export async function uploadComplianceDocumentAction(formData: FormData) {
    try {
        const { companyId, authUser } = await requireNonCrewCaller()

        const file = formData.get("file") as File | null
        const category = String(formData.get("category") || "").trim() as AllComplianceCategory
        const title = String(formData.get("title") || "").trim()
        const referenceNumber = String(formData.get("referenceNumber") || "").trim() || null
        const issuingAuthority = String(formData.get("issuingAuthority") || "").trim() || null
        const issuedDateStr = String(formData.get("issuedDate") || "").trim()
        const expiryDateStr = String(formData.get("expiryDate") || "").trim()
        const pilotUserIdRaw = String(formData.get("pilotUserId") || "").trim() || null
        const droneIdRaw = String(formData.get("droneId") || "").trim() || null
        const alertDaysBefore = Math.max(7, Math.round(Number(formData.get("alertDaysBefore") || 30)))
        const includeInVendorPack = formData.get("includeInVendorPack") !== "false"
        const archivePrevious = formData.get("archivePrevious") !== "false"
        const notes = String(formData.get("notes") || "").trim() || null

        if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
            return { success: false, error: "Please attach a PDF or image file." }
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            return { success: false, error: "File exceeds the 25 MB limit." }
        }
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return {
                success: false,
                error: "Unsupported file format. Please upload PDF, JPG, PNG, or WEBP.",
            }
        }
        if (!category || !ALL_COMPLIANCE_CATEGORY_META[category]) {
            return { success: false, error: "Invalid compliance document category." }
        }
        if (!title) {
            return { success: false, error: "Document title is required." }
        }

        // Managers who are not Admin can upload RPL renewals or general docs; verify tenant FKs
        let validPilotId: string | null = null
        if (pilotUserIdRaw) {
            const p = await prisma.user.findFirst({
                where: { id: pilotUserIdRaw, companyId },
                select: { id: true },
            })
            if (!p) return { success: false, error: "Selected pilot not found in workspace." }
            validPilotId = p.id
        }

        let validDroneId: string | null = null
        if (droneIdRaw) {
            const d = await prisma.drone.findFirst({
                where: { id: droneIdRaw, companyId },
                select: { id: true },
            })
            if (!d) return { success: false, error: "Selected aircraft not found in workspace." }
            validDroneId = d.id
        }

        const docId = randomUUID()
        const buffer = Buffer.from(await file.arrayBuffer())
        const storagePath = await uploadComplianceFile({
            companyId,
            category,
            docId,
            fileName: file.name,
            mimeType: file.type,
            buffer,
        })

        const defaultOrder = ALL_COMPLIANCE_CATEGORY_META[category].defaultOrder

        await prisma.$transaction(async tx => {
            if (archivePrevious && category !== "OTHER") {
                await tx.complianceDocument.updateMany({
                    where: {
                        companyId,
                        category: category as any,
                        isArchived: false,
                        ...(category === "RPL" ? { pilotUserId: validPilotId } : {}),
                    },
                    data: { isArchived: true },
                })
            }

            await tx.complianceDocument.create({
                data: {
                    id: docId,
                    companyId,
                    category: category as any,
                    pilotUserId: validPilotId,
                    droneId: validDroneId,
                    title,
                    referenceNumber,
                    issuingAuthority,
                    issuedDate: parseOptionalDate(issuedDateStr),
                    expiryDate: parseOptionalDate(expiryDateStr),
                    alertDaysBefore,
                    storagePath,
                    fileName: file.name,
                    mimeType: file.type,
                    fileSizeBytes: file.size,
                    includeInVendorPack,
                    vendorPackOrder: defaultOrder,
                    uploadedByUserId: authUser.id,
                    notes,
                },
            })
        })

        revalidatePath("/compliance")
        revalidatePath("/", "layout")
        return { success: true, docId }
    } catch (e: any) {
        console.error("uploadComplianceDocumentAction error:", e)
        return { success: false, error: e.message || "Failed to upload compliance document" }
    }
}

export async function toggleVendorPackInclusionAction(docId: string, includeInVendorPack: boolean) {
    try {
        const { companyId } = await requireNonCrewCaller()
        await prisma.complianceDocument.updateMany({
            where: { id: docId, companyId },
            data: { includeInVendorPack },
        })
        revalidatePath("/compliance")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to update Vendor Pack setting" }
    }
}

export async function archiveComplianceDocumentAction(docId: string, isArchived: boolean) {
    try {
        const { companyId } = await requireAdminCaller()
        await prisma.complianceDocument.updateMany({
            where: { id: docId, companyId },
            data: { isArchived },
        })
        revalidatePath("/compliance")
        revalidatePath("/", "layout")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to update archive status" }
    }
}

export async function deleteComplianceDocumentAction(docId: string) {
    try {
        const { companyId } = await requireAdminCaller()
        const doc = await prisma.complianceDocument.findFirst({
            where: { id: docId, companyId },
        })
        if (!doc) return { success: false, error: "Document not found." }

        await prisma.complianceDocument.delete({ where: { id: doc.id } })
        await deleteComplianceFile(companyId, doc.storagePath)

        revalidatePath("/compliance")
        revalidatePath("/", "layout")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to delete document" }
    }
}

export async function getComplianceDocumentSignedUrlAction(docId: string, download = false) {
    try {
        const { companyId } = await requireNonCrewCaller()
        const doc = await prisma.complianceDocument.findFirst({
            where: { id: docId, companyId },
        })
        if (!doc) return { success: false, error: "Document not found." }

        const url = await getComplianceSignedUrl(
            companyId,
            doc.storagePath,
            300,
            download ? doc.fileName : undefined
        )
        if (!url) return { success: false, error: "Could not generate secure document link." }
        return { success: true, url, fileName: doc.fileName }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to retrieve document link" }
    }
}

export async function triggerComplianceAlertDigestAction() {
    try {
        const { companyId } = await requireAdminCaller()
        const result = await checkAndNotifyCompanyComplianceAlerts(companyId, { forceSend: true })
        revalidatePath("/compliance")
        return { success: true, result }
    } catch (e: any) {
        return { success: false, error: e.message || "Failed to send compliance alert digest" }
    }
}

/**
 * Advisory non-blocking warnings for Pilot RPL & Drone Maintenance when dispatching or starting a job.
 */
export async function getDispatchComplianceWarningsAction(params: {
    pilotUserId?: string | null
    droneId?: string | null
}) {
    try {
        const { companyId } = await requireNonCrewCaller()
        const warnings: string[] = []
        const now = new Date()

        if (params.pilotUserId) {
            const [pilot, rplDocs] = await Promise.all([
                prisma.user.findFirst({
                    where: { id: params.pilotUserId, companyId },
                    select: { name: true, email: true },
                }),
                prisma.complianceDocument.findMany({
                    where: {
                        companyId,
                        category: "RPL",
                        pilotUserId: params.pilotUserId,
                        isArchived: false,
                    },
                    orderBy: { expiryDate: "desc" },
                }),
            ])
            const pilotLabel = pilot?.name || pilot?.email || "Selected pilot"
            if (rplDocs.length === 0) {
                warnings.push(`${pilotLabel} has no active SACAA RPL uploaded in Compliance.`)
            } else {
                const st = evaluateComplianceDocument(rplDocs[0], now)
                if (st.severity === "EXPIRED") {
                    warnings.push(`${pilotLabel}'s SACAA RPL is ${st.label.toLowerCase()}.`)
                } else if (st.severity === "CRITICAL") {
                    warnings.push(`${pilotLabel}'s SACAA RPL ${st.label.toLowerCase()}.`)
                }
            }
        }

        if (params.droneId) {
            const [drone, flightAgg] = await Promise.all([
                prisma.drone.findFirst({ where: { id: params.droneId, companyId } }),
                prisma.flightLogEntry.aggregate({
                    where: { companyId, droneId: params.droneId },
                    _sum: { durationMinutes: true },
                }),
            ])
            if (drone) {
                const st = evaluateDroneMaintenance(
                    drone,
                    flightAgg._sum.durationMinutes || 0,
                    now
                )
                if (st.severity === "EXPIRED" || st.severity === "CRITICAL") {
                    warnings.push(
                        `${drone.name}: ${st.label}${st.reasons.length ? ` (${st.reasons[0]})` : ""}.`
                    )
                }
            }
        }

        return { success: true, warnings }
    } catch {
        return { success: true, warnings: [] }
    }
}
