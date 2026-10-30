import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { ensureAuth, getAuthUser } from "@/lib/auth-actions"
import { getSignedPhotoUrl } from "@/lib/supabase-storage"
import { getOpenMeteoSiteForecastForDate, evaluateFlightWeatherStatus } from "@/lib/weather"
import { MobileJobSheetClient } from "@/components/jobs/MobileJobSheetClient"

export const dynamic = "force-dynamic"

function formatWhatsAppUrl(phone?: string | null): string | null {
    if (!phone) return null
    let digits = phone.replace(/[^0-9]/g, "")
    if (!digits) return null
    if (digits.startsWith("0") && digits.length === 10) {
        digits = "27" + digits.slice(1)
    }
    return `https://wa.me/${digits}`
}

export default async function MobileJobSheetPage({
    params
}: {
    params: { projectId: string }
}) {
    const companyId = await ensureAuth()
    const authUser = await getAuthUser()
    if (!authUser) redirect("/login")

    const project = await prisma.project.findFirst({
        where: { id: params.projectId, companyId },
        include: {
            client: {
                include: {
                    contacts: { take: 3 }
                }
            },
            jobSheet: true,
            parentProject: {
                include: {
                    invoices: {
                        where: { type: "QUOTE" },
                        include: {
                            contact: true,
                            items: {
                                select: {
                                    area: true,
                                    description: true,
                                    code: true,
                                    position: true
                                },
                                orderBy: { position: "asc" }
                            }
                        },
                        orderBy: { createdAt: "desc" },
                        take: 1
                    }
                }
            },
            invoices: {
                include: {
                    contact: true,
                    items: {
                        // STRICT ZERO-PRICE PROJECTION
                        select: {
                            area: true,
                            description: true,
                            code: true,
                            position: true
                        },
                        orderBy: { position: "asc" }
                    }
                },
                orderBy: { createdAt: "desc" }
            }
        }
    })

    if (!project) notFound()

    // Strict CREW assignment check
    if (authUser.role === "CREW") {
        const assigned = project.assignedCrewIds || []
        if (!assigned.includes(authUser.id) && project.pilotUserId !== authUser.id) {
            redirect("/my-jobs")
        }
    }

    const [settings, drones, teamUsers] = await Promise.all([
        prisma.companySettings.findUnique({ where: { companyId } }),
        prisma.drone.findMany({
            where: { companyId, isActive: true },
            orderBy: { name: "asc" }
        }).catch(() => []),
        prisma.user.findMany({
            where: { companyId },
            select: { id: true, name: true, email: true, role: true },
            orderBy: { name: "asc" }
        })
    ])

    const quote =
        project.invoices.find(i => i.type === "QUOTE" && i.status === "ACCEPTED") ||
        project.invoices.find(i => i.type === "QUOTE") ||
        project.parentProject?.invoices?.[0] ||
        null

    const draftBalanceInvoice =
        authUser.role !== "CREW"
            ? project.invoices.find(i => i.type === "INVOICE" && i.status === "DRAFT")
            : null

    const quoteMeta = ((quote?.metadata as any) || {})
    const rawElevations: any[] = Array.isArray(quoteMeta.elevations) && quoteMeta.elevations.length > 0
        ? quoteMeta.elevations
        : [
            {
                id: "elev-main",
                name: "Main Building Facade",
                selectedCleaning: "GLAZING"
            }
        ]

    // Build zero-price operational scope by elevation + Manual-by-crew areas + exclusions
    const elevations = rawElevations.map((el: any, idx: number) => {
        const key = el.id || el.name || `elev-${idx + 1}`
        const scopeLines: string[] = []
        if (el.selectedCleaning === "FULL_FACADE") {
            scopeLines.push("Full Facade Maintenance Clean (glazing, frames, cladding & walls)")
        } else if (el.selectedCleaning === "GLAZING" || el.selectedCleaning === "BOTH_ALTERNATIVES") {
            scopeLines.push("Exterior Glazing Maintenance Clean (windows, glazing & frames)")
        }
        if (el.hasBalconies) {
            scopeLines.push("Balcony & Detail Areas (soffits, window reveals & balustrade glass)")
        }
        if (el.hasPreTreatment) {
            scopeLines.push("Stain & Growth Pre-Treatment before main wash")
        }
        if (el.hasPreCoatingWash || el.hasPreCoating) {
            scopeLines.push("Pre-Coating Facade Wash (per contractor specification)")
        }
        if (scopeLines.length === 0) {
            scopeLines.push("Exterior Facade Maintenance Clean")
        }

        const manualAreas: string[] = []
        if (el.hasHandClean) {
            const widthInfo =
                el.handCleanAppliesTo === "PART" && el.handCleanWidth
                    ? `${el.handCleanWidth} m width`
                    : el.width
                        ? `Full ${el.width} m width`
                        : "Ground-level frontage"
            const heightInfo = el.handCleanHeight ? `up to ${el.handCleanHeight} m` : "below ~3 m"
            manualAreas.push(`Low-Level & Detail Hand Clean (${widthInfo}, ${heightInfo}, entrances & deep recesses)`)
        }
        if (el.hasBalconies) {
            manualAreas.push("Recessed balcony glass / hand-detail check where obstructed from drone flight line")
        }

        return {
            key,
            name: el.name || `Elevation ${idx + 1}`,
            dimensions: el.width && el.height ? `${el.width} m × ${el.height} m` : null,
            condition: el.condition || "Sound",
            scopeLines,
            manualAreas,
            exclusions: el.exclusions?.trim() || null
        }
    })

    // Resolve site visit photos & condition flags (zero prices)
    const rawSitePhotos: any[] = Array.isArray(quoteMeta.siteVisitPhotos) ? quoteMeta.siteVisitPhotos : []
    const resolvedSitePhotos = await Promise.all(
        rawSitePhotos.map(async (p: any, idx: number) => ({
            id: p.id || `svp-${idx + 1}`,
            refNumber: idx + 1,
            caption: p.caption || p.label || `Photo ${idx + 1}`,
            elevationName: p.elevationName || null,
            url: p.url ? await getSignedPhotoUrl(p.url) : ""
        }))
    )
    const photoById = new Map(resolvedSitePhotos.map(p => [p.id, p]))

    const rawFlags: any[] = Array.isArray(quoteMeta.conditionFlags) ? quoteMeta.conditionFlags : []
    const conditionFlags = rawFlags.map((f: any, idx: number) => {
        const linkedPhotos = (Array.isArray(f.photoIds) ? f.photoIds : [])
            .map((pid: string) => photoById.get(pid))
            .filter(Boolean)
        return {
            id: f.id || `flag-${idx + 1}`,
            elevationName: f.elevationName || f.elevation || "Site",
            type: f.type || f.conditionType || "Pre-existing condition",
            location: f.location || "",
            notes: f.notes || f.description || "",
            photos: linkedPhotos
        }
    })

    // Exclusions list
    const exclusionsList: string[] = []
    for (const el of elevations) {
        if (el.exclusions) {
            exclusionsList.push(`${el.name}: ${el.exclusions}`)
        }
    }
    for (const fl of conditionFlags) {
        if (String(fl.type).toLowerCase().includes("crack") || String(fl.type).toLowerCase().includes("damage")) {
            exclusionsList.push(`Damaged / cracked area excluded (${fl.elevationName}${fl.location ? ` — ${fl.location}` : ""})`)
        }
    }
    exclusionsList.push("Internal faces of glass (unless separately agreed)")
    exclusionsList.push("Hardened cement, paint and adhesive residue")
    exclusionsList.push("Repair of pre-existing damage, failed sealant or penetrated staining")

    // Contact details
    const primaryContact = quote?.contact || project.client?.contacts?.[0] || null
    const contactName =
        primaryContact?.name ||
        quote?.attentionTo ||
        project.client?.attentionTo ||
        project.client?.name ||
        "Site Contact"
    const contactPhone = primaryContact?.phone || project.client?.phone || null
    const siteAddress = quote?.site || project.client?.address || project.name
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(siteAddress)}`

    // Resolve signed URLs for already-uploaded JobSheet photos
    const existingSheet = project.jobSheet
    const rawElevPhotos = ((existingSheet?.elevationPhotos as any) || {}) as Record<string, { before?: any[]; after?: any[] }>
    const resolvedElevPhotos: Record<string, { before: any[]; after: any[] }> = {}

    for (const [k, slot] of Object.entries(rawElevPhotos)) {
        const beforeResolved = await Promise.all(
            (slot?.before || []).map(async (item: any) => ({
                ...item,
                signedUrl: item.path ? await getSignedPhotoUrl(item.path) : ""
            }))
        )
        const afterResolved = await Promise.all(
            (slot?.after || []).map(async (item: any) => ({
                ...item,
                signedUrl: item.path ? await getSignedPhotoUrl(item.path) : ""
            }))
        )
        resolvedElevPhotos[k] = { before: beforeResolved, after: afterResolved }
    }

    const rawIssuePhotos: any[] = Array.isArray(existingSheet?.issuePhotos) ? (existingSheet!.issuePhotos as any[]) : []
    const resolvedIssuePhotos = await Promise.all(
        rawIssuePhotos.map(async (item: any) => ({
            ...item,
            signedUrl: item.path ? await getSignedPhotoUrl(item.path) : ""
        }))
    )

    // Live Open-Meteo site forecast
    const forecast = await getOpenMeteoSiteForecastForDate(
        siteAddress,
        project.startDate || new Date(),
        (project.jobSpecs as any)?.coordinates
    )
    const flightWeather = evaluateFlightWeatherStatus(forecast, settings as any)

    const jobData = {
        projectId: project.id,
        jobName: project.name,
        isRecurringVisit: Boolean(project.parentProjectId),
        clientName: project.client?.name || "Client",
        siteAddress,
        mapsUrl,
        contactName,
        contactPhone,
        whatsappUrl: formatWhatsAppUrl(contactPhone),
        poNumber: quote?.clientPoNumber || quote?.reference || "PO on file",
        scheduledDate: project.startDate ? project.startDate.toISOString() : null,
        projectStatus: project.status,
        elevations,
        exclusionsList,
        conditionFlags,
        sitePhotos: resolvedSitePhotos,
        flightWeather,
        drones: drones.map(d => ({
            id: d.id,
            name: d.name,
            serialNumber: d.serialNumber,
            model: d.model
        })),
        pilots: teamUsers.map(u => ({
            id: u.id,
            label: u.name ? `${u.name} (${u.role})` : `${u.email} (${u.role})`
        })),
        jobSheet: {
            status: existingSheet?.status || "NOT_STARTED",
            pilotUserId: existingSheet?.pilotUserId || project.pilotUserId || authUser.id,
            droneId: existingSheet?.droneId || project.droneId || (drones[0]?.id || ""),
            elevationFlights: (existingSheet?.elevationFlights as any) || {},
            totalFlightMinutes: existingSheet?.totalFlightMinutes ?? null,
            checklist: (existingSheet?.checklist as any) || {
                weatherChecked: false,
                exclusionZoneSetUp: false,
                ppeOn: false,
                spotterInPosition: false,
                aircraftCheck: false,
                waterPumpPressurised: false
            },
            startedAt: existingSheet?.startedAt ? existingSheet.startedAt.toISOString() : null,
            finishedAt: existingSheet?.finishedAt ? existingSheet.finishedAt.toISOString() : null,
            timeLogs: Array.isArray(existingSheet?.timeLogs) ? existingSheet!.timeLogs : [],
            elevationPhotos: resolvedElevPhotos,
            issuesNotes: existingSheet?.issuesNotes || "",
            issuePhotos: resolvedIssuePhotos,
            signOffName: existingSheet?.signOffName || "",
            signOffSignature: existingSheet?.signOffSignature || "",
            signedOffAt: existingSheet?.signedOffAt ? existingSheet.signedOffAt.toISOString() : null,
            clientUnavailable: existingSheet?.clientUnavailable || false,
            clientUnavailableReason: existingSheet?.clientUnavailableReason || "",
            standbyFlagged: existingSheet?.standbyFlagged || false,
            standbyReason: existingSheet?.standbyReason || null,
            standbyStatus: existingSheet?.standbyStatus || null,
            completionReportId: existingSheet?.completionReportId || null
        },
        // Admin-only links (never populated with prices; hidden for CREW)
        adminLinks: authUser.role !== "CREW"
            ? {
                projectHref: `/projects/${project.id}`,
                reportHref: existingSheet?.completionReportId ? `/reports/${existingSheet.completionReportId}` : null,
                draftBalanceInvoiceHref: draftBalanceInvoice ? `/invoices/${draftBalanceInvoice.id}` : null,
                draftBalanceInvoiceNumber: draftBalanceInvoice?.quoteNumber || null
            }
            : null
    }

    return (
        <MobileJobSheetClient
            job={jobData}
            currentUserRole={authUser.role}
        />
    )
}
