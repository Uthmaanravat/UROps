"use client"

import React, { useState, useMemo } from "react"
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Printer,
    Eye,
    EyeOff,
    Repeat,
    MapPin,
    Building2,
    Clock,
    AlertCircle,
    CheckCircle2,
    CalendarDays
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { generateSchedulePdf } from "@/lib/project-print-utils"
import Link from "next/link"

interface ProjectScheduleViewProps {
    projects: any[]
    company?: any
    onJobClick?: (project: any) => void
}

type HorizonRange = "2_MONTHS" | "3_MONTHS" | "6_MONTHS" | "12_MONTHS"

interface WeekColumn {
    weekNumber: number
    startDate: Date
    endDate: Date
    label: string
    isCurrentWeek: boolean
    monthKey: string
    monthLabel: string
}

export function ProjectScheduleView({ projects, company, onJobClick }: ProjectScheduleViewProps) {
    const isAeroWash = Boolean(
        company?.id === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' ||
        company?.companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' ||
        company?.theme === 'dark-orange' ||
        company?.settings?.theme === 'dark-orange' ||
        company?.name?.toLowerCase().includes('aerowash') ||
        company?.settings?.name?.toLowerCase().includes('aerowash')
    )
    const [range, setRange] = useState<HorizonRange>("2_MONTHS")
    const [showPrices, setShowPrices] = useState(false)
    const [isPrinting, setIsPrinting] = useState(false)

    const numMonths = useMemo(() => {
        switch (range) {
            case "2_MONTHS": return 2
            case "3_MONTHS": return 3
            case "6_MONTHS": return 6
            case "12_MONTHS": return 12
            default: return 2
        }
    }, [range])

    // Generate weekly date intervals starting from beginning of current month
    const { weeks, monthGroups } = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        // Find Monday of the first week
        const dayOfWeek = start.getDay()
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const curWeekStart = new Date(start)
        curWeekStart.setDate(start.getDate() + diffToMonday)

        const endDate = new Date(today.getFullYear(), today.getMonth() + numMonths, 0)

        const generatedWeeks: WeekColumn[] = []
        const monthsMap: Record<string, { label: string; weekCount: number }> = {}

        let iter = new Date(curWeekStart)
        while (iter <= endDate) {
            const wStart = new Date(iter)
            const wEnd = new Date(iter)
            wEnd.setDate(wStart.getDate() + 6)
            wEnd.setHours(23, 59, 59, 999)

            // Calculate week number
            const firstJan = new Date(wStart.getFullYear(), 0, 1)
            const days = Math.floor((wStart.getTime() - firstJan.getTime()) / (24 * 3600 * 1000))
            const weekNumber = Math.ceil((days + firstJan.getDay() + 1) / 7)

            const isCurrent = today >= wStart && today <= wEnd

            // Middle of the week for month grouping
            const midWeek = new Date(wStart)
            midWeek.setDate(wStart.getDate() + 3)
            const mKey = `${midWeek.getFullYear()}-${String(midWeek.getMonth() + 1).padStart(2, "0")}`
            const mLabel = midWeek.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }).toUpperCase()

            const startDay = wStart.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
            const endDay = wEnd.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
            const label = `Wk ${weekNumber} · ${startDay} – ${endDay}`

            generatedWeeks.push({
                weekNumber,
                startDate: wStart,
                endDate: wEnd,
                label,
                isCurrentWeek: isCurrent,
                monthKey: mKey,
                monthLabel: mLabel
            })

            if (!monthsMap[mKey]) {
                monthsMap[mKey] = { label: mLabel, weekCount: 0 }
            }
            monthsMap[mKey].weekCount++

            // Move to next Monday
            iter.setDate(iter.getDate() + 7)
        }

        return { weeks: generatedWeeks, monthGroups: monthsMap }
    }, [numMonths])

    // Calculate month summaries (jobs + value)
    const monthSummaries = useMemo(() => {
        const summaries: Record<string, { jobCount: number; totalValue: number }> = {}
        Object.keys(monthGroups).forEach(mKey => {
            summaries[mKey] = { jobCount: 0, totalValue: 0 }
        })

        projects.forEach(p => {
            const pDate = p.startDate ? new Date(p.startDate) : null
            if (!pDate) return
            const mKey = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, "0")}`
            if (summaries[mKey]) {
                summaries[mKey].jobCount++
                const val = p.invoices?.[0]?.total || 0
                summaries[mKey].totalValue += Number(val)
            }
        })

        return summaries
    }, [monthGroups, projects])

    const handlePrintSchedule = async () => {
        setIsPrinting(true)
        try {
            const doc = await generateSchedulePdf(projects, company, {
                rangeMonths: numMonths,
                showPrices
            })
            doc.save(`${isAeroWash ? "aerowash" : "operations"}_schedule_${numMonths}_months.pdf`)
        } catch (e) {
            console.error("Print Schedule error:", e)
        } finally {
            setIsPrinting(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Top Toolbar: Range Selector, Price Toggle & Print Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#14141E] p-3 rounded-2xl border border-white/10 shadow-xl">
                {/* Range Toggle */}
                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-2">Horizon:</span>
                    <button
                        type="button"
                        onClick={() => setRange("2_MONTHS")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            range === "2_MONTHS" ? "bg-primary text-primary-foreground shadow-md" : "text-gray-400 hover:text-white"
                        }`}
                    >
                        2 Months
                    </button>
                    <button
                        type="button"
                        onClick={() => setRange("3_MONTHS")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            range === "3_MONTHS" ? "bg-primary text-primary-foreground shadow-md" : "text-gray-400 hover:text-white"
                        }`}
                    >
                        3 Months
                    </button>
                    <button
                        type="button"
                        onClick={() => setRange("6_MONTHS")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            range === "6_MONTHS" ? "bg-primary text-primary-foreground shadow-md" : "text-gray-400 hover:text-white"
                        }`}
                    >
                        6 Months
                    </button>
                    <button
                        type="button"
                        onClick={() => setRange("12_MONTHS")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            range === "12_MONTHS" ? "bg-primary text-primary-foreground shadow-md" : "text-gray-400 hover:text-white"
                        }`}
                    >
                        12 Months
                    </button>
                </div>

                {/* Right Actions: Prices Toggle & Print Schedule */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPrices(!showPrices)}
                        className="bg-black/40 border-white/10 text-white hover:bg-white/10 text-xs h-9 font-bold flex items-center gap-1.5"
                    >
                        {showPrices ? <EyeOff className="h-3.5 w-3.5 text-primary" /> : <Eye className="h-3.5 w-3.5" />}
                        <span>{showPrices ? "Hide Prices" : "Show Prices"}</span>
                    </Button>

                    <Button
                        onClick={handlePrintSchedule}
                        disabled={isPrinting}
                        className="bg-[#14141E] text-white border border-primary/50 hover:bg-primary/10 font-bold text-xs h-9 px-4 flex items-center gap-2 shadow-sm"
                    >
                        <Printer className="h-4 w-4 text-primary" />
                        <span>{isPrinting ? "Generating..." : "Print Schedule (A4 Landscape)"}</span>
                    </Button>
                </div>
            </div>

            {/* Schedule Grid Container with Horizontal Scroll */}
            <div className="rounded-2xl border border-white/10 bg-[#14141E] shadow-2xl overflow-hidden">
                <div className="overflow-x-auto pb-4">
                    <div className="min-w-[900px]">
                        {/* 1. Month Header Groups Bar with Month Summaries */}
                        <div className="flex border-b border-white/10 bg-black/60">
                            {/* Left fixed spacer for job labels */}
                            <div className="w-[260px] min-w-[260px] p-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-r border-white/10 flex items-center justify-between">
                                <span>Scheduled Jobs ({projects.length})</span>
                                <span className="text-primary text-[11px] font-bold">Horizon Grid</span>
                            </div>

                            {/* Month Header Spans */}
                            <div className="flex-1 flex">
                                {Object.entries(monthGroups).map(([mKey, mInfo]) => {
                                    const summary = monthSummaries[mKey] || { jobCount: 0, totalValue: 0 }
                                    const widthPercent = (mInfo.weekCount / weeks.length) * 100

                                    return (
                                        <div
                                            key={mKey}
                                            style={{ width: `${widthPercent}%` }}
                                            className="p-2.5 text-center border-r border-white/10 last:border-r-0 bg-white/[0.02]"
                                        >
                                            <div className="text-xs font-black uppercase tracking-widest text-white">
                                                {mInfo.label}
                                            </div>
                                            <div className="text-[10px] font-bold text-muted-foreground mt-0.5 flex items-center justify-center gap-2">
                                                <span className="text-primary font-black">{summary.jobCount} Jobs</span>
                                                {showPrices && (
                                                    <span className="text-emerald-400 font-mono">
                                                        · R {summary.totalValue.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* 2. Week Column Headers */}
                        <div className="flex border-b border-white/10 bg-black/40">
                            <div className="w-[260px] min-w-[260px] p-2 text-[10px] font-black uppercase tracking-wider text-gray-400 border-r border-white/10">
                                Client & Site Address
                            </div>
                            <div className="flex-1 flex">
                                {weeks.map((w, idx) => (
                                    <div
                                        key={idx}
                                        style={{ width: `${100 / weeks.length}%` }}
                                        className={`p-2 text-center border-r border-white/5 last:border-r-0 text-[10px] font-bold transition-colors ${
                                            w.isCurrentWeek
                                                ? "bg-primary/15 text-primary border-b-2 border-primary"
                                                : "text-gray-300"
                                        }`}
                                    >
                                        <div className="whitespace-nowrap">{w.label}</div>
                                        {w.isCurrentWeek && (
                                            <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-primary text-primary-foreground mt-0.5">
                                                This Week
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Job Rows */}
                        <div className="divide-y divide-white/5">
                            {projects.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground text-sm font-bold">
                                    No scheduled work found for this horizon.
                                </div>
                            ) : (
                                projects.map((project: any) => {
                                    const pDate = project.startDate ? new Date(project.startDate) : null
                                    const poNumber = project.poNumber || project.clientPoNumber || project.invoices?.[0]?.clientPoNumber || null
                                    const totalWorth = project.invoices?.[0]?.total || 0

                                    // Check which week column this project falls in
                                    const matchingWeekIdx = pDate
                                        ? weeks.findIndex(w => pDate >= w.startDate && pDate <= w.endDate)
                                        : -1

                                    return (
                                        <div key={project.id} className="flex hover:bg-white/[0.02] transition-colors group">
                                            {/* Left Client & Job Summary Info */}
                                            <div className="w-[260px] min-w-[260px] p-3 border-r border-white/10 flex flex-col justify-center">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-xs text-white truncate">
                                                        {project.client?.name || "Client"}
                                                    </span>
                                                    {(project.isRecurring || project.parentProjectId) && (
                                                        <span title="Recurring Contract Visit"><Repeat className="h-3 w-3 text-teal-400 shrink-0" /></span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-gray-400 truncate mt-0.5">
                                                    {project.site || project.name}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1 font-mono">
                                                    {poNumber && <span className="text-primary font-bold">{poNumber}</span>}
                                                    {showPrices && totalWorth > 0 && (
                                                        <span className="text-emerald-400">R {Number(totalWorth).toLocaleString()}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Timeline Grid Cells */}
                                            <div className="flex-1 flex relative items-center py-2">
                                                {weeks.map((w, wIdx) => {
                                                    const isJobInThisWeek = matchingWeekIdx === wIdx

                                                    return (
                                                        <div
                                                            key={wIdx}
                                                            style={{ width: `${100 / weeks.length}%` }}
                                                            className={`h-full min-h-[50px] border-r border-white/5 last:border-r-0 flex items-center justify-center p-1 ${
                                                                w.isCurrentWeek ? "bg-primary/[0.03]" : ""
                                                            }`}
                                                        >
                                                            {isJobInThisWeek ? (
                                                                <Link
                                                                    href={`/projects/${project.id}`}
                                                                    onClick={() => onJobClick?.(project)}
                                                                    className="w-full"
                                                                >
                                                                    <div
                                                                        className={`p-2 rounded-xl border text-left shadow-lg transition-all hover:scale-[1.02] cursor-pointer ${
                                                                            project.status === "COMPLETED"
                                                                                ? "bg-teal-500/20 border-teal-500/40 text-teal-200"
                                                                                : project.status === "IN_PROGRESS"
                                                                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                                                                                : project.isRecurring || project.parentProjectId
                                                                                ? "bg-primary/20 border-primary/50 text-white"
                                                                                : "bg-purple-500/20 border-purple-500/40 text-purple-200"
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-1">
                                                                            <span className="text-[10px] font-black uppercase tracking-wider truncate">
                                                                                {project.name}
                                                                            </span>
                                                                            {(project.isRecurring || project.parentProjectId) && (
                                                                                <Repeat className="h-3 w-3 text-primary shrink-0" />
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[9px] font-medium opacity-80 mt-0.5 truncate">
                                                                            {project.startDate
                                                                                ? new Date(project.startDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })
                                                                                : "Scheduled"}{(() => {
                                                                                    const c = isAeroWash
                                                                                        ? (project.crew || "Flight Alpha")
                                                                                        : (project.assignedTeam || project.team || project.crew)
                                                                                    return c ? ` · ${c}` : ""
                                                                                })()}
                                                                        </div>
                                                                    </div>
                                                                </Link>
                                                            ) : null}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* 4. Empty Weeks Clearly Marked "No work booked" */}
                        <div className="flex border-t border-white/10 bg-black/20 py-2">
                            <div className="w-[260px] min-w-[260px] p-2 text-[10px] font-bold text-muted-foreground border-r border-white/10">
                                Week Booking Status
                            </div>
                            <div className="flex-1 flex">
                                {weeks.map((w, idx) => {
                                    const hasWorkInWeek = projects.some(p => {
                                        if (!p.startDate) return false
                                        const pD = new Date(p.startDate)
                                        return pD >= w.startDate && pD <= w.endDate
                                    })

                                    return (
                                        <div
                                            key={idx}
                                            style={{ width: `${100 / weeks.length}%` }}
                                            className="text-center p-1 border-r border-white/5 last:border-r-0"
                                        >
                                            {!hasWorkInWeek ? (
                                                <span className="inline-block text-[9px] font-bold text-gray-500/80 border border-dashed border-white/10 px-1.5 py-0.5 rounded-md">
                                                    No work booked
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                                                    <CheckCircle2 className="h-2.5 w-2.5" /> Booked
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
