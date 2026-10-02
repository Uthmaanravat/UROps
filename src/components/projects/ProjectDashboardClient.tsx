"use client"

import { useState, useTransition, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Plus, LayoutGrid, List, Calendar as CalendarIcon, Briefcase, Clock, CheckCircle2, AlertCircle, MoreHorizontal, DollarSign, Printer, Zap, ShieldAlert, Clock3, Eye } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { updateProjectStatus, updateProjectCommercialStatus, updateProjectSchedule } from "@/app/(dashboard)/projects/actions"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ProjectSchedulePrintModal, isTenderProject, isReactiveProject, getScheduleWeeks, getProjectScheduleBucket } from "./ProjectSchedulePrintModal"

const ALL_COLUMNS = [
    { id: 'APPROVAL', title: 'Waiting Approval', statuses: ['SOW', 'SOW_SUBMITTED', 'LEAD'], color: 'border-blue-500/30 bg-blue-500/5', icon: Clock3 },
    { id: 'SCHEDULED', title: 'Scheduled', statuses: ['PLANNING', 'SCHEDULED', 'QUOTED'], color: 'border-purple-500/30 bg-purple-500/5', icon: CalendarIcon },
    { id: 'IN_PROGRESS', title: 'In Progress', statuses: ['IN_PROGRESS'], color: 'border-emerald-500/30 bg-emerald-500/5', icon: Zap },
    { id: 'HOLD', title: 'On Hold', statuses: ['ON_HOLD'], color: 'border-orange-500/30 bg-orange-500/5', icon: AlertCircle },
    { id: 'COMPLETED', title: 'Completed', statuses: ['COMPLETED'], color: 'border-teal-500/30 bg-teal-500/5', icon: CheckCircle2 },
    { id: 'AWAITING_PAYMENT', title: 'Awaiting Payment', statuses: ['INVOICED'], color: 'border-red-500/30 bg-red-500/5', icon: DollarSign },
    { id: 'PAID', title: 'Paid & Archived', statuses: ['PAID', 'CANCELLED'], color: 'border-white/10 bg-white/5', icon: Briefcase },
];

export function ProjectDashboardClient({
    projects: initialProjects,
    company
}: {
    projects: any[]
    company?: any
}) {
    const [view, setView] = useState<'KANBAN' | 'LIST' | 'GANTT'>('KANBAN')
    const [projects, setProjects] = useState(initialProjects)
    const [workTypeFilter, setWorkTypeFilter] = useState<'ALL' | 'GENERAL' | 'TENDER'>('ALL')
    const [visibleColumns, setVisibleColumns] = useState<string[]>(ALL_COLUMNS.map(c => c.id).filter(id => id !== 'PAID'))
    const [topFocus, setTopFocus] = useState<'REACTIVE' | 'WAITING_PO' | 'ACTIVE' | 'NONE'>('NONE')
    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [showPaidWork, setShowPaidWork] = useState(false)
    const [timelineFilter, setTimelineFilter] = useState<'ALL' | 'BUSY_NOW' | 'THIS_WEEK' | 'NEXT_WEEK' | 'WEEK_3' | 'MONTH_LATER' | 'UNSCHEDULED'>('ALL')
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    useEffect(() => {
        const saved = localStorage.getItem('ops_board_columns')
        if (saved) {
            try {
                setVisibleColumns(JSON.parse(saved))
            } catch (e) {
                // Ignore parsing errors
            }
        }
    }, [])

    const handleColumnToggle = (colId: string) => {
        setVisibleColumns(prev => {
            const next = prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId];
            localStorage.setItem('ops_board_columns', JSON.stringify(next));
            return next;
        });
    }

    const columns = ALL_COLUMNS.filter(col => visibleColumns.includes(col.id));

    const handleDragStart = (e: React.DragEvent, projectId: string) => {
        e.dataTransfer.setData('projectId', projectId)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = async (e: React.DragEvent, statusId: string) => {
        e.preventDefault()
        const projectId = e.dataTransfer.getData('projectId')

        const targetDbStatus = columns.find(c => c.id === statusId)?.statuses[0]
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

    const handleScheduleChange = async (projectId: string, bucketId: string) => {
        const weeks = getScheduleWeeks()
        let targetStartDate: Date | null = null
        let targetEndDate: Date | null = null
        let targetStatus = 'SCHEDULED'

        if (bucketId === 'BUSY_NOW') {
            targetStatus = 'IN_PROGRESS'
            targetStartDate = new Date()
        } else if (bucketId === 'THIS_WEEK') {
            targetStartDate = weeks[0].startDate
            targetEndDate = weeks[0].endDate
        } else if (bucketId === 'NEXT_WEEK') {
            targetStartDate = weeks[1].startDate
            targetEndDate = weeks[1].endDate
        } else if (bucketId === 'WEEK_3') {
            targetStartDate = weeks[2].startDate
            targetEndDate = weeks[2].endDate
        } else if (bucketId === 'MONTH_LATER') {
            targetStartDate = weeks[3].startDate
            targetEndDate = weeks[3].endDate
        } else if (bucketId === 'UNSCHEDULED') {
            targetStartDate = null
            targetEndDate = null
            targetStatus = 'PLANNING'
        }

        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                return {
                    ...p,
                    startDate: targetStartDate?.toISOString() || null,
                    endDate: targetEndDate?.toISOString() || null,
                    status: targetStatus
                }
            }
            return p
        }))

        startTransition(async () => {
            await updateProjectSchedule(projectId, {
                startDate: targetStartDate,
                endDate: targetEndDate,
                status: targetStatus
            })
            router.refresh()
        })
    }

    // Work type counts (active jobs vs paid jobs)
    const activeProjects = projects.filter(p => p.status !== 'PAID' && p.status !== 'CANCELLED')
    const paidProjectsCount = projects.filter(p => p.status === 'PAID' || p.status === 'CANCELLED').length

    const activeTenderCount = activeProjects.filter(isTenderProject).length
    const activeGeneralCount = activeProjects.filter(p => !isTenderProject(p)).length

    // Filter projects by Work Type & Paid Work visibility
    // By default, PAID and CANCELLED work is hidden from active project operations
    const displayedProjects = projects.filter(p => {
        if (!showPaidWork && (p.status === 'PAID' || p.status === 'CANCELLED')) {
            return false
        }
        const isTender = isTenderProject(p)
        if (workTypeFilter === "GENERAL") return !isTender
        if (workTypeFilter === "TENDER") return isTender
        return true
    })

    // 1. WORK TO DO (NOT DONE):
    // Work that is there and NOT done (Scheduled, In Progress, Planning, Quoted, SOW)
    // Strictly excludes already completed, invoiced (awaiting payment), paid, and cancelled
    const workToDoProjects = displayedProjects.filter(p => !['COMPLETED', 'INVOICED', 'PAID', 'CANCELLED'].includes(p.status))
    const workAmountNotDone = workToDoProjects.reduce((acc, p) => {
        const latestInvoice = p.invoices?.[0]
        const latestWbp = p.workBreakdowns?.[0]
        const totalWorth = latestInvoice
            ? latestInvoice.total
            : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0)
        return acc + (Number(totalWorth) || 0)
    }, 0)

    // 2. REACTIVE WORK (replaces Emergency Jobs: counts reactive projects and quotes)
    const reactiveProjects = displayedProjects.filter(isReactiveProject)
    const reactiveQuotesCount = displayedProjects.reduce((acc, p) => {
        const rQuotes = p.invoices?.filter((inv: any) => inv.type === 'QUOTE' && (/reactive/i.test(inv.reference || '') || /reactive/i.test(inv.notes || '') || isReactiveProject(p))) || []
        return acc + rQuotes.length
    }, 0)

    const awaitingPoProjects = displayedProjects.filter(p => p.commercialStatus === 'AWAITING_PO')

    return (
        <div className="space-y-6 pb-20 max-w-[1600px] mx-auto">
            {/* Header: Title & Main Action Buttons */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        Project Operations
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide">
                        Manage active workflows, site scheduling, and project health
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setShowScheduleModal(true)}
                        className="bg-[#14141E] text-white border border-[#A3E635]/40 hover:border-[#A3E635] hover:bg-[#1A1A28] font-black shadow-[0_0_15px_rgba(163,230,53,0.15)] text-xs flex items-center gap-2 h-9 px-4 transition-all"
                    >
                        <Printer className="h-4 w-4 text-[#A3E635]" />
                        <span>Print / Schedule Doc</span>
                    </Button>

                    <Link href="/projects/new">
                        <Button className="bg-[#A3E635] text-black font-black hover:bg-[#A3E635]/90 shadow-[0_0_20px_rgba(163,230,53,0.3)] text-xs h-9 px-4">
                            <Plus className="mr-1.5 h-4 w-4" /> New Project
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Row 2: Clean Glassmorphic Toolbar (View Switcher, Work Type, Paid Filter, Columns) */}
            <div className="bg-[#14141E]/90 backdrop-blur-md p-1.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 border border-white/10 shadow-xl">
                {/* Left: View Switcher (Board | Timeline Graph | List) */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                    <button
                        type="button"
                        onClick={() => setView('KANBAN')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                            view === 'KANBAN' ? 'bg-[#A3E635] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                        title="Kanban Board View"
                    >
                        <LayoutGrid className="h-3.5 w-3.5" /> Board
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('GANTT')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                            view === 'GANTT' ? 'bg-[#A3E635] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                        title="Timeline Schedule Graph (Gantt)"
                    >
                        <CalendarIcon className="h-3.5 w-3.5" /> Timeline Graph
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('LIST')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                            view === 'LIST' ? 'bg-[#A3E635] text-black shadow-md' : 'text-gray-400 hover:text-white'
                        }`}
                        title="List View"
                    >
                        <List className="h-3.5 w-3.5" /> List
                    </button>
                </div>

                {/* Center: Work Classification Tabs (All Work | General | Tender 152G) */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                    <button
                        type="button"
                        onClick={() => setWorkTypeFilter("ALL")}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                            workTypeFilter === "ALL"
                                ? "bg-white text-black shadow-md"
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        All Work ({showPaidWork ? projects.length : activeProjects.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setWorkTypeFilter("GENERAL")}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                            workTypeFilter === "GENERAL"
                                ? "bg-blue-600 text-white shadow-md"
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        General ({showPaidWork ? projects.filter(p => !isTenderProject(p)).length : activeGeneralCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setWorkTypeFilter("TENDER")
                            if (topFocus === 'REACTIVE') setTopFocus('NONE')
                        }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                            workTypeFilter === "TENDER"
                                ? "bg-amber-500 text-black shadow-md"
                                : "text-gray-400 hover:text-white"
                        }`}
                    >
                        Tender 152G ({showPaidWork ? projects.filter(isTenderProject).length : activeTenderCount})
                    </button>
                </div>

                {/* Right: Paid Work Filter Toggle & Columns Dropdown */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPaidWork(!showPaidWork)}
                        className={`font-bold h-9 text-xs transition-all ${
                            showPaidWork
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                        title="Toggle displaying paid & archived projects"
                    >
                        <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                        {showPaidWork ? `Paid Included (${paidProjectsCount})` : `Show Paid (${paidProjectsCount})`}
                    </Button>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="bg-black/30 border-white/10 text-white hover:bg-white/5 font-bold h-9 text-xs">
                                <Eye className="h-4 w-4 mr-1.5" /> Columns
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 bg-[#0F0F1A] border-white/10 p-2 shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1">Toggle Board Columns</p>
                                {ALL_COLUMNS.map(col => (
                                    <div key={col.id} className="flex items-center space-x-2 px-2 py-1 hover:bg-white/5 rounded-md transition-colors cursor-pointer" onClick={() => handleColumnToggle(col.id)}>
                                        <Checkbox
                                            id={`col-${col.id}`}
                                            checked={visibleColumns.includes(col.id)}
                                            className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                                        />
                                        <Label htmlFor={`col-${col.id}`} className="text-xs font-bold text-white cursor-pointer flex-1">{col.title}</Label>
                                    </div>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* KPI Summary Cards - Hide Reactive Work when viewing Tender */}
            <div className={`grid gap-4 ${workTypeFilter === 'TENDER' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
                {/* 1. Work To Do (Not Done) */}
                <Card
                    className={`bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl transition-all cursor-pointer ${
                        topFocus === 'ACTIVE' ? 'ring-2 ring-primary border-primary/50' : 'hover:border-primary/30'
                    }`}
                    onClick={() => setTopFocus(prev => prev === 'ACTIVE' ? 'NONE' : 'ACTIVE')}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                        <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                            Work To Do
                        </CardTitle>
                        <Briefcase className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white">{workToDoProjects.length}</div>
                        <p className="text-[10px] text-muted-foreground font-semibold mt-1">
                            Scheduled &amp; in-progress jobs
                        </p>
                    </CardContent>
                </Card>

                {/* 2. Work Value (Not Done) */}
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-emerald-500/30 transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                        <CardTitle className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">
                            Work Amount (Not Done)
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                            {formatCurrency(workAmountNotDone)}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-semibold mt-1">
                            Pending completion on site
                        </p>
                    </CardContent>
                </Card>

                {/* 3. Reactive Work - ONLY for General Work and All Work (Removed on Tender) */}
                {workTypeFilter !== 'TENDER' && (
                    <Card
                        className={`bg-[#14141E]/80 backdrop-blur-md border-amber-500/20 shadow-2xl transition-all cursor-pointer ${
                            topFocus === 'REACTIVE' ? 'ring-2 ring-amber-500 border-amber-500/50' : 'hover:border-amber-500/50'
                        }`}
                        onClick={() => setTopFocus(prev => prev === 'REACTIVE' ? 'NONE' : 'REACTIVE')}
                    >
                        <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                            <CardTitle className="text-[11px] font-black text-amber-400 uppercase tracking-widest">
                                Reactive Work
                            </CardTitle>
                            <Zap className="h-4 w-4 text-amber-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]">
                                {reactiveProjects.length}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-semibold mt-1">
                                {reactiveQuotesCount > 0 ? `${reactiveQuotesCount} quotes on record` : 'Call-outs & maintenance'}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* 4. Awaiting PO */}
                <Card
                    className={`bg-[#14141E]/80 backdrop-blur-md border-orange-500/20 shadow-2xl transition-all cursor-pointer ${
                        topFocus === 'WAITING_PO' ? 'ring-2 ring-orange-500 border-orange-500/50' : 'hover:border-orange-500/30'
                    }`}
                    onClick={() => setTopFocus(prev => prev === 'WAITING_PO' ? 'NONE' : 'WAITING_PO')}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                        <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                            Awaiting PO
                        </CardTitle>
                        <Clock className="h-4 w-4 text-orange-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white">{awaitingPoProjects.length}</div>
                        <p className="text-[10px] text-muted-foreground font-semibold mt-1">
                            Pending client order number
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Top Focus Section */}
            {topFocus !== 'NONE' && (
                <div className="bg-[#1A1A2E]/50 border border-white/5 rounded-3xl p-6 shadow-3xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${
                                topFocus === 'REACTIVE' ? 'bg-amber-500/20 text-amber-400' : topFocus === 'WAITING_PO' ? 'bg-orange-500/20 text-orange-400' : 'bg-primary/20 text-primary'
                            }`}>
                                {topFocus === 'REACTIVE' ? <Zap className="h-6 w-6" /> : topFocus === 'WAITING_PO' ? <Clock3 className="h-6 w-6" /> : <Briefcase className="h-6 w-6" />}
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                                    {topFocus === 'REACTIVE' ? 'Reactive Work Operations' : topFocus === 'WAITING_PO' ? 'Pending PO Approval' : 'Priority Active Work (To Do)'}
                                </h2>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                                    {topFocus === 'REACTIVE' ? 'Call-outs, repairs, and unscheduled maintenance jobs' : 'Action Required'}
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setTopFocus('NONE')} className="text-muted-foreground hover:text-white">
                            Dismiss
                        </Button>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        {(topFocus === 'REACTIVE' ? reactiveProjects :
                            topFocus === 'WAITING_PO' ? awaitingPoProjects :
                                workToDoProjects.slice(0, 8)
                        ).map(project => {
                            const latestInvoice = project.invoices?.[0];
                            const latestWbp = project.workBreakdowns?.[0];
                            const totalWorth = latestInvoice ? latestInvoice.total : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0);
                            const isTender = isTenderProject(project);

                            return (
                                <Link key={project.id} href={`/projects/${project.id}`} className="min-w-[300px] bg-[#0F0F1A] border border-white/10 p-5 rounded-2xl hover:border-primary/50 transition-all group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge className={`${topFocus === 'REACTIVE' ? 'bg-amber-500 text-black' : 'bg-primary text-black'} font-black text-[9px] uppercase`}>
                                                {project.status.replace(/_/g, ' ')}
                                            </Badge>
                                            {isTender && (
                                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 font-black text-[9px] uppercase">
                                                    Tender 152G
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-xs font-black text-emerald-400">{formatCurrency(Number(totalWorth) || 0)}</span>
                                    </div>
                                    <h4 className="font-black text-white text-base leading-tight mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                                        {project.name}
                                    </h4>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{project.client?.name}</p>
                                    <div className="mt-4 flex items-center gap-2">
                                        <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: '65%' }} />
                                        </div>
                                        <span className="text-[10px] font-bold text-muted-foreground">Active</span>
                                    </div>
                                </Link>
                            )
                        })}
                        {(topFocus === 'REACTIVE' ? reactiveProjects : topFocus === 'WAITING_PO' ? awaitingPoProjects : workToDoProjects).length === 0 && (
                            <div className="flex-1 text-center py-10 border-2 border-dashed border-white/5 rounded-2xl">
                                <p className="text-sm text-muted-foreground font-black uppercase tracking-widest">No items in this category</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* KANBAN VIEW */}
            {view === 'KANBAN' && (
                <div className="flex gap-4 overflow-x-auto pb-6 snap-x pt-2 scrollbar-thin scrollbar-thumb-white/10">
                    {columns.map(col => {
                        const colProjects = displayedProjects.filter(p => col.statuses.includes(p.status));
                        return (
                            <div key={col.id} className="min-w-[340px] w-[340px] shrink-0 snap-start" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.id)}>
                                <div className={`border rounded-2xl p-4 flex flex-col h-[70vh] shadow-2xl backdrop-blur-md ${col.color}`}>
                                    <div className="flex items-center justify-between mb-4 px-1">
                                        <h3 className="font-black text-xs uppercase tracking-widest text-white/90">{col.title}</h3>
                                        <span className="bg-black/40 text-white/70 text-xs px-2 py-0.5 rounded-full font-bold border border-white/10">
                                            {colProjects.length}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 scrollbar-hide">
                                        {colProjects.map(project => {
                                            const latestInvoice = project.invoices?.[0];
                                            const latestWbp = project.workBreakdowns?.[0];
                                            const totalWorth = latestInvoice ? latestInvoice.total : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0);
                                            const isTender = isTenderProject(project);
                                            const isReactive = isReactiveProject(project);

                                            return (
                                                <div
                                                    key={project.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, project.id)}
                                                    className="bg-[#0F0F1A] border border-white/10 p-4 rounded-xl shadow-xl hover:border-primary/50 transition-all group cursor-grab active:cursor-grabbing relative overflow-hidden flex flex-col"
                                                >
                                                    {isReactive && (
                                                        <div className="absolute top-0 inset-x-0 h-1 bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                                                    )}

                                                    <div className="flex justify-between items-start mb-2">
                                                        <Link href={`/projects/${project.id}`} className="hover:text-primary transition-colors flex-1 pr-2">
                                                            <h4 className="font-black text-white text-sm leading-tight line-clamp-2">{project.name}</h4>
                                                        </Link>
                                                        <div className="relative shrink-0">
                                                            <select
                                                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                                                                value=""
                                                                onChange={(e) => {
                                                                    const [field, val] = e.target.value.split(':');
                                                                    if (field && val) handleStatusChange(project.id, field as 'status' | 'commercialStatus', val);
                                                                }}
                                                            >
                                                                <option value="" disabled>Actions...</option>
                                                                <option value="status:IN_PROGRESS">Mark In Progress</option>
                                                                <option value="status:SCHEDULED">Mark Scheduled</option>
                                                                <option value="commercialStatus:REACTIVE_WORK">⚡ Flag Reactive Work</option>
                                                                <option value="commercialStatus:AWAITING_PO">⌛ Wait for PO</option>
                                                                <option value="status:COMPLETED">Mark Completed</option>
                                                                <option value="status:PAID">Mark Paid &amp; Archive</option>
                                                                <option value="commercialStatus:EMERGENCY_WORK">🚨 Flag Emergency</option>
                                                            </select>
                                                            <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-white/10 shrink-0 pointer-events-none">
                                                                <MoreHorizontal className="h-4 w-4 text-white" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground truncate">{project.client?.name}</p>
                                                        {isTender ? (
                                                            <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">TENDER 152G</span>
                                                        ) : (
                                                            <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">GENERAL</span>
                                                        )}
                                                    </div>

                                                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
                                                        <div className="flex flex-wrap gap-1">
                                                            {isReactive && (
                                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] py-0">⚡ Reactive</Badge>
                                                            )}
                                                            {project.commercialStatus === 'AWAITING_PO' && (
                                                                <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[9px] py-0">Waiting PO</Badge>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-black text-emerald-400">{formatCurrency(Number(totalWorth) || 0)}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {colProjects.length === 0 && (
                                            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl p-6">
                                                <p className="text-xs text-muted-foreground/30 font-black uppercase tracking-widest text-center">Empty</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* TIMELINE SCHEDULE GRAPH (GANTT) */}
            {view === 'GANTT' && (() => {
                const scheduleWeeks = getScheduleWeeks()

                // Active projects to display on timeline
                const activeTimelineProjects = displayedProjects.filter(p => !['COMPLETED', 'PAID', 'CANCELLED'].includes(p.status))

                // Counts by bucket
                const busyCount = activeTimelineProjects.filter(p => p.status === 'IN_PROGRESS').length
                const thisWeekCount = activeTimelineProjects.filter(p => p.status !== 'IN_PROGRESS' && getProjectScheduleBucket(p) === 'THIS_WEEK').length
                const nextWeekCount = activeTimelineProjects.filter(p => p.status !== 'IN_PROGRESS' && getProjectScheduleBucket(p) === 'NEXT_WEEK').length
                const week3Count = activeTimelineProjects.filter(p => p.status !== 'IN_PROGRESS' && getProjectScheduleBucket(p) === 'WEEK_3').length
                const monthLaterCount = activeTimelineProjects.filter(p => p.status !== 'IN_PROGRESS' && getProjectScheduleBucket(p) === 'MONTH_LATER').length
                const unscheduledCount = activeTimelineProjects.filter(p => p.status !== 'IN_PROGRESS' && getProjectScheduleBucket(p) === 'UNSCHEDULED').length

                // Filtered by selected timeline pill
                const filteredTimelineProjects = activeTimelineProjects.filter(p => {
                    if (timelineFilter === 'ALL') return true
                    const bucket = getProjectScheduleBucket(p)
                    return bucket === timelineFilter
                })

                return (
                    <Card className="bg-[#14141E]/90 backdrop-blur-md border-white/10 shadow-2xl p-4 md:p-6 overflow-hidden">
                        {/* 1. Header Filter Bar: "what all will be this week" */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
                            <div>
                                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-[#A3E635] shadow-[0_0_10px_#A3E635]" />
                                    Weekly Operations Schedule
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Assign and view work scheduled for this week, next week, or active on site
                                </p>
                            </div>

                            {/* Schedule Filter Pills */}
                            <div className="flex flex-wrap items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setTimelineFilter('ALL')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        timelineFilter === 'ALL' ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    All ({activeTimelineProjects.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTimelineFilter('BUSY_NOW')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        timelineFilter === 'BUSY_NOW' ? 'bg-[#A3E635] text-black shadow-md' : 'text-emerald-400 hover:text-white'
                                    }`}
                                >
                                    🟢 Busy Now ({busyCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTimelineFilter('THIS_WEEK')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        timelineFilter === 'THIS_WEEK' ? 'bg-purple-600 text-white shadow-md' : 'text-purple-300 hover:text-white'
                                    }`}
                                >
                                    🟣 This Week ({thisWeekCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTimelineFilter('NEXT_WEEK')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        timelineFilter === 'NEXT_WEEK' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-300 hover:text-white'
                                    }`}
                                >
                                    🔵 Next Week ({nextWeekCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTimelineFilter('WEEK_3')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        timelineFilter === 'WEEK_3' ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-300 hover:text-white'
                                    }`}
                                >
                                    Week 3 ({week3Count})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTimelineFilter('MONTH_LATER')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        timelineFilter === 'MONTH_LATER' ? 'bg-amber-600 text-white shadow-md' : 'text-amber-300 hover:text-white'
                                    }`}
                                >
                                    Later Month ({monthLaterCount})
                                </button>
                                {unscheduledCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setTimelineFilter('UNSCHEDULED')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                            timelineFilter === 'UNSCHEDULED' ? 'bg-orange-600 text-white shadow-md' : 'text-orange-400 hover:text-white'
                                        }`}
                                    >
                                        ⚠️ Unscheduled ({unscheduledCount})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 2. Interactive Real-Date Gantt Grid */}
                        <div className="overflow-x-auto">
                            <div className="min-w-[1100px]">
                                {/* Columns Header with REAL DATES */}
                                <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-white/10 pb-3 mb-3 bg-black/20 p-2 rounded-xl">
                                    <div className="col-span-4 pl-2">Project &amp; Client Details</div>
                                    <div className="col-span-2 text-center border-l border-white/10 text-emerald-400">
                                        🟢 Busy Now (On Site)
                                    </div>
                                    <div className="col-span-2 text-center border-l border-white/10 text-purple-300">
                                        🟣 This Week
                                        <div className="text-[9px] font-bold text-gray-400 lowercase">{scheduleWeeks[0].dateLabel}</div>
                                    </div>
                                    <div className="col-span-2 text-center border-l border-white/10 text-blue-300">
                                        🔵 Next Week
                                        <div className="text-[9px] font-bold text-gray-400 lowercase">{scheduleWeeks[1].dateLabel}</div>
                                    </div>
                                    <div className="col-span-1 text-center border-l border-white/10 text-indigo-300">
                                        Week 3
                                        <div className="text-[9px] font-bold text-gray-400 lowercase">{scheduleWeeks[2].dateLabel}</div>
                                    </div>
                                    <div className="col-span-1 text-center border-l border-white/10 text-amber-300">
                                        Later
                                        <div className="text-[9px] font-bold text-gray-400 lowercase">Month</div>
                                    </div>
                                </div>

                                {/* Project Rows */}
                                <div className="space-y-2.5">
                                    {filteredTimelineProjects.map((p) => {
                                        const bucket = getProjectScheduleBucket(p)
                                        const isTender = isTenderProject(p)
                                        const latestInvoice = p.invoices?.[0]
                                        const latestWbp = p.workBreakdowns?.[0]
                                        const totalWorth = latestInvoice ? latestInvoice.total : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0)

                                        return (
                                            <div
                                                key={p.id}
                                                className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/20 hover:bg-white/[0.04] transition-all group"
                                            >
                                                {/* Left: Project Info & Schedule Assigner */}
                                                <div className="col-span-4 pr-2 flex items-center justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <Link
                                                                href={`/projects/${p.id}`}
                                                                className="font-black text-white text-xs hover:text-[#A3E635] transition-colors truncate"
                                                            >
                                                                {p.name}
                                                            </Link>
                                                            {isTender ? (
                                                                <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                                    TENDER
                                                                </span>
                                                            ) : (
                                                                <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                                                    GENERAL
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                                            <span className="truncate">{p.client?.name || 'General Client'}</span>
                                                            <span>•</span>
                                                            <span className="text-emerald-400 font-bold">{formatCurrency(Number(totalWorth) || 0)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Quick Schedule Assigner Dropdown */}
                                                    <div className="shrink-0">
                                                        <select
                                                            value={bucket}
                                                            onChange={(e) => handleScheduleChange(p.id, e.target.value)}
                                                            className="bg-black/50 text-white border border-white/10 text-[9px] font-black rounded-lg px-2 py-1 outline-none cursor-pointer focus:border-[#A3E635]"
                                                            title="Assign weekly schedule"
                                                        >
                                                            <option value="BUSY_NOW">🟢 Busy Now (On Site)</option>
                                                            <option value="THIS_WEEK">🟣 This Week ({scheduleWeeks[0].dateLabel})</option>
                                                            <option value="NEXT_WEEK">🔵 Next Week ({scheduleWeeks[1].dateLabel})</option>
                                                            <option value="WEEK_3">🗓️ Week 3 ({scheduleWeeks[2].dateLabel})</option>
                                                            <option value="MONTH_LATER">🟠 Later This Month</option>
                                                            <option value="UNSCHEDULED">⚠️ Needs Scheduling</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Gantt Bar Columns */}
                                                {/* Column: Busy Now (2 cols) */}
                                                <div className="col-span-2 px-1 relative h-9 flex items-center justify-center">
                                                    {bucket === 'BUSY_NOW' ? (
                                                        <div className="w-full h-7 rounded-lg bg-[#A3E635] text-black font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(163,230,53,0.4)] animate-pulse">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-black animate-ping" />
                                                            Active Now
                                                        </div>
                                                    ) : (
                                                        <div className="h-0.5 w-8 bg-white/5 rounded-full" />
                                                    )}
                                                </div>

                                                {/* Column: This Week (2 cols) */}
                                                <div className="col-span-2 px-1 relative h-9 flex items-center justify-center border-l border-white/5">
                                                    {bucket === 'THIS_WEEK' ? (
                                                        <div className="w-full h-7 rounded-lg bg-purple-600/90 hover:bg-purple-600 text-white font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-md border border-purple-400/30">
                                                            <span>🟣 This Week</span>
                                                        </div>
                                                    ) : (
                                                        <div className="h-0.5 w-8 bg-white/5 rounded-full" />
                                                    )}
                                                </div>

                                                {/* Column: Next Week (2 cols) */}
                                                <div className="col-span-2 px-1 relative h-9 flex items-center justify-center border-l border-white/5">
                                                    {bucket === 'NEXT_WEEK' ? (
                                                        <div className="w-full h-7 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-md border border-blue-400/30">
                                                            <span>🔵 Next Week</span>
                                                        </div>
                                                    ) : (
                                                        <div className="h-0.5 w-8 bg-white/5 rounded-full" />
                                                    )}
                                                </div>

                                                {/* Column: Week 3 (1 col) */}
                                                <div className="col-span-1 px-1 relative h-9 flex items-center justify-center border-l border-white/5">
                                                    {bucket === 'WEEK_3' ? (
                                                        <div className="w-full h-7 rounded-lg bg-indigo-600/90 text-white font-black text-[8px] uppercase tracking-wider flex items-center justify-center shadow-md">
                                                            Wk 3
                                                        </div>
                                                    ) : (
                                                        <div className="h-0.5 w-4 bg-white/5 rounded-full" />
                                                    )}
                                                </div>

                                                {/* Column: Later Month (1 col) */}
                                                <div className="col-span-1 px-1 relative h-9 flex items-center justify-center border-l border-white/10">
                                                    {bucket === 'MONTH_LATER' ? (
                                                        <div className="w-full h-7 rounded-lg bg-amber-600/90 text-white font-black text-[8px] uppercase tracking-wider flex items-center justify-center shadow-md">
                                                            Later
                                                        </div>
                                                    ) : bucket === 'UNSCHEDULED' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleScheduleChange(p.id, 'THIS_WEEK')}
                                                            className="w-full h-6 rounded border border-dashed border-orange-500/40 text-orange-400 hover:bg-orange-500/10 text-[8px] font-bold"
                                                            title="Click to schedule for this week"
                                                        >
                                                            + Schedule
                                                        </button>
                                                    ) : (
                                                        <div className="h-0.5 w-4 bg-white/5 rounded-full" />
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {filteredTimelineProjects.length === 0 && (
                                        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-2xl">
                                            <p className="text-sm font-bold text-gray-400">No projects found in this schedule view.</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setTimelineFilter('ALL')}
                                                className="mt-2 text-xs text-[#A3E635] hover:underline"
                                            >
                                                Show All Projects
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                )
            })()}

            {/* LIST VIEW */}
            {view === 'LIST' && (
                <div className="rounded-2xl border border-white/5 bg-[#14141E]/80 backdrop-blur-md shadow-2xl overflow-hidden">
                    <div className="relative w-full overflow-auto">
                        <table className="w-full text-sm text-left min-w-[800px]">
                            <thead className="[&_tr]:border-b border-white/10 bg-black/20">
                                <tr className="transition-colors hover:bg-muted/50">
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground uppercase text-[10px] tracking-widest">Project Name</th>
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground uppercase text-[10px] tracking-widest">Type</th>
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground uppercase text-[10px] tracking-widest">Client</th>
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground uppercase text-[10px] tracking-widest">Status</th>
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground uppercase text-[10px] tracking-widest">Comm. Status</th>
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground text-right uppercase text-[10px] tracking-widest">Worth</th>
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedProjects.map((project: any) => {
                                    const latestWbp = project.workBreakdowns?.[0]
                                    const latestInvoice = project.invoices?.[0]
                                    const totalWorth = latestInvoice ? latestInvoice.total : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0)
                                    const isTender = isTenderProject(project)
                                    const isReactive = isReactiveProject(project)

                                    return (
                                        <tr key={project.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                                            <td className="p-4 align-middle">
                                                <Link href={`/projects/${project.id}`} className="font-black text-white hover:text-primary">
                                                    {project.name}
                                                </Link>
                                            </td>
                                            <td className="p-4 align-middle">
                                                {isTender ? (
                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                        TENDER 152G
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                                        GENERAL
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground font-medium">{project.client?.name}</td>
                                            <td className="p-4 align-middle">
                                                <select
                                                    value={project.status}
                                                    onChange={(e) => handleStatusChange(project.id, 'status', e.target.value)}
                                                    className="bg-white/5 text-white border border-white/10 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded cursor-pointer outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="LEAD" className="bg-[#14141E] text-white">LEAD</option>
                                                    <option value="PLANNING" className="bg-[#14141E] text-white">PLANNING</option>
                                                    <option value="SOW" className="bg-[#14141E] text-white">SCOPE</option>
                                                    <option value="QUOTED" className="bg-[#14141E] text-white">QUOTED</option>
                                                    <option value="SCHEDULED" className="bg-[#14141E] text-white">SCHEDULED</option>
                                                    <option value="IN_PROGRESS" className="bg-[#14141E] text-white">IN PROGRESS</option>
                                                    <option value="COMPLETED" className="bg-[#14141E] text-white">COMPLETED</option>
                                                    <option value="INVOICED" className="bg-[#14141E] text-white">INVOICED</option>
                                                    <option value="PAID" className="bg-[#14141E] text-white">PAID</option>
                                                    <option value="ON_HOLD" className="bg-[#14141E] text-white">ON HOLD</option>
                                                    <option value="CANCELLED" className="bg-[#14141E] text-white">CANCELLED</option>
                                                </select>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <select
                                                        value={project.commercialStatus}
                                                        onChange={(e) => handleStatusChange(project.id, 'commercialStatus', e.target.value)}
                                                        className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest cursor-pointer outline-none focus:ring-2 focus:ring-primary/50 ${
                                                            isReactive ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : project.commercialStatus === 'PO_RECEIVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                                        }`}
                                                    >
                                                        <option value="AWAITING_PO" className="bg-[#14141E] text-white">⌛ AWAITING PO</option>
                                                        <option value="PO_RECEIVED" className="bg-[#14141E] text-white">✅ PO RECEIVED</option>
                                                        <option value="REACTIVE_WORK" className="bg-[#14141E] text-white">⚡ REACTIVE</option>
                                                        <option value="EMERGENCY_WORK" className="bg-[#14141E] text-white">🚨 EMERGENCY</option>
                                                    </select>
                                                    {isReactive && (
                                                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                            ⚡ REACTIVE
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right font-black text-emerald-400">
                                                {formatCurrency(Number(totalWorth) || 0)}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/projects/${project.id}`}>
                                                        <Button variant="ghost" size="sm" className="hover:bg-primary hover:text-black font-bold">View</Button>
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Schedule Print Modal */}
            <ProjectSchedulePrintModal
                isOpen={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                projects={displayedProjects}
                company={company}
                initialWorkType={workTypeFilter}
            />
        </div>
    )
}
