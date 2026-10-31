export type ComplianceSeverity = "VALID" | "DUE_SOON" | "CRITICAL" | "EXPIRED" | "MISSING"

export type CoreComplianceCategory =
    | "ABEOD_AGREEMENT"
    | "INSURANCE"
    | "COIDA"
    | "TAX_CLEARANCE"
    | "RPL"

export type AllComplianceCategory =
    | CoreComplianceCategory
    | "COMPANY_REG"
    | "BBBEE"
    | "BANK_CONFIRMATION"
    | "SAFETY_HSE_PLAN"
    | "OTHER"

export const CORE_COMPLIANCE_CATEGORIES: Array<{
    category: CoreComplianceCategory
    label: string
    shortLabel: string
    authorityHint: string
    vendorPrefix: string
    isPilotScoped?: boolean
}> = [
    {
        category: "ABEOD_AGREEMENT",
        label: "ABEOD Operating Agreement",
        shortLabel: "ABEOD Agreement",
        authorityHint: "ABEOD / SACAA Part 101 ROC",
        vendorPrefix: "01_ABEOD_Operating_Agreement",
    },
    {
        category: "INSURANCE",
        label: "Aviation Liability Insurance",
        shortLabel: "Insurance",
        authorityHint: "Aviation Public Liability / Hull",
        vendorPrefix: "02_Aviation_Liability_Insurance",
    },
    {
        category: "COIDA",
        label: "COIDA Letter of Good Standing",
        shortLabel: "COIDA",
        authorityHint: "Dept. of Employment & Labour",
        vendorPrefix: "03_COIDA_Letter_of_Good_Standing",
    },
    {
        category: "TAX_CLEARANCE",
        label: "SARS Tax Clearance / PIN",
        shortLabel: "Tax Clearance",
        authorityHint: "South African Revenue Service",
        vendorPrefix: "04_SARS_Tax_Clearance",
    },
    {
        category: "RPL",
        label: "Remote Pilot Licence (RPL)",
        shortLabel: "Pilot RPL",
        authorityHint: "SACAA Remote Pilot Licence",
        vendorPrefix: "05_SACAA_Remote_Pilot_Licence",
        isPilotScoped: true,
    },
]

export const ALL_COMPLIANCE_CATEGORY_META: Record<
    AllComplianceCategory,
    { label: string; shortLabel: string; vendorPrefix: string; defaultOrder: number }
> = {
    ABEOD_AGREEMENT: {
        label: "ABEOD Operating Agreement",
        shortLabel: "ABEOD Agreement",
        vendorPrefix: "01_ABEOD_Operating_Agreement",
        defaultOrder: 10,
    },
    INSURANCE: {
        label: "Aviation Liability Insurance",
        shortLabel: "Insurance",
        vendorPrefix: "02_Aviation_Liability_Insurance",
        defaultOrder: 20,
    },
    COIDA: {
        label: "COIDA Letter of Good Standing",
        shortLabel: "COIDA",
        vendorPrefix: "03_COIDA_Letter_of_Good_Standing",
        defaultOrder: 30,
    },
    TAX_CLEARANCE: {
        label: "SARS Tax Clearance / PIN",
        shortLabel: "Tax Clearance",
        vendorPrefix: "04_SARS_Tax_Clearance",
        defaultOrder: 40,
    },
    RPL: {
        label: "Remote Pilot Licence (RPL)",
        shortLabel: "Pilot RPL",
        vendorPrefix: "05_SACAA_Remote_Pilot_Licence",
        defaultOrder: 50,
    },
    COMPANY_REG: {
        label: "Company Registration (CIPC)",
        shortLabel: "CIPC Reg",
        vendorPrefix: "06_CIPC_Company_Registration",
        defaultOrder: 60,
    },
    BBBEE: {
        label: "B-BBEE Certificate / Affidavit",
        shortLabel: "B-BBEE",
        vendorPrefix: "07_BBBEE_Certificate",
        defaultOrder: 70,
    },
    BANK_CONFIRMATION: {
        label: "Bank Confirmation Letter",
        shortLabel: "Bank Letter",
        vendorPrefix: "08_Bank_Confirmation_Letter",
        defaultOrder: 80,
    },
    SAFETY_HSE_PLAN: {
        label: "HSE / Flight Safety Manual",
        shortLabel: "Safety / HSE",
        vendorPrefix: "09_HSE_Safety_Plan",
        defaultOrder: 90,
    },
    OTHER: {
        label: "Supporting Compliance Document",
        shortLabel: "Other",
        vendorPrefix: "10_Supporting_Document",
        defaultOrder: 100,
    },
}

export function isComplianceFeatureEnabled(companyId?: string | null, settings?: any): boolean {
    if (!companyId) return false
    if (settings?.complianceEnabled === true) return true
    return Boolean(
        companyId === "70af7281-072d-4ed5-9f2e-af4d93e99ea9" ||
            settings?.theme === "dark-orange" ||
            settings?.layoutPreferences?.dashboardView === "drone" ||
            settings?.name?.toLowerCase?.()?.includes("aerowash")
    )
}

export interface EvaluatedDocumentStatus {
    severity: ComplianceSeverity
    daysRemaining: number | null
    label: string
    alertStage: "30_DAY" | "14_DAY" | "7_DAY" | "EXPIRED" | null
}

export function evaluateComplianceDocument(
    doc: {
        expiryDate?: Date | string | null
        alertDaysBefore?: number | null
    },
    now = new Date()
): EvaluatedDocumentStatus {
    if (!doc.expiryDate) {
        return {
            severity: "VALID",
            daysRemaining: null,
            label: "Valid (No Expiry)",
            alertStage: null,
        }
    }

    const exp = new Date(doc.expiryDate)
    if (isNaN(exp.getTime())) {
        return {
            severity: "VALID",
            daysRemaining: null,
            label: "Valid",
            alertStage: null,
        }
    }

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfExpiry = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate()).getTime()
    const daysRemaining = Math.round((startOfExpiry - startOfToday) / 86400000)
    const warnWindow = Math.max(15, doc.alertDaysBefore ?? 30)

    if (daysRemaining < 0) {
        return {
            severity: "EXPIRED",
            daysRemaining,
            label: `Expired ${Math.abs(daysRemaining)}d ago`,
            alertStage: "EXPIRED",
        }
    }
    if (daysRemaining === 0) {
        return {
            severity: "EXPIRED",
            daysRemaining: 0,
            label: "Expires today",
            alertStage: "EXPIRED",
        }
    }
    if (daysRemaining <= 7) {
        return {
            severity: "CRITICAL",
            daysRemaining,
            label: `Expires in ${daysRemaining}d`,
            alertStage: "7_DAY",
        }
    }
    if (daysRemaining <= 14) {
        return {
            severity: "CRITICAL",
            daysRemaining,
            label: `Expires in ${daysRemaining}d`,
            alertStage: "14_DAY",
        }
    }
    if (daysRemaining <= warnWindow) {
        return {
            severity: "DUE_SOON",
            daysRemaining,
            label: `Expires in ${daysRemaining}d`,
            alertStage: daysRemaining <= 30 ? "30_DAY" : null,
        }
    }

    return {
        severity: "VALID",
        daysRemaining,
        label: `Valid (${daysRemaining}d left)`,
        alertStage: null,
    }
}

export interface EvaluatedDroneMaintenance {
    severity: "VALID" | "DUE_SOON" | "CRITICAL" | "EXPIRED"
    label: string
    totalAirframeMinutes: number
    minutesSinceLastService: number
    minutesRemainingToService: number
    daysUntilNextService: number | null
    reasons: string[]
}

export function evaluateDroneMaintenance(
    drone: {
        airworthinessStatus?: string | null
        manualBaseFlightMinutes?: number | null
        flightMinutesAtLastService?: number | null
        maintenanceIntervalMinutes?: number | null
        maintenanceIntervalDays?: number | null
        lastMaintenanceDate?: Date | string | null
        nextMaintenanceDueDate?: Date | string | null
    },
    loggedFlightMinutes: number,
    now = new Date()
): EvaluatedDroneMaintenance {
    const baseMins = drone.manualBaseFlightMinutes ?? 0
    const totalAirframeMinutes = Math.max(0, baseMins + (loggedFlightMinutes || 0))
    const lastServiceMins = drone.flightMinutesAtLastService ?? 0
    const intervalMins = Math.max(60, drone.maintenanceIntervalMinutes ?? 3000)
    const minutesSinceLastService = Math.max(0, totalAirframeMinutes - lastServiceMins)
    const minutesRemainingToService = intervalMins - minutesSinceLastService

    let effectiveNextDue: Date | null = null
    if (drone.nextMaintenanceDueDate) {
        const d = new Date(drone.nextMaintenanceDueDate)
        if (!isNaN(d.getTime())) effectiveNextDue = d
    } else if (drone.lastMaintenanceDate && drone.maintenanceIntervalDays) {
        const last = new Date(drone.lastMaintenanceDate)
        if (!isNaN(last.getTime())) {
            effectiveNextDue = new Date(last.getTime() + drone.maintenanceIntervalDays * 86400000)
        }
    }

    let daysUntilNextService: number | null = null
    if (effectiveNextDue) {
        const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const dueMs = new Date(
            effectiveNextDue.getFullYear(),
            effectiveNextDue.getMonth(),
            effectiveNextDue.getDate()
        ).getTime()
        daysUntilNextService = Math.round((dueMs - todayMs) / 86400000)
    }

    const reasons: string[] = []
    let severity: "VALID" | "DUE_SOON" | "CRITICAL" | "EXPIRED" = "VALID"

    if (drone.airworthinessStatus === "GROUNDED") {
        severity = "EXPIRED"
        reasons.push("Aircraft grounded")
    } else if (drone.airworthinessStatus === "MAINTENANCE_DUE") {
        severity = "EXPIRED"
        reasons.push("Flagged maintenance due")
    }

    if (minutesRemainingToService <= 0) {
        severity = "EXPIRED"
        reasons.push(`Service interval exceeded by ${Math.abs(minutesRemainingToService)} min`)
    } else if (minutesRemainingToService <= 60) {
        if (severity !== "EXPIRED") severity = "CRITICAL"
        reasons.push(`${minutesRemainingToService} flight min remaining to service`)
    } else if (minutesRemainingToService <= 300) {
        if (severity === "VALID") severity = "DUE_SOON"
        reasons.push(`${(minutesRemainingToService / 60).toFixed(1)} flight hrs remaining to service`)
    }

    if (daysUntilNextService !== null) {
        if (daysUntilNextService <= 0) {
            severity = "EXPIRED"
            reasons.push(
                daysUntilNextService === 0
                    ? "Scheduled maintenance due today"
                    : `Scheduled maintenance overdue by ${Math.abs(daysUntilNextService)}d`
            )
        } else if (daysUntilNextService <= 3) {
            if (severity !== "EXPIRED") severity = "CRITICAL"
            reasons.push(`Scheduled service in ${daysUntilNextService}d`)
        } else if (daysUntilNextService <= 14) {
            if (severity === "VALID") severity = "DUE_SOON"
            reasons.push(`Scheduled service in ${daysUntilNextService}d`)
        }
    }

    const label =
        severity === "EXPIRED"
            ? drone.airworthinessStatus === "GROUNDED"
                ? "Grounded"
                : "Maintenance Overdue"
            : severity === "CRITICAL"
            ? "Service Critical"
            : severity === "DUE_SOON"
            ? "Service Due Soon"
            : "Serviceable"

    return {
        severity,
        label,
        totalAirframeMinutes,
        minutesSinceLastService,
        minutesRemainingToService,
        daysUntilNextService,
        reasons,
    }
}

export interface EvaluatedBatteryHealth {
    severity: "VALID" | "DUE_SOON" | "CRITICAL" | "EXPIRED"
    label: string
    cycleRatio: number
    cyclesRemaining: number
    reasons: string[]
}

export function evaluateBatteryStatus(
    battery: {
        status?: string | null
        currentCycles?: number | null
        maxRecommendedCycles?: number | null
        healthPercent?: number | null
        nextInspectionDueDate?: Date | string | null
    },
    now = new Date()
): EvaluatedBatteryHealth {
    const current = battery.currentCycles ?? 0
    const max = Math.max(1, battery.maxRecommendedCycles ?? 200)
    const cycleRatio = current / max
    const cyclesRemaining = max - current
    const reasons: string[] = []
    let severity: "VALID" | "DUE_SOON" | "CRITICAL" | "EXPIRED" = "VALID"

    if (battery.status === "RETIRED") {
        return {
            severity: "VALID",
            label: "Retired",
            cycleRatio,
            cyclesRemaining,
            reasons: ["Retired from active fleet"],
        }
    }

    if (battery.status === "SWOLLEN_QUARANTINE") {
        severity = "EXPIRED"
        reasons.push("Swollen / quarantined — do not fly")
    } else if (battery.status === "MAINTENANCE_DUE") {
        severity = "EXPIRED"
        reasons.push("Flagged for inspection/maintenance")
    }

    if (cycleRatio >= 1) {
        severity = "EXPIRED"
        reasons.push(`Reached max cycle limit (${current}/${max})`)
    } else if (cycleRatio >= 0.95) {
        if (severity !== "EXPIRED") severity = "CRITICAL"
        reasons.push(`${cyclesRemaining} cycles left before retirement (${current}/${max})`)
    } else if (cycleRatio >= 0.85) {
        if (severity === "VALID") severity = "DUE_SOON"
        reasons.push(`${cyclesRemaining} cycles remaining (${current}/${max})`)
    }

    if (battery.healthPercent != null) {
        if (battery.healthPercent < 75) {
            severity = "EXPIRED"
            reasons.push(`Low battery SOH (${battery.healthPercent}%)`)
        } else if (battery.healthPercent <= 80) {
            if (severity === "VALID") severity = "DUE_SOON"
            reasons.push(`Battery SOH at ${battery.healthPercent}%`)
        }
    }

    if (battery.nextInspectionDueDate) {
        const d = new Date(battery.nextInspectionDueDate)
        if (!isNaN(d.getTime())) {
            const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
            const dueMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
            const daysLeft = Math.round((dueMs - todayMs) / 86400000)
            if (daysLeft <= 0) {
                severity = "EXPIRED"
                reasons.push("Battery inspection overdue")
            } else if (daysLeft <= 14 && severity === "VALID") {
                severity = "DUE_SOON"
                reasons.push(`Inspection due in ${daysLeft}d`)
            }
        }
    }

    const label =
        battery.status === "SWOLLEN_QUARANTINE"
            ? "Quarantined"
            : severity === "EXPIRED"
            ? "Retire / Maint Due"
            : severity === "CRITICAL"
            ? "Near Cycle Limit"
            : severity === "DUE_SOON"
            ? "Check Soon"
            : "Healthy"

    return {
        severity,
        label,
        cycleRatio,
        cyclesRemaining,
        reasons,
    }
}

export interface VendorPackReadiness {
    isReady: boolean
    includedCount: number
    missingCategories: Array<{ category: CoreComplianceCategory; label: string }>
    expiredDocuments: Array<{ id: string; title: string; category: string; label: string }>
    expiringSoonDocuments: Array<{ id: string; title: string; category: string; label: string }>
}

export function evaluateVendorPackReadiness(
    activeDocuments: Array<{
        id: string
        category: string
        title: string
        expiryDate?: Date | string | null
        alertDaysBefore?: number | null
        includeInVendorPack?: boolean
        isArchived?: boolean
    }>,
    now = new Date()
): VendorPackReadiness {
    const nonArchived = activeDocuments.filter(d => !d.isArchived)
    const missingCategories: Array<{ category: CoreComplianceCategory; label: string }> = []
    const expiredDocuments: Array<{ id: string; title: string; category: string; label: string }> = []
    const expiringSoonDocuments: Array<{ id: string; title: string; category: string; label: string }> = []

    for (const core of CORE_COMPLIANCE_CATEGORIES) {
        const matching = nonArchived.filter(d => d.category === core.category)
        if (matching.length === 0) {
            missingCategories.push({ category: core.category, label: core.label })
        }
    }

    const packDocs = nonArchived.filter(d => d.includeInVendorPack !== false)
    for (const doc of packDocs) {
        const st = evaluateComplianceDocument(doc, now)
        if (st.severity === "EXPIRED") {
            expiredDocuments.push({
                id: doc.id,
                title: doc.title,
                category: doc.category,
                label: st.label,
            })
        } else if (st.severity === "CRITICAL" || st.severity === "DUE_SOON") {
            expiringSoonDocuments.push({
                id: doc.id,
                title: doc.title,
                category: doc.category,
                label: st.label,
            })
        }
    }

    return {
        isReady: missingCategories.length === 0 && expiredDocuments.length === 0 && packDocs.length > 0,
        includedCount: packDocs.length,
        missingCategories,
        expiredDocuments,
        expiringSoonDocuments,
    }
}

export function formatFlightHoursAndMinutes(totalMinutes: number): string {
    const mins = Math.max(0, Math.round(totalMinutes || 0))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
}
