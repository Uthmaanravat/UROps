import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
    ALL_COMPLIANCE_CATEGORY_META,
    type AllComplianceCategory,
    evaluateComplianceDocument,
    formatFlightHoursAndMinutes,
} from "@/lib/compliance-status"

export interface VendorPackSummaryPdfInput {
    companyName: string
    registrationNumber?: string | null
    taxId?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
    website?: string | null
    bankDetails?: string | null
    documents: Array<{
        category: string
        title: string
        referenceNumber?: string | null
        issuingAuthority?: string | null
        issuedDate?: Date | string | null
        expiryDate?: Date | string | null
        pilotName?: string | null
    }>
    drones: Array<{
        name: string
        model?: string | null
        serialNumber: string
        sacaaRegNumber?: string | null
        airworthinessLabel: string
        totalAirframeMinutes: number
    }>
    pilots: Array<{
        name: string
        email: string
        rplReference?: string | null
        rplExpiry?: Date | string | null
        rplStatusLabel: string
    }>
    generatedAt?: Date
}

function fmtDate(val?: Date | string | null): string {
    if (!val) return "—"
    const d = new Date(val)
    if (isNaN(d.getTime())) return "—"
    return d.toISOString().split("T")[0]
}

export function generateVendorComplianceSummaryPdfBuffer(input: VendorPackSummaryPdfInput): Buffer {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const generatedAt = input.generatedAt || new Date()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Top Header Banner
    doc.setFillColor(15, 15, 26)
    doc.rect(0, 0, pageWidth, 38, "F")
    doc.setFillColor(249, 115, 22) // AeroWash orange accent strip
    doc.rect(0, 38, pageWidth, 2, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text(input.companyName || "AeroWash", 14, 17)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(210, 214, 224)
    doc.text("VENDOR ONBOARDING & STATUTORY COMPLIANCE SUMMARY PACK", 14, 25)
    doc.setFontSize(8.5)
    doc.text(`Generated: ${fmtDate(generatedAt)}`, 14, 32)

    let y = 48

    // Section 1: Company Statutory Details
    doc.setTextColor(20, 24, 36)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text("1. COMPANY & STATUTORY DETAILS", 14, y)
    y += 4

    const companyRows: Array<[string, string, string, string]> = [
        [
            "Legal / Trading Name",
            input.companyName || "—",
            "Company Reg. No.",
            input.registrationNumber || "On file",
        ],
        [
            "VAT / Tax Reference",
            input.taxId || "On file",
            "Primary Contact",
            [input.phone, input.email].filter(Boolean).join(" | ") || "—",
        ],
        [
            "Registered Address",
            input.address || "—",
            "Website",
            input.website || "—",
        ],
    ]

    if (input.bankDetails?.trim()) {
        companyRows.push([
            "Banking Details",
            input.bankDetails.replace(/\r?\n/g, " | "),
            "",
            "",
        ])
    }

    autoTable(doc, {
        startY: y,
        body: companyRows,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 35, 45] },
        columnStyles: {
            0: { fontStyle: "bold", fillColor: [245, 247, 250], cellWidth: 38 },
            1: { cellWidth: 58 },
            2: { fontStyle: "bold", fillColor: [245, 247, 250], cellWidth: 36 },
            3: { cellWidth: 50 },
        },
        margin: { left: 14, right: 14 },
    })

    y = (doc as any).lastAutoTable.finalY + 9

    // Section 2: Included Compliance Certificates & Agreements
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(20, 24, 36)
    doc.text("2. INCLUDED COMPLIANCE CERTIFICATES & OPERATING AGREEMENTS", 14, y)
    y += 4

    const docRows = input.documents.map((d, idx) => {
        const meta =
            ALL_COMPLIANCE_CATEGORY_META[d.category as AllComplianceCategory] ||
            ALL_COMPLIANCE_CATEGORY_META.OTHER
        const evalSt = evaluateComplianceDocument({ expiryDate: d.expiryDate }, generatedAt)
        const titleWithPilot = d.pilotName ? `${d.title} (${d.pilotName})` : d.title
        return [
            String(idx + 1).padStart(2, "0"),
            meta.shortLabel,
            titleWithPilot,
            d.referenceNumber || "—",
            d.issuingAuthority || "—",
            fmtDate(d.expiryDate),
            evalSt.severity === "EXPIRED" ? "EXPIRED" : "VALID",
        ]
    })

    autoTable(doc, {
        startY: y,
        head: [["#", "Category", "Document", "Ref / Policy / PIN", "Authority", "Expiry", "Status"]],
        body:
            docRows.length > 0
                ? docRows
                : [["—", "—", "No documents attached to pack", "—", "—", "—", "—"]],
        theme: "striped",
        headStyles: { fillColor: [15, 15, 26], textColor: [255, 255, 255], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.2 },
        margin: { left: 14, right: 14 },
    })

    y = (doc as any).lastAutoTable.finalY + 9

    // Section 3: Certified Remote Pilots (RPL)
    if (input.pilots.length > 0) {
        if (y > 240) {
            doc.addPage()
            y = 20
        }
        doc.setFont("helvetica", "bold")
        doc.setFontSize(11)
        doc.setTextColor(20, 24, 36)
        doc.text("3. CERTIFIED REMOTE PILOTS (SACAA RPL)", 14, y)
        y += 4

        autoTable(doc, {
            startY: y,
            head: [["Pilot Name", "Contact Email", "SACAA RPL Reference", "Licence Expiry", "Status"]],
            body: input.pilots.map(p => [
                p.name,
                p.email,
                p.rplReference || "On file",
                fmtDate(p.rplExpiry),
                p.rplStatusLabel,
            ]),
            theme: "striped",
            headStyles: { fillColor: [15, 15, 26], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 2.2 },
            margin: { left: 14, right: 14 },
        })

        y = (doc as any).lastAutoTable.finalY + 9
    }

    // Section 4: Registered Aircraft Fleet
    if (input.drones.length > 0) {
        if (y > 240) {
            doc.addPage()
            y = 20
        }
        doc.setFont("helvetica", "bold")
        doc.setFontSize(11)
        doc.setTextColor(20, 24, 36)
        doc.text("4. REGISTERED UAS / DRONE FLEET SCHEDULE", 14, y)
        y += 4

        autoTable(doc, {
            startY: y,
            head: [["Aircraft", "Model", "Serial Number", "SACAA Reg.", "Airframe Hours", "Airworthiness"]],
            body: input.drones.map(d => [
                d.name,
                d.model || "—",
                d.serialNumber,
                d.sacaaRegNumber || "On ROC Spec",
                formatFlightHoursAndMinutes(d.totalAirframeMinutes),
                d.airworthinessLabel,
            ]),
            theme: "striped",
            headStyles: { fillColor: [15, 15, 26], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 2.2 },
            margin: { left: 14, right: 14 },
        })

        y = (doc as any).lastAutoTable.finalY + 8
    }

    // Footer Note
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFont("helvetica", "italic")
        doc.setFontSize(7.5)
        doc.setTextColor(120, 125, 135)
        doc.text(
            `${input.companyName} — Confidential Vendor Compliance Pack | Page ${i} of ${pageCount}`,
            14,
            288
        )
    }

    const arrayBuffer = doc.output("arraybuffer")
    return Buffer.from(arrayBuffer)
}

export interface FlightLogPdfRow {
    flightDate: string
    pilotName: string
    droneName: string
    projectName: string
    siteLocation: string
    purpose: string
    sorties: number
    durationMinutes: number
    source: string
}

export function buildSacaaFlightLogPdf(params: {
    companyName: string
    rows: FlightLogPdfRow[]
    filterSummary?: string
}): jsPDF {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFillColor(15, 15, 26)
    doc.rect(0, 0, pageWidth, 26, "F")
    doc.setFillColor(249, 115, 22)
    doc.rect(0, 26, pageWidth, 1.5, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text(`${params.companyName} — RPAS / UAS FLIGHT OPERATIONS LOGBOOK`, 14, 12)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(210, 214, 224)
    const totalMins = params.rows.reduce((sum, r) => sum + (r.durationMinutes || 0), 0)
    const totalSorties = params.rows.reduce((sum, r) => sum + (r.sorties || 1), 0)
    doc.text(
        `Entries: ${params.rows.length}  |  Total Sorties: ${totalSorties}  |  Total Flight Time: ${formatFlightHoursAndMinutes(totalMins)} (${totalMins} min)` +
            (params.filterSummary ? `  |  Filter: ${params.filterSummary}` : ""),
        14,
        20
    )

    autoTable(doc, {
        startY: 33,
        head: [
            [
                "Date",
                "Pilot in Command",
                "Aircraft (SN / Reg)",
                "Job / Project",
                "Site / Location",
                "Purpose",
                "Sorties",
                "Flight Time",
                "Source",
            ],
        ],
        body: params.rows.map(r => [
            r.flightDate,
            r.pilotName,
            r.droneName,
            r.projectName,
            r.siteLocation,
            r.purpose.replace(/_/g, " "),
            String(r.sorties || 1),
            `${r.durationMinutes} min (${formatFlightHoursAndMinutes(r.durationMinutes)})`,
            r.source === "JOB_SHEET" ? "Job Sheet" : "Manual",
        ]),
        theme: "striped",
        headStyles: { fillColor: [15, 15, 26], textColor: [255, 255, 255], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
    })

    return doc
}
