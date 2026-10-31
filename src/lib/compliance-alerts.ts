import { prisma } from "@/lib/prisma"
import { sendRealEmail } from "@/lib/email"
import {
    ALL_COMPLIANCE_CATEGORY_META,
    type AllComplianceCategory,
    evaluateBatteryStatus,
    evaluateComplianceDocument,
    evaluateDroneMaintenance,
    isComplianceFeatureEnabled,
} from "@/lib/compliance-status"

export interface CompanyComplianceDigestResult {
    companyId: string
    companyName: string
    documentAlertsTriggered: number
    overdueDronesCount: number
    attentionBatteriesCount: number
    emailsDispatchedTo: string[]
}

/**
 * Evaluates compliance document expiries + overdue maintenance for a single company,
 * sends milestone alert emails (30_DAY, 14_DAY, 7_DAY, EXPIRED) without daily spam unless forceSend=true,
 * and updates lastAlertStage / lastAlertSentAt on alerted documents.
 */
export async function checkAndNotifyCompanyComplianceAlerts(
    companyId: string,
    options?: { forceSend?: boolean }
): Promise<CompanyComplianceDigestResult | null> {
    const [company, settings] = await Promise.all([
        prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } }),
        prisma.companySettings.findUnique({ where: { companyId } }),
    ])

    if (!company || !isComplianceFeatureEnabled(companyId, settings)) {
        return null
    }

    const now = new Date()

    const [docs, drones, flightSums, batteries, adminUsers] = await Promise.all([
        prisma.complianceDocument.findMany({
            where: { companyId, isArchived: false },
            include: { pilotUser: { select: { id: true, name: true, email: true, notificationEmail: true } } },
            orderBy: { expiryDate: "asc" },
        }),
        prisma.drone.findMany({
            where: { companyId, isActive: true },
        }),
        prisma.flightLogEntry.groupBy({
            by: ["droneId"],
            where: { companyId, droneId: { not: null } },
            _sum: { durationMinutes: true },
        }),
        prisma.droneBattery.findMany({
            where: { companyId, status: { not: "RETIRED" } },
        }),
        prisma.user.findMany({
            where: {
                companyId,
                OR: [{ isOwner: true }, { role: "ADMIN" }],
            },
            select: { email: true, notificationEmail: true },
        }),
    ])

    const droneMinsMap = new Map<string, number>()
    for (const row of flightSums) {
        if (row.droneId) {
            droneMinsMap.set(row.droneId, row._sum.durationMinutes || 0)
        }
    }

    const triggeredDocs: Array<{
        id: string
        title: string
        categoryLabel: string
        referenceNumber: string | null
        expiryStr: string
        stage: "30_DAY" | "14_DAY" | "7_DAY" | "EXPIRED"
        statusLabel: string
        pilotEmail?: string | null
        pilotName?: string | null
    }> = []

    for (const d of docs) {
        const evaluated = evaluateComplianceDocument(d, now)
        if (!evaluated.alertStage) continue

        const alreadyNotifiedAtThisStage = d.lastAlertStage === evaluated.alertStage
        if (alreadyNotifiedAtThisStage && !options?.forceSend) {
            continue
        }

        const catMeta =
            ALL_COMPLIANCE_CATEGORY_META[d.category as AllComplianceCategory] ||
            ALL_COMPLIANCE_CATEGORY_META.OTHER

        triggeredDocs.push({
            id: d.id,
            title: d.title,
            categoryLabel: catMeta.label,
            referenceNumber: d.referenceNumber,
            expiryStr: d.expiryDate ? new Date(d.expiryDate).toISOString().split("T")[0] : "—",
            stage: evaluated.alertStage,
            statusLabel: evaluated.label,
            pilotEmail: d.pilotUser?.notificationEmail || d.pilotUser?.email || null,
            pilotName: d.pilotUser?.name || d.pilotUser?.email || null,
        })
    }

    const overdueDrones = drones
        .map(dr => ({
            drone: dr,
            eval: evaluateDroneMaintenance(dr, droneMinsMap.get(dr.id) || 0, now),
        }))
        .filter(x => x.eval.severity === "EXPIRED" || x.eval.severity === "CRITICAL")

    const attentionBatteries = batteries
        .map(b => ({
            battery: b,
            eval: evaluateBatteryStatus(b, now),
        }))
        .filter(x => x.eval.severity === "EXPIRED" || x.eval.severity === "CRITICAL")

    const shouldSend =
        triggeredDocs.length > 0 ||
        (Boolean(options?.forceSend) && (overdueDrones.length > 0 || attentionBatteries.length > 0))

    if (!shouldSend) {
        return {
            companyId,
            companyName: settings?.name || company.name,
            documentAlertsTriggered: 0,
            overdueDronesCount: overdueDrones.length,
            attentionBatteriesCount: attentionBatteries.length,
            emailsDispatchedTo: [],
        }
    }

    const customEmails = (settings?.complianceAlertEmails || "")
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(s => s.includes("@"))

    const recipients = Array.from(
        new Set([
            ...adminUsers.map(u => (u.notificationEmail || u.email || "").trim()).filter(Boolean),
            ...(settings?.copyNotificationsTo ? [settings.copyNotificationsTo.trim()] : []),
            ...customEmails,
        ])
    )

    const appUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://ur-ops.vercel.app"
    const companyDisplay = settings?.name || company.name

    const lines: string[] = [
        `${companyDisplay} — Compliance & Fleet Readiness Alert`,
        "",
    ]

    if (triggeredDocs.length > 0) {
        lines.push("DOCUMENT EXPIRY ALERTS:")
        for (const td of triggeredDocs) {
            lines.push(
                `• [${td.statusLabel.toUpperCase()}] ${td.categoryLabel}: ${td.title}` +
                    (td.pilotName ? ` (Pilot: ${td.pilotName})` : "") +
                    (td.referenceNumber ? ` — Ref: ${td.referenceNumber}` : "") +
                    ` — Expiry: ${td.expiryStr}`
            )
        }
        lines.push("")
    }

    if (overdueDrones.length > 0) {
        lines.push("AIRCRAFT MAINTENANCE ATTENTION:")
        for (const od of overdueDrones) {
            lines.push(
                `• ${od.drone.name} (${od.drone.serialNumber}): ${od.eval.label} — ${od.eval.reasons.join("; ")}`
            )
        }
        lines.push("")
    }

    if (attentionBatteries.length > 0) {
        lines.push("BATTERY FLEET ATTENTION:")
        for (const ab of attentionBatteries) {
            lines.push(
                `• ${ab.battery.label}: ${ab.eval.label} — ${ab.eval.reasons.join("; ")}`
            )
        }
        lines.push("")
    }

    lines.push(`Manage renewals, fleet records & Vendor Pack: ${appUrl}/compliance`)

    if (recipients.length > 0) {
        await sendRealEmail({
            to: recipients,
            from: `${companyDisplay} Compliance <info@aerowash.co.za>`,
            replyTo: settings?.email || "info@aerowash.co.za",
            subject: `[Compliance Alert] ${triggeredDocs.length} document(s) expiring/expired — ${companyDisplay}`,
            body: lines.join("\n"),
        })
    }

    // Also notify individual RPL pilot directly if their email is not already in admin recipients
    for (const td of triggeredDocs) {
        if (td.pilotEmail && !recipients.includes(td.pilotEmail)) {
            await sendRealEmail({
                to: [td.pilotEmail],
                from: `${companyDisplay} Compliance <info@aerowash.co.za>`,
                replyTo: settings?.email || "info@aerowash.co.za",
                subject: `[Pilot RPL Alert] ${td.title} — ${td.statusLabel}`,
                body:
                    `Hi ${td.pilotName || "Pilot"},\n\n` +
                    `Your Remote Pilot Licence record "${td.title}"${td.referenceNumber ? ` (${td.referenceNumber})` : ""} is marked: ${td.statusLabel} (Expiry: ${td.expiryStr}).\n\n` +
                    `Please upload your renewed RPL in UROps Compliance:\n${appUrl}/compliance\n`,
            }).catch(err => console.warn("[Compliance Alerts] Pilot RPL email warning:", err))
        }
    }

    // Persist alert stage so we only re-notify when crossing the next threshold
    for (const td of triggeredDocs) {
        await prisma.complianceDocument.update({
            where: { id: td.id },
            data: {
                lastAlertStage: td.stage,
                lastAlertSentAt: now,
            },
        })
    }

    return {
        companyId,
        companyName: companyDisplay,
        documentAlertsTriggered: triggeredDocs.length,
        overdueDronesCount: overdueDrones.length,
        attentionBatteriesCount: attentionBatteries.length,
        emailsDispatchedTo: recipients,
    }
}

/**
 * Lightweight top-banner summary for DashboardLayout (ADMIN & MANAGER only, never CREW).
 */
export async function getLayoutComplianceBannerItems(companyId: string, settings?: any) {
    if (!isComplianceFeatureEnabled(companyId, settings)) {
        return []
    }

    try {
        const now = new Date()
        const [docs, drones, flightSums] = await Promise.all([
            prisma.complianceDocument.findMany({
                where: { companyId, isArchived: false },
                select: {
                    id: true,
                    title: true,
                    category: true,
                    expiryDate: true,
                    alertDaysBefore: true,
                },
            }),
            prisma.drone.findMany({
                where: { companyId, isActive: true },
                select: {
                    id: true,
                    name: true,
                    airworthinessStatus: true,
                    manualBaseFlightMinutes: true,
                    flightMinutesAtLastService: true,
                    maintenanceIntervalMinutes: true,
                    maintenanceIntervalDays: true,
                    lastMaintenanceDate: true,
                    nextMaintenanceDueDate: true,
                },
            }),
            prisma.flightLogEntry.groupBy({
                by: ["droneId"],
                where: { companyId, droneId: { not: null } },
                _sum: { durationMinutes: true },
            }),
        ])

        const items: Array<{ id: string; label: string; severity: "CRITICAL" | "EXPIRED" }> = []

        for (const d of docs) {
            const st = evaluateComplianceDocument(d, now)
            if (st.severity === "EXPIRED" || st.severity === "CRITICAL") {
                const catMeta =
                    ALL_COMPLIANCE_CATEGORY_META[d.category as AllComplianceCategory] ||
                    ALL_COMPLIANCE_CATEGORY_META.OTHER
                items.push({
                    id: `doc-${d.id}`,
                    label: `${catMeta.shortLabel}: ${st.label}`,
                    severity: st.severity,
                })
            }
        }

        const minsMap = new Map<string, number>()
        for (const r of flightSums) {
            if (r.droneId) minsMap.set(r.droneId, r._sum.durationMinutes || 0)
        }

        for (const dr of drones) {
            const st = evaluateDroneMaintenance(dr, minsMap.get(dr.id) || 0, now)
            if (st.severity === "EXPIRED") {
                items.push({
                    id: `drone-${dr.id}`,
                    label: `${dr.name}: ${st.label}`,
                    severity: "EXPIRED",
                })
            }
        }

        return items
    } catch {
        return []
    }
}
