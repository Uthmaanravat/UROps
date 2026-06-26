"use client"

import { Button } from "@/components/ui/button"
import { ClipboardList, Loader2 } from "lucide-react"
import jsPDF from "jspdf"
import { drawPdfHeader } from "@/lib/pdf-utils"
import autoTable from "jspdf-autotable"
import { useState } from "react"

interface SOWChecklistButtonProps {
    project: {
        id: string
        name: string
        client: {
            name: string
            companyName?: string | null
            attentionTo?: string | null
            address?: string | null
        }
    }
    latestScope: {
        id: string
        site?: string | null
        items: {
            id: string
            area?: string | null
            description: string
            quantity: number
            unit?: string | null
            notes?: string | null
        }[]
    }
    settings?: any
    className?: string
    compact?: boolean
}

export function SOWChecklistButton({ project, latestScope, settings, className, compact }: SOWChecklistButtonProps) {
    const [loading, setLoading] = useState(false)

    const company = {
        name: settings?.name || "LR Builders & Maintenance Pty (Ltd)",
        address: settings?.address || "15 Culemborg Street, Avondale, Parow, Cape Town, 7500",
        email: settings?.email || "Loedvi@lrbuilders.co.za",
        phone: settings?.phone || "082 448 7490",
        logoUrl: settings?.logoUrl || "",
        vatNumber: settings?.vatNumber || "",
        paymentTerms: settings?.paymentTerms || "",
        bankDetails: settings?.bankDetails || "",
        layoutPreferences: settings?.layoutPreferences
    }

    const generateChecklistPdf = async () => {
        setLoading(true)
        try {
            const doc = new jsPDF()

            // Header (Shared branding)
            const nextY = await drawPdfHeader(
                doc,
                company,
                'SCOPE OF WORK CHECKLIST',
                project.name.toUpperCase(),
                'LABORER COPY'
            )

            const gridY = nextY + 2

            // Document Details Grid (Left)
            doc.setFontSize(8)
            doc.setTextColor(163, 230, 53) // Lime
            doc.setFont("helvetica", "bold")
            doc.text("DOCUMENT DETAILS", 14, gridY)

            doc.setFontSize(9)
            doc.setTextColor(100, 116, 139) // slate-500
            doc.setFont("helvetica", "normal")
            doc.text("Project Name:", 14, gridY + 6)
            doc.setTextColor(30, 41, 59)
            doc.setFont("helvetica", "bold")
            doc.text(project.name, 38, gridY + 6)

            doc.setTextColor(100, 116, 139)
            doc.setFont("helvetica", "normal")
            doc.text("Client Name:", 14, gridY + 11)
            doc.setTextColor(30, 41, 59)
            doc.setFont("helvetica", "bold")
            doc.text(project.client.companyName || project.client.name, 38, gridY + 11)

            doc.setTextColor(100, 116, 139)
            doc.setFont("helvetica", "normal")
            doc.text("Date Issued:", 14, gridY + 16)
            doc.setTextColor(30, 41, 59)
            doc.setFont("helvetica", "bold")
            doc.text(new Date().toLocaleDateString('en-GB'), 38, gridY + 16)

            // Site Location Grid (Right)
            doc.setFontSize(8)
            doc.setTextColor(163, 230, 53) // Lime
            doc.setFont("helvetica", "bold")
            doc.text("SITE LOCATION", 110, gridY)

            doc.setFontSize(9)
            doc.setTextColor(30, 41, 59)
            doc.setFont("helvetica", "bold")
            const siteAddress = latestScope.site || "No site address provided"
            const addressLines = doc.splitTextToSize(siteAddress, 86)
            doc.text(addressLines, 110, gridY + 6)

            const minListY = Math.max(gridY + 22, gridY + 6 + (addressLines.length * 4.5))

            // Section Header
            const headerY = minListY + 6
            doc.setFontSize(12)
            doc.setFont("helvetica", "bold")
            doc.setTextColor(15, 23, 42) // slate-900
            doc.text("TASK CHECKLIST", 14, headerY)

            // Build Rows (exclude pricing)
            const rows: any[] = []
            const validItems = latestScope.items.filter(item => item.description && item.description.trim() !== "")
            
            if (validItems.length === 0) {
                alert("Please add at least one item with a description before downloading.")
                setLoading(false)
                return
            }

            validItems.forEach((item) => {
                rows.push([
                    "", // Checkbox placeholder (drawn vectorally)
                    item.area || "GENERAL",
                    item.description,
                    item.quantity.toString(),
                    item.unit || "ea",
                    "" // Blank space for laborer comments
                ])
            })

            // Generate autotable
            autoTable(doc, {
                startY: headerY + 6,
                head: [['Done', 'Area / Section', 'Scope Description', 'Qty', 'Unit', 'Laborer Comments']],
                body: rows,
                theme: 'striped',
                headStyles: {
                    fillColor: [15, 23, 42], // slate-900 Navy
                    textColor: [163, 230, 53], // Lime pop
                    fontStyle: 'bold',
                    fontSize: 9
                },
                bodyStyles: {
                    cellPadding: 4,
                    fontSize: 8,
                    textColor: [30, 41, 59]
                },
                columnStyles: {
                    0: { cellWidth: 15, halign: 'center' }, // Checkbox
                    1: { cellWidth: 35 },                   // Area
                    2: { cellWidth: 80 },                   // Description
                    3: { cellWidth: 14, halign: 'center' }, // Qty
                    4: { cellWidth: 14, halign: 'center' }, // Unit
                    5: { cellWidth: 24 }                    // Comments space
                },
                didDrawCell: (data) => {
                    // Draw checkbox rectangle in the first column's body cells
                    if (data.column.index === 0 && data.cell.section === 'body') {
                        const pdfDoc = data.doc
                        const boxSize = 4.5 // 4.5mm square
                        const x = data.cell.x + (data.cell.width - boxSize) / 2
                        const y = data.cell.y + (data.cell.height - boxSize) / 2
                        
                        pdfDoc.setDrawColor(100, 116, 139) // slate-500
                        pdfDoc.setLineWidth(0.4)
                        pdfDoc.rect(x, y, boxSize, boxSize)
                    }
                }
            })

            // Save PDF
            const sanitizedProjName = project.name.replace(/[^a-z0-9]/gi, '_')
            doc.save(`SOW_Checklist_${sanitizedProjName}.pdf`)

        } catch (error) {
            console.error("Failed to generate SOW checklist PDF:", error)
            alert("An error occurred while generating SOW checklist PDF.")
        } finally {
            setLoading(false)
        }
    }

    const hasValidItems = latestScope.items.some(item => item.description && item.description.trim() !== "")

    return (
        <Button 
            variant="outline" 
            onClick={generateChecklistPdf} 
            disabled={loading || !hasValidItems}
            className={className || "border-primary/20 hover:bg-primary/10 text-white font-bold backdrop-blur-sm"}
            title="Download SOW Checklist (Laborers)"
        >
            {loading ? (
                <Loader2 className={compact ? "h-4 w-4 animate-spin" : "mr-2 h-4 w-4 animate-spin"} />
            ) : (
                <ClipboardList className={compact ? "h-4 w-4 text-primary" : "mr-2 h-4 w-4 text-primary"} />
            )}
            {!compact && "Download Checklist (Laborers)"}
        </Button>
    )
}
