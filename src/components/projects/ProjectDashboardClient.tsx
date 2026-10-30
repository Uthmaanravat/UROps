"use client"

import React, { useState, useTransition, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import {
    Plus,
    LayoutGrid,
    List,
    Calendar as CalendarIcon,
    Briefcase,
    Clock,
    CheckCircle2,
    AlertCircle,
    MoreHorizontal,
    DollarSign,
    Printer,
    Zap,
    FileText,
    ArrowUpRight,
    MapPin,
    User,
    Flame,
    Loader2,
    Repeat,
    CalendarDays
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { updateProjectStatus, updateProjectCommercialStatus } from "@/app/(dashboard)/projects/actions"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { generateSchedulePdf, generateJobSheetPdf } from "@/lib/project-print-utils"
import { ProjectScheduleView } from "@/components/projects/ProjectScheduleView"
import { ProjectCalendarView } from "@/components/projects/ProjectCalendarView"
import { ProjectRecurrenceModal } from "@/components/projects/ProjectRecurrenceModal"
import { WeatherBadge } from "@/components/projects/WeatherBadge"
import { ProjectSchedulePrintModal } from "@/components/projects/ProjectSchedulePrintModal"

// PART 5 REQUIREMENT: Scheduled -> In Progress -> Completed -> Invoiced -> Paid
const COLUMNS = [
    {
        id: 'SCHEDULED',
        title: 'Scheduled',
        statuses: ['SCHEDULED', 'PLANNING', 'QUOTED', 'SOW', 'SOW_SUBMITTED', 'LEAD'],
        color: 'border-purple-500/30 bg-purple-500/5',
        badge: 'bg-purple-950 text-purple-300 border-purple-800'
    },
    {
        id: 'IN_PROGRESS',
        title: 'In Progress',
        statuses: ['IN_PROGRESS'],
        color: 'border-emerald-500/30 bg-emerald-500/5',
        badge: 'bg-emerald-950 text-emerald-300 border-emerald-800'
    },
    {
        id: 'COMPLETED',
        title: 'Completed',
        statuses: ['COMPLETED'],
        color: 'border-teal-500/30 bg-teal-500/5',
        badge: 'bg-teal-950 text-teal-300 border-teal-800'
    },
    {
        id: 'INVOICED',
        title: 'Invoiced',
        statuses: ['INVOICED', 'AWAITING_PAYMENT'],
        color: 'border-blue-500/30 bg-blue-500/5',
        badge: 'bg-blue-950 text-blue-300 border-blue-800'
    },
    {
        id: 'PAID',
        title: 'Paid',
        statuses: ['PAID'],
        color: 'border-white/10 bg-white/5',
        badge: 'bg-zinc-800 text-zinc-400 border-zinc-700'
    },
]

export function ProjectDashboardClient({
    projects: initialProjects,
    company,
    tendersEnabled,
    reactiveEnabled,
    clients = [],
    quotes = [],
    prospects = []
}: {
    projects: any[]
    company?: any
    tendersEnabled?: boolean
    reactiveEnabled?: boolean
    clients?: any[]
    quotes?: any[]
    prospects?: any[]
}) {
    const isTendersEnabled = tendersEnabled ?? (company?.settings?.tendersEnabled === true)
    const isReactiveEnabled = reactiveEnabled ?? (company?.settings?.reactiveEnabled === true)
    const isAeroWash = Boolean(
        company?.id === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' ||
        company?.companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' ||
        company?.theme === 'dark-orange' ||
        company?.settings?.theme === 'dark-orange' ||
        company?.name?.toLowerCase().includes('aerowash') ||
        company?.settings?.name?.toLowerCase().includes('aerowash')
    )

    const [view, setView] = useState<'KANBAN' | 'LIST' | 'SCHEDULE' | 'CALENDAR'>('KANBAN')
    const [projects, setProjects] = useState(initialProjects || [])
    const [filterCategory, setFilterCategory] = useState<'ALL' | 'WAITING_PO' | 'REACTIVE' | 'TENDER'>('ALL')
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    // Modals
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
    const [lrScheduleModalOpen, setLrScheduleModalOpen] = useState(false)
    const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false)
    const [showPaid, setShowPaid] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('urops_projects_show_paid')
            return saved !== null ? saved === 'true' : false
        }
        return false
    })
    const [hideCompleted, setHideCompleted] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('urops_projects_hide_completed')
            return saved !== null ? saved === 'true' : false
        }
        return false
    })

    const toggleShowPaid = () => {
        setShowPaid(prev => {
            const next = !prev
            if (typeof window !== 'undefined') {
                localStorage.setItem('urops_projects_show_paid', String(next))
            }
            return next
        })
    }

    const toggleHideCompleted = () => {
        setHideCompleted(prev => {
            const next = !prev
            if (typeof window !== 'undefined') {
                localStorage.setItem('urops_projects_hide_completed', String(next))
            }
            return next
        })
    }

    const paidCount = projects.filter(p => p.status === 'PAID').length
    const completedCount = projects.filter(p => p.status === 'COMPLETED').length

    const activeColumns = COLUMNS.filter(col => {
        if (col.id === 'PAID' && !showPaid) return false
        if (col.id === 'COMPLETED' && hideCompleted) return false
        return true
    })
    const [showPricesOnSchedule, setShowPricesOnSchedule] = useState(false)
    const [scheduleRangeMonths, setScheduleRangeMonths] = useState<number>(2)
    const [isPrintingSchedule, setIsPrintingSchedule] = useState(false)
    const [printingJobSheetId, setPrintingJobSheetId] = useState<string | null>(null)

    useEffect(() => {
        setProjects(initialProjects || [])
    }, [initialProjects])

    // Filter projects
    const displayedProjects = projects.filter(p => {
        if (!showPaid && p.status === 'PAID') return false
        if (hideCompleted && p.status === 'COMPLETED') return false
        if (!isTendersEnabled && p.workType === 'TENDER') return false
        if (!isReactiveEnabled && (p.commercialStatus === 'REACTIVE_WORK' || p.commercialStatus === 'EMERGENCY_WORK') && filterCategory === 'REACTIVE') return false
        if (filterCategory === 'WAITING_PO') return p.commercialStatus === 'AWAITING_PO'
        if (filterCategory === 'REACTIVE' && isReactiveEnabled) return p.commercialStatus === 'REACTIVE_WORK' || p.commercialStatus === 'EMERGENCY_WORK'
        if (filterCategory === 'TENDER') return p.workType === 'TENDER' || Boolean(p.tenderId)
        return true
    })

    // Drag and drop handler
    const handleDragStart = (e: React.DragEvent, projectId: string) => {
        e.dataTransfer.setData('projectId', projectId)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = async (e: React.DragEvent, colId: string) => {
        e.preventDefault()
        const projectId = e.dataTransfer.getData('projectId')
        const targetDbStatus = COLUMNS.find(c => c.id === colId)?.statuses[0]
        if (!targetDbStatus) return

        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: targetDbStatus } : p))
        startTransition(async () => {
            await updateProjectStatus(projectId, targetDbStatus)
            router.refresh()
        })
    }

    const handleStatusChange = async (projectId: string, field: 'status' | 'commercialStatus', value: string) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, [field]: value } : p))
        startTransition(async () => {
            if (field === 'status') {
                await updateProjectStatus(projectId, value)
            } else {
                await updateProjectCommercialStatus(projectId, value)
            }
            router.refresh()
        })
    }

    // Print handlers
    const handlePrintSchedule = async () => {
        setIsPrintingSchedule(true)
        try {
            const doc = await generateSchedulePdf(displayedProjects, company, {
                rangeMonths: scheduleRangeMonths,
                showPrices: showPricesOnSchedule
            })
            doc.save(`Operations_Schedule_${scheduleRangeMonths}_Months_${new Date().toISOString().slice(0, 10)}.pdf`)
            setScheduleModalOpen(false)
        } catch (err: any) {
            console.error(err)
            alert(err.message || "Failed to generate Schedule PDF")
        } finally {
            setIsPrintingSchedule(false)
        }
    }

    const handlePrintJobSheet = async (project: any) => {
        setPrintingJobSheetId(project.id)
        try {
            const doc = await generateJobSheetPdf(project, company)
            const cleanName = (project.name || "Job").replace(/[^a-zA-Z0-9_-]/g, "_")
            doc.save(`JobSheet_${cleanName}.pdf`)
        } catch (err: any) {
            console.error(err)
            alert(err.message || "Failed to generate Job Sheet PDF")
        } finally {
            setPrintingJobSheetId(null)
        }
    }

    // Summary counts for Next Actions
    const scheduledCount = projects.filter(p => ['SCHEDULED', 'PLANNING', 'QUOTED', 'SOW'].includes(p.status)).length
    const inProgressCount = projects.filter(p => p.status === 'IN_PROGRESS').length
    const awaitingPoCount = projects.filter(p => p.commercialStatus === 'AWAITING_PO').length
    const reactiveCount = projects.filter(p => p.commercialStatus === 'REACTIVE_WORK' || p.commercialStatus === 'EMERGENCY_WORK').length

    return (
        <div className="space-y-6 pb-20 max-w-[1600px] mx-auto">
            {/* Header: Title & Main Action Buttons */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        Project Operations
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide">
                        Active workflows, site scheduling & operations
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Top Next Actions summary */}
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#14141E] border border-white/10 text-xs text-gray-300">
                        <Flame className="h-4 w-4 text-primary shrink-0" />
                        <span>
                            <strong>Next Actions:</strong> {scheduledCount} scheduled · {inProgressCount} in progress · {awaitingPoCount} awaiting PO
                            {isReactiveEnabled && reactiveCount > 0 ? ` · ${reactiveCount} reactive` : ""}
                        </span>
                    </div>

                    {/* Button 1: Print Schedule */}
                    <Button
                        onClick={() => {
                            if (isAeroWash) {
                                setScheduleModalOpen(true)
                            } else {
                                setLrScheduleModalOpen(true)
                            }
                        }}
                        className="bg-[#14141E] text-white border border-primary/40 hover:border-primary hover:bg-primary/10 font-bold shadow-sm text-xs flex items-center gap-2 h-9 px-4 transition-all"
                    >
                        <Printer className="h-4 w-4 text-primary" />
                        <span>Print Schedule</span>
                    </Button>

                    {/* Button 2: New Recurring Contract */}
                    <Button
                        onClick={() => setRecurrenceModalOpen(true)}
                        className="bg-[#14141E] text-white border border-teal-500/40 hover:border-teal-400 hover:bg-teal-500/10 font-bold shadow-sm text-xs flex items-center gap-2 h-9 px-4 transition-all"
                    >
                        <Repeat className="h-4 w-4 text-teal-400" />
                        <span>+ Contract Work</span>
                    </Button>

                    {/* Button 3: New Project */}
                    <Link href="/projects/new">
                        <Button className="bg-primary text-primary-foreground font-black hover:bg-primary/90 shadow-md text-xs h-9 px-4">
                            <Plus className="mr-1.5 h-4 w-4" /> New Project
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick Filter Bar & View Switcher */}
            <div className="bg-[#14141E]/90 backdrop-blur-md p-1.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 border border-white/10 shadow-xl">
                {/* View Switcher: Board vs List vs Schedule vs Calendar */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                    <button
                        type="button"
                        onClick={() => setView('KANBAN')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                            view === 'KANBAN' ? 'bg-primary text-primary-foreground shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <LayoutGrid className="h-3.5 w-3.5" /> Board
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('LIST')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                            view === 'LIST' ? 'bg-primary text-primary-foreground shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <List className="h-3.5 w-3.5" /> List
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('SCHEDULE')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                            view === 'SCHEDULE' ? 'bg-primary text-primary-foreground shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <CalendarDays className="h-3.5 w-3.5" /> Schedule
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('CALENDAR')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                            view === 'CALENDAR' ? 'bg-primary text-primary-foreground shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <CalendarIcon className="h-3.5 w-3.5" /> Calendar
                    </button>
                </div>

                {/* Filter Tabs: All | Awaiting PO | Reactive (if enabled) | Tender (if enabled) | Credit Notes */}
                <div className="flex flex-wrap items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                    <button
                        type="button"
                        onClick={() => setFilterCategory('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filterCategory === 'ALL' ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        All Jobs ({projects.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterCategory('WAITING_PO')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            filterCategory === 'WAITING_PO' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Awaiting PO ({awaitingPoCount})
                    </button>
                    {isReactiveEnabled && (
                        <button
                            type="button"
                            onClick={() => setFilterCategory('REACTIVE')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterCategory === 'REACTIVE' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Reactive Work ({reactiveCount})
                        </button>
                    )}
                    {isTendersEnabled && (
                        <button
                            type="button"
                            onClick={() => setFilterCategory('TENDER')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterCategory === 'TENDER' ? 'bg-amber-500 text-black shadow-md' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Tender 152G
                        </button>
                    )}
                    <Link
                        href="/credit-notes"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-1 transition-all"
                    >
                        <FileText className="h-3.5 w-3.5" /> Credit Notes ↗
                    </Link>
                </div>

                {/* Show Paid & Hide Completed Toggles (Both Companies, remembered per user) */}
                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                    <button
                        type="button"
                        onClick={toggleShowPaid}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            showPaid
                                ? 'bg-zinc-700 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                        title={showPaid ? 'Click to hide Paid column' : 'Click to show Paid column'}
                    >
                        <span>{showPaid ? 'Hide Paid' : `Show Paid (${paidCount})`}</span>
                    </button>

                    <button
                        type="button"
                        onClick={toggleHideCompleted}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            hideCompleted
                                ? 'bg-teal-950 text-teal-300 border border-teal-800'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                        title={hideCompleted ? 'Click to show Completed jobs' : 'Click to hide Completed jobs'}
                    >
                        <span>{hideCompleted ? 'Show Completed' : 'Hide Completed'}</span>
                    </button>
                </div>
            </div>

            {/* 1. SCHEDULE HORIZON VIEW */}
            {view === 'SCHEDULE' && (
                <ProjectScheduleView
                    projects={displayedProjects}
                    company={company}
                    onJobClick={(project) => router.push(`/projects/${project.id}`)}
                />
            )}

            {/* 2. CALENDAR VIEW */}
            {view === 'CALENDAR' && (
                <ProjectCalendarView
                    projects={displayedProjects}
                    quotes={quotes}
                    prospects={prospects}
                    company={company}
                    onDateClick={(date) => {}}
                />
            )}

            {/* 3. KANBAN BOARD VIEW */}
            {view === 'KANBAN' && (
                <div className="overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="flex gap-4 min-w-full pt-2">
                        {activeColumns.map(col => {
                            const colProjects = displayedProjects.filter(p => col.statuses.includes(p.status))

                            return (
                                <div
                                    key={col.id}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, col.id)}
                                    className={`border rounded-2xl p-3.5 flex flex-col min-h-[70vh] w-[290px] min-w-[280px] sm:min-w-[290px] flex-1 shrink-0 shadow-xl backdrop-blur-md ${col.color}`}
                                >
                                    {/* Column Header */}
                                    <div className="flex items-center justify-between gap-2 mb-3 px-1">
                                        <h3 className="font-black text-xs uppercase tracking-wider text-white/90 whitespace-nowrap shrink-0">
                                            {col.title}
                                        </h3>
                                        <span className="bg-black/40 text-white/70 text-xs px-2.5 py-0.5 rounded-full font-bold border border-white/10 shrink-0 ml-auto tabular-nums">
                                            {colProjects.length}
                                        </span>
                                    </div>

                                    {/* Project Cards */}
                                    <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                                        {colProjects.map(project => {
                                            const latestInvoice = project.invoices?.[0]
                                            const totalWorth = latestInvoice?.total || 0
                                            const poNumber = latestInvoice?.clientPoNumber || latestInvoice?.reference || null
                                            const site = project.site || project.client?.address || "Site address on file"
                                            const isPrinting = printingJobSheetId === project.id
                                            const isRecurring = project.isRecurring || project.parentProjectId

                                            return (
                                                <div
                                                    key={project.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, project.id)}
                                                    className="bg-[#14141E] border border-white/10 hover:border-primary/50 rounded-xl p-3 shadow-lg hover:shadow-2xl transition-all cursor-grab active:cursor-grabbing space-y-2.5 group relative"
                                                >
                                                    {/* Top row: Job Title & Quick Menu */}
                                                    <div className="flex items-start justify-between gap-2">
                                                        <Link
                                                            href={`/projects/${project.id}`}
                                                            className="font-black text-xs text-white group-hover:text-primary transition-colors flex items-center gap-1.5 flex-1"
                                                        >
                                                            <span className="line-clamp-2 leading-tight">{project.name}</span>
                                                            {isRecurring && (
                                                                <span title="Recurring Contract Visit"><Repeat className="h-3 w-3 text-teal-400 shrink-0" /></span>
                                                            )}
                                                        </Link>

                                                        {/* Quick Actions Dropdown */}
                                                        <div className="relative shrink-0">
                                                            <select
                                                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                                                                value=""
                                                                onChange={(e) => {
                                                                    const [field, val] = e.target.value.split(':')
                                                                    if (field && val) handleStatusChange(project.id, field as any, val)
                                                                }}
                                                            >
                                                                <option value="" disabled>Move to...</option>
                                                                <option value="status:SCHEDULED">Scheduled</option>
                                                                <option value="status:IN_PROGRESS">In Progress</option>
                                                                <option value="status:COMPLETED">Completed</option>
                                                                <option value="status:INVOICED">Invoiced</option>
                                                                <option value="status:PAID">Paid</option>
                                                                <option value="commercialStatus:AWAITING_PO">⌛ Awaiting PO</option>
                                                                {isReactiveEnabled && (
                                                                    <option value="commercialStatus:REACTIVE_WORK">⚡ Reactive Work</option>
                                                                )}
                                                            </select>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-white/10 text-gray-400">
                                                                <MoreHorizontal className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Client Name */}
                                                    <div className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5 truncate">
                                                        <User className="h-3 w-3 text-zinc-500 shrink-0" />
                                                        <span className="truncate">{project.client?.name || "Client"}</span>
                                                    </div>

                                                    {/* Site Address */}
                                                    <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 truncate">
                                                        <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
                                                        <span className="truncate">{site}</span>
                                                    </div>

                                                    {isAeroWash && project.flightWeather && (
                                                        <div>
                                                            <WeatherBadge weather={project.flightWeather} compact className="text-[10px]" />
                                                        </div>
                                                    )}

                                                    {/* Date & Crew */}
                                                    <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-white/5">
                                                        <div className="flex items-center gap-1 text-zinc-300 font-medium">
                                                            <Clock className="h-3 w-3 text-primary shrink-0" />
                                                            <span>
                                                                {project.startDate
                                                                    ? new Date(project.startDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
                                                                    : "Scheduled"}
                                                            </span>
                                                        </div>
                                                        {(() => {
                                                            const crewOrTeam = isAeroWash
                                                                ? (project.crew || "Flight Alpha")
                                                                : (project.assignedTeam || project.team || project.crew || "")
                                                            if (!crewOrTeam) return null
                                                            return (
                                                                <span className="text-zinc-500 text-[9px] font-mono">
                                                                    {crewOrTeam}
                                                                </span>
                                                            )
                                                        })()}
                                                    </div>

                                                    {/* Value & PO Number */}
                                                    <div className="flex items-center justify-between pt-1">
                                                        {poNumber ? (
                                                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 truncate max-w-[120px]">
                                                                PO: {poNumber}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] text-zinc-600 font-mono">PO Pending</span>
                                                        )}

                                                        <span className="text-xs font-black font-mono text-emerald-400">
                                                            {totalWorth > 0 ? formatCurrency(totalWorth) : "—"}
                                                        </span>
                                                    </div>

                                                    {/* Action Buttons: Mobile Job Sheet (AeroWash only) + Print Job Sheet */}
                                                    {isAeroWash ? (
                                                        <div className="flex gap-1.5">
                                                            <Link
                                                                href={`/my-jobs/${project.id}`}
                                                                className="flex-1 h-7 rounded-lg text-[10px] font-bold bg-primary/15 border border-primary/40 text-primary hover:bg-primary hover:text-black transition-all flex items-center justify-center gap-1 shadow-sm"
                                                            >
                                                                <span>Run Job</span>
                                                            </Link>
                                                            <Button
                                                                type="button"
                                                                onClick={() => handlePrintJobSheet(project)}
                                                                disabled={isPrinting}
                                                                className="flex-1 h-7 rounded-lg text-[10px] font-bold bg-[#14141E] border border-white/10 text-white hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                                            >
                                                                {isPrinting ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                                ) : (
                                                                    <Printer className="h-3 w-3 text-primary" />
                                                                )}
                                                                <span>PDF</span>
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            onClick={() => handlePrintJobSheet(project)}
                                                            disabled={isPrinting}
                                                            className="w-full h-7 rounded-lg text-[10px] font-bold bg-[#14141E] border border-white/10 text-white hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                                        >
                                                            {isPrinting ? (
                                                                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                            ) : (
                                                                <Printer className="h-3 w-3 text-primary" />
                                                            )}
                                                            <span>Print Job Sheet</span>
                                                        </Button>
                                                    )}
                                                </div>
                                            )
                                        })}

                                        {colProjects.length === 0 && (
                                            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl p-6 text-zinc-600 text-xs">
                                                No jobs
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* 4. LIST VIEW */}
            {view === 'LIST' && (
                <div className="rounded-2xl border border-white/10 bg-[#14141E] overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-white/10 bg-black/30 text-muted-foreground uppercase text-[10px] tracking-wider font-black">
                                    <th className="p-3.5 pl-4">Job / Project</th>
                                    <th className="p-3.5">Client</th>
                                    <th className="p-3.5">Site Address</th>
                                    <th className="p-3.5">Date</th>
                                    <th className="p-3.5">{isAeroWash ? "Flight Crew / Pilot" : "Team / Foreman"}</th>
                                    <th className="p-3.5">Status</th>
                                    <th className="p-3.5">PO #</th>
                                    <th className="p-3.5 text-right">Value</th>
                                    <th className="p-3.5 pr-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {displayedProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-muted-foreground italic">
                                            No projects match this category.
                                        </td>
                                    </tr>
                                ) : (
                                    displayedProjects.map(p => {
                                        const latestInvoice = p.invoices?.[0]
                                        const totalWorth = latestInvoice?.total || 0
                                        const poNumber = latestInvoice?.clientPoNumber || latestInvoice?.reference || "—"
                                        const site = p.site || p.client?.address || "Site on file"
                                        const dateStr = p.startDate
                                            ? new Date(p.startDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
                                            : "This Week"
                                        const crew = p.assignedTeam || p.team || p.crew || (isAeroWash ? "Flight Alpha" : "—")
                                        const isPrinting = printingJobSheetId === p.id

                                        return (
                                            <tr key={p.id} className="hover:bg-white/[0.03] transition-colors">
                                                <td className="p-3.5 pl-4 font-bold text-white">
                                                    <Link href={`/projects/${p.id}`} className="hover:text-primary transition-colors flex items-center gap-1.5">
                                                        <span>{p.name}</span>
                                                        {(p.isRecurring || p.parentProjectId) && (
                                                            <Repeat className="h-3 w-3 text-teal-400 shrink-0" />
                                                        )}
                                                    </Link>
                                                </td>
                                                <td className="p-3.5 text-zinc-300">{p.client?.name || "Client"}</td>
                                                <td className="p-3.5 text-zinc-400 max-w-[200px] truncate">{site}</td>
                                                <td className="p-3.5 text-zinc-300">
                                                    <div>{dateStr}</div>
                                                    {isAeroWash && p.flightWeather && (
                                                        <div className="mt-1">
                                                            <WeatherBadge weather={p.flightWeather} compact className="text-[9px] px-1.5 py-0.5" />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3.5 text-zinc-300">{crew}</td>
                                                <td className="p-3.5">
                                                    <Badge className="bg-zinc-800 text-zinc-300 text-[10px] font-bold">
                                                        {p.status}
                                                    </Badge>
                                                </td>
                                                <td className="p-3.5 text-zinc-400 font-mono">{poNumber}</td>
                                                <td className="p-3.5 text-right font-bold text-emerald-400">
                                                    {totalWorth > 0 ? formatCurrency(totalWorth) : "—"}
                                                </td>
                                                <td className="p-3.5 pr-4 text-center">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handlePrintJobSheet(p)}
                                                        disabled={isPrinting}
                                                        className="h-7 px-2.5 rounded-lg text-[10px] font-bold bg-[#14141E] border border-white/10 text-white hover:border-primary hover:text-primary"
                                                    >
                                                        {isPrinting ? <Loader2 className="h-3 w-3 animate-spin mr-1 text-primary" /> : <Printer className="h-3 w-3 mr-1 text-primary" />}
                                                        Job Sheet
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Print Schedule Modal (A4 Landscape, Range Selector, Prices Hidden by Default) */}
            <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
                <DialogContent className="max-w-md bg-[#14141E] border border-white/10 text-white rounded-3xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase text-white flex items-center gap-2">
                            <Printer className="h-5 w-5 text-primary" />
                            Print Schedule (A4 Landscape)
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Multi-week landscape operations schedule with client details, site locations and flight crews.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {/* Horizon Selection */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-300">Schedule Horizon</Label>
                            <div className="grid grid-cols-4 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                                {[
                                    { label: "2 Mo", val: 2 },
                                    { label: "3 Mo", val: 3 },
                                    { label: "6 Mo", val: 6 },
                                    { label: "12 Mo", val: 12 },
                                ].map(opt => (
                                    <button
                                        key={opt.val}
                                        type="button"
                                        onClick={() => setScheduleRangeMonths(opt.val)}
                                        className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            scheduleRangeMonths === opt.val
                                                ? "bg-primary text-primary-foreground shadow"
                                                : "text-gray-400 hover:text-white"
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Prices Toggle (Hidden by default) */}
                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="schedulePrices"
                                    checked={showPricesOnSchedule}
                                    onCheckedChange={(c) => setShowPricesOnSchedule(Boolean(c))}
                                    className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                                />
                                <Label htmlFor="schedulePrices" className="text-xs font-bold text-gray-300 cursor-pointer">
                                    Show Prices on Schedule (Hidden by default)
                                </Label>
                            </div>
                            <p className="text-[11px] text-zinc-500">
                                Prices are hidden by default so operational printouts can be distributed safely to site crew.
                            </p>
                        </div>

                        <div className="text-xs text-zinc-400 flex items-center justify-between">
                            <span>Jobs to include:</span>
                            <strong className="text-white">{displayedProjects.length}</strong>
                        </div>
                    </div>

                    <DialogFooter className="pt-2 border-t border-white/10 flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => setScheduleModalOpen(false)}
                            className="text-xs text-gray-400"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handlePrintSchedule}
                            disabled={isPrintingSchedule}
                            className="bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5"
                        >
                            {isPrintingSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                            Download A4 Landscape PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* LR Builders Operations & Works Schedule Generator */}
            {!isAeroWash && (
                <ProjectSchedulePrintModal
                    isOpen={lrScheduleModalOpen}
                    onClose={() => setLrScheduleModalOpen(false)}
                    projects={projects}
                    company={company}
                    initialWorkType={filterCategory === 'TENDER' ? 'TENDER' : 'ALL'}
                />
            )}

            {/* Recurring Contract Creation Modal */}
            <ProjectRecurrenceModal
                open={recurrenceModalOpen}
                onOpenChange={setRecurrenceModalOpen}
                clients={clients}
                onSuccess={() => {
                    setRecurrenceModalOpen(false)
                    router.refresh()
                }}
            />
        </div>
    )
}
