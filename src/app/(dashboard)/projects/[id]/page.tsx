import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Pencil, FileText, Calendar, DollarSign, CheckCircle, Sparkles, Trophy } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { WorkflowTracker } from "@/components/workflow/WorkflowTracker"
import { updateProjectStatus, deleteProject } from "@/app/(dashboard)/projects/actions"
import { deleteInvoiceAction } from "@/app/(dashboard)/invoices/actions"
import { DeleteButton } from "@/components/ui/DeleteButton"
import { deleteSOWAction } from "./sow/actions"
import { ensureAuth } from "@/lib/auth-actions"

export const dynamic = 'force-dynamic'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
    const companyId = await ensureAuth()
    const project = await (prisma as any).project.findFirst({
        where: { id: params.id, companyId },
        include: {
            client: true,
            invoices: {
                orderBy: { date: 'desc' },
                include: { payments: true }
            },
            scopes: {
                orderBy: { version: 'desc' },
                take: 1,
                include: { items: true }
            },
            workBreakdowns: {
                orderBy: { version: 'desc' },
                take: 1
            },
            meetings: {
                orderBy: { date: 'desc' },
                take: 5
            }
        }
    })

    if (!project) notFound()

    const latestScope = project.scopes[0]
    const latestWbp = project.workBreakdowns[0]
    const latestQuote = project.invoices.find((i: any) => i.type === 'QUOTE')
    const invoice = project.invoices.find((i: any) => i.type === 'INVOICE')
    const paidAmount = invoice?.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0

    // Role Simulation (demo purposes)
    const isAdmin = true;

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                    <Link href="/projects" className="hover:text-primary transition-colors">Projects</Link>
                    <span className="opacity-30">/</span>
                    <span className="text-muted-foreground">{project.client.name}</span>
                </div>
                <div className="flex items-center justify-between">
                    <h1 className="text-4xl font-black tracking-tight text-white">{project.name}</h1>
                    <div className="flex gap-2">
                        {project.status !== 'COMPLETED' && isAdmin && (
                            <form action={async () => {
                                'use server'
                                await updateProjectStatus(project.id, 'COMPLETED')
                            }}>
                                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20">
                                    <Trophy className="mr-2 h-4 w-4" /> Mark as Completed
                                </Button>
                            </form>
                        )}
                        <Link href={`/projects/${project.id}/edit`}>
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-xl shadow-primary/20 transition-all border-none">
                                <Pencil className="mr-2 h-4 w-4" /> Edit Project Details
                            </Button>
                        </Link>
                        <DeleteButton
                            id={project.id}
                            action={deleteProject}
                            variant="outline"
                            className="border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all font-bold"
                            label="Delete Project"
                            confirmText="Are you sure? This will delete the project and ALL related documents permanently."
                        />
                    </div>
                </div>

                {/* Workflow Tracker */}
                <div className="bg-[#1A1A2E] border border-white/5 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
                    <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-6 inline-flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        <Sparkles className="w-3 h-3" /> Project Lifecycle
                    </h2>
                    <WorkflowTracker currentStage={project.workflowStage || 'SOW'} />

                    {/* Action Center - Navy themed */}
                    <div className="mt-8 p-6 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner border border-primary/20">
                                {project.workflowStage === 'SOW' && <Sparkles className="w-6 h-6 animate-pulse" />}
                                {project.workflowStage === 'QUOTATION' && <FileText className="w-6 h-6" />}
                                {project.workflowStage === 'INVOICE' && <FileText className="w-6 h-6" />}
                                {project.workflowStage === 'PAYMENT' && <DollarSign className="w-6 h-6" />}
                                {(project.workflowStage === 'COMPLETED' || project.status === 'COMPLETED') && <CheckCircle className="w-6 h-6 text-primary" />}
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-white">Current Milestone</h3>
                                <p className="text-sm text-muted-foreground font-medium">
                                    {project.workflowStage === 'SOW' && !latestScope && "Action Required: Define Initial Scope of Work."}
                                    {project.workflowStage === 'SOW' && latestScope?.status === 'SUBMITTED' && "Scope Submitted. Technical lead is preparing commercial breakdown."}
                                    {project.workflowStage === 'QUOTATION' && "Quotation Live. Awaiting client authorization."}
                                    {project.workflowStage === 'INVOICE' && "Invoiced. Monitoring for payment receipt."}
                                    {project.workflowStage === 'PAYMENT' && "Payment Received. Final compliance check."}
                                    {(project.workflowStage === 'COMPLETED' || project.status === 'COMPLETED') && "Project lifecycle complete. Mission successful."}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            {project.workflowStage === 'SOW' && (
                                <>
                                    {!latestScope || latestScope.status === 'DRAFT' ? (
                                        <Link href={`/projects/${project.id}/sow`}>
                                            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 shadow-xl shadow-primary/20">
                                                Launch SOW Builder
                                            </Button>
                                        </Link>
                                    ) : (
                                        <>
                                            <Link href={`/projects/${project.id}/sow`}>
                                                <Button size="lg" variant="outline" className="border-white/20 hover:bg-white/10 font-bold">
                                                    Inspect Requirements
                                                </Button>
                                            </Link>
                                            {isAdmin && latestWbp && (
                                                <div className="flex gap-3">
                                                    <Link href={`/work-breakdown-pricing/${latestWbp.id}`}>
                                                        <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-xl shadow-primary/20">
                                                            Enter Commercial Workspace
                                                        </Button>
                                                    </Link>
                                                    <DeleteButton
                                                        id={latestWbp.id}
                                                        action={async (id) => {
                                                            'use server'
                                                            const { deleteWBPAction } = await import("@/app/(dashboard)/work-breakdown-pricing/actions")
                                                            await deleteWBPAction(id)
                                                        }}
                                                        variant="outline"
                                                        className="h-14 w-14 border-white/10 hover:bg-red-500/10 hover:text-red-500"
                                                        confirmText="Delete this commercial breakdown?"
                                                    />
                                                </div>
                                            )}
                                            {latestScope && (
                                                <DeleteButton
                                                    id={latestScope.id}
                                                    action={async (id) => {
                                                        'use server'
                                                        await deleteSOWAction(id, project.id)
                                                    }}
                                                    variant="outline"
                                                    className="h-14 w-14 border-white/10 hover:bg-red-500/10 hover:text-red-500"
                                                    confirmText="Delete this Scope of Work record? This will also remove the linked WB&P if any."
                                                />
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                            {project.workflowStage === 'QUOTATION' && (
                                <Link href={latestQuote ? `/invoices/${latestQuote.id}` : `/projects/${project.id}/sow`}>
                                    <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-xl shadow-primary/20">
                                        {latestQuote ? "Analyze Quotation" : "Generate Documentation"}
                                    </Button>
                                </Link>
                            )}
                            {(project.workflowStage === 'INVOICE' || project.workflowStage === 'PAYMENT') && invoice && (
                                <Link href={`/invoices/${invoice.id}`}>
                                    <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-xl shadow-primary/20">
                                        Manage Financials
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="md:col-span-2 space-y-6">
                    <div className="border rounded-lg bg-card p-6">
                        <h3 className="font-semibold mb-4">Project Details</h3>
                        <p className="whitespace-pre-wrap text-sm text-gray-700">
                            {project.description || "No description provided."}
                        </p>
                    </div>

                    <div className="border rounded-lg bg-card">
                        <div className="p-4 border-b font-semibold flex justify-between items-center">
                            <span>Documents (Quotes & Invoices)</span>
                        </div>
                        <div className="overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Number</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Total</th>
                                        <th className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {project.invoices.map((inv: any) => (
                                        <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="p-3">{new Date(inv.date).toLocaleDateString()}</td>
                                            <td className="p-3 font-mono font-bold text-primary">{inv.quoteNumber || `#${inv.number}`}</td>
                                            <td className="p-3"><span className="font-semibold text-xs uppercase bg-gray-100 px-2 py-1 rounded">{inv.type}</span></td>
                                            <td className="p-3">{inv.status}</td>
                                            <td className="p-3 text-right">{formatCurrency(inv.total)}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/invoices/${inv.id}`}>
                                                        <Button variant="ghost" size="sm">View</Button>
                                                    </Link>
                                                    <DeleteButton
                                                        id={inv.id}
                                                        action={deleteInvoiceAction}
                                                        confirmText={`Are you sure you want to delete this ${inv.type.toLowerCase()}?`}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {project.invoices.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                                No documents yet. Start by creating a Scope of Work.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="border rounded-lg bg-card p-6">
                        <h3 className="font-semibold mb-4">Metadata</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-muted-foreground">Status</span>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="font-medium">{project.status}</span>
                                    {project.commercialStatus && (
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded
                                            ${project.commercialStatus === 'EMERGENCY_WORK' ? 'bg-red-500 text-white animate-pulse' :
                                                project.commercialStatus === 'PO_RECEIVED' ? 'bg-primary/20 text-primary border border-primary/20' :
                                                    'bg-amber-500/20 text-amber-500 border border-amber-500/20'}`}>
                                            {project.commercialStatus.replace('_', ' ')}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-muted-foreground">Start Date</span>
                                <span>{project.startDate ? new Date(project.startDate).toLocaleDateString() : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">End Date</span>
                                <span>{project.endDate ? new Date(project.endDate).toLocaleDateString() : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="border rounded-lg bg-card p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold">Meetings</h3>
                            <Link href="/calendar">
                                <Button variant="ghost" size="sm"><Calendar className="h-4 w-4" /></Button>
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {project.meetings.map((m: any) => (
                                <div key={m.id} className="text-sm border-l-2 border-primary pl-3 py-1">
                                    <div className="font-medium">{m.title}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {new Date(m.date).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                            {project.meetings.length === 0 && (
                                <div className="text-sm text-muted-foreground italic">No meetings scheduled.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
