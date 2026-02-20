import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { deleteProject } from "./actions"
import { DeleteButton } from "@/components/ui/DeleteButton"
import { ensureAuth } from "@/lib/auth-actions"

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
    const companyId = await ensureAuth()
    let projects: any[] = []

    try {
        projects = await prisma.project.findMany({
            where: { companyId },
            orderBy: { updatedAt: 'desc' },
            include: {
                client: true,
                scopes: {
                    include: { items: true },
                    orderBy: { version: 'desc' },
                    take: 1
                },
                workBreakdowns: {
                    include: { items: true },
                    orderBy: { version: 'desc' },
                    take: 1
                },
                invoices: {
                    select: {
                        total: true,
                        type: true,
                        status: true,
                        site: true,
                        reference: true,
                        quoteNumber: true
                    }
                }
            },
            take: 50
        }) || []
    } catch (error) {
        console.error("Error fetching projects:", error)
        projects = []
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                    <p className="text-muted-foreground">Manage your ongoing projects and breakdowns.</p>
                </div>
                <Link href="/projects/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Project
                    </Button>
                </Link>
            </div>

            <div className="md:hidden space-y-4">
                {projects.map((project: any) => {
                    const latestWbp = project.workBreakdowns[0]
                    const latestScope = project.scopes[0]
                    const totalWorth = latestWbp
                        ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15
                        : (project.invoices.find((i: any) => i.type === 'QUOTE' || i.type === 'INVOICE')?.total || 0)

                    return (
                        <div key={project.id} className="bg-card border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-black text-white text-lg leading-tight">{project.name}</h3>
                                        {project.invoices.find((i: any) => i.reference)?.reference && project.invoices.find((i: any) => i.reference).reference !== project.name && (
                                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-black border border-primary/20">
                                                {project.invoices.find((i: any) => i.reference).reference}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-muted-foreground text-xs uppercase font-bold tracking-widest">{project.client.name}</p>
                                    {project.invoices?.[0]?.quoteNumber && (
                                        <p className="text-[10px] font-mono text-primary font-black mt-1 uppercase tracking-widest">{project.invoices[0].quoteNumber}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-50">Total Worth</p>
                                    <p className="text-xl font-black text-primary">{formatCurrency(totalWorth)}</p>
                                </div>
                            </div>

                            <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 opacity-30">Status Tracking</p>
                                <div className="flex flex-wrap gap-2">
                                    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider
                                        ${project.status === 'COMPLETED' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' :
                                            project.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                project.status === 'PAID' ? 'bg-primary/20 text-primary border border-primary/30' :
                                                    project.status === 'INVOICED' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                        project.status === 'QUOTED' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                                            project.status === 'SOW_SUBMITTED' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                                                                project.status === 'SCHEDULED' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                                                    project.status === 'LEAD' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                                                        'bg-white/5 text-muted-foreground border border-white/10'}`}>
                                        {project.status === 'SOW_SUBMITTED' ? 'Scope Submitted' : project.status.replace('_', ' ')}
                                    </span>
                                    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest
                                        ${project.commercialStatus === 'EMERGENCY_WORK' ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50' :
                                            project.commercialStatus === 'PO_RECEIVED' ? 'bg-primary/20 text-primary border border-primary/40' :
                                                'bg-amber-500/20 text-amber-500 border border-amber-500/30'}`}>
                                        {project.commercialStatus === 'EMERGENCY_WORK' ? '🚨 EMERGENCY' :
                                            project.commercialStatus === 'PO_RECEIVED' ? '✅ PO RECEIVED' : '⏳ AWAITING PO'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Link href={`/projects/${project.id}`} className="flex-1">
                                    <Button className="w-full bg-white/5 hover:bg-primary hover:text-primary-foreground border-white/10 font-black uppercase text-xs tracking-widest h-11 rounded-xl transition-all">
                                        View Project
                                    </Button>
                                </Link>
                                <DeleteButton
                                    id={project.id}
                                    action={deleteProject}
                                    confirmText="Are you sure?"
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="hidden md:block rounded-md border bg-card">
                <div className="relative w-full overflow-auto">
                    <table className="w-full text-sm text-left min-w-[800px]">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50">
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Project Name</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Client</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Site / Place</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">AI Summary</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Doc #</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Worth</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map((project: any) => {
                                const latestWbp = project.workBreakdowns[0]
                                const latestScope = project.scopes[0]

                                const activeItems = latestWbp?.items || latestScope?.items || []

                                // Refine AI Summary to be high-level instead of a raw list
                                const aiSummary = activeItems.length > 0
                                    ? `Project involves ${activeItems[0].description.toLowerCase()}${activeItems.length > 1 ? ` and other specialized works` : ''}. Focused on ${project.client.name}'s requirements at ${project.invoices[0]?.site || 'the designated site'}.`
                                    : "Scope pending definition."

                                const totalWorth = latestWbp
                                    ? latestWbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15
                                    : (project.invoices.find((i: any) => i.type === 'QUOTE' || i.type === 'INVOICE')?.total || 0)

                                return (
                                    <tr key={project.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                                        <td className="p-4 align-middle">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-black text-white">{project.name}</span>
                                                {project.invoices.find((i: any) => i.reference)?.reference && project.invoices.find((i: any) => i.reference).reference !== project.name && (
                                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                                        REF: {project.invoices.find((i: any) => i.reference).reference}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle text-muted-foreground font-medium">{project.client.name}</td>
                                        <td className="p-4 align-middle text-muted-foreground italic font-medium">
                                            {project.invoices[0]?.site || '-'}
                                        </td>
                                        <td className="p-4 align-middle max-w-[300px]">
                                            <div className="text-[11px] text-primary font-bold leading-relaxed" title={aiSummary}>
                                                {aiSummary}
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="flex flex-col gap-2">
                                                <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider
                                                    ${project.status === 'COMPLETED' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' :
                                                        project.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                            project.status === 'PAID' ? 'bg-primary/20 text-primary border border-primary/30' :
                                                                project.status === 'INVOICED' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                                    project.status === 'QUOTED' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                                                        project.status === 'SOW_SUBMITTED' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                                                                            project.status === 'SCHEDULED' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                                                                project.status === 'LEAD' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                                                                    'bg-white/5 text-muted-foreground border border-white/10'}`}>
                                                    {project.status === 'SOW_SUBMITTED' ? 'Scope Submitted' : project.status.replace('_', ' ')}
                                                </span>
                                                <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest
                                                    ${project.commercialStatus === 'EMERGENCY_WORK' ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50' :
                                                        project.commercialStatus === 'PO_RECEIVED' ? 'bg-primary/20 text-primary border border-primary/40' :
                                                            'bg-amber-500/20 text-amber-500 border border-amber-500/30'}`}>
                                                    {project.commercialStatus === 'EMERGENCY_WORK' ? '🚨 EMERGENCY' :
                                                        project.commercialStatus === 'PO_RECEIVED' ? '✅ PO RECEIVED' : '⏳ AWAITING PO'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="text-[10px] font-mono text-primary font-bold">
                                                {project.invoices?.[0]?.quoteNumber || '-'}
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle text-right font-black text-white text-base">
                                            {formatCurrency(totalWorth)}
                                        </td>
                                        <td className="p-4 align-middle text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/projects/${project.id}`}>
                                                    <Button variant="ghost" size="sm" className="hover:bg-primary hover:text-primary-foreground font-bold transition-all">View</Button>
                                                </Link>
                                                <DeleteButton
                                                    id={project.id}
                                                    action={deleteProject}
                                                    confirmText="Are you sure you want to delete this project? All related documents and breakdowns will be removed."
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {projects.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                                        No projects found. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
