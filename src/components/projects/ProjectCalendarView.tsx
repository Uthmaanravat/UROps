"use client"

import React, { useState, useMemo } from "react"
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Repeat,
    Phone,
    MapPin,
    Building2,
    Eye,
    EyeOff,
    Printer,
    Plus,
    Clock,
    FileText,
    CheckCircle2,
    CalendarDays,
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { rescheduleProjectVisitAction } from "@/app/(dashboard)/projects/actions"
import { generateMonthCalendarPdf } from "@/lib/project-print-utils"
import Link from "next/link"

interface ProjectCalendarViewProps {
    projects: any[]
    quotes?: any[]
    prospects?: any[]
    company?: any
    onDateClick?: (date: Date) => void
}

type CalendarMode = "MONTH" | "WEEK" | "3_MONTHS"

export function ProjectCalendarView({
    projects,
    quotes = [],
    prospects = [],
    company,
    onDateClick
}: ProjectCalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [mode, setMode] = useState<CalendarMode>("MONTH")
    const [showPrices, setShowPrices] = useState(false)
    const [showPipelineFollowups, setShowPipelineFollowups] = useState(true)
    const [isPrintingCalendar, setIsPrintingCalendar] = useState(false)

    // Reschedule prompt state for recurring contracts
    const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
    const [pendingReschedule, setPendingReschedule] = useState<{
        project: any
        newDate: Date
    } | null>(null)
    const [isSavingReschedule, setIsSavingReschedule] = useState(false)

    // Navigation handlers
    const handlePrev = () => {
        const next = new Date(currentDate)
        if (mode === "MONTH") next.setMonth(next.getMonth() - 1)
        else if (mode === "WEEK") next.setDate(next.getDate() - 7)
        else if (mode === "3_MONTHS") next.setMonth(next.getMonth() - 3)
        setCurrentDate(next)
    }

    const handleNext = () => {
        const next = new Date(currentDate)
        if (mode === "MONTH") next.setMonth(next.getMonth() + 1)
        else if (mode === "WEEK") next.setDate(next.getDate() + 7)
        else if (mode === "3_MONTHS") next.setMonth(next.getMonth() + 3)
        setCurrentDate(next)
    }

    const handleToday = () => {
        setCurrentDate(new Date())
    }

    // Month Grid Generation
    const monthData = useMemo(() => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()

        const firstDayOfMonth = new Date(year, month, 1)
        const lastDayOfMonth = new Date(year, month + 1, 0)

        // Find Monday of first calendar week
        const startDayOfWeek = firstDayOfMonth.getDay()
        const diffToMonday = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek
        const startCalendar = new Date(firstDayOfMonth)
        startCalendar.setDate(firstDayOfMonth.getDate() + diffToMonday)

        const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        let iter = new Date(startCalendar)
        while (days.length < 35 || iter <= lastDayOfMonth) {
            days.push({
                date: new Date(iter),
                isCurrentMonth: iter.getMonth() === month,
                isToday: iter.getTime() === today.getTime()
            })
            iter.setDate(iter.getDate() + 1)
            if (days.length >= 42) break
        }

        return {
            monthLabel: currentDate.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }).toUpperCase(),
            days
        }
    }, [currentDate])

    // Summary calculations for current month view
    const summary = useMemo(() => {
        const currentMonth = currentDate.getMonth()
        const currentYear = currentDate.getFullYear()

        let confirmedJobs = 0
        let projectedVisits = 0
        let totalValue = 0

        projects.forEach(p => {
            if (!p.startDate) return
            const d = new Date(p.startDate)
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                if (p.isRecurring || p.parentProjectId) {
                    projectedVisits++
                } else {
                    confirmedJobs++
                }
                const val = p.invoices?.[0]?.total || 0
                totalValue += Number(val)
            }
        })

        return { confirmedJobs, projectedVisits, totalValue }
    }, [currentDate, projects])

    // Mobile Agenda List calculations: group days with activity in current month
    const agendaDays = useMemo(() => {
        const todayStr = new Date().toISOString().split("T")[0]
        const currentMonth = currentDate.getMonth()
        const currentYear = currentDate.getFullYear()

        const daysWithItems: {
            date: Date
            isToday: boolean
            projects: any[]
            quotes: any[]
            prospects: any[]
        }[] = []

        // Scan all days of current month
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
        for (let d = 1; d <= daysInMonth; d++) {
            const cur = new Date(currentYear, currentMonth, d)
            const curStr = cur.toISOString().split("T")[0]

            const dayProjects = projects.filter(p => {
                if (!p.startDate) return false
                return new Date(p.startDate).toISOString().split("T")[0] === curStr
            })

            const dayQuotes = quotes.filter(q => {
                if (!q.date) return false
                return new Date(q.date).toISOString().split("T")[0] === curStr
            })

            const dayProspects = showPipelineFollowups
                ? prospects.filter(pr => {
                      if (!pr.nextFollowupDate) return false
                      return new Date(pr.nextFollowupDate).toISOString().split("T")[0] === curStr
                  })
                : []

            if (dayProjects.length > 0 || dayQuotes.length > 0 || dayProspects.length > 0 || curStr === todayStr) {
                daysWithItems.push({
                    date: cur,
                    isToday: curStr === todayStr,
                    projects: dayProjects,
                    quotes: dayQuotes,
                    prospects: dayProspects
                })
            }
        }

        return daysWithItems
    }, [currentDate, projects, quotes, prospects, showPipelineFollowups])

    // Print Month Calendar Handler
    const handlePrintMonth = async () => {
        setIsPrintingCalendar(true)
        try {
            const doc = await generateMonthCalendarPdf(projects, quotes, currentDate, company, { showPrices })
            const monthName = currentDate.toLocaleDateString("en-ZA", { month: "short", year: "numeric" }).replace(/\s+/g, "_")
            doc.save(`AeroWash_Calendar_${monthName}.pdf`)
        } catch (e) {
            console.error("Print Month Calendar error:", e)
            alert("Failed to generate Month Calendar PDF")
        } finally {
            setIsPrintingCalendar(false)
        }
    }

    // Drag and drop handlers for rescheduling
    const handleDragStart = (e: React.DragEvent, project: any) => {
        e.dataTransfer.setData("application/json", JSON.stringify(project))
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
        e.preventDefault()
        try {
            const raw = e.dataTransfer.getData("application/json")
            if (!raw) return
            const project = JSON.parse(raw)

            if (project.parentProjectId || project.isRecurring) {
                // Prompt user: this visit or all future visits
                setPendingReschedule({ project, newDate: targetDate })
                setRescheduleModalOpen(true)
            } else {
                // Single direct job reschedule
                await rescheduleProjectVisitAction(project.id, targetDate.toISOString(), "THIS_VISIT")
            }
        } catch (err) {
            console.error("Drop reschedule error:", err)
        }
    }

    const confirmReschedule = async (rescheduleType: "THIS_VISIT" | "ALL_FUTURE_VISITS") => {
        if (!pendingReschedule) return
        setIsSavingReschedule(true)
        try {
            await rescheduleProjectVisitAction(
                pendingReschedule.project.id,
                pendingReschedule.newDate.toISOString(),
                rescheduleType
            )
            setRescheduleModalOpen(false)
            setPendingReschedule(null)
        } catch (e) {
            console.error("Confirm reschedule error:", e)
        } finally {
            setIsSavingReschedule(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* 1. Header Toolbar with Month Summary */}
            <div className="bg-[#14141E] p-4 rounded-2xl border border-white/10 shadow-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Navigation: Prev / Today / Next & Month Heading */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handlePrev}
                                className="h-8 w-8 text-gray-300 hover:text-white hover:bg-white/10"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleToday}
                                className="h-8 px-3 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/10"
                            >
                                Today
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleNext}
                                className="h-8 w-8 text-gray-300 hover:text-white hover:bg-white/10"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <h2 className="text-xl font-black text-white tracking-tight">
                            {monthData.monthLabel}
                        </h2>
                    </div>

                    {/* Mode Toggle: Month | Week | 3-Months */}
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                        <button
                            type="button"
                            onClick={() => setMode("MONTH")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                mode === "MONTH" ? "bg-primary text-primary-foreground shadow-md" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Month
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("WEEK")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                mode === "WEEK" ? "bg-primary text-primary-foreground shadow-md" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Week
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("3_MONTHS")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                mode === "3_MONTHS" ? "bg-primary text-primary-foreground shadow-md" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            3 Months
                        </button>
                    </div>

                    {/* Right Controls: Prices, Pipeline Toggle, Print */}
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-300 cursor-pointer bg-black/40 px-3 py-2 rounded-xl border border-white/5 select-none">
                            <input
                                type="checkbox"
                                checked={showPipelineFollowups}
                                onChange={(e) => setShowPipelineFollowups(e.target.checked)}
                                className="rounded text-primary focus:ring-primary"
                            />
                            <span>Pipeline Follow-ups</span>
                        </label>

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
                            onClick={handlePrintMonth}
                            disabled={isPrintingCalendar}
                            className="bg-[#14141E] text-white border border-primary/50 hover:bg-primary/10 font-bold text-xs h-9 px-3 flex items-center gap-1.5 shadow-sm"
                        >
                            {isPrintingCalendar ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Printer className="h-3.5 w-3.5 text-primary" />}
                            <span>Print Month</span>
                        </Button>
                    </div>
                </div>

                {/* Month Summary Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5 text-xs">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                            <span className="text-gray-400">Confirmed Jobs:</span>
                            <span className="font-bold text-white">{summary.confirmedJobs}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 border border-teal-300" />
                            <span className="text-gray-400">Projected Contract Visits:</span>
                            <span className="font-bold text-teal-300">{summary.projectedVisits}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full border border-dashed border-amber-400" />
                            <span className="text-gray-400">Pencilled Quotes:</span>
                            <span className="font-bold text-amber-300">{quotes.length}</span>
                        </div>
                    </div>

                    {showPrices && (
                        <div className="font-mono text-sm font-black text-emerald-400">
                            Month Projected: R {summary.totalValue.toLocaleString()}
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Desktop Calendar Month Grid View (Hidden on mobile) */}
            <div className="hidden md:block rounded-2xl border border-white/10 bg-[#14141E] shadow-2xl overflow-hidden">
                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 border-b border-white/10 bg-black/60 text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground py-2.5">
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                    <div>Sun</div>
                </div>

                {/* Day Cells */}
                <div className="grid grid-cols-7 divide-x divide-y divide-white/5 bg-[#0f0f1a]">
                    {monthData.days.map((dayObj, dIdx) => {
                        const dayDateStr = dayObj.date.toISOString().split("T")[0]

                        // Find items for this day
                        const dayProjects = projects.filter(p => {
                            if (!p.startDate) return false
                            return new Date(p.startDate).toISOString().split("T")[0] === dayDateStr
                        })

                        const dayQuotes = quotes.filter(q => {
                            if (!q.date) return false
                            return new Date(q.date).toISOString().split("T")[0] === dayDateStr
                        })

                        const dayProspects = showPipelineFollowups
                            ? prospects.filter(pr => {
                                  if (!pr.nextFollowupDate) return false
                                  return new Date(pr.nextFollowupDate).toISOString().split("T")[0] === dayDateStr
                              })
                            : []

                        return (
                            <div
                                key={dIdx}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, dayObj.date)}
                                onClick={() => onDateClick?.(dayObj.date)}
                                className={`min-h-[120px] p-2 flex flex-col transition-colors group cursor-pointer ${
                                    dayObj.isCurrentMonth ? "bg-[#14141E]/40" : "bg-black/40 opacity-40"
                                } ${dayObj.isToday ? "ring-2 ring-primary/80 bg-primary/[0.05]" : "hover:bg-white/[0.02]"}`}
                            >
                                {/* Date Number Header */}
                                <div className="flex items-center justify-between mb-1.5">
                                    <span
                                        className={`text-xs font-black rounded-full h-6 w-6 flex items-center justify-center ${
                                            dayObj.isToday
                                                ? "bg-primary text-primary-foreground shadow-md"
                                                : "text-gray-400 group-hover:text-white"
                                        }`}
                                    >
                                        {dayObj.date.getDate()}
                                    </span>

                                    {dayProjects.length > 0 && (
                                        <span className="text-[9px] font-mono font-bold text-gray-500">
                                            {dayProjects.length} {dayProjects.length === 1 ? "job" : "jobs"}
                                        </span>
                                    )}
                                </div>

                                {/* Items Container */}
                                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[160px] pr-0.5">
                                    {/* 1. Confirmed & Projected Jobs */}
                                    {dayProjects.map((p) => {
                                        const isRecurring = p.isRecurring || p.parentProjectId
                                        const totalWorth = p.invoices?.[0]?.total || 0

                                        return (
                                            <div
                                                key={p.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, p)}
                                                className={`p-1.5 rounded-lg border text-left text-xs transition-all shadow-sm ${
                                                    isRecurring
                                                        ? "border-teal-500/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20"
                                                        : "border-primary/50 bg-primary/20 text-white font-bold hover:bg-primary/30"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-[10px] font-black uppercase tracking-wider truncate">
                                                        {p.client?.name || p.name}
                                                    </span>
                                                    {isRecurring && <Repeat className="h-3 w-3 text-teal-400 shrink-0" />}
                                                </div>
                                                <div className="text-[9px] opacity-80 truncate mt-0.5">
                                                    {p.site || p.name}
                                                </div>
                                                {showPrices && totalWorth > 0 && (
                                                    <div className="text-[9px] font-mono text-emerald-400 mt-0.5">
                                                        R {Number(totalWorth).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}

                                    {/* 2. Pencilled In Quotes */}
                                    {dayQuotes.map((q) => (
                                        <div
                                            key={q.id}
                                            className="p-1.5 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 text-amber-200 text-left text-xs hover:bg-amber-500/20 transition-all"
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 truncate">
                                                    Pencilled Quote
                                                </span>
                                                <FileText className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                                            </div>
                                            <div className="text-[9px] truncate mt-0.5 font-bold">
                                                {q.client?.name || q.quoteNumber}
                                            </div>
                                            {showPrices && q.total > 0 && (
                                                <div className="text-[8px] font-mono text-amber-300/80">
                                                    R {Number(q.total).toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* 3. Pipeline Follow-ups & Site Visits */}
                                    {dayProspects.map((pr) => (
                                        <Link
                                            key={pr.id}
                                            href={`/prospects?id=${pr.id}`}
                                            className="block p-1 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[9px] font-bold hover:bg-purple-500/25 transition-all truncate"
                                        >
                                            🎯 Call: {pr.name}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 3. Mobile Phone Day-by-Day Agenda List */}
            <div className="block md:hidden space-y-3">
                {agendaDays.length === 0 ? (
                    <div className="p-8 text-center bg-[#14141E] rounded-2xl border border-white/10 text-muted-foreground text-xs font-bold">
                        No jobs or visits scheduled for this month.
                    </div>
                ) : (
                    agendaDays.map(({ date, isToday, projects: dayProjects, quotes: dayQuotes, prospects: dayProspects }) => (
                        <div
                            key={date.toISOString()}
                            className={`p-3.5 rounded-2xl border ${
                                isToday ? "border-primary bg-primary/[0.05]" : "border-white/10 bg-[#14141E]"
                            } shadow-lg space-y-2.5`}
                        >
                            {/* Day Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-black uppercase tracking-wider ${isToday ? "text-primary" : "text-white"}`}>
                                        {date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                                    </span>
                                    {isToday && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-primary text-black">
                                            Today
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-mono text-zinc-400">
                                    {dayProjects.length} {dayProjects.length === 1 ? "job" : "jobs"}
                                </span>
                            </div>

                            {/* Day Items */}
                            <div className="space-y-2">
                                {dayProjects.map(p => (
                                    <div key={p.id} className="p-2.5 rounded-xl border border-white/10 bg-black/40 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-white">{p.client?.name || p.name}</span>
                                            {(p.isRecurring || p.parentProjectId) && (
                                                <span className="text-[9px] font-bold text-teal-400 bg-teal-950/60 border border-teal-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <Repeat className="h-2.5 w-2.5" /> Recurring
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                                            <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
                                            <span className="truncate">{p.site || p.client?.address || "Site on file"}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-white/5">
                                            <span>Crew: {p.crew || "Flight Alpha"}</span>
                                            {showPrices && p.invoices?.[0]?.total && (
                                                <span className="text-emerald-400 font-mono font-bold">
                                                    R {Number(p.invoices[0].total).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {dayQuotes.map(q => (
                                    <div key={q.id} className="p-2.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-amber-300">Pencilled Quote: {q.client?.name}</span>
                                            <span className="text-[9px] font-mono text-amber-400 font-bold">{q.quoteNumber}</span>
                                        </div>
                                        {showPrices && q.total > 0 && (
                                            <div className="text-[10px] font-mono text-amber-400/80">
                                                R {Number(q.total).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {dayProspects.map(pr => (
                                    <div key={pr.id} className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 flex items-center justify-between">
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-purple-200 truncate">Pipeline Follow-up: {pr.name}</div>
                                            <div className="text-[10px] text-purple-300/70 truncate">{pr.propertyManagerName || "Property Manager"}</div>
                                        </div>
                                        {pr.propertyManagerPhone && (
                                            <a
                                                href={`tel:${pr.propertyManagerPhone}`}
                                                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0 ml-2"
                                            >
                                                <Phone className="h-3.5 w-3.5" />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 4. Recurring Reschedule Confirmation Modal */}
            <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
                <DialogContent className="bg-[#0f0f1a] border border-white/10 text-white sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase tracking-wider text-primary flex items-center gap-2">
                            <Repeat className="h-5 w-5 text-primary" />
                            Reschedule Recurring Visit
                        </DialogTitle>
                        <DialogDescription className="text-gray-300 text-xs">
                            This job is part of a recurring service contract:
                            <span className="font-bold text-white block mt-1">
                                {pendingReschedule?.project?.name}
                            </span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-3">
                        <p className="text-xs text-gray-300">
                            Would you like to reschedule <span className="font-bold text-primary">only this single visit</span>, or shift <span className="font-bold text-teal-400">this and all subsequent future visits</span>?
                        </p>
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={() => confirmReschedule("THIS_VISIT")}
                            disabled={isSavingReschedule}
                            className="bg-black/40 border-white/20 text-white hover:bg-white/10 text-xs font-bold"
                        >
                            This Visit Only
                        </Button>
                        <Button
                            onClick={() => confirmReschedule("ALL_FUTURE_VISITS")}
                            disabled={isSavingReschedule}
                            className="bg-primary text-primary-foreground font-black text-xs hover:bg-primary/90"
                        >
                            Shift All Future Visits
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
