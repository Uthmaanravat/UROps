"use client"

import React, { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { Printer, Download, Eye, Calendar, FileText, CheckCircle2, BarChartHorizontal, LayoutGrid, Clock } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export interface ProjectSchedulePrintModalProps {
    isOpen: boolean
    onClose: () => void
    projects: any[]
    company?: any
    initialWorkType?: "ALL" | "GENERAL" | "TENDER"
}

export function isTenderProject(p: any): boolean {
    if (p.workType === "TENDER") return true
    if (p.tenderId) return true
    if (p.invoices?.some((i: any) => i.workType === "TENDER" || Boolean(i.tenderId))) return true
    if (p.client?.name?.toLowerCase().includes("cape town")) {
        const hasTenderDoc = p.invoices?.some((i: any) => i.workType === "TENDER" || Boolean(i.tenderId))
        if (hasTenderDoc) return true
        const hasTenderItems = p.invoices?.some((i: any) => i.items?.some((it: any) => it.code && /^\d+(\.\d+)?$/.test(it.code)))
        if (hasTenderItems) return true
        if (/tender|152g|benches/i.test(p.name || "")) return true
    }
    return false
}

export function isReactiveProject(p: any): boolean {
    // Tenders have zero reactive work
    if (isTenderProject(p)) return false
    if (p.commercialStatus === "REACTIVE_WORK" || p.commercialStatus === "EMERGENCY_WORK") return true
    if (/reactive/i.test(p.name || "")) return true
    if (p.invoices?.some((inv: any) => /reactive/i.test(inv.reference || "") || /reactive/i.test(inv.notes || ""))) return true
    return false
}

export function ProjectSchedulePrintModal({
    isOpen,
    onClose,
    projects,
    company,
    initialWorkType = "ALL"
}: ProjectSchedulePrintModalProps) {
    const [workTypeFilter, setWorkTypeFilter] = useState<"ALL" | "GENERAL" | "TENDER">(initialWorkType)
    
    // Graph / Document Style Selector (Gantt timeline, weekly planner, table, or combined)
    const [graphType, setGraphType] = useState<"COMBINED" | "GANTT" | "PLANNER" | "TABLE">("COMBINED")

    // Status filters - Default to Scheduled & In Progress
    const [includeScheduled, setIncludeScheduled] = useState(true)
    const [includeInProgress, setIncludeInProgress] = useState(true)
    const [includeApproval, setIncludeApproval] = useState(false)
    const [includeHold, setIncludeHold] = useState(false)
    const [includeCompleted, setIncludeCompleted] = useState(false)
    const [includeAwaitingPayment, setIncludeAwaitingPayment] = useState(false)

    // Visibility toggles ("Tick what they can view")
    // Financial amounts default to FALSE so workers/employers do not see money unless PM checks it
    const [showFinancials, setShowFinancials] = useState(false)
    const [showScope, setShowScope] = useState(true)
    const [showSite, setShowSite] = useState(true)
    const [showClient, setShowClient] = useState(true)
    const [showCommercialStatus, setShowCommercialStatus] = useState(true)

    // Custom document notes
    const [customNotes, setCustomNotes] = useState("")

    // Filter projects matching criteria
    const candidateProjects = useMemo(() => {
        return projects.filter(p => {
            const isTender = isTenderProject(p)
            if (workTypeFilter === "GENERAL" && isTender) return false
            if (workTypeFilter === "TENDER" && !isTender) return false

            const s = p.status
            if (['SCHEDULED', 'PLANNING', 'QUOTED'].includes(s) && includeScheduled) return true
            if (['IN_PROGRESS'].includes(s) && includeInProgress) return true
            if (['SOW', 'SOW_SUBMITTED', 'LEAD'].includes(s) && includeApproval) return true
            if (['ON_HOLD'].includes(s) && includeHold) return true
            if (['COMPLETED'].includes(s) && includeCompleted) return true
            if (['INVOICED'].includes(s) && includeAwaitingPayment) return true

            return false
        })
    }, [projects, workTypeFilter, includeScheduled, includeInProgress, includeApproval, includeHold, includeCompleted, includeAwaitingPayment])

    // Selected project IDs for individual ticking
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())

    React.useEffect(() => {
        setSelectedProjectIds(new Set(candidateProjects.map(p => p.id)))
    }, [candidateProjects])

    const toggleProjectSelect = (id: string) => {
        setSelectedProjectIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectAllProjects = () => {
        setSelectedProjectIds(new Set(candidateProjects.map(p => p.id)))
    }

    const clearAllProjects = () => {
        setSelectedProjectIds(new Set())
    }

    const finalProjects = useMemo(() => {
        return candidateProjects.filter(p => selectedProjectIds.has(p.id))
    }, [candidateProjects, selectedProjectIds])

    const totalSelectedValue = useMemo(() => {
        return finalProjects.reduce((sum, p) => {
            const inv = p.invoices?.[0]
            const wbp = p.workBreakdowns?.[0]
            const val = inv ? inv.total : (wbp ? wbp.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 1.15 : 0)
            return sum + (Number(val) || 0)
        }, 0)
    }, [finalProjects])

    // Grouping by schedule bucket for the Planner Grid
    const busyProjects = useMemo(() => finalProjects.filter(p => p.status === 'IN_PROGRESS'), [finalProjects])
    const thisWeekProjects = useMemo(() => finalProjects.filter((p, i) => p.status === 'SCHEDULED' && i % 2 === 0), [finalProjects])
    const upcomingMonthProjects = useMemo(() => finalProjects.filter((p, i) => !['IN_PROGRESS'].includes(p.status) && (p.status !== 'SCHEDULED' || i % 2 !== 0)), [finalProjects])

    // Print Handler
    const handlePrint = () => {
        window.print()
    }

    // PDF Download Handler (Strictly using Quote & Invoice Navy #14141E & Lime #A3E635 theme)
    const handleDownloadPdf = () => {
        const doc = new jsPDF({
            orientation: graphType === "PLANNER" ? "landscape" : "portrait",
            unit: "mm",
            format: "a4"
        })

        const companyName = company?.name || "LR BUILDERS"
        const companyPhone = company?.phone || "082 821 7247"
        const companyEmail = company?.email || "info@lrbuilders.co.za"
        const pageWidth = doc.internal.pageSize.getWidth()

        // 1. Signature Brand Header Bars (Navy #14141E + Lime #A3E635)
        doc.setFillColor(20, 20, 30) // Navy #14141E
        doc.rect(0, 0, pageWidth, 9, 'F')
        doc.setFillColor(163, 230, 53) // Lime #A3E635
        doc.rect(0, 9, pageWidth, 2.5, 'F')

        // 2. Company Details & Document Title
        doc.setFont("helvetica", "bold")
        doc.setFontSize(15)
        doc.setTextColor(20, 20, 30) // Navy
        doc.text(companyName.toUpperCase(), 14, 21)

        doc.setFont("helvetica", "normal")
        doc.setFontSize(8.5)
        doc.setTextColor(100, 116, 139)
        doc.text(`Phone: ${companyPhone}  |  Email: ${companyEmail}`, 14, 26)

        // Document Title on Right
        doc.setFont("helvetica", "bold")
        doc.setFontSize(13)
        doc.setTextColor(20, 20, 30)
        doc.text("OPERATIONS & WORKS SCHEDULE", pageWidth - 14, 21, { align: "right" })

        doc.setFont("helvetica", "bold")
        doc.setFontSize(8.5)
        const audienceText = showFinancials ? "AUDIENCE: PROJECT MANAGEMENT (WITH FINANCIALS)" : "AUDIENCE: FIELD CREW & SITE TEAM"
        doc.setTextColor(showFinancials ? 16 : 71, showFinancials ? 185 : 85, showFinancials ? 129 : 105)
        doc.text(audienceText, pageWidth - 14, 26, { align: "right" })

        // 3. Metadata Pill Bar (Navy & Lime Accent)
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(20, 20, 30)
        doc.setLineWidth(0.3)
        doc.roundedRect(14, 31, pageWidth - 28, 12, 1.5, 1.5, 'FD')

        doc.setFontSize(8)
        doc.setTextColor(20, 20, 30)
        const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        const typeStr = workTypeFilter === "ALL" ? "All Work" : (workTypeFilter === "TENDER" ? "Tender 152G (Fixed Rates)" : "General Work")
        doc.text(`DATE: ${dateStr}`, 18, 38.5)
        doc.text(`SCOPE: ${typeStr.toUpperCase()}`, 70, 38.5)
        doc.text(`JOBS LISTED: ${finalProjects.length}`, 130, 38.5)
        if (showFinancials) {
            doc.setFont("helvetica", "bold")
            doc.setTextColor(20, 20, 30)
            doc.text(`TOTAL VALUE: ${formatCurrency(totalSelectedValue)}`, pageWidth - 18, 38.5, { align: "right" })
            doc.setFont("helvetica", "normal")
        }

        let currentY = 48

        // 4. Render Gantt Timeline Graph in PDF (if GANTT or COMBINED)
        if (graphType === "GANTT" || graphType === "COMBINED") {
            const ganttHead = ['#', 'PROJECT / JOB', 'SITE', 'BUSY NOW', 'THIS WEEK', 'NEXT WEEK', 'THIS MONTH']
            if (showFinancials) ganttHead.push('EST. WORTH')

            const ganttRows = finalProjects.map((p, idx) => {
                const isBusy = p.status === 'IN_PROGRESS'
                const isThisWeek = p.status === 'SCHEDULED' && idx % 2 === 0
                const isNextWeek = p.status === 'SCHEDULED' && idx % 2 !== 0
                const isLater = !['IN_PROGRESS', 'SCHEDULED'].includes(p.status)
                const site = p.invoices?.[0]?.site || p.scopes?.[0]?.site || "Site Specified"

                const row = [
                    idx + 1,
                    `${p.name}\n(${p.client?.name || 'General'})`,
                    site,
                    isBusy ? "ACTIVE" : "-",
                    isThisWeek ? "SCHEDULED" : (isBusy ? "BUSY" : "-"),
                    isNextWeek ? "SCHEDULED" : "-",
                    isLater ? p.status.replace(/_/g, ' ') : "-"
                ]

                if (showFinancials) {
                    const inv = p.invoices?.[0]
                    const wbp = p.workBreakdowns?.[0]
                    const val = inv ? inv.total : (wbp ? wbp.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 1.15 : 0)
                    row.push(formatCurrency(Number(val) || 0))
                }
                return row
            })

            autoTable(doc, {
                startY: currentY,
                margin: { left: 14, right: 14 },
                head: [ganttHead],
                body: ganttRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [20, 20, 30], // Navy #14141E
                    textColor: [163, 230, 53], // Lime #A3E635
                    fontSize: 8,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                styles: {
                    fontSize: 7.5,
                    cellPadding: 2.5,
                    textColor: [20, 20, 30],
                    lineColor: [226, 232, 240],
                    lineWidth: 0.1
                },
                didParseCell: (data) => {
                    // Highlight active schedule blocks with color fills
                    if (data.section === 'body') {
                        if (data.column.index === 3 && data.cell.raw === "ACTIVE") {
                            data.cell.styles.fillColor = [220, 252, 231] // light green
                            data.cell.styles.textColor = [22, 101, 52] // dark green
                            data.cell.styles.fontStyle = 'bold'
                        } else if (data.column.index === 4 && (data.cell.raw === "SCHEDULED" || data.cell.raw === "BUSY")) {
                            data.cell.styles.fillColor = [243, 232, 255] // light purple
                            data.cell.styles.textColor = [107, 33, 168]
                            data.cell.styles.fontStyle = 'bold'
                        } else if (data.column.index === 5 && data.cell.raw === "SCHEDULED") {
                            data.cell.styles.fillColor = [239, 246, 255] // light blue
                            data.cell.styles.textColor = [29, 78, 216]
                            data.cell.styles.fontStyle = 'bold'
                        } else if (data.column.index === 6 && data.cell.raw !== "-") {
                            data.cell.styles.fillColor = [254, 243, 199] // light amber
                            data.cell.styles.textColor = [180, 83, 9]
                            data.cell.styles.fontStyle = 'bold'
                        }
                    }
                }
            })

            currentY = (doc as any).lastAutoTable?.finalY + 8
        }

        // 5. Render Detailed Task Table (if TABLE or COMBINED)
        if ((graphType === "TABLE" || graphType === "COMBINED") && currentY < 240) {
            const tableHead = ['#', 'PROJECT & SCOPE OF WORK', 'SITE', 'STATUS']
            if (showFinancials) tableHead.push('EST. WORTH')

            const tableRows = finalProjects.map((p, idx) => {
                const site = p.invoices?.[0]?.site || p.scopes?.[0]?.site || "Site Specified"
                let desc = p.name
                if (showClient && p.client?.name) desc += `\nClient: ${p.client.name}`
                
                if (showScope) {
                    const invoice = p.invoices?.[0]
                    const scopeItems = invoice?.items || p.scopes?.[0]?.items || []
                    if (scopeItems.length > 0) {
                        const tasks = scopeItems.slice(0, 3).map((it: any) => `• ${it.description} (${it.quantity} ${it.unit || 'ea'})`).join('\n')
                        desc += `\nTasks:\n${tasks}`
                    }
                }

                const row = [
                    idx + 1,
                    desc,
                    site,
                    p.status.replace(/_/g, ' ')
                ]

                if (showFinancials) {
                    const inv = p.invoices?.[0]
                    const wbp = p.workBreakdowns?.[0]
                    const val = inv ? inv.total : (wbp ? wbp.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 1.15 : 0)
                    row.push(formatCurrency(Number(val) || 0))
                }
                return row
            })

            autoTable(doc, {
                startY: currentY,
                margin: { left: 14, right: 14 },
                head: [tableHead],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [20, 20, 30],
                    textColor: [163, 230, 53],
                    fontSize: 8,
                    fontStyle: 'bold'
                },
                styles: {
                    fontSize: 7.5,
                    cellPadding: 2.5,
                    textColor: [20, 20, 30]
                }
            })

            currentY = (doc as any).lastAutoTable?.finalY + 8
        }

        // Custom Notes & Signatures
        if (currentY + 28 < 280) {
            if (customNotes) {
                doc.setFont("helvetica", "bold")
                doc.setFontSize(8)
                doc.setTextColor(20, 20, 30)
                doc.text("INSTRUCTIONS / NOTES:", 14, currentY)
                doc.setFont("helvetica", "normal")
                doc.text(customNotes, 14, currentY + 4)
                currentY += 10
            }

            doc.setDrawColor(20, 20, 30)
            doc.setLineWidth(0.2)
            doc.line(14, currentY + 10, 80, currentY + 10)
            doc.setFontSize(7.5)
            doc.setTextColor(100, 116, 139)
            doc.text("Foreman / Site Supervisor Sign-Off", 14, currentY + 14)

            doc.line(120, currentY + 10, 196, currentY + 10)
            doc.text("Project Manager Approval", 120, currentY + 14)
        }

        const fileName = `LR_Builders_Schedule_${new Date().toISOString().slice(0, 10)}.pdf`
        doc.save(fileName)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[96vw] lg:max-w-6xl w-full max-h-[92vh] h-[92vh] p-0 overflow-hidden bg-[#0A0A12] border-white/10 flex flex-col text-white">
                {/* Header */}
                <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between bg-[#0F0F1A]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                            <Printer className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg md:text-xl font-black text-white uppercase tracking-tight">
                                Operations &amp; Works Schedule Generator
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-medium">
                                Print schedules and timeline graphs for field workers, supervisors, or project managers.
                            </DialogDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pr-8">
                        <Button
                            onClick={handleDownloadPdf}
                            disabled={finalProjects.length === 0}
                            size="sm"
                            className="bg-white/10 hover:bg-white/20 text-white font-bold border border-white/10 text-xs flex items-center gap-1.5"
                        >
                            <Download className="h-4 w-4 text-primary" /> Download PDF
                        </Button>
                        <Button
                            onClick={handlePrint}
                            disabled={finalProjects.length === 0}
                            size="sm"
                            className="bg-primary hover:bg-primary/90 text-black font-black text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(163,230,53,0.3)]"
                        >
                            <Printer className="h-4 w-4" /> Print Document
                        </Button>
                    </div>
                </div>

                {/* Body: Two Columns */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                    {/* LEFT CONTROLS (5 cols) */}
                    <div className="lg:col-span-5 border-r border-white/10 p-4 md:p-6 overflow-y-auto space-y-5 bg-[#0E0E18]">
                        {/* 1. Schedule Graph / Layout Selector */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                                    <BarChartHorizontal className="h-3.5 w-3.5" /> 1. Project Graph / Schedule Layout
                                </Label>
                                <span className="text-[9px] font-bold text-gray-400">Print Style</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setGraphType("COMBINED")}
                                    className={`p-2.5 rounded-xl border text-left transition-all ${
                                        graphType === "COMBINED" ? "bg-primary/10 border-primary text-white shadow-lg" : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                    }`}
                                >
                                    <div className="text-xs font-black flex items-center gap-1.5">
                                        <span>🌟 Combined (Graph + Table)</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Timeline graph on top + full task details below</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setGraphType("GANTT")}
                                    className={`p-2.5 rounded-xl border text-left transition-all ${
                                        graphType === "GANTT" ? "bg-primary/10 border-primary text-white shadow-lg" : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                    }`}
                                >
                                    <div className="text-xs font-black flex items-center gap-1.5">
                                        <span>📊 Timeline Schedule (Gantt)</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Visual bars: Busy Now, This Week, Next Week</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setGraphType("PLANNER")}
                                    className={`p-2.5 rounded-xl border text-left transition-all ${
                                        graphType === "PLANNER" ? "bg-primary/10 border-primary text-white shadow-lg" : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                    }`}
                                >
                                    <div className="text-xs font-black flex items-center gap-1.5">
                                        <span>📅 Weekly Planner Matrix</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">3 Columns: Busy, This Week, This Month</p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setGraphType("TABLE")}
                                    className={`p-2.5 rounded-xl border text-left transition-all ${
                                        graphType === "TABLE" ? "bg-primary/10 border-primary text-white shadow-lg" : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                                    }`}
                                >
                                    <div className="text-xs font-black flex items-center gap-1.5">
                                        <span>📋 Detailed Scope Table</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Line items, quantities, and site locations</p>
                                </button>
                            </div>
                        </div>

                        {/* 2. Work Classification Selection */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                2. Work Classification
                            </Label>
                            <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setWorkTypeFilter("ALL")}
                                    className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all ${
                                        workTypeFilter === "ALL" ? "bg-white text-black shadow-md" : "text-gray-400 hover:text-white"
                                    }`}
                                >
                                    All Work
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWorkTypeFilter("GENERAL")}
                                    className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all ${
                                        workTypeFilter === "GENERAL" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
                                    }`}
                                >
                                    General Only
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWorkTypeFilter("TENDER")}
                                    className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all ${
                                        workTypeFilter === "TENDER" ? "bg-amber-500 text-black shadow-md" : "text-gray-400 hover:text-white"
                                    }`}
                                >
                                    Tender 152G
                                </button>
                            </div>
                        </div>

                        {/* 3. Stages to Include */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                3. Stages to Include
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setIncludeScheduled(!includeScheduled)}>
                                    <Checkbox checked={includeScheduled} onCheckedChange={() => setIncludeScheduled(!includeScheduled)} />
                                    <Label className="text-xs font-bold text-white cursor-pointer">Scheduled / Quoted</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setIncludeInProgress(!includeInProgress)}>
                                    <Checkbox checked={includeInProgress} onCheckedChange={() => setIncludeInProgress(!includeInProgress)} />
                                    <Label className="text-xs font-bold text-emerald-400 cursor-pointer">Busy (In Progress)</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setIncludeApproval(!includeApproval)}>
                                    <Checkbox checked={includeApproval} onCheckedChange={() => setIncludeApproval(!includeApproval)} />
                                    <Label className="text-xs font-bold text-gray-300 cursor-pointer">Waiting Approval</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setIncludeAwaitingPayment(!includeAwaitingPayment)}>
                                    <Checkbox checked={includeAwaitingPayment} onCheckedChange={() => setIncludeAwaitingPayment(!includeAwaitingPayment)} />
                                    <Label className="text-xs font-bold text-gray-300 cursor-pointer">Awaiting Payment</Label>
                                </div>
                            </div>
                        </div>

                        {/* 4. Audience Visibility ("Tick what they can view") */}
                        <div className="space-y-2.5 p-4 rounded-xl bg-primary/5 border border-primary/20">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                                    <Eye className="h-3.5 w-3.5" /> 4. Tick What They Can View
                                </Label>
                                <span className="text-[9px] font-bold text-gray-400">Audience Controls</span>
                            </div>

                            {/* FINANCIALS TOGGLE */}
                            <div className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                showFinancials ? "bg-emerald-500/10 border-emerald-500/40" : "bg-white/5 border-white/10 hover:border-white/20"
                            }`} onClick={() => setShowFinancials(!showFinancials)}>
                                <div className="flex items-start gap-2.5">
                                    <Checkbox checked={showFinancials} onCheckedChange={() => setShowFinancials(!showFinancials)} className="mt-0.5" />
                                    <div>
                                        <div className="text-xs font-black flex items-center gap-1.5">
                                            <span className={showFinancials ? "text-emerald-400" : "text-white"}>
                                                Show Pricing &amp; Financial Amounts
                                            </span>
                                            {showFinancials ? (
                                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] py-0">PM Mode</Badge>
                                            ) : (
                                                <Badge className="bg-white/10 text-gray-400 border-white/10 text-[9px] py-0">Field Crew Safe</Badge>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                            {showFinancials ? "Checked: Pricing visible for Project Managers." : "Unchecked: Hides all financial figures from field workers."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <div className="flex items-center space-x-2 bg-black/20 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setShowScope(!showScope)}>
                                    <Checkbox checked={showScope} onCheckedChange={() => setShowScope(!showScope)} />
                                    <Label className="text-xs font-bold text-white cursor-pointer">Show Scope / Tasks</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-black/20 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setShowSite(!showSite)}>
                                    <Checkbox checked={showSite} onCheckedChange={() => setShowSite(!showSite)} />
                                    <Label className="text-xs font-bold text-white cursor-pointer">Show Site Location</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-black/20 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setShowClient(!showClient)}>
                                    <Checkbox checked={showClient} onCheckedChange={() => setShowClient(!showClient)} />
                                    <Label className="text-xs font-bold text-white cursor-pointer">Show Client Name</Label>
                                </div>
                                {/* HIDE reactive work option on Tender */}
                                {workTypeFilter !== 'TENDER' && (
                                    <div className="flex items-center space-x-2 bg-black/20 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setShowCommercialStatus(!showCommercialStatus)}>
                                        <Checkbox checked={showCommercialStatus} onCheckedChange={() => setShowCommercialStatus(!showCommercialStatus)} />
                                        <Label className="text-xs font-bold text-white cursor-pointer">Show Reactive Flag</Label>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. Project Selection Checklist */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    5. Selected Jobs ({selectedProjectIds.size} of {candidateProjects.length})
                                </Label>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={selectAllProjects} className="text-[10px] font-bold text-primary hover:underline">Select All</button>
                                    <span className="text-muted-foreground text-[10px]">•</span>
                                    <button type="button" onClick={clearAllProjects} className="text-[10px] font-bold text-gray-400 hover:underline">Clear</button>
                                </div>
                            </div>

                            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 border border-white/10 rounded-xl p-2 bg-black/30">
                                {candidateProjects.map(p => {
                                    const isChecked = selectedProjectIds.has(p.id)
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => toggleProjectSelect(p.id)}
                                            className={`flex items-start gap-2 p-2 rounded-lg transition-colors cursor-pointer border ${
                                                isChecked ? "bg-white/10 border-white/20" : "bg-transparent border-transparent hover:bg-white/5"
                                            }`}
                                        >
                                            <Checkbox checked={isChecked} className="mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-black text-white truncate">{p.name}</span>
                                                    {isTenderProject(p) && (
                                                        <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">TENDER</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    <span>{p.client?.name}</span>
                                                    <span>•</span>
                                                    <span className="uppercase text-primary font-bold">{p.status.replace(/_/g, ' ')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Optional Schedule Instructions
                            </Label>
                            <input
                                type="text"
                                value={customNotes}
                                onChange={(e) => setCustomNotes(e.target.value)}
                                placeholder="e.g. PPE required. Report to site supervisor on arrival."
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {/* RIGHT: LIVE A4 DOCUMENT PREVIEW (Styled matching Quotes and Invoices theme) */}
                    <div className="lg:col-span-7 bg-[#14141E] p-4 md:p-6 overflow-y-auto flex flex-col items-center">
                        <div className="w-full max-w-[720px] mb-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 font-bold text-white">
                                <FileText className="h-4 w-4 text-primary" /> Document Preview (Exact Quote &amp; Invoice Theme)
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/5">
                                Standard A4 Print
                            </span>
                        </div>

                        {/* PRINTABLE SHEET CONTAINER */}
                        <div
                            id="printable-schedule-document"
                            className="w-full max-w-[720px] bg-white text-[#14141E] rounded-xl shadow-2xl overflow-hidden border border-slate-200 print:border-none print:shadow-none print:w-full print:max-w-full print:rounded-none"
                        >
                            {/* Signature Quote & Invoice Brand Bar: Navy #14141E (9px) + Accent Lime #A3E635 (3px) */}
                            <div className="h-2.5 bg-[#14141E] w-full" />
                            <div className="h-1 bg-[#A3E635] w-full" />

                            <div className="p-6 md:p-8 space-y-6">
                                {/* Document Header */}
                                <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-black tracking-tight text-[#14141E] uppercase">
                                            {company?.name || "LR BUILDERS"}
                                        </h2>
                                        <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                            Phone: {company?.phone || "082 821 7247"} &nbsp;|&nbsp; Email: {company?.email || "info@lrbuilders.co.za"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-base md:text-lg font-black text-[#14141E] uppercase tracking-tight">
                                            OPERATIONS &amp; WORKS SCHEDULE
                                        </div>
                                        <div
                                            className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded inline-block mt-0.5 border"
                                            style={{
                                                backgroundColor: showFinancials ? "#ECFDF5" : "#F8FAFC",
                                                color: showFinancials ? "#047857" : "#1E293B",
                                                borderColor: showFinancials ? "#A7F3D0" : "#E2E8F0"
                                            }}
                                        >
                                            {showFinancials ? "Audience: Project Management (Financials Included)" : "Audience: Field Crew / Site Team"}
                                        </div>
                                    </div>
                                </div>

                                {/* Metadata Bar */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#F8FAFC] p-3 rounded-lg border border-slate-200 text-[10px] text-slate-700">
                                    <div><span className="font-bold text-[#14141E]">Date:</span> {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                                    <div><span className="font-bold text-[#14141E]">Scope:</span> {workTypeFilter === "ALL" ? "All Work" : (workTypeFilter === "TENDER" ? "Tender 152G" : "General Work")}</div>
                                    <div><span className="font-bold text-[#14141E]">Total Jobs:</span> {finalProjects.length}</div>
                                    {showFinancials && (
                                        <div className="text-right font-black text-emerald-700">
                                            Total: {formatCurrency(totalSelectedValue)}
                                        </div>
                                    )}
                                </div>

                                {/* OPTION A: TIMELINE SCHEDULE GRAPH (GANTT CHART) */}
                                {(graphType === "GANTT" || graphType === "COMBINED") && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-[#14141E] flex items-center gap-1.5">
                                                <span className="h-2.5 w-2.5 rounded-full bg-[#A3E635] border border-[#14141E] inline-block" />
                                                Work Schedule &amp; Execution Timeline (Gantt Graph)
                                            </h3>
                                            <div className="flex items-center gap-2.5 text-[9px] font-bold text-slate-600">
                                                <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-emerald-600 inline-block" /> Busy On Site</span>
                                                <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-purple-600 inline-block" /> This Week</span>
                                                <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-blue-600 inline-block" /> Next Week</span>
                                                <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-amber-500 inline-block" /> This Month</span>
                                            </div>
                                        </div>

                                        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    {/* Table Header: Dark Navy #14141E with Lime #A3E635 Text */}
                                                    <tr className="bg-[#14141E] text-[#A3E635] text-[9px] font-black uppercase tracking-wider">
                                                        <th className="py-2.5 px-2 w-8 text-center">#</th>
                                                        <th className="py-2.5 px-3 w-52">Project &amp; Site</th>
                                                        <th className="py-2.5 px-1.5 text-center w-28 border-l border-white/10 text-emerald-400">
                                                            🟢 Busy Now
                                                        </th>
                                                        <th className="py-2.5 px-1.5 text-center w-28 border-l border-white/10 text-purple-300">
                                                            🟣 This Week
                                                        </th>
                                                        <th className="py-2.5 px-1.5 text-center w-28 border-l border-white/10 text-blue-300">
                                                            🔵 Next Week
                                                        </th>
                                                        <th className="py-2.5 px-1.5 text-center w-28 border-l border-white/10 text-amber-300">
                                                            🟠 This Month
                                                        </th>
                                                        {showFinancials && <th className="py-2.5 px-2 text-right w-24 border-l border-white/10">Amount</th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 bg-white">
                                                    {finalProjects.map((p, idx) => {
                                                        const isBusy = p.status === 'IN_PROGRESS'
                                                        const isThisWeek = p.status === 'SCHEDULED' && idx % 2 === 0
                                                        const isNextWeek = p.status === 'SCHEDULED' && idx % 2 !== 0
                                                        const isLater = !['IN_PROGRESS', 'SCHEDULED'].includes(p.status)
                                                        const site = p.invoices?.[0]?.site || p.scopes?.[0]?.site || "Site Specified"
                                                        const inv = p.invoices?.[0]
                                                        const wbp = p.workBreakdowns?.[0]
                                                        const worth = inv ? inv.total : (wbp ? wbp.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 1.15 : 0)

                                                        return (
                                                            <tr key={p.id} className="hover:bg-slate-50">
                                                                <td className="py-2 px-2 text-center font-bold text-slate-500">{idx + 1}</td>
                                                                <td className="py-2 px-3">
                                                                    <div className="font-black text-[#14141E] text-xs leading-tight">{p.name}</div>
                                                                    <div className="text-[10px] text-slate-500 font-semibold">{site} • {p.client?.name}</div>
                                                                </td>
                                                                {/* Busy Now */}
                                                                <td className="py-2 px-1 text-center bg-emerald-50/20 border-l border-slate-200">
                                                                    {isBusy ? (
                                                                        <div className="py-1 px-1.5 rounded bg-emerald-600 text-white font-black text-[8px] uppercase tracking-wider shadow-sm">
                                                                            Active
                                                                        </div>
                                                                    ) : <div className="h-0.5 w-6 bg-slate-200 mx-auto" />}
                                                                </td>
                                                                {/* This Week */}
                                                                <td className="py-2 px-1 text-center bg-purple-50/20 border-l border-slate-200">
                                                                    {isBusy ? (
                                                                        <div className="py-1 px-1.5 rounded bg-emerald-500/80 text-white font-bold text-[8px] uppercase">
                                                                            In Work
                                                                        </div>
                                                                    ) : isThisWeek ? (
                                                                        <div className="py-1 px-1.5 rounded bg-purple-600 text-white font-black text-[8px] uppercase tracking-wider shadow-sm">
                                                                            Scheduled
                                                                        </div>
                                                                    ) : <div className="h-0.5 w-6 bg-slate-200 mx-auto" />}
                                                                </td>
                                                                {/* Next Week */}
                                                                <td className="py-2 px-1 text-center bg-blue-50/20 border-l border-slate-200">
                                                                    {isNextWeek ? (
                                                                        <div className="py-1 px-1.5 rounded bg-blue-600 text-white font-black text-[8px] uppercase tracking-wider shadow-sm">
                                                                            Next Wk
                                                                        </div>
                                                                    ) : <div className="h-0.5 w-6 bg-slate-200 mx-auto" />}
                                                                </td>
                                                                {/* This Month */}
                                                                <td className="py-2 px-1 text-center bg-amber-50/20 border-l border-slate-200">
                                                                    {isLater ? (
                                                                        <div className="py-1 px-1.5 rounded bg-amber-500 text-black font-black text-[8px] uppercase tracking-wider shadow-sm">
                                                                            {p.status.replace(/_/g, ' ')}
                                                                        </div>
                                                                    ) : <div className="h-0.5 w-6 bg-slate-200 mx-auto" />}
                                                                </td>
                                                                {showFinancials && (
                                                                    <td className="py-2 px-2 text-right font-black text-emerald-800 text-xs border-l border-slate-200">
                                                                        {formatCurrency(Number(worth) || 0)}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* OPTION B: WEEKLY & MONTHLY PLANNER MATRIX */}
                                {graphType === "PLANNER" && (
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-[#14141E] flex items-center gap-1.5">
                                            <span className="h-2.5 w-2.5 rounded-full bg-[#A3E635] inline-block" />
                                            Weekly &amp; Monthly Operations Planning Matrix
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {/* Column 1: Busy Now */}
                                            <div className="border border-emerald-300 bg-emerald-50/30 rounded-lg p-3 space-y-2">
                                                <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                                                        🟢 Currently Busy (Now)
                                                    </span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800">
                                                        {busyProjects.length}
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {busyProjects.map(p => (
                                                        <div key={p.id} className="bg-white p-2.5 rounded border border-emerald-200 shadow-xs">
                                                            <div className="font-black text-xs text-[#14141E]">{p.name}</div>
                                                            <div className="text-[10px] text-slate-500 font-semibold">{p.invoices?.[0]?.site || p.scopes?.[0]?.site || 'Site on Job'}</div>
                                                        </div>
                                                    ))}
                                                    {busyProjects.length === 0 && <p className="text-[10px] text-slate-400 italic">No active jobs in this column</p>}
                                                </div>
                                            </div>

                                            {/* Column 2: Scheduled This Week */}
                                            <div className="border border-purple-300 bg-purple-50/30 rounded-lg p-3 space-y-2">
                                                <div className="flex items-center justify-between pb-1.5 border-b border-purple-200">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-800">
                                                        🟣 Scheduled This Week
                                                    </span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-200 text-purple-800">
                                                        {thisWeekProjects.length}
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {thisWeekProjects.map(p => (
                                                        <div key={p.id} className="bg-white p-2.5 rounded border border-purple-200 shadow-xs">
                                                            <div className="font-black text-xs text-[#14141E]">{p.name}</div>
                                                            <div className="text-[10px] text-slate-500 font-semibold">{p.invoices?.[0]?.site || p.scopes?.[0]?.site || 'Site on Job'}</div>
                                                        </div>
                                                    ))}
                                                    {thisWeekProjects.length === 0 && <p className="text-[10px] text-slate-400 italic">No jobs scheduled this week</p>}
                                                </div>
                                            </div>

                                            {/* Column 3: Scheduled This Month / Upcoming */}
                                            <div className="border border-blue-300 bg-blue-50/30 rounded-lg p-3 space-y-2">
                                                <div className="flex items-center justify-between pb-1.5 border-b border-blue-200">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">
                                                        🔵 This Month / Upcoming
                                                    </span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-200 text-blue-800">
                                                        {upcomingMonthProjects.length}
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {upcomingMonthProjects.map(p => (
                                                        <div key={p.id} className="bg-white p-2.5 rounded border border-blue-200 shadow-xs">
                                                            <div className="font-black text-xs text-[#14141E]">{p.name}</div>
                                                            <div className="text-[10px] text-slate-500 font-semibold">{p.invoices?.[0]?.site || p.scopes?.[0]?.site || 'Site on Job'}</div>
                                                        </div>
                                                    ))}
                                                    {upcomingMonthProjects.length === 0 && <p className="text-[10px] text-slate-400 italic">No upcoming jobs in this column</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* OPTION C: DETAILED SCOPE OF WORK & TASKS TABLE */}
                                {(graphType === "TABLE" || graphType === "COMBINED") && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-[#14141E] flex items-center gap-1.5">
                                                <span className="h-2.5 w-2.5 rounded-full bg-[#14141E] inline-block" />
                                                Detailed Work &amp; Task Scope Breakdown
                                            </h3>
                                        </div>
                                        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    {/* Header: Dark Navy #14141E with Lime #A3E635 */}
                                                    <tr className="bg-[#14141E] text-[#A3E635] text-[9px] font-black uppercase tracking-wider">
                                                        <th className="py-2 px-2 text-center w-8">#</th>
                                                        <th className="py-2 px-3">Project &amp; Tasks</th>
                                                        {showSite && <th className="py-2 px-3 w-36">Site Location</th>}
                                                        <th className="py-2 px-3 text-center w-28">Status</th>
                                                        {showFinancials && <th className="py-2 px-3 text-right w-28">Est. Worth</th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 bg-white">
                                                    {finalProjects.map((p, idx) => {
                                                        const isTender = isTenderProject(p)
                                                        const isReactive = isReactiveProject(p)
                                                        const invoice = p.invoices?.[0]
                                                        const scopeItems = invoice?.items || p.scopes?.[0]?.items || []
                                                        const siteName = invoice?.site || p.scopes?.[0]?.site || "Site Specified"
                                                        const inv = p.invoices?.[0]
                                                        const wbp = p.workBreakdowns?.[0]
                                                        const worth = inv ? inv.total : (wbp ? wbp.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 1.15 : 0)

                                                        return (
                                                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                                                <td className="py-2 px-2 text-center font-bold text-slate-500 align-top">{idx + 1}</td>
                                                                <td className="py-2 px-3 align-top">
                                                                    <div className="font-black text-[#14141E] text-xs">{p.name}</div>
                                                                    {showClient && p.client?.name && (
                                                                        <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                                                                            Client: {p.client.name}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex items-center gap-1.5 mt-1">
                                                                        {isTender && (
                                                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                                                                TENDER 152G
                                                                            </span>
                                                                        )}
                                                                        {/* Only show reactive if NOT tender */}
                                                                        {!isTender && isReactive && showCommercialStatus && (
                                                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-300">
                                                                                REACTIVE WORK
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {/* Scope Tasks */}
                                                                    {showScope && scopeItems.length > 0 && (
                                                                        <div className="mt-1.5 pl-2 border-l-2 border-slate-300 space-y-0.5 text-[10px] text-slate-600">
                                                                            <span className="font-bold text-slate-700 block text-[9px] uppercase tracking-wider">Tasks:</span>
                                                                            {scopeItems.slice(0, 3).map((it: any, iIdx: number) => (
                                                                                <div key={iIdx} className="leading-tight">
                                                                                    • {it.description} <span className="font-bold text-slate-700">({it.quantity} {it.unit || 'ea'})</span>
                                                                                </div>
                                                                            ))}
                                                                            {scopeItems.length > 3 && (
                                                                                <div className="text-[9px] italic text-slate-400">+ {scopeItems.length - 3} more items on quote</div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                {showSite && (
                                                                    <td className="py-2 px-3 text-slate-700 font-medium align-top">
                                                                        <div className="font-bold text-[#14141E]">{siteName}</div>
                                                                    </td>
                                                                )}
                                                                <td className="py-2 px-3 text-center align-top">
                                                                    <span className="inline-block px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider border bg-slate-100 text-slate-800 border-slate-300">
                                                                        {p.status.replace(/_/g, ' ')}
                                                                    </span>
                                                                </td>
                                                                {showFinancials && (
                                                                    <td className="py-2 px-3 text-right font-black text-emerald-800 align-top text-xs">
                                                                        {formatCurrency(Number(worth) || 0)}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Instructions / Notes */}
                                {customNotes && (
                                    <div className="p-3 bg-[#F8FAFC] rounded-lg border border-slate-200 text-[11px] text-slate-700">
                                        <span className="font-bold uppercase text-[9px] text-[#14141E] block mb-0.5">Instructions:</span>
                                        {customNotes}
                                    </div>
                                )}

                                {/* Signature Footer */}
                                <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-8 text-[10px] text-slate-500">
                                    <div>
                                        <div className="border-b border-slate-400 pb-4 mb-1" />
                                        <div className="font-bold text-slate-700">Foreman / Site Supervisor Signature</div>
                                    </div>
                                    <div>
                                        <div className="border-b border-slate-400 pb-4 mb-1" />
                                        <div className="font-bold text-slate-700">Project Manager / Director Signature</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
