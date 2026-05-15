"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Plus, LayoutGrid, List, Calendar as CalendarIcon, ArrowRight, Briefcase } from "lucide-react"
import Link from "next/link"
import { DeleteButton } from "@/components/ui/DeleteButton"
import { deleteProject } from "@/app/(dashboard)/projects/actions"

const columns = [
    { id: 'LEAD', title: 'Lead / Planning', statuses: ['LEAD', 'PLANNING'] },
    { id: 'SOW', title: 'Scope / Quoting', statuses: ['SOW', 'SOW_SUBMITTED', 'QUOTED'] },
    { id: 'IN_PROGRESS', title: 'Active Projects', statuses: ['SCHEDULED', 'IN_PROGRESS'] },
    { id: 'FINANCIAL', title: 'Invoicing / Paid', statuses: ['INVOICED', 'PAID', 'COMPLETED'] },
    { id: 'HOLD', title: 'On Hold / Cancelled', statuses: ['ON_HOLD', 'CANCELLED'] },
];

export function ProjectDashboardClient({ projects }: { projects: any[] }) {
    const [view, setView] = useState<'KANBAN' | 'LIST' | 'TIMELINE'>('KANBAN')

    // Calculations
    const activeProjects = projects.filter(p => !['COMPLETED', 'PAID', 'CANCELLED'].includes(p.status));
    const totalPipelineValue = activeProjects.reduce((acc, p) => {
        const latestInvoice = p.invoices?.[0];
        const latestWbp = p.workBreakdowns?.[0];
        const totalWorth = latestInvoice
            ? latestInvoice.total
            : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0);
        return acc + totalWorth;
    }, 0);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Operations Center</h1>
                    <p className="text-muted-foreground text-sm font-medium">Manage project workflows and financial tracking</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="bg-black/20 p-1 rounded-xl flex gap-1 border border-white/5">
                        <Button 
                            variant={view === 'KANBAN' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setView('KANBAN')}
                            className={view === 'KANBAN' ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'text-muted-foreground'}
                        >
                            <LayoutGrid className="h-4 w-4 mr-2" /> Board
                        </Button>
                        <Button 
                            variant={view === 'LIST' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setView('LIST')}
                            className={view === 'LIST' ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'text-muted-foreground'}
                        >
                            <List className="h-4 w-4 mr-2" /> List
                        </Button>
                        <Button 
                            variant={view === 'TIMELINE' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setView('TIMELINE')}
                            className={view === 'TIMELINE' ? 'bg-primary/20 text-primary hover:bg-primary/30' : 'text-muted-foreground'}
                        >
                            <CalendarIcon className="h-4 w-4 mr-2" /> Timeline
                        </Button>
                    </div>
                    <Link href="/projects/new">
                        <Button className="bg-primary text-black font-black hover:bg-primary/90">
                            <Plus className="mr-2 h-4 w-4" /> New Project
                        </Button>
                    </Link>
                </div>
            </div>

            {/* KPI Summary */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-[#14141E] border-white/5 shadow-xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Active Projects</CardTitle>
                        <Briefcase className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-white">{activeProjects.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-[#14141E] border-white/5 shadow-xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Pipeline Value</CardTitle>
                        <Briefcase className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-500">{formatCurrency(totalPipelineValue)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* KANBAN VIEW */}
            {view === 'KANBAN' && (
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                    {columns.map(col => {
                        const colProjects = projects.filter(p => col.statuses.includes(p.status));
                        return (
                            <div key={col.id} className="min-w-[320px] w-[320px] shrink-0 snap-start">
                                <div className="bg-[#0A0A12] border border-white/5 rounded-2xl p-4 flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-black text-sm uppercase tracking-widest text-primary/80">{col.title}</h3>
                                        <span className="bg-white/5 text-muted-foreground text-xs px-2 py-0.5 rounded-full font-bold">
                                            {colProjects.length}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                                        {colProjects.map(project => {
                                            const latestInvoice = project.invoices?.[0];
                                            const latestWbp = project.workBreakdowns?.[0];
                                            const totalWorth = latestInvoice
                                                ? latestInvoice.total
                                                : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0);

                                            return (
                                                <div key={project.id} className="bg-[#14141E] border border-white/5 p-4 rounded-xl shadow-lg hover:border-primary/30 transition-colors group cursor-pointer relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                                                    <div className="pl-2">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <Link href={`/projects/${project.id}`} className="hover:underline">
                                                                <h4 className="font-black text-white text-sm line-clamp-1">{project.name}</h4>
                                                            </Link>
                                                        </div>
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-3">{project.client.name}</p>
                                                        
                                                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                                                            <span className="text-[10px] font-black tracking-widest text-primary bg-primary/10 px-2 py-1 rounded">
                                                                {project.status.replace('_', ' ')}
                                                            </span>
                                                            <span className="text-xs font-black text-white">
                                                                {formatCurrency(totalWorth)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {colProjects.length === 0 && (
                                            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl p-6">
                                                <p className="text-xs text-muted-foreground/50 font-bold uppercase tracking-widest text-center">No projects</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* LIST VIEW */}
            {view === 'LIST' && (
                <div className="rounded-2xl border border-white/5 bg-[#14141E] shadow-2xl overflow-hidden">
                    <div className="relative w-full overflow-auto">
                        <table className="w-full text-sm text-left min-w-[800px]">
                            <thead className="[&_tr]:border-b border-white/10">
                                <tr className="border-b transition-colors hover:bg-muted/50">
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground uppercase text-[10px] tracking-widest">Project Name</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground uppercase text-[10px] tracking-widest">Client</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground uppercase text-[10px] tracking-widest">Status</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground uppercase text-[10px] tracking-widest">Comm. Status</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right uppercase text-[10px] tracking-widest">Worth</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((project: any) => {
                                    const latestWbp = project.workBreakdowns?.[0]
                                    const latestInvoice = project.invoices?.[0]
                                    const totalWorth = latestInvoice
                                        ? latestInvoice.total
                                        : (latestWbp ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15 : 0)

                                    return (
                                        <tr key={project.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                                            <td className="p-4 align-middle">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-black text-white">{project.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground font-medium">{project.client.name}</td>
                                            <td className="p-4 align-middle">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">
                                                    {project.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest
                                                    ${project.commercialStatus === 'EMERGENCY_WORK' ? 'bg-red-500 text-white shadow-lg' :
                                                    project.commercialStatus === 'REACTIVE_WORK' ? 'bg-orange-500 text-white shadow-lg' :
                                                    project.commercialStatus === 'PO_RECEIVED' ? 'bg-primary/20 text-primary border border-primary/40' :
                                                    'bg-amber-500/20 text-amber-500 border border-amber-500/30'}`}>
                                                    {project.commercialStatus === 'EMERGENCY_WORK' ? '🚨 EMERGENCY' :
                                                    project.commercialStatus === 'REACTIVE_WORK' ? '⚡ REACTIVE' :
                                                    project.commercialStatus === 'PO_RECEIVED' ? '✅ PO RECEIVED' : '⏳ AWAITING PO'}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle text-right font-black text-white">
                                                {formatCurrency(totalWorth)}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/projects/${project.id}`}>
                                                        <Button variant="ghost" size="sm" className="hover:bg-primary hover:text-primary-foreground font-bold">View</Button>
                                                    </Link>
                                                    <DeleteButton
                                                        id={project.id}
                                                        action={deleteProject}
                                                        confirmText="Delete project?"
                                                    />
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

            {/* TIMELINE VIEW */}
            {view === 'TIMELINE' && (
                <Card className="bg-[#14141E] border-white/5 shadow-2xl p-6">
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                        {projects.slice(0, 10).map((project, idx) => (
                            <div key={project.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-[#0F0F1A] text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                    <Briefcase className="h-4 w-4" />
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white/5 p-4 rounded-xl border border-white/5 hover:border-primary/30 transition-colors">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{new Date(project.updatedAt).toLocaleDateString()}</span>
                                        <span className="text-[9px] font-black uppercase tracking-widest bg-primary/20 text-primary px-2 py-0.5 rounded">{project.status.replace('_', ' ')}</span>
                                    </div>
                                    <h4 className="font-black text-white text-sm">{project.name}</h4>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{project.client.name}</p>
                                    <Link href={`/projects/${project.id}`} className="inline-flex items-center mt-3 text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">
                                        View Details <ArrowRight className="ml-1 h-3 w-3" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    )
}
