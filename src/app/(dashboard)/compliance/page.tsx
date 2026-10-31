import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ensureAuth, getAuthUser } from "@/lib/auth-actions"
import { backfillCompanyJobSheetFlightLogs } from "@/lib/flight-log-sync"
import { ComplianceHubClient } from "@/components/compliance/ComplianceHubClient"

export const dynamic = "force-dynamic"

export default async function CompliancePage() {
    const companyId = await ensureAuth()
    const authUser = await getAuthUser()

    if (!authUser || authUser.companyId !== companyId) {
        redirect("/login")
    }
    if (authUser.role === "CREW") {
        redirect("/my-jobs")
    }

    // Automatically sync any completed/logged Phase 2 JobSheets that don't yet have a FlightLogEntry
    try {
        const unsyncedCount = await prisma.jobSheet.count({
            where: {
                companyId,
                totalFlightMinutes: { gt: 0 },
                flightLog: null,
            },
        })
        if (unsyncedCount > 0) {
            await backfillCompanyJobSheetFlightLogs(companyId)
        }
    } catch (err) {
        console.warn("[CompliancePage] JobSheet auto-sync check skipped:", err)
    }

    const [company, settings, flightLogs, drones, batteries, documents, pilots, projects] =
        await Promise.all([
            prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
            prisma.companySettings.findUnique({ where: { companyId } }),
            prisma.flightLogEntry.findMany({
                where: { companyId },
                include: {
                    pilotUser: { select: { id: true, name: true, email: true } },
                    drone: {
                        select: {
                            id: true,
                            name: true,
                            serialNumber: true,
                            sacaaRegNumber: true,
                        },
                    },
                    project: {
                        select: {
                            id: true,
                            name: true,
                            client: { select: { name: true } },
                        },
                    },
                },
                orderBy: [{ flightDate: "desc" }, { createdAt: "desc" }],
                take: 500,
            }),
            prisma.drone.findMany({
                where: { companyId },
                include: {
                    maintenanceLogs: {
                        orderBy: { performedAt: "desc" },
                        take: 15,
                    },
                },
                orderBy: [{ isActive: "desc" }, { name: "asc" }],
            }),
            prisma.droneBattery.findMany({
                where: { companyId },
                include: {
                    assignedDrone: { select: { id: true, name: true } },
                    chargeLogs: {
                        orderBy: { loggedAt: "desc" },
                        take: 10,
                    },
                },
                orderBy: [{ pairGroup: "asc" }, { label: "asc" }],
            }),
            prisma.complianceDocument.findMany({
                where: { companyId },
                include: {
                    pilotUser: { select: { id: true, name: true, email: true } },
                    drone: { select: { id: true, name: true } },
                },
                orderBy: [
                    { isArchived: "asc" },
                    { vendorPackOrder: "asc" },
                    { createdAt: "desc" },
                ],
            }),
            prisma.user.findMany({
                where: { companyId },
                select: { id: true, name: true, email: true, role: true },
                orderBy: { name: "asc" },
            }),
            prisma.project.findMany({
                where: { companyId, status: { not: "CANCELLED" } },
                select: { id: true, name: true },
                orderBy: { updatedAt: "desc" },
                take: 100,
            }),
        ])

    const isAdmin = authUser.role === "ADMIN" || Boolean(authUser.isOwner)
    const companyName = settings?.name || company?.name || "AeroWash"

    const serialized = JSON.parse(
        JSON.stringify({
            flightLogs,
            drones,
            batteries,
            documents,
            pilots,
            projects,
        })
    )

    return (
        <ComplianceHubClient
            companyName={companyName}
            isAdmin={isAdmin}
            flightLogs={serialized.flightLogs}
            drones={serialized.drones}
            batteries={serialized.batteries}
            documents={serialized.documents}
            pilots={serialized.pilots}
            projects={serialized.projects}
        />
    )
}
