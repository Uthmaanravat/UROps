"use client"

import React, { useState, useMemo, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { Printer, Download, Eye, EyeOff, CheckSquare, Square, Building2, MapPin, Calendar, AlertTriangle, ShieldCheck, FileText, CheckCircle2 } from "lucide-react"
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
    
    // Status filters - Default to Scheduled & In Progress as requested
    const [includeScheduled, setIncludeScheduled] = useState(true)
    const [includeInProgress, setIncludeInProgress] = useState(true)
    const [includeApproval, setIncludeApproval] = useState(false)
    const [includeHold, setIncludeHold] = useState(false)
    const [includeCompleted, setIncludeCompleted] = useState(false)
    const [includeAwaitingPayment, setIncludeAwaitingPayment] = useState(false)

    // Visibility toggles ("Tick what they can view")
    // IMPORTANT: Financial amounts default to FALSE so site crew/employers do not see money unless PM checks it!
    const [showFinancials, setShowFinancials] = useState(false)
    const [showScope, setShowScope] = useState(true)
    const [showSite, setShowSite] = useState(true)
    const [showClient, setShowClient] = useState(true)
    const [showCommercialStatus, setShowCommercialStatus] = useState(true)
    const [showDates, setShowDates] = useState(true)

    // Custom document notes
    const [customNotes, setCustomNotes] = useState("")

    // Filter projects matching criteria
    const candidateProjects = useMemo(() => {
        return projects.filter(p => {
            // Work type filter
            const isTender = isTenderProject(p)
            if (workTypeFilter === "GENERAL" && isTender) return false
            if (workTypeFilter === "TENDER" && !isTender) return false

            // Status filter
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

    // Keep selected IDs in sync when candidate list changes
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

    // Final projects to print
    const finalProjects = useMemo(() => {
        return candidateProjects.filter(p => selectedProjectIds.has(p.id))
    }, [candidateProjects, selectedProjectIds])

    // Total financial value if allowed to be viewed
    const totalSelectedValue = useMemo(() => {
        return finalProjects.reduce((sum, p) => {
            const inv = p.invoices?.[0]
            const wbp = p.workBreakdowns?.[0]
            const val = inv ? inv.total : (wbp ? wbp.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 1.15 : 0)
            return sum + (Number(val) || 0)
        }, 0)
    }, [finalProjects])

    // Handle Browser Print
    const handlePrint = () => {
        window.print()
    }

    // Handle PDF Download
    const handleDownloadPdf = () => {
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        })

        const companyName = company?.name || "LR BUILDERS"
        const companyPhone = company?.phone || "082 821 7247"
        const companyEmail = company?.email || "info@lrbuilders.co.za"

        // 1. Header Bar
        doc.setFillColor(20, 20, 30) // Navy
        doc.rect(0, 0, 210, 10, 'F')
        doc.setFillColor(163, 230, 53) // Lime
        doc.rect(0, 10, 210, 2.5, 'F')

        // 2. Company Info & Title
        doc.setFont("helvetica", "bold")
        doc.setFontSize(16)
        doc.setTextColor(20, 20, 30)
        doc.text(companyName.toUpperCase(), 14, 22)

        doc.setFont("helvetica", "normal")
        doc.setFontSize(8.5)
        doc.setTextColor(100, 116, 139)
        doc.text(`Phone: ${companyPhone}  |  Email: ${companyEmail}`, 14, 27)

        // Document Title
        doc.setFont("helvetica", "bold")
        doc.setFontSize(13)
        doc.setTextColor(20, 20, 30)
        doc.text("OPERATIONS & WORKS SCHEDULE", 196, 22, { align: "right" })

        doc.setFont("helvetica", "bold")
        doc.setFontSize(8.5)
        const audienceText = showFinancials ? "AUDIENCE: PROJECT MANAGEMENT (WITH FINANCIALS)" : "AUDIENCE: FIELD CREW & SITE TEAM"
        if (showFinancials) {
            doc.setTextColor(16, 185, 129)
        } else {
            doc.setTextColor(59, 130, 246)
        }
        doc.text(audienceText, 196, 27, { align: "right" })

        // 3. Meta summary box
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.roundedRect(14, 32, 182, 13, 2, 2, 'FD')

        doc.setFontSize(8)
        doc.setTextColor(71, 85, 105)
        const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        const typeStr = workTypeFilter === "ALL" ? "All Works" : (workTypeFilter === "TENDER" ? "Tender 152G" : "General Work")
        doc.text(`DATE GENERATED: ${dateStr}`, 18, 40)
        doc.text(`WORK TYPE: ${typeStr.toUpperCase()}`, 75, 40)
        doc.text(`TOTAL JOBS: ${finalProjects.length}`, 130, 40)
        if (showFinancials) {
            doc.setFont("helvetica", "bold")
            doc.setTextColor(16, 185, 129)
            doc.text(`TOTAL VALUE: ${formatCurrency(totalSelectedValue)}`, 190, 40, { align: "right" })
            doc.setFont("helvetica", "normal")
        }

        // 4. Build Table Columns and Rows
        const headRow = ['#', 'PROJECT / JOB', 'SITE', 'STATUS']
        if (showFinancials) {
            headRow.push('EST. AMOUNT')
        }

        const bodyRows: any[] = []
        finalProjects.forEach((p, idx) => {
            const isReactive = isReactiveProject(p)
            const isTender = isTenderProject(p)
            
            let projDesc = p.name
            if (showClient && p.client?.name) {
                projDesc += `\nClient: ${p.client.name}`
            }
            if (isTender) {
                projDesc += `\n[Tender 152G]`
            }

            // Append scope items if showScope is true
            if (showScope) {
                const invoice = p.invoices?.[0]
                const scopeItems = invoice?.items || p.scopes?.[0]?.items || []
                if (scopeItems.length > 0) {
                    const taskList = scopeItems.slice(0, 5).map((it: any) => `• ${it.description} (${it.quantity} ${it.unit || 'ea'})`).join('\n')
                    projDesc += `\nTasks/Scope:\n${taskList}`
                    if (scopeItems.length > 5) {
                        projDesc += `\n... +${scopeItems.length - 5} more items`
                    }
                }
            }

            const siteName = p.invoices?.[0]?.site || p.scopes?.[0]?.site || "Site Specified on Job"

            let statusLabel = p.status.replace(/_/g, ' ')
            if (isReactive) statusLabel += "\n(REACTIVE WORK)"
            if (p.commercialStatus === 'AWAITING_PO') statusLabel += "\n(WAITING PO)"

            const row = [
                idx + 1,
                projDesc,
                siteName,
                statusLabel
            ]

            if (showFinancials) {
                const inv = p.invoices?.[0]
                const wbp = p.workBreakdowns?.[0]
                const val = inv ? inv.total : (wbp ? wbp.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 1.15 : 0)
                row.push(formatCurrency(Number(val) || 0))
            }

            bodyRows.push(row)
        })

        autoTable(doc, {
            startY: 49,
            margin: { left: 14, right: 14 },
            head: [headRow],
            body: bodyRows,
            theme: 'grid',
            headStyles: {
                fillColor: [20, 20, 30],
                textColor: [163, 230, 53],
                fontSize: 8.5,
                fontStyle: 'bold',
                halign: 'left'
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
                textColor: [30, 41, 59],
                lineColor: [226, 232, 240],
                lineWidth: 0.1
            },
            columnStyles: showFinancials ? {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 85, halign: 'left' },
                2: { cellWidth: 35, halign: 'left' },
                3: { cellWidth: 26, halign: 'center' },
                4: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }
            } : {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 105, halign: 'left' },
                2: { cellWidth: 42, halign: 'left' },
                3: { cellWidth: 25, halign: 'center' }
            }
        })

        const finalY = (doc as any).lastAutoTable?.finalY || 150

        // Custom Notes & Sign-off
        if (finalY + 35 < 280) {
            let noteY = finalY + 8
            if (customNotes) {
                doc.setFont("helvetica", "bold")
                doc.setFontSize(8)
                doc.setTextColor(20, 20, 30)
                doc.text("INSTRUCTIONS / NOTES:", 14, noteY)
                doc.setFont("helvetica", "normal")
                doc.setTextColor(71, 85, 105)
                const splitNotes = doc.splitTextToSize(customNotes, 182)
                doc.text(splitNotes, 14, noteY + 4)
                noteY += (splitNotes.length * 4) + 6
            }

            // Signatures
            doc.setDrawColor(203, 213, 225)
            doc.line(14, noteY + 14, 80, noteY + 14)
            doc.setFontSize(7.5)
            doc.setTextColor(100, 116, 139)
            doc.text("Site Supervisor / Foreman Sign-Off", 14, noteY + 18)

            doc.line(116, noteY + 14, 196, noteY + 14)
            doc.text("Project Manager Approval", 116, noteY + 18)
        }

        const fileName = `LR_Builders_Operations_Schedule_${new Date().toISOString().slice(0, 10)}.pdf`
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
                                Operations & Schedule Document Generator
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-medium">
                                Configure and print custom work schedules for field workers, employers, or project managers.
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

                {/* Body: Two Column (Controls on left, Live A4 Preview on right) */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                    {/* LEFT CONTROLS (5 cols on lg) */}
                    <div className="lg:col-span-5 border-r border-white/10 p-4 md:p-6 overflow-y-auto space-y-6 bg-[#0E0E18]">
                        {/* 1. Work Type Selection */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                1. Work Classification
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

                        {/* 2. Stages to Include */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    2. Stages to Include
                                </Label>
                                <span className="text-[9px] font-bold text-primary">Pre-selected: To-Do</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setIncludeScheduled(!includeScheduled)}>
                                    <Checkbox checked={includeScheduled} onCheckedChange={() => setIncludeScheduled(!includeScheduled)} />
                                    <Label className="text-xs font-bold text-white cursor-pointer">Scheduled / Quoted</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setIncludeInProgress(!includeInProgress)}>
                                    <Checkbox checked={includeInProgress} onCheckedChange={() => setIncludeInProgress(!includeInProgress)} />
                                    <Label className="text-xs font-bold text-emerald-400 cursor-pointer">In Progress (Busy)</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setIncludeApproval(!includeApproval)}>
                                    <Checkbox checked={includeApproval} onCheckedChange={() => setIncludeApproval(!includeApproval)} />
                                    <Label className="text-xs font-bold text-gray-300 cursor-pointer">Waiting Approval</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setIncludeHold(!includeHold)}>
                                    <Checkbox checked={includeHold} onCheckedChange={() => setIncludeHold(!includeHold)} />
                                    <Label className="text-xs font-bold text-gray-300 cursor-pointer">On Hold</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setIncludeCompleted(!includeCompleted)}>
                                    <Checkbox checked={includeCompleted} onCheckedChange={() => setIncludeCompleted(!includeCompleted)} />
                                    <Label className="text-xs font-bold text-gray-300 cursor-pointer">Completed</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setIncludeAwaitingPayment(!includeAwaitingPayment)}>
                                    <Checkbox checked={includeAwaitingPayment} onCheckedChange={() => setIncludeAwaitingPayment(!includeAwaitingPayment)} />
                                    <Label className="text-xs font-bold text-gray-300 cursor-pointer">Awaiting Payment</Label>
                                </div>
                            </div>
                        </div>

                        {/* 3. Privacy & Audience Controls ("Tick what they can view") */}
                        <div className="space-y-2.5 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                                    <Eye className="h-3.5 w-3.5" /> 3. Tick What They Can View
                                </Label>
                                <span className="text-[9px] font-bold text-amber-300">Audience Controls</span>
                            </div>

                            {/* THE FINANCIALS CHECKBOX - CRITICAL */}
                            <div className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                showFinancials ? "bg-emerald-500/10 border-emerald-500/40" : "bg-white/5 border-white/10 hover:border-white/20"
                            }`} onClick={() => setShowFinancials(!showFinancials)}>
                                <div className="flex items-start gap-2.5">
                                    <Checkbox
                                        checked={showFinancials}
                                        onCheckedChange={() => setShowFinancials(!showFinancials)}
                                        className="mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-black flex items-center gap-1.5">
                                            <span className={showFinancials ? "text-emerald-400" : "text-white"}>
                                                Show Pricing & Financial Amounts
                                            </span>
                                            {showFinancials ? (
                                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] py-0">PM Mode: Visible</Badge>
                                            ) : (
                                                <Badge className="bg-white/10 text-gray-400 border-white/10 text-[9px] py-0">Workers Mode: Hidden</Badge>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                            {showFinancials
                                                ? "Checked: The document displays project money amounts. Ideal for Project Managers."
                                                : "Unchecked: Conceals all money and pricing. Safe for site crew and field workers."}
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
                                <div className="flex items-center space-x-2 bg-black/20 p-2 rounded-lg border border-white/5 cursor-pointer" onClick={() => setShowCommercialStatus(!showCommercialStatus)}>
                                    <Checkbox checked={showCommercialStatus} onCheckedChange={() => setShowCommercialStatus(!showCommercialStatus)} />
                                    <Label className="text-xs font-bold text-white cursor-pointer">Show Reactive Flag</Label>
                                </div>
                            </div>
                        </div>

                        {/* 4. Projects Selection Checklist */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    4. Selected Jobs ({selectedProjectIds.size} of {candidateProjects.length})
                                </Label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllProjects}
                                        className="text-[10px] font-bold text-primary hover:underline"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-muted-foreground text-[10px]">•</span>
                                    <button
                                        type="button"
                                        onClick={clearAllProjects}
                                        className="text-[10px] font-bold text-gray-400 hover:underline"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-white/10 rounded-xl p-2 bg-black/30">
                                {candidateProjects.length === 0 ? (
                                    <p className="text-xs text-muted-foreground p-3 text-center">No projects match the selected criteria.</p>
                                ) : (
                                    candidateProjects.map(p => {
                                        const isChecked = selectedProjectIds.has(p.id)
                                        const isTender = isTenderProject(p)
                                        const isReactive = isReactiveProject(p)

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
                                                        {isTender && (
                                                            <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">TENDER</span>
                                                        )}
                                                        {isReactive && (
                                                            <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30">REACTIVE</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                        <span>{p.client?.name}</span>
                                                        <span>•</span>
                                                        <span className="uppercase text-primary">{p.status.replace(/_/g, ' ')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        {/* Instructions / Notes Field */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Optional Schedule Instructions
                            </Label>
                            <input
                                type="text"
                                value={customNotes}
                                onChange={(e) => setCustomNotes(e.target.value)}
                                placeholder="e.g. PPE required at all times. Report to foreman on arrival."
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {/* RIGHT: LIVE A4 DOCUMENT PREVIEW (7 cols on lg) */}
                    <div className="lg:col-span-7 bg-[#14141E] p-4 md:p-6 overflow-y-auto flex flex-col items-center">
                        <div className="w-full max-w-[700px] mb-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 font-bold">
                                <FileText className="h-4 w-4 text-primary" /> Live Document Preview
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-white/5">
                                A4 Standard Print Format
                            </span>
                        </div>

                        {/* PRINTABLE SHEET CONTAINER (Clean Black/White/Contrast) */}
                        <div
                            id="printable-schedule-document"
                            className="w-full max-w-[700px] bg-white text-slate-900 rounded-lg shadow-2xl p-6 md:p-8 space-y-5 print:p-0 print:shadow-none print:w-full print:max-w-full print:rounded-none"
                        >
                            {/* Document Header */}
                            <div className="border-b-2 border-slate-900 pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">
                                            {company?.name || "LR BUILDERS"}
                                        </h2>
                                        <p className="text-[11px] font-bold text-slate-500">
                                            Phone: {company?.phone || "082 821 7247"} &nbsp;|&nbsp; Email: {company?.email || "info@lrbuilders.co.za"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight">
                                            OPERATIONS & WORKS SCHEDULE
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded inline-block mt-0.5 border"
                                            style={{
                                                backgroundColor: showFinancials ? "#ECFDF5" : "#EFF6FF",
                                                color: showFinancials ? "#047857" : "#1D4ED8",
                                                borderColor: showFinancials ? "#A7F3D0" : "#BFDBFE"
                                            }}
                                        >
                                            {showFinancials ? "Audience: Project Management (Financials Included)" : "Audience: Field Crew / Site Team"}
                                        </div>
                                    </div>
                                </div>

                                {/* Metadata Pill */}
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[10px] font-medium text-slate-600">
                                    <div>
                                        <span className="font-bold text-slate-800">Date:</span>{" "}
                                        {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-800">Scope:</span>{" "}
                                        {workTypeFilter === "ALL" ? "All Works" : (workTypeFilter === "TENDER" ? "Tender 152G" : "General Work")}
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-800">Jobs Listed:</span>{" "}
                                        {finalProjects.length}
                                    </div>
                                    {showFinancials && (
                                        <div className="text-right font-bold text-emerald-700">
                                            Total: {formatCurrency(totalSelectedValue)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Job Items Table */}
                            {finalProjects.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 font-bold text-sm border-2 border-dashed border-slate-200 rounded-lg">
                                    No projects selected. Use the controls on the left to include jobs.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-800 font-black text-[10px] uppercase tracking-wider">
                                                <th className="py-2 px-2 text-center w-8">#</th>
                                                <th className="py-2 px-3">Project & Scope of Work</th>
                                                {showSite && <th className="py-2 px-3 w-32">Site / Location</th>}
                                                <th className="py-2 px-3 text-center w-28">Status / Stage</th>
                                                {showFinancials && <th className="py-2 px-3 text-right w-28">Est. Worth</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {finalProjects.map((p, idx) => {
                                                const isTender = isTenderProject(p)
                                                const isReactive = isReactiveProject(p)
                                                const invoice = p.invoices?.[0]
                                                const scopeItems = invoice?.items || p.scopes?.[0]?.items || []
                                                const siteName = invoice?.site || p.scopes?.[0]?.site || "Site Specified on Job"

                                                const inv = p.invoices?.[0]
                                                const wbp = p.workBreakdowns?.[0]
                                                const worth = inv ? inv.total : (wbp ? wbp.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 1.15 : 0)

                                                return (
                                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="py-2.5 px-2 text-center font-bold text-slate-500 align-top">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="py-2.5 px-3 align-top">
                                                            <div className="font-black text-slate-900 text-sm">
                                                                {p.name}
                                                            </div>
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
                                                                {isReactive && (
                                                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                                                                        REACTIVE WORK
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Scope Breakdown */}
                                                            {showScope && scopeItems.length > 0 && (
                                                                <div className="mt-2 pl-2 border-l-2 border-slate-300 space-y-0.5 text-[10px] text-slate-600">
                                                                    <span className="font-bold text-slate-700 block text-[9px] uppercase tracking-wider">Tasks:</span>
                                                                    {scopeItems.slice(0, 4).map((it: any, iIdx: number) => (
                                                                        <div key={iIdx} className="leading-tight">
                                                                            • {it.description} <span className="font-bold text-slate-700">({it.quantity} {it.unit || 'ea'})</span>
                                                                        </div>
                                                                    ))}
                                                                    {scopeItems.length > 4 && (
                                                                        <div className="text-[9px] italic text-slate-500">+ {scopeItems.length - 4} more items on quote/sow</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        {showSite && (
                                                            <td className="py-2.5 px-3 text-slate-700 font-medium align-top">
                                                                <div className="font-bold text-slate-900">{siteName}</div>
                                                            </td>
                                                        )}
                                                        <td className="py-2.5 px-3 text-center align-top">
                                                            <span className="inline-block px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider border bg-slate-100 text-slate-800 border-slate-300">
                                                                {p.status.replace(/_/g, ' ')}
                                                            </span>
                                                            {p.commercialStatus === 'AWAITING_PO' && (
                                                                <span className="block mt-1 text-[8px] font-bold text-amber-700">
                                                                    Awaiting PO
                                                                </span>
                                                            )}
                                                        </td>
                                                        {showFinancials && (
                                                            <td className="py-2.5 px-3 text-right font-black text-emerald-800 align-top text-xs">
                                                                {formatCurrency(Number(worth) || 0)}
                                                            </td>
                                                        )}
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Optional Instructions */}
                            {customNotes && (
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-700">
                                    <span className="font-bold uppercase text-[9px] text-slate-800 block mb-0.5">Instructions:</span>
                                    {customNotes}
                                </div>
                            )}

                            {/* Signatures Footer */}
                            <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-[10px] text-slate-500">
                                <div>
                                    <div className="border-b border-slate-400 pb-4 mb-1"></div>
                                    <div className="font-bold text-slate-700">Foreman / Site Supervisor Signature</div>
                                </div>
                                <div>
                                    <div className="border-b border-slate-400 pb-4 mb-1"></div>
                                    <div className="font-bold text-slate-700">Project Manager / Director Signature</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
