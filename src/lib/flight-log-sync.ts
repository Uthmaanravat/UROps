import { prisma } from "@/lib/prisma"

/**
 * Counts sorties from JobSheet.elevationFlights JSON if recorded, defaulting to >= 1.
 */
function deriveSortiesFromElevationFlights(elevationFlights: any): number {
    if (!elevationFlights || typeof elevationFlights !== "object") return 1
    let count = 0
    for (const val of Object.values(elevationFlights) as any[]) {
        if (val && (val.flightStart || val.flightEnd || Number(val.durationMinutes) > 0)) {
            count += 1
        }
    }
    return Math.max(1, count)
}

/**
 * Idempotently syncs a single Phase 2 JobSheet into FlightLogEntry.
 * - Creates or updates the linked FlightLogEntry when totalFlightMinutes > 0 and pilot/drone exist.
 * - Cleans up an auto-synced FlightLogEntry if totalFlightMinutes was cleared back to 0/null.
 */
export async function syncJobSheetFlightLog(jobSheetId: string): Promise<{
    synced: boolean
    flightLogId?: string | null
}> {
    try {
        const sheet = await prisma.jobSheet.findUnique({
            where: { id: jobSheetId },
            include: {
                pilotUser: { select: { id: true, name: true, email: true } },
                drone: { select: { id: true, name: true, serialNumber: true } },
                project: {
                    include: {
                        client: { select: { name: true, address: true } },
                        invoices: {
                            select: { site: true },
                            orderBy: { createdAt: "desc" },
                            take: 1,
                        },
                    },
                },
            },
        })

        if (!sheet) return { synced: false }

        const duration = Number(sheet.totalFlightMinutes || 0)
        if (duration <= 0) {
            await prisma.flightLogEntry.deleteMany({
                where: { jobSheetId: sheet.id, source: "JOB_SHEET" },
            })
            return { synced: false, flightLogId: null }
        }

        const flightDate =
            sheet.finishedAt ||
            sheet.startedAt ||
            sheet.project?.startDate ||
            sheet.updatedAt ||
            sheet.createdAt

        const siteLocation =
            sheet.project?.invoices?.[0]?.site ||
            sheet.project?.client?.address ||
            sheet.project?.name ||
            null

        const weatherSnap = (sheet.weatherSnapshot as any)?.forecast
        const weatherSummary = weatherSnap
            ? `Wind ${weatherSnap.windSpeedKmh} km/h (gusts ${weatherSnap.windGustsKmh} km/h), Rain ${weatherSnap.rainMm} mm`
            : null

        const pilotNameSnapshot = sheet.pilotUser
            ? sheet.pilotUser.name || sheet.pilotUser.email
            : null
        const droneNameSnapshot = sheet.drone
            ? `${sheet.drone.name} (${sheet.drone.serialNumber})`
            : null

        const sorties = deriveSortiesFromElevationFlights(sheet.elevationFlights)

        const entry = await prisma.flightLogEntry.upsert({
            where: { jobSheetId: sheet.id },
            update: {
                projectId: sheet.projectId,
                pilotUserId: sheet.pilotUserId || null,
                pilotNameSnapshot,
                droneId: sheet.droneId || null,
                droneNameSnapshot,
                flightDate,
                durationMinutes: Math.round(duration),
                sorties,
                siteLocation,
                weatherSummary,
                notes: sheet.issuesNotes || undefined,
            },
            create: {
                companyId: sheet.companyId,
                jobSheetId: sheet.id,
                projectId: sheet.projectId,
                pilotUserId: sheet.pilotUserId || null,
                pilotNameSnapshot,
                droneId: sheet.droneId || null,
                droneNameSnapshot,
                flightDate,
                durationMinutes: Math.round(duration),
                sorties,
                purpose: "COMMERCIAL_OPS",
                siteLocation,
                weatherSummary,
                notes: sheet.issuesNotes || null,
                source: "JOB_SHEET",
            },
        })

        return { synced: true, flightLogId: entry.id }
    } catch (err) {
        console.warn("[FlightLogSync] Safe warning syncing JobSheet:", err)
        return { synced: false }
    }
}

/**
 * Backfills/refreshes FlightLogEntry records for all JobSheets of a company with totalFlightMinutes > 0.
 */
export async function backfillCompanyJobSheetFlightLogs(companyId: string): Promise<number> {
    const sheets = await prisma.jobSheet.findMany({
        where: {
            companyId,
            totalFlightMinutes: { gt: 0 },
        },
        select: { id: true },
    })

    let syncedCount = 0
    for (const s of sheets) {
        const res = await syncJobSheetFlightLog(s.id)
        if (res.synced) syncedCount += 1
    }
    return syncedCount
}
