"use client"

import { useState, useTransition, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Plus, LayoutGrid, List, Calendar as CalendarIcon, Briefcase, Clock, CheckCircle2, AlertCircle, MoreHorizontal, DollarSign, Printer, Zap, ShieldAlert, Clock3, Eye } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { updateProjectStatus, updateProjectCommercialStatus } from "@/app/(dashboard)/projects/actions"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ProjectSchedulePrintModal, isTenderProject, isReactiveProject } from "./ProjectSchedulePrintModal"

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

    // Work type counts
    const tenderCount = projects.filter(isTenderProject).length;
    const generalCount = projects.filter(p => !isTenderProject(p)).length;

    // Filter projects by Work Type (All / General / Tender 152G)
    const displayedProjects = projects.filter(p => {
        const isTender = isTenderProject(p);
        if (workTypeFilter === "GENERAL") return !isTender;
        if (workTypeFilter === "TENDER") return isTender;
        return true;
    });

    // 1. WORK TO DO (NOT DONE):
    // Work that is there and NOT done (Scheduled, In Progress, Planning, Quoted, SOW)
    // Strictly excludes already completed, invoiced (awaiting payment), paid, and cancelled
    const workToDoProjects = displayedProjects.filter(p => !['COMPLETED', 'INVOICED', 'PAID', 'CANCELLED'].includes(p.status));
    const workAmountNotDone = workToDoProjects.reduce((acc, p) => {
        const latestInvoice = p.invoices?.[0];
        const latestWbp = p.workBreakdowns?.[0];
        const totalWorth = latestInvoice
            ? latestInvoice.total
            : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0);
        return acc + (Number(totalWorth) || 0);
    }, 0);

    // 2. REACTIVE WORK (replaces Emergency Jobs: counts reactive projects and quotes)
    const reactiveProjects = displayedProjects.filter(isReactiveProject);
    const reactiveQuotesCount = displayedProjects.reduce((acc, p) => {
        const rQuotes = p.invoices?.filter((inv: any) => inv.type === 'QUOTE' && (/reactive/i.test(inv.reference || '') || /reactive/i.test(inv.notes || '') || isReactiveProject(p))) || [];
        return acc + rQuotes.length;
    }, 0);

    const awaitingPoProjects = displayedProjects.filter(p => p.commercialStatus === 'AWAITING_PO');

    return (
        <div className="space-y-6 pb-20 max-w-[1600px] mx-auto">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        Project Operations
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide">
                        Manage workflows, scheduling, and project health
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* View Switcher: Board | Timeline Graph (Gantt) | List */}
                    <div className="bg-[#14141E]/90 backdrop-blur-md p-1 rounded-xl flex gap-1 border border-white/10 shadow-xl">
                        <button
                            type="button"
                            onClick={() => setView('KANBAN')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                                view === 'KANBAN' ? 'bg-primary text-black shadow-md' : 'text-gray-400 hover:text-white'
                            }`}
                            title="Kanban Board View"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" /> Board
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('GANTT')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                                view === 'GANTT' ? 'bg-primary text-black shadow-md' : 'text-gray-400 hover:text-white'
                            }`}
                            title="Timeline Schedule Graph (Gantt)"
                        >
                            <CalendarIcon className="h-3.5 w-3.5" /> Timeline Graph
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('LIST')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                                view === 'LIST' ? 'bg-primary text-black shadow-md' : 'text-gray-400 hover:text-white'
                            }`}
                            title="List View"
                        >
                            <List className="h-3.5 w-3.5" /> List
                        </button>
                    </div>

                    {/* Work Type Filter Tabs: All | General Work | Tender 152G */}
                    <div className="bg-[#14141E]/90 backdrop-blur-md p-1 rounded-xl flex gap-1 border border-white/10 shadow-xl">
                        <button
                            type="button"
                            onClick={() => {
                                setWorkTypeFilter("ALL")
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                workTypeFilter === "ALL"
                                    ? "bg-white text-black shadow-md"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            All Work ({projects.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setWorkTypeFilter("GENERAL")
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                workTypeFilter === "GENERAL"
                                    ? "bg-blue-600 text-white shadow-md"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            General ({generalCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setWorkTypeFilter("TENDER")
                                if (topFocus === 'REACTIVE') setTopFocus('NONE')
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                workTypeFilter === "TENDER"
                                    ? "bg-amber-500 text-black shadow-md"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Tender 152G ({tenderCount})
                        </button>
                    </div>

                    {/* Action Buttons: Schedule Document, Columns, New Project */}
                    <div className="bg-[#14141E]/80 backdrop-blur-md p-1 rounded-xl flex items-center gap-1 border border-white/10 shadow-xl">
                        <Button
                            onClick={() => setShowScheduleModal(true)}
                            className="bg-primary text-black font-black hover:bg-primary/90 shadow-[0_0_15px_rgba(163,230,53,0.3)] text-xs flex items-center gap-1.5 h-9"
                        >
                            <Printer className="h-4 w-4" /> Print / Schedule Doc
                        </Button>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="bg-[#14141E]/80 border-white/10 text-white hover:bg-white/5 font-bold h-9">
                                    <Eye className="h-4 w-4 mr-1.5" /> Columns
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 bg-[#0F0F1A] border-white/10 p-2 shadow-2xl">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1">Toggle Columns</p>
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

                        <Link href="/projects/new">
                            <Button className="bg-white text-black font-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] text-xs h-9">
                                <Plus className="mr-1.5 h-4 w-4" /> New Project
                            </Button>
                        </Link>
                    </div>
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

            {/* GANTT VIEW */}
            {view === 'GANTT' && (
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl p-6 overflow-x-auto">
                    <div className="min-w-[800px]">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-white/10 pb-4 mb-4">
                            <div className="col-span-3">Project</div>
                            {['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((w, i) => (
                                <div key={i} className="col-span-2 text-center border-l border-white/5">{w}</div>
                            ))}
                            <div className="col-span-1 text-right">Status</div>
                        </div>
                        <div className="space-y-4">
                            {workToDoProjects.map((p, idx) => {
                                const startCol = (idx % 3) * 2 + 4;
                                const spanCol = (idx % 2) + 2;
                                const isReactive = isReactiveProject(p);
                                return (
                                    <div key={p.id} className="grid grid-cols-12 gap-2 items-center group">
                                        <div className="col-span-3">
                                            <Link href={`/projects/${p.id}`} className="font-bold text-white text-sm hover:text-primary transition-colors line-clamp-1">{p.name}</Link>
                                            <p className="text-[10px] text-muted-foreground">{p.client?.name}</p>
                                        </div>
                                        <div className="col-span-8 relative h-8 rounded-lg bg-white/5">
                                            <div
                                                className={`absolute inset-y-1 rounded-md shadow-lg flex items-center px-3 text-[10px] font-black cursor-grab ${
                                                    isReactive ? 'bg-amber-500 text-black' : 'bg-primary/80 text-black hover:bg-primary'
                                                }`}
                                                style={{ left: `${(startCol - 4) * 12.5}%`, width: `${spanCol * 12.5}%` }}
                                            >
                                                <span className="truncate">{p.status.replace(/_/g, ' ')}</span>
                                            </div>
                                        </div>
                                        <div className="col-span-1 text-right">
                                            <Badge variant="outline" className="text-[9px] border-white/10">{p.status}</Badge>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </Card>
            )}

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
