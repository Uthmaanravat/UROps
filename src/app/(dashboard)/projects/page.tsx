import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { deleteProject } from "./actions"
import { DeleteButton } from "@/components/ui/DeleteButton"

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
    const projects = await prisma.project.findMany({
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
                    site: true
                }
            }
        }
    })

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

            <div className="rounded-md border bg-card">
                <div className="relative w-full overflow-auto">
                    <table className="w-full text-sm text-left min-w-[800px]">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50">
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Project Name</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Client</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Site / Place</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">AI Summary</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
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
                                        <td className="p-4 align-middle font-black text-white">{project.name}</td>
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
