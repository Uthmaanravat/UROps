import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ensureAuth, getAuthUser } from "@/lib/auth-actions"
import { enrichAeroWashProjectsWithWeather } from "@/lib/weather-alerts"
import { MyJobsTodayClient } from "@/components/jobs/MyJobsTodayClient"

export const dynamic = "force-dynamic"

export default async function MyJobsTodayPage() {
    const companyId = await ensureAuth()
    const authUser = await getAuthUser()
    if (!authUser) redirect("/login")

    const isCrew = authUser.role === "CREW"

    const [settings, drones, rawProjects] = await Promise.all([
        prisma.companySettings.findUnique({ where: { companyId } }),
        prisma.drone.findMany({ where: { companyId } }).catch(() => []),
        prisma.project.findMany({
            where: {
                companyId,
                isRecurring: false, // Show individual visits & direct jobs, not abstract parent containers
                status: { notIn: ["CANCELLED"] as any },
                ...(isCrew
                    ? {
                        OR: [
                            { assignedCrewIds: { has: authUser.id } },
                            { pilotUserId: authUser.id }
                        ]
                    }
                    : {})
            },
            include: {
                client: {
                    select: {
                        name: true,
                        address: true,
                        phone: true,
                        attentionTo: true
                    }
                },
                jobSheet: {
                    select: {
                        id: true,
                        status: true,
                        startedAt: true,
                        finishedAt: true,
                        droneId: true,
                        standbyFlagged: true,
                        standbyStatus: true
                    }
                },
                invoices: {
                    where: { type: "QUOTE" },
                    // STRICT ZERO-PRICE PROJECTION
                    select: {
                        site: true,
                        clientPoNumber: true,
                        reference: true,
                        attentionTo: true
                    },
                    orderBy: { createdAt: "desc" },
                    take: 1
                }
            },
            orderBy: [{ startDate: "asc" }, { updatedAt: "desc" }],
            take: 100
        })
    ])

    const enriched = await enrichAeroWashProjectsWithWeather(rawProjects, settings as any, companyId)
    const droneMap = new Map(drones.map(d => [d.id, `${d.name} (${d.serialNumber})`]))

    // Strip to strictly operational fields (NEVER include prices/totals)
    const sanitizedJobs = enriched.map(p => {
        const quote = p.invoices?.[0]
        const droneId = p.jobSheet?.droneId || p.droneId
        return {
            id: p.id,
            name: p.name,
            clientName: p.client?.name || "Client",
            siteAddress: quote?.site || p.client?.address || p.name,
            poNumber: quote?.clientPoNumber || quote?.reference || null,
            startDate: p.startDate ? p.startDate.toISOString() : null,
            projectStatus: p.status,
            jobSheetStatus: p.jobSheet?.status || "NOT_STARTED",
            isRecurringVisit: Boolean(p.parentProjectId),
            aircraftLabel: droneId ? (droneMap.get(droneId) || null) : null,
            flightWeather: p.flightWeather || null
        }
    })

    return (
        <MyJobsTodayClient
            jobs={sanitizedJobs}
            userName={authUser.name || authUser.email}
            userRole={authUser.role}
        />
    )
}
