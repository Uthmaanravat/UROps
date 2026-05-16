"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Plus, LayoutGrid, List, Calendar as CalendarIcon, ArrowRight, Briefcase, Loader2, Clock, CheckCircle2, AlertCircle, BarChartHorizontal, MoreHorizontal, DollarSign } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DeleteButton } from "@/components/ui/DeleteButton"
import { deleteProject, updateProjectStatus, updateProjectCommercialStatus } from "@/app/(dashboard)/projects/actions"
import { Badge } from "@/components/ui/badge"

const columns = [
    { id: 'APPROVAL', title: 'Waiting Approval', statuses: ['SOW', 'SOW_SUBMITTED', 'QUOTED', 'LEAD'], color: 'border-blue-500/30 bg-blue-500/5' },
    { id: 'SCHEDULED', title: 'Scheduled', statuses: ['PLANNING', 'SCHEDULED'], color: 'border-purple-500/30 bg-purple-500/5' },
    { id: 'IN_PROGRESS', title: 'In Progress', statuses: ['IN_PROGRESS'], color: 'border-emerald-500/30 bg-emerald-500/5' },
    { id: 'HOLD', title: 'On Hold', statuses: ['ON_HOLD'], color: 'border-orange-500/30 bg-orange-500/5' },
    { id: 'COMPLETED', title: 'Completed', statuses: ['COMPLETED'], color: 'border-teal-500/30 bg-teal-500/5' },
    { id: 'AWAITING_PAYMENT', title: 'Awaiting Payment', statuses: ['INVOICED'], color: 'border-red-500/30 bg-red-500/5' },
    { id: 'PAID', title: 'Paid & Archived', statuses: ['PAID', 'CANCELLED'], color: 'border-white/10 bg-white/5' },
];

export function ProjectDashboardClient({ projects: initialProjects }: { projects: any[] }) {
    const [view, setView] = useState<'KANBAN' | 'LIST' | 'GANTT'>('KANBAN')
    const [projects, setProjects] = useState(initialProjects)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

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

    // Calculations
    const activeProjects = projects.filter(p => !['COMPLETED', 'PAID', 'CANCELLED'].includes(p.status));
    const totalPipelineValue = activeProjects.reduce((acc, p) => {
        const latestInvoice = p.invoices?.[0];
        const latestWbp = p.workBreakdowns?.[0];
        const totalWorth = latestInvoice
            ? latestInvoice.total
            : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0);
        return acc + (Number(totalWorth) || 0);
    }, 0);

    const emergencyProjects = activeProjects.filter(p => p.commercialStatus === 'EMERGENCY_WORK');

    return (
        <div className="space-y-6 pb-20 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">Project Operations</h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide">Manage workflows, scheduling, and project health</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="bg-[#14141E]/80 backdrop-blur-md p-1 rounded-xl flex gap-1 border border-white/10 shadow-xl">
                        <Button variant={view === 'KANBAN' ? 'default' : 'ghost'} size="sm" onClick={() => setView('KANBAN')} className={view === 'KANBAN' ? 'bg-primary text-black hover:bg-primary/90 font-black' : 'text-muted-foreground font-bold hover:text-white'}>
                            <LayoutGrid className="h-4 w-4 mr-2" /> Kanban
                        </Button>
                        <Button variant={view === 'GANTT' ? 'default' : 'ghost'} size="sm" onClick={() => setView('GANTT')} className={view === 'GANTT' ? 'bg-primary text-black hover:bg-primary/90 font-black' : 'text-muted-foreground font-bold hover:text-white'}>
                            <BarChartHorizontal className="h-4 w-4 mr-2" /> Gantt
                        </Button>
                        <Button variant={view === 'LIST' ? 'default' : 'ghost'} size="sm" onClick={() => setView('LIST')} className={view === 'LIST' ? 'bg-primary text-black hover:bg-primary/90 font-black' : 'text-muted-foreground font-bold hover:text-white'}>
                            <List className="h-4 w-4 mr-2" /> List
                        </Button>
                    </div>
                    <Link href="/projects/new">
                        <Button className="bg-white text-black font-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                            <Plus className="mr-2 h-4 w-4" /> New Project
                        </Button>
                    </Link>
                </div>
            </div>

            {/* KPI Summary */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-primary/30 transition-all cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Active Pipeline</CardTitle>
                        <Briefcase className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white">{activeProjects.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-emerald-500/30 transition-all cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Pipeline Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-400">{formatCurrency(totalPipelineValue)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-red-500/20 shadow-2xl hover:border-red-500/50 transition-all cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[11px] font-black text-red-400 uppercase tracking-widest">Emergency Jobs</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">{emergencyProjects.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-orange-500/30 transition-all cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Awaiting PO</CardTitle>
                        <Clock className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white">{projects.filter(p => p.commercialStatus === 'AWAITING_PO').length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* KANBAN VIEW */}
            {view === 'KANBAN' && (
                <div className="flex gap-4 overflow-x-auto pb-6 snap-x pt-2 scrollbar-thin scrollbar-thumb-white/10">
                    {columns.map(col => {
                        const colProjects = projects.filter(p => col.statuses.includes(p.status));
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

                                            return (
                                                <div key={project.id} draggable onDragStart={(e) => handleDragStart(e, project.id)} className="bg-[#0F0F1A] border border-white/10 p-4 rounded-xl shadow-xl hover:border-primary/50 transition-all group cursor-grab active:cursor-grabbing relative overflow-hidden flex flex-col">
                                                    
                                                    {project.commercialStatus === 'EMERGENCY_WORK' && (
                                                        <div className="absolute top-0 inset-x-0 h-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                                                    )}

                                                    <div className="flex justify-between items-start mb-2">
                                                        <Link href={`/projects/${project.id}`} className="hover:text-primary transition-colors flex-1">
                                                            <h4 className="font-black text-white text-sm leading-tight line-clamp-2">{project.name}</h4>
                                                        </Link>
                                                        <div className="relative">
                                                            <select 
                                                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10" 
                                                                value=""
                                                                onChange={(e) => {
                                                                    const [field, val] = e.target.value.split(':');
                                                                    if (field && val) handleStatusChange(project.id, field as 'status'|'commercialStatus', val);
                                                                }}
                                                            >
                                                                <option value="" disabled>Actions...</option>
                                                                <option value="status:IN_PROGRESS">Mark In Progress</option>
                                                                <option value="commercialStatus:AWAITING_PO">Wait for PO</option>
                                                                <option value="status:COMPLETED">Mark Completed</option>
                                                                <option value="status:PAID">Mark Paid & Archive</option>
                                                                <option value="commercialStatus:EMERGENCY_WORK">Flag Emergency</option>
                                                            </select>
                                                            <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-white/10 shrink-0 pointer-events-none">
                                                                <MoreHorizontal className="h-4 w-4 text-white" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    
                                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-4">{project.client.name}</p>
                                                    
                                                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
                                                        <div className="flex flex-col gap-1">
                                                            {project.commercialStatus === 'AWAITING_PO' && <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[9px] py-0">Waiting PO</Badge>}
                                                            {project.commercialStatus === 'EMERGENCY_WORK' && <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] py-0">Urgent</Badge>}
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

            {/* GANTT VIEW (Simplified) */}
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
                            {activeProjects.map((p, idx) => {
                                // Mock duration for visual effect since we might not have dates
                                const startCol = (idx % 3) * 2 + 4; 
                                const spanCol = (idx % 2) + 2;
                                return (
                                    <div key={p.id} className="grid grid-cols-12 gap-2 items-center group">
                                        <div className="col-span-3">
                                            <Link href={`/projects/${p.id}`} className="font-bold text-white text-sm hover:text-primary transition-colors line-clamp-1">{p.name}</Link>
                                            <p className="text-[10px] text-muted-foreground">{p.client.name}</p>
                                        </div>
                                        <div className="col-span-8 relative h-8 rounded-lg bg-white/5">
                                            <div 
                                                className={`absolute inset-y-1 rounded-md shadow-lg flex items-center px-3 text-[10px] font-black cursor-grab ${p.commercialStatus === 'EMERGENCY_WORK' ? 'bg-red-500 text-white' : 'bg-primary/80 text-black hover:bg-primary'}`}
                                                style={{ left: `${(startCol - 4) * 12.5}%`, width: `${spanCol * 12.5}%` }}
                                            >
                                                <span className="truncate">{p.status.replace('_', ' ')}</span>
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
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground uppercase text-[10px] tracking-widest">Client</th>
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground uppercase text-[10px] tracking-widest">Status</th>
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground uppercase text-[10px] tracking-widest">Comm. Status</th>
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground text-right uppercase text-[10px] tracking-widest">Worth</th>
                                    <th className="h-12 px-4 align-middle font-black text-muted-foreground"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((project: any) => {
                                    const latestWbp = project.workBreakdowns?.[0]
                                    const latestInvoice = project.invoices?.[0]
                                    const totalWorth = latestInvoice ? latestInvoice.total : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0)

                                    return (
                                        <tr key={project.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                                            <td className="p-4 align-middle">
                                                <Link href={`/projects/${project.id}`} className="font-black text-white hover:text-primary">{project.name}</Link>
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground font-medium">{project.client.name}</td>
                                            <td className="p-4 align-middle">
                                                <select value={project.status} onChange={(e) => handleStatusChange(project.id, 'status', e.target.value)} className="bg-white/5 text-white border border-white/10 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded cursor-pointer outline-none focus:ring-2 focus:ring-primary/50">
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
                                                <select value={project.commercialStatus} onChange={(e) => handleStatusChange(project.id, 'commercialStatus', e.target.value)} className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest cursor-pointer outline-none focus:ring-2 focus:ring-primary/50 ${project.commercialStatus === 'EMERGENCY_WORK' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : project.commercialStatus === 'REACTIVE_WORK' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : project.commercialStatus === 'PO_RECEIVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'}`}>
                                                    <option value="AWAITING_PO" className="bg-[#14141E] text-white">⌛ AWAITING PO</option>
                                                    <option value="PO_RECEIVED" className="bg-[#14141E] text-white">✅ PO RECEIVED</option>
                                                    <option value="REACTIVE_WORK" className="bg-[#14141E] text-white">⚡ REACTIVE</option>
                                                    <option value="EMERGENCY_WORK" className="bg-[#14141E] text-white">🚨 EMERGENCY</option>
                                                </select>
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
        </div>
    )
}
