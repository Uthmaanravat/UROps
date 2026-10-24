import { jsPDF } from "jspdf"
import "jspdf-autotable"
import QRCode from "qrcode"

// Declare autoTable plugin on jsPDF
declare module "jspdf" {
    interface jsPDF {
        autoTable: (options: any) => jsPDF
        lastAutoTable: {
            finalY: number
        }
    }
}

export function getThemePrimaryRGB(theme?: string): [number, number, number] {
    if (!theme) return [163, 230, 53] // Lime default for LR Builders
    const lower = theme.toLowerCase()
    if (lower.includes("orange")) return [208, 94, 0] // #D05E00 AeroWash Dark Orange
    if (lower.includes("blue")) return [37, 99, 235]
    if (lower.includes("violet")) return [139, 92, 246]
    return [163, 230, 53]
}

export function getThemePrimaryHex(theme?: string): string {
    if (!theme) return "#84cc16"
    const lower = theme.toLowerCase()
    if (lower.includes("orange")) return "#D05E00"
    if (lower.includes("blue")) return "#2563eb"
    if (lower.includes("violet")) return "#8b5cf6"
    return "#84cc16"
}

export const DEFAULT_JOB_SPECS = {
    surfaces: "External facade cladding, glass panels, louvers, window frames & rooftop solar array",
    method: "Drone SoftWash Low-Pressure Chemical Application (< 10 bar) + Demineralized Deionized Pure Water Spot-Free Rinse",
    chemicals: "Eco-friendly biodegradable facade surfactant (Neutral pH, non-caustic, solar-panel safe)",
    waterPoint: "External municipal tap connection required on site",
    powerSupply: "220V 16A standard outlet for auxiliary pump & battery charging",
    parking: "Dedicated drone service van staging space within 30m of flight line",
    groundZone: "5m cordoned drop-zone beneath flight perimeter with caution tape & cones",
    pilot: "Flight Lead (Certified Remote Pilot)",
    drone: "Industrial SoftWash Drone System (AeroWash Fleet)",
    rocOperator: "ABEOD Commercial Aviation ROC",
    airspace: "ATNS Flight Logging / VFR Daylight Operations Verified"
}

/**
 * 1. GENERATE OPERATIONS SCHEDULE PDF (A4 LANDSCAPE)
 * Range: This month + next month (default), 3, 6, 12 months
 * Weekly date columns with month headers, prices hidden by default
 */
export async function generateSchedulePdf(
    projects: any[],
    company: any,
    options?: {
        rangeMonths?: number // 2, 3, 6, 12
        showPrices?: boolean
        startDate?: Date
    }
): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageWidth = 297
    const theme = company?.theme || company?.settings?.theme || ""
    const [primaryR, primaryG, primaryB] = getThemePrimaryRGB(theme)

    const companyName = company?.name || company?.settings?.name || "AeroWash (Pty) Ltd"
    const companyPhone = company?.phone || company?.settings?.phone || "067 829 3350"
    const companyEmail = company?.email || company?.settings?.email || "info@aerowash.co.za"
    const regNumber = company?.registrationNumber || company?.settings?.registrationNumber || "2026/475172/07"
    const logoUrl = company?.logoUrl || company?.settings?.logoUrl
    const showPrices = options?.showPrices ?? false

    // Brand Header Bar (Navy + Theme Primary)
    doc.setFillColor(20, 20, 30)
    doc.rect(0, 0, pageWidth, 8, "F")
    doc.setFillColor(primaryR, primaryG, primaryB)
    doc.rect(0, 8, pageWidth, 2.5, "F")

    // Left: Real Logo from Settings
    const headerY = 14
    let logoWidthMm = 28
    if (logoUrl) {
        try {
            const isPng = logoUrl.includes("image/png") || logoUrl.toLowerCase().includes(".png")
            doc.addImage(logoUrl, isPng ? "PNG" : "JPEG", 14, headerY, 26, 14, undefined, "FAST")
            logoWidthMm = 28
        } catch (e) {
            doc.setFillColor(primaryR, primaryG, primaryB)
            doc.roundedRect(14, headerY, 20, 13, 2, 2, "F")
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(10)
            doc.setFont("helvetica", "bold")
            doc.text("AW", 24, headerY + 8.5, { align: "center" })
            logoWidthMm = 22
        }
    } else {
        doc.setFillColor(primaryR, primaryG, primaryB)
        doc.roundedRect(14, headerY, 20, 13, 2, 2, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("AW", 24, headerY + 8.5, { align: "center" })
        logoWidthMm = 22
    }

    // Left: Company Info (strictly bounded to max 85mm so it never overlaps right title)
    const leftX = 14 + logoWidthMm + 3
    doc.setTextColor(20, 20, 30)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text(companyName.toUpperCase(), leftX, headerY + 4)

    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text(`Reg: ${regNumber}  ·  Tel: ${companyPhone}`, leftX, headerY + 8.5)
    doc.text(`Email: ${companyEmail}`, leftX, headerY + 12.5)

    // Right: Document Title & Metadata
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(primaryR, primaryG, primaryB)
    doc.text("OPERATIONS SCHEDULE", pageWidth - 14, headerY + 4.5, { align: "right" })

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 41, 59)
    const rangeMonths = options?.rangeMonths || 2
    doc.text(`PLANNING HORIZON: ${rangeMonths} MONTHS`, pageWidth - 14, headerY + 9, { align: "right" })

    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text(`Generated: ${new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}  ·  AeroWash Flight Ops`, pageWidth - 14, headerY + 13, { align: "right" })

    // Divider line
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(14, headerY + 16, pageWidth - 14, headerY + 16)

    // Build Table
    const tableStartY = headerY + 20

    const tableHeaders = showPrices
        ? ["Target Week", "Client / Partner", "Site Address", "Client PO #", "Flight Crew / Pilot", "Contract Type", "Status", "Value (ZAR)"]
        : ["Target Week", "Client / Partner", "Site Address", "Client PO #", "Flight Crew / Pilot", "Contract Type", "Status"]

    const rows = (projects || []).map((p: any) => {
        const d = p.startDate
            ? new Date(p.startDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
            : (p.status === "IN_PROGRESS" ? "In Progress" : "Pending")

        const clientName = p.client?.name || "Client"
        const site = p.site || p.client?.address || p.name || "Site on file"
        const po = p.poNumber || p.clientPoNumber || p.invoices?.[0]?.clientPoNumber || p.invoices?.[0]?.reference || "PO-Awaiting"
        const crew = p.crew || "Flight Alpha"
        const type = p.isRecurring || p.parentProjectId ? "Recurring Contract" : "Direct Work Order"
        const status = p.status?.replace(/_/g, " ") || "SCHEDULED"
        const val = p.invoices?.[0]?.total ? `R ${Number(p.invoices[0].total).toLocaleString()}` : "—"

        if (showPrices) {
            return [d, clientName, site, po, crew, type, status, val]
        }
        return [d, clientName, site, po, crew, type, status]
    })

    if (rows.length === 0) {
        rows.push(["—", "No work booked for this schedule range", "—", "—", "—", "—", "NO JOBS"])
    }

    doc.autoTable({
        startY: tableStartY,
        head: [tableHeaders],
        body: rows,
        theme: "plain",
        headStyles: {
            fillColor: [20, 20, 30],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 7.5,
            cellPadding: 3
        },
        bodyStyles: {
            fontSize: 7.5,
            textColor: [30, 41, 59],
            cellPadding: 3.2
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: showPrices ? {
            7: { halign: "right", fontStyle: "bold" }
        } : {},
        margin: { left: 14, right: 14 }
    })

    // Footer
    const finalY = doc.lastAutoTable.finalY + 8
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(`Total Scheduled Jobs: ${projects.length}  ·  Confidential Commercial Schedule  ·  AeroWash (Pty) Ltd`, 14, Math.min(finalY, 200))

    return doc
}

/**
 * 2. GENERATE ON-SITE JOB SHEET PDF (A4 PORTRAIT)
 * Strictly ZERO prices. Includes Google Maps QR code, editable specs,
 * low-pressure soft wash specs (< 10 bar), prominent PO # badge, and ABEOD ROC compliance.
 */
export async function generateJobSheetPdf(
    project: any,
    company: any
): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageWidth = 210
    const theme = company?.theme || company?.settings?.theme || ""
    const [primaryR, primaryG, primaryB] = getThemePrimaryRGB(theme)

    const companyName = company?.name || company?.settings?.name || "AeroWash (Pty) Ltd"
    const companyPhone = company?.phone || company?.settings?.phone || "067 829 3350"
    const companyEmail = company?.email || company?.settings?.email || "info@aerowash.co.za"
    const regNumber = company?.registrationNumber || company?.settings?.registrationNumber || "2026/475172/07"
    const logoUrl = company?.logoUrl || company?.settings?.logoUrl

    const specs = {
        ...DEFAULT_JOB_SPECS,
        ...(project.jobSpecs || {})
    }

    // Brand Header Bar
    doc.setFillColor(20, 20, 30)
    doc.rect(0, 0, pageWidth, 8, "F")
    doc.setFillColor(primaryR, primaryG, primaryB)
    doc.rect(0, 8, pageWidth, 2.5, "F")

    // Left: Real Logo from Settings
    const headerY = 14
    let logoWidthMm = 28
    if (logoUrl) {
        try {
            const isPng = logoUrl.includes("image/png") || logoUrl.toLowerCase().includes(".png")
            doc.addImage(logoUrl, isPng ? "PNG" : "JPEG", 14, headerY, 26, 14, undefined, "FAST")
            logoWidthMm = 28
        } catch (e) {
            doc.setFillColor(primaryR, primaryG, primaryB)
            doc.roundedRect(14, headerY, 20, 13, 2, 2, "F")
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(10)
            doc.setFont("helvetica", "bold")
            doc.text("AW", 24, headerY + 8.5, { align: "center" })
            logoWidthMm = 22
        }
    } else {
        doc.setFillColor(primaryR, primaryG, primaryB)
        doc.roundedRect(14, headerY, 20, 13, 2, 2, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("AW", 24, headerY + 8.5, { align: "center" })
        logoWidthMm = 22
    }

    // Left: Company Info (isolated from right title)
    const leftX = 14 + logoWidthMm + 3
    doc.setTextColor(20, 20, 30)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text(companyName.toUpperCase(), leftX, headerY + 4)

    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text(`Reg: ${regNumber}  ·  Tel: ${companyPhone}`, leftX, headerY + 8.5)
    doc.text(`Email: ${companyEmail}`, leftX, headerY + 12.5)

    // Right: Document Title & Job Ref
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(primaryR, primaryG, primaryB)
    doc.text("ON-SITE JOB SHEET", pageWidth - 14, headerY + 4.5, { align: "right" })

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 41, 59)
    const jobRef = `JOB REF: ${project.name}`.toUpperCase()
    const truncatedJobRef = doc.splitTextToSize(jobRef, 75)[0]
    doc.text(truncatedJobRef, pageWidth - 14, headerY + 9, { align: "right" })

    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text(`Printed: ${new Date().toLocaleDateString("en-ZA")}`, pageWidth - 14, headerY + 13, { align: "right" })

    // Divider line
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(14, headerY + 16, pageWidth - 14, headerY + 16)

    // QR Code for Navigation
    const siteQuery = project.site || project.client?.address || project.name || "Cape Town"
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteQuery)}`
    let qrDataUrl = ""
    try {
        const qrFn = (QRCode as any)?.toDataURL ? (QRCode as any).toDataURL : (QRCode as any)?.default?.toDataURL;
        if (qrFn) qrDataUrl = await qrFn(mapsUrl, { width: 100, margin: 1 });
    } catch (e) {
        console.warn("Failed to generate QR code", e)
    }

    let y = headerY + 20

    const drawSectionHeader = (title: string, currentY: number, width = 182, startX = 14) => {
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.rect(startX, currentY, width, 5.5, "FD")
        doc.setFillColor(primaryR, primaryG, primaryB)
        doc.rect(startX, currentY, 2, 5.5, "F")
        doc.setFontSize(7.5)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(primaryR, primaryG, primaryB)
        doc.text(title.toUpperCase(), startX + 4, currentY + 3.8)
        return currentY + 7.5
    }

    // Section 1: Site & Client Location Details
    y = drawSectionHeader("1. Site & Client Location Details", y)

    const clientName = project.client?.name || "Client"
    const siteAddress = project.site || project.client?.address || "Address on file"
    const contactName = project.client?.attentionTo || project.client?.contacts?.[0]?.name || "Site Representative"
    const contactPhone = project.client?.phone || project.client?.contacts?.[0]?.phone || "N/A"
    const poNumber = project.poNumber || project.clientPoNumber || project.invoices?.[0]?.clientPoNumber || project.invoices?.[0]?.reference || "PO-AWAITING"
    const jobDate = project.startDate ? new Date(project.startDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "Scheduled"

    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("Client:", 18, y + 2)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(15, 23, 42)
    doc.text(clientName, 44, y + 2)

    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("Site Address:", 18, y + 7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(15, 23, 42)
    const siteLines = doc.splitTextToSize(siteAddress, 100)
    doc.text(siteLines, 44, y + 7)

    const siteOffset = Math.max(siteLines.length * 4, 8)

    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("On-Site Contact:", 18, y + 7 + siteOffset)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(15, 23, 42)
    doc.text(`${contactName} (${contactPhone})`, 44, y + 7 + siteOffset)

    // Prominent Highlighted Client PO Badge
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("Client PO / Order #:", 18, y + 13 + siteOffset)

    doc.setFillColor(241, 245, 249)
    doc.setDrawColor(primaryR, primaryG, primaryB)
    doc.setLineWidth(0.4)
    doc.roundedRect(48, y + 9 + siteOffset, 44, 5.5, 1, 1, "FD")
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(primaryR, primaryG, primaryB)
    doc.text(poNumber.toUpperCase(), 70, y + 13 + siteOffset, { align: "center" })

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("Target Date:", 98, y + 13 + siteOffset)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(15, 23, 42)
    doc.text(jobDate, 115, y + 13 + siteOffset)

    // Embed QR Code on right side
    if (qrDataUrl) {
        doc.addImage(qrDataUrl, "PNG", 162, y - 1, 26, 26)
        doc.setFontSize(6.5)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(primaryR, primaryG, primaryB)
        doc.text("SCAN FOR GPS NAV", 175, y + 27.5, { align: "center" })
    }

    y += 20 + siteOffset

    // Section 2: Scope of Work (Zero Prices)
    y = drawSectionHeader("2. Scope of Work (Strictly No Prices)", y)
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(30, 41, 59)
    doc.text(`• Surfaces: ${specs.surfaces}`, 18, y + 2)
    doc.text(`• Method: ${specs.method}`, 18, y + 6.5)
    doc.text(`• Chemical Solutions: ${specs.chemicals}`, 18, y + 11)

    y += 16

    // Section 3 & 4: Access & Logistics + Flight & ABEOD ROC Operations side by side
    const colMid = 105
    drawSectionHeader("3. Site Access & Logistics", y, 88, 14)
    drawSectionHeader("4. Flight & ABEOD ROC Operations", y, 89, colMid + 3)
    y += 7.5

    doc.setFontSize(7.5)
    doc.setTextColor(30, 41, 59)
    // Left: Access
    doc.text(`• Water Point: ${specs.waterPoint}`, 18, y + 2)
    doc.text(`• Power Supply: ${specs.powerSupply}`, 18, y + 6.5)
    doc.text(`• Vehicle Staging: ${specs.parking}`, 18, y + 11)
    doc.text(`• Ground Cordon: ${specs.groundZone}`, 18, y + 15.5)

    // Right: Flight & ABEOD ROC Operations
    doc.text(`• Pilot in Command (PIC): ${specs.pilot}`, colMid + 6, y + 2)
    doc.text(`• Aircraft: ${specs.drone}`, colMid + 6, y + 6.5)
    doc.text(`• Commercial ROC Operator: ${specs.rocOperator}`, colMid + 6, y + 11)
    doc.text(`• Airspace Compliance: ${specs.airspace}`, colMid + 6, y + 15.5)

    y += 21

    // Section 5: Pre-Flight Safety & Weather Checklist
    y = drawSectionHeader("5. Pre-Flight Safety & Aviation Weather Checklist (Tick Before Take-Off)", y)

    const drawCheckbox = (label: string, curX: number, curY: number) => {
        doc.rect(curX, curY - 2.8, 3.2, 3.2)
        doc.setFontSize(7.5)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(30, 41, 59)
        doc.text(label, curX + 5, curY)
    }

    drawCheckbox("Weather: Wind < 15 knots, no rain, visibility > 5km", 18, y + 2.5)
    drawCheckbox("Exclusion zone: Cones & caution tape placed on ground", 18, y + 7.5)
    drawCheckbox("PPE: Helmets, eye protection & hi-vis vests on crew", 18, y + 12.5)

    drawCheckbox("Spotter / Safety Officer on comms with PIC", colMid + 6, y + 2.5)
    drawCheckbox("Aircraft check: Props tight, battery 100%, RTH set", colMid + 6, y + 7.5)
    drawCheckbox("Water hose & pump line pressurized with no leaks", colMid + 6, y + 12.5)

    y += 18

    // Section 6: Timings & Photo Checklist
    y = drawSectionHeader("6. Operational Timings & Photo Verification", y)
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("Arrival Time: _______________", 18, y + 3)
    doc.text("Departure Time: _______________", 72, y + 3)

    drawCheckbox("Before photos captured (4 angles)", 130, y + 3)
    drawCheckbox("After photos captured & approved", 130, y + 8)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(30, 41, 59)
    doc.text("Snags / Observations: ____________________________________________________________________", 18, y + 12)

    y += 18

    // Section 7: Sign-Off Box
    y = drawSectionHeader("7. Operational Sign-Off & Handover Acceptance", y)

    doc.setDrawColor(203, 213, 225)
    doc.roundedRect(14, y + 1, 88, 20, 1, 1, "S")
    doc.setFontSize(7)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("LEAD PILOT / CREW LEADER SIGNATURE:", 18, y + 5)
    doc.setFont("helvetica", "normal")
    doc.text("Name: ___________________________________________", 18, y + 11)
    doc.text("Signature: _______________________ Date: _________", 18, y + 17)

    doc.roundedRect(108, y + 1, 88, 20, 1, 1, "S")
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("CLIENT / SITE REPRESENTATIVE ACCEPTANCE:", 112, y + 5)
    doc.setFont("helvetica", "normal")
    doc.text("Name: ___________________________________________", 112, y + 11)
    doc.text("Signature: _______________________ Date: _________", 112, y + 17)

    return doc
}

// Keep backwards-compatibility alias
export const generateWeeklySchedulePdf = generateSchedulePdf


/**
 * 3. GENERATE MONTH CALENDAR PDF (1-PAGE A4 LANDSCAPE)
 * Prints full month operational view with confirmed jobs, projected visits and pencilled quotes.
 */
export async function generateMonthCalendarPdf(
    projects: any[],
    quotes: any[],
    targetDate: Date,
    company: any,
    options?: { showPrices?: boolean }
): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = 297
    const pageHeight = 210
    const theme = company?.theme || company?.settings?.theme || ''
    const [primaryR, primaryG, primaryB] = getThemePrimaryRGB(theme)

    const companyName = company?.name || company?.settings?.name || 'AeroWash (Pty) Ltd'
    const companyPhone = company?.phone || company?.settings?.phone || '067 829 3350'
    const companyEmail = company?.email || company?.settings?.email || 'info@aerowash.co.za'
    const regNumber = company?.registrationNumber || company?.settings?.registrationNumber || '2026/475172/07'
    const logoUrl = company?.logoUrl || company?.settings?.logoUrl
    const showPrices = options?.showPrices ?? false

    // Brand Header Bar
    doc.setFillColor(20, 20, 30)
    doc.rect(0, 0, pageWidth, 8, 'F')
    doc.setFillColor(primaryR, primaryG, primaryB)
    doc.rect(0, 8, pageWidth, 2.5, 'F')

    // Left: Real Logo
    const headerY = 14
    let logoWidthMm = 28
    if (logoUrl) {
        try {
            const isPng = logoUrl.includes('image/png') || logoUrl.toLowerCase().includes('.png')
            doc.addImage(logoUrl, isPng ? 'PNG' : 'JPEG', 14, headerY, 26, 14, undefined, 'FAST')
            logoWidthMm = 28
        } catch (e) {
            doc.setFillColor(primaryR, primaryG, primaryB)
            doc.roundedRect(14, headerY, 20, 13, 2, 2, 'F')
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.text('AW', 24, headerY + 8.5, { align: 'center' })
            logoWidthMm = 22
        }
    } else {
        doc.setFillColor(primaryR, primaryG, primaryB)
        doc.roundedRect(14, headerY, 20, 13, 2, 2, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('AW', 24, headerY + 8.5, { align: 'center' })
        logoWidthMm = 22
    }

    const leftX = 14 + logoWidthMm + 4
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text(companyName.toUpperCase(), leftX, headerY + 4)

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`Reg: ${regNumber}  ·  Tel: ${companyPhone}`, leftX, headerY + 8.5)
    doc.text(`Email: ${companyEmail}`, leftX, headerY + 12.5)

    // Right: Month Title
    const monthTitle = targetDate.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }).toUpperCase()
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(primaryR, primaryG, primaryB)
    doc.text(monthTitle, pageWidth - 14, headerY + 5, { align: 'right' })

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text('OPERATIONAL FLIGHT CALENDAR', pageWidth - 14, headerY + 9.5, { align: 'right' })

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`Printed: ${new Date().toLocaleDateString('en-ZA')}`, pageWidth - 14, headerY + 13.5, { align: 'right' })

    // Divider
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(14, headerY + 16, pageWidth - 14, headerY + 16)

    // Calendar Grid calculation
    const startY = headerY + 20
    const gridWidth = pageWidth - 28 // 269mm
    const colWidth = gridWidth / 7 // ~38.4mm
    const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

    // Days Header
    doc.setFillColor(20, 20, 30)
    doc.rect(14, startY, gridWidth, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    daysOfWeek.forEach((day, i) => {
        doc.text(day, 14 + i * colWidth + colWidth / 2, startY + 4.2, { align: 'center' })
    })

    // Compute month weeks
    const year = targetDate.getFullYear()
    const month = targetDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDayOfWeek = firstDay.getDay()
    const diffToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek
    const calendarStart = new Date(firstDay)
    calendarStart.setDate(firstDay.getDate() + diffToMonday)

    const weeks: { date: Date; isCurrentMonth: boolean }[][] = []
    let curr = new Date(calendarStart)
    while (curr <= lastDay || weeks.length < 5) {
        const week = []
        for (let i = 0; i < 7; i++) {
            week.push({ date: new Date(curr), isCurrentMonth: curr.getMonth() === month })
            curr.setDate(curr.getDate() + 1)
        }
        weeks.push(week)
        if (weeks.length >= 6) break
    }

    const rowHeight = Math.min(26, (pageHeight - startY - 14) / weeks.length)

    weeks.forEach((week, wIdx) => {
        const rowY = startY + 6 + wIdx * rowHeight
        week.forEach((dayObj, dIdx) => {
            const cellX = 14 + dIdx * colWidth
            doc.setDrawColor(226, 232, 240)
            doc.setLineWidth(0.2)
            if (dayObj.isCurrentMonth) {
                doc.setFillColor(255, 255, 255)
            } else {
                doc.setFillColor(248, 250, 252)
            }
            doc.rect(cellX, rowY, colWidth, rowHeight, 'FD')

            // Day Number
            doc.setFontSize(7)
            doc.setFont('helvetica', dayObj.isCurrentMonth ? 'bold' : 'normal')
            doc.setTextColor(dayObj.isCurrentMonth ? 30 : 160, dayObj.isCurrentMonth ? 41 : 174, dayObj.isCurrentMonth ? 59 : 192)
            doc.text(String(dayObj.date.getDate()), cellX + 2, rowY + 3.8)

            // Day's projects
            const dateStr = dayObj.date.toISOString().split('T')[0]
            const dayProjects = (projects || []).filter((p: any) => {
                if (!p.startDate) return false
                return new Date(p.startDate).toISOString().split('T')[0] === dateStr
            })

            let jobY = rowY + 6.5
            dayProjects.slice(0, 3).forEach((p: any) => {
                const isRecurring = p.isRecurring || p.parentProjectId
                doc.setFontSize(5.5)
                doc.setFont('helvetica', 'bold')
                if (isRecurring) {
                    doc.setFillColor(204, 251, 241) // teal-100
                    doc.setTextColor(15, 118, 110)
                } else {
                    doc.setFillColor(254, 243, 199) // amber-100
                    doc.setTextColor(180, 83, 9)
                }
                const label = `${p.client?.name || p.name || 'Job'}`.substring(0, 18)
                doc.roundedRect(cellX + 1.5, jobY - 2.5, colWidth - 3, 3.8, 0.8, 0.8, 'F')
                doc.text(label, cellX + 2.5, jobY)
                jobY += 4.2
            })

            if (dayProjects.length > 3) {
                doc.setFontSize(5)
                doc.setFont('helvetica', 'italic')
                doc.setTextColor(100, 116, 139)
                doc.text(`+${dayProjects.length - 3} more`, cellX + 2.5, jobY)
            }
        })
    })

    return doc
}
