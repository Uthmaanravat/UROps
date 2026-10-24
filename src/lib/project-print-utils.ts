import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import QRCode from "qrcode"
import { getThemePrimaryRGB } from "@/lib/pdf-utils"

export async function generateWeeklySchedulePdf(
    projects: any[],
    company: any,
    showPrices: boolean = false
): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const theme = company?.theme || company?.settings?.theme || ""
    const [primaryR, primaryG, primaryB] = getThemePrimaryRGB(theme)

    const companyName = company?.name || company?.settings?.name || "AeroWash (Pty) Ltd"
    const companyPhone = company?.phone || company?.settings?.phone || "067 829 3350"
    const companyEmail = company?.email || company?.settings?.email || "info@aerowash.co.za"
    const regNumber = company?.registrationNumber || company?.settings?.registrationNumber || "2026/475172/07"
    const logoUrl = company?.logoUrl || company?.settings?.logoUrl

    // 1. Header Bars: Dark Navy (8mm) + Primary Accent (2.5mm)
    doc.setFillColor(20, 20, 30) // #14141E
    doc.rect(0, 0, 210, 8, "F")

    doc.setFillColor(primaryR, primaryG, primaryB)
    doc.rect(0, 8, 210, 2.5, "F")

    // 2. Company Info & Logo
    let headerY = 16
    let logoWidthMm = 20
    if (logoUrl) {
        try {
            const ext = logoUrl.includes('.png') ? 'PNG' : 'JPEG'
            doc.addImage(logoUrl, ext, 14, headerY, 22, 14, undefined, 'FAST')
            logoWidthMm = 26
        } catch (e) {
            // fallback text initials
            doc.setFillColor(primaryR, primaryG, primaryB)
            doc.roundedRect(14, headerY, 18, 14, 2, 2, "F")
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(10)
            doc.setFont("helvetica", "bold")
            doc.text("AW", 23, headerY + 9, { align: "center" })
            logoWidthMm = 22
        }
    } else {
        doc.setFillColor(primaryR, primaryG, primaryB)
        doc.roundedRect(14, headerY, 18, 14, 2, 2, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("AW", 23, headerY + 9, { align: "center" })
        logoWidthMm = 22
    }

    const titleX = 14 + logoWidthMm + 2
    doc.setTextColor(20, 20, 30)
    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.text(companyName.toUpperCase(), titleX, headerY + 6)

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text(`Reg: ${regNumber}  ·  Tel: ${companyPhone}  ·  Email: ${companyEmail}`, titleX, headerY + 11)

    // Right-aligned Document Title
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(primaryR, primaryG, primaryB)
    doc.text("WEEKLY OPERATIONS SCHEDULE", 196, headerY + 6, { align: "right" })

    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    const printedDate = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
    doc.text(`Schedule for This & Next Week  ·  Generated: ${printedDate}`, 196, headerY + 11, { align: "right" })

    // Divider line
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(14, headerY + 16, 196, headerY + 16)

    // Table data
    const tableStartY = headerY + 20

    const headers = showPrices
        ? ["Date", "Client", "Site Address", "Crew / Pilot", "Status", "Value (ZAR)"]
        : ["Date", "Client", "Site Address", "Crew / Pilot", "Status"]

    const rows = (projects || []).map((p: any) => {
        const d = p.startDate
            ? new Date(p.startDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
            : (p.status === "IN_PROGRESS" ? "Busy Now" : "This Week")

        const clientName = p.client?.name || "Client"
        const site = p.site || p.client?.address || p.name || "Site"
        const crew = p.crew || "AeroWash Flight Crew 1"
        const status = p.status?.replace(/_/g, " ") || "SCHEDULED"
        const val = p.invoices?.[0]?.total ? `R ${Number(p.invoices[0].total).toLocaleString()}` : "—"

        return showPrices
            ? [d, clientName, site, crew, status, val]
            : [d, clientName, site, crew, status]
    })

    autoTable(doc, {
        head: [headers],
        body: rows.length > 0 ? rows : [showPrices ? ["—", "No jobs scheduled", "—", "—", "—", "—"] : ["—", "No jobs scheduled", "—", "—", "—"]],
        startY: tableStartY,
        margin: { left: 14, right: 14 },
        theme: "plain",
        headStyles: {
            fillColor: [20, 20, 30],
            textColor: [primaryR, primaryG, primaryB],
            fontStyle: "bold",
            fontSize: 8.5
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [30, 41, 59],
            cellPadding: 3.5
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: showPrices ? {
            0: { cellWidth: 22 },
            1: { cellWidth: 38 },
            2: { cellWidth: 50 },
            3: { cellWidth: 32 },
            4: { cellWidth: 22 },
            5: { cellWidth: 18, halign: 'right' }
        } : {
            0: { cellWidth: 24 },
            1: { cellWidth: 42 },
            2: { cellWidth: 60 },
            3: { cellWidth: 34 },
            4: { cellWidth: 22 }
        }
    })

    // Footer at bottom of A4 (297mm height)
    doc.setDrawColor(226, 232, 240)
    doc.line(14, 282, 196, 282)

    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text(`${companyName}  ·  Confidential Operations Schedule  ·  Page 1 of 1`, 14, 288)
    doc.text(`Total Scheduled Jobs: ${projects.length}`, 196, 288, { align: "right" })

    return doc
}

export async function generateJobSheetPdf(
    project: any,
    company: any
): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const theme = company?.theme || company?.settings?.theme || ""
    const [primaryR, primaryG, primaryB] = getThemePrimaryRGB(theme)

    const companyName = company?.name || company?.settings?.name || "AeroWash (Pty) Ltd"
    const companyPhone = company?.phone || company?.settings?.phone || "067 829 3350"
    const companyEmail = company?.email || company?.settings?.email || "info@aerowash.co.za"
    const regNumber = company?.registrationNumber || company?.settings?.registrationNumber || "2026/475172/07"
    const logoUrl = company?.logoUrl || company?.settings?.logoUrl

    // 1. Signature Brand Header Bars (Navy #14141E + Dark Orange Accent)
    doc.setFillColor(20, 20, 30) // #14141E
    doc.rect(0, 0, 210, 8, "F")

    doc.setFillColor(primaryR, primaryG, primaryB)
    doc.rect(0, 8, 210, 2.5, "F")

    // 2. Company Details + Job Sheet Title
    const headerY = 15
    let logoWidthMm = 20
    if (logoUrl) {
        try {
            const ext = logoUrl.includes('.png') ? 'PNG' : 'JPEG'
            doc.addImage(logoUrl, ext, 14, headerY, 22, 13, undefined, 'FAST')
            logoWidthMm = 25
        } catch (e) {
            doc.setFillColor(primaryR, primaryG, primaryB)
            doc.roundedRect(14, headerY, 18, 13, 2, 2, "F")
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(10)
            doc.setFont("helvetica", "bold")
            doc.text("AW", 23, headerY + 8.5, { align: "center" })
            logoWidthMm = 22
        }
    } else {
        doc.setFillColor(primaryR, primaryG, primaryB)
        doc.roundedRect(14, headerY, 18, 13, 2, 2, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("AW", 23, headerY + 8.5, { align: "center" })
        logoWidthMm = 22
    }

    const titleX = 14 + logoWidthMm + 2
    doc.setTextColor(20, 20, 30)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(companyName.toUpperCase(), titleX, headerY + 5)

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 116, 139)
    doc.text(`Reg: ${regNumber}  ·  Tel: ${companyPhone}  ·  Email: ${companyEmail}`, titleX, headerY + 10)

    doc.setFontSize(15)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(primaryR, primaryG, primaryB)
    doc.text("ON-SITE JOB SHEET", 196, headerY + 5, { align: "right" })

    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 41, 59)
    doc.text(`JOB REF: ${project.name}`.toUpperCase(), 196, headerY + 10, { align: "right" })

    // Divider line
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(14, headerY + 14, 196, headerY + 14)

    // Generate Google Maps QR Code
    const siteQuery = project.site || project.client?.address || project.name || "Cape Town"
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteQuery)}`
    let qrDataUrl = ""
    try {
        qrDataUrl = await QRCode.toDataURL(mapsUrl, { width: 100, margin: 1 })
    } catch (e) {
        console.warn("Failed to generate QR code", e)
    }

    // Section 1: Site & Client Details (with QR Code)
    let y = headerY + 18

    // Section Header Box
    const drawSectionHeader = (title: string, currentY: number) => {
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.rect(14, currentY, 182, 5.5, "FD")
        doc.setFillColor(primaryR, primaryG, primaryB)
        doc.rect(14, currentY, 2, 5.5, "F")
        doc.setFontSize(7.5)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(primaryR, primaryG, primaryB)
        doc.text(title.toUpperCase(), 18, currentY + 3.8)
        return currentY + 7.5
    }

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
    doc.text(clientName, 42, y + 2)

    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("Site Address:", 18, y + 7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(15, 23, 42)
    const siteLines = doc.splitTextToSize(siteAddress, 105)
    doc.text(siteLines, 42, y + 7)

    const siteOffset = Math.max(siteLines.length * 4, 8)

    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("On-Site Contact:", 18, y + 7 + siteOffset)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(15, 23, 42)
    doc.text(`${contactName} (${contactPhone})`, 42, y + 7 + siteOffset)

    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("Client PO / Order #:", 18, y + 12 + siteOffset)

    // Highlighted PO box
    doc.setFillColor(241, 245, 249)
    doc.setDrawColor(primaryR, primaryG, primaryB)
    doc.setLineWidth(0.3)
    doc.roundedRect(48, y + 12 + siteOffset - 3.8, 42, 5.2, 1, 1, "FD")
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(primaryR, primaryG, primaryB)
    doc.text(poNumber.toUpperCase(), 69, y + 12 + siteOffset - 0.2, { align: "center" })

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("Job Date:", 95, y + 12 + siteOffset)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(15, 23, 42)
    doc.text(jobDate, 110, y + 12 + siteOffset)

    // Embed QR Code on the right side
    if (qrDataUrl) {
        doc.addImage(qrDataUrl, "PNG", 162, y - 1, 26, 26)
        doc.setFontSize(6.5)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(primaryR, primaryG, primaryB)
        doc.text("SCAN FOR GPS NAV", 175, y + 27.5, { align: "center" })
    }

    y += 18 + siteOffset

    // Section 2: Scope of Work (Zero Prices)
    y = drawSectionHeader("2. Scope of Work (No Prices)", y)

    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(30, 41, 59)
    doc.text("• Surfaces: External glass facade, composite aluminum cladding panels, louvers & trims", 18, y + 2)
    doc.text("• Method: Drone SoftWash High-Reach Application + Demineralized Pure Water De-Ionized Rinse", 18, y + 6.5)
    doc.text("• Chemical Solutions: Eco-friendly biodegradable facade surfactant (Neutral pH, non-caustic)", 18, y + 11)

    y += 16

    // Section 3 & 4: Access + Flight Operations side by side with separate branded headers
    const colMid = 105

    const drawSubHeader = (title: string, startX: number, width: number, currentY: number) => {
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.rect(startX, currentY, width, 5.5, "FD")
        doc.setFillColor(primaryR, primaryG, primaryB)
        doc.rect(startX, currentY, 2, 5.5, "F")
        doc.setFontSize(7.5)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(primaryR, primaryG, primaryB)
        doc.text(title.toUpperCase(), startX + 4, currentY + 3.8)
    }

    drawSubHeader("3. Site Access & Logistics", 14, 88, y)
    drawSubHeader("4. Flight & ABEOD ROC Operations", colMid + 3, 89, y)

    y += 7.5

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(30, 41, 59)
    // Left: Access
    doc.text("• Water point: External tap connection required", 18, y + 2)
    doc.text("• Power: 220V standard outlet for charger", 18, y + 6.5)
    doc.text("• Parking: Dedicated drone van staging space", 18, y + 11)
    doc.text("• Ground: 5m cordoned drop-zone beneath flight", 18, y + 15.5)

    // Right: Flight & ABEOD ROC
    doc.text("• Pilot in Command (PIC): Certified Drone Flight Lead", colMid + 6, y + 2)
    doc.text("• Aircraft: SoftWash Drone System (AeroWash Fleet)", colMid + 6, y + 6.5)
    doc.text("• ROC Operator: ABEOD Commercial Aviation ROC", colMid + 6, y + 11)
    doc.text("• Airspace: VFR Daylight operations logged", colMid + 6, y + 15.5)

    y += 21

    // Section 5: Pre-Flight Safety & Weather Checklist (with tick boxes)
    y = drawSectionHeader("5. Pre-Flight Safety & Weather Checklist (Tick Before Take-Off)", y)

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

    drawCheckbox("Spotter / Safety Officer in position on comms", colMid + 5, y + 2.5)
    drawCheckbox("Aircraft check: Props tight, battery 100%, RTH set", colMid + 5, y + 7.5)
    drawCheckbox("Water hose & pump line pressurized with no leaks", colMid + 5, y + 12.5)

    y += 18

    // Section 6: Timings & Photo Checklist
    y = drawSectionHeader("6. Operational Timings & Photo Checklist", y)

    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("Arrival Time: _______________", 18, y + 3)
    doc.text("Departure Time: _______________", 75, y + 3)

    drawCheckbox("Before photos captured (4 angles)", 135, y + 3)
    drawCheckbox("After photos captured", 135, y + 8)

    doc.setFont("helvetica", "normal")
    doc.text("Issues / pre-existing defects found on site: ___________________________________________________________________", 18, y + 9.5)

    y += 16

    // Section 7: Client Sign-Off & Crew Handover
    y = drawSectionHeader("7. Quality Sign-Off & Handover", y)

    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(30, 41, 59)
    doc.text("Client Confirmation: Work inspected and completed to satisfaction without damage to premises.", 18, y + 2.5)

    const boxY = y + 5.5
    doc.setDrawColor(203, 213, 225)
    doc.setFillColor(255, 255, 255)
    doc.rect(14, boxY, 90, 22, "FD")
    doc.rect(106, boxY, 90, 22, "FD")

    // Left sign box: Client
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("CLIENT REPRESENTATIVE:", 18, boxY + 5)
    doc.setFont("helvetica", "normal")
    doc.text("Name: ____________________________________", 18, boxY + 11)
    doc.text("Signature: ___________________ Date: ________", 18, boxY + 17)

    // Right sign box: AeroWash Pilot / Lead
    doc.setFont("helvetica", "bold")
    doc.setTextColor(71, 85, 105)
    doc.text("LEAD PILOT / CREW SIGNATURE:", 110, boxY + 5)
    doc.setFont("helvetica", "normal")
    doc.text("Name: ____________________________________", 110, boxY + 11)
    doc.text("Signature: ___________________ Date: ________", 110, boxY + 17)

    // Bottom Footer
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(`${companyName} On-Site Operational Sheet  ·  Strictly Zero Prices  ·  Page 1 of 1`, 14, 289)

    return doc
}
