import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle, FileText } from "lucide-react"
import Link from "next/link"
import { WorkBreakdownPricingEditor } from "@/components/wbp/WorkBreakdownPricingEditor"
import { cn, formatCurrency } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function WorkBreakdownPricingPage({ params }: { params: { id: string } }) {
    const wbp = await prisma.workBreakdownPricing.findUnique({
        where: { id: params.id },
        include: {
            project: {
                include: { client: true }
            },
            items: true
        }
    })

    if (!wbp) {
        notFound()
    }

    const project = wbp.project

    // Role Simulation (demo purposes)
    const isAdmin = true; // In a real app, this would come from session/context

    if (!isAdmin) {
        return (
            <div className="max-w-4xl mx-auto py-10 px-4 text-center">
                <Card className="p-8 border-yellow-100 bg-yellow-50">
                    <h2 className="text-xl font-bold text-yellow-800 mb-2">Access Restricted</h2>
                    <p className="text-yellow-700">Only administrators can access the Work Breakdown & Pricing workspace.</p>
                    <Link href={`/projects/${project.id}`} className="mt-4 inline-block underline text-yellow-900">
                        Return to Project Page
                    </Link>
                </Card>
            </div>
        )
    }

    const isApproved = wbp.status === 'APPROVED'

    const settings = await prisma.companySettings.findUnique({ where: { id: "default" } });
    const aiEnabled = settings?.aiEnabled ?? true;

    return (
        <div className="max-w-7xl mx-auto py-8 px-6 space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link href={`/projects/${project.id}`}>
                        <Button variant="ghost" size="icon" className="hover:bg-primary/10 text-primary transition-all">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-white uppercase tracking-wider">Commercial Workspace</h1>
                        <p className="text-muted-foreground/60 text-sm font-bold mt-1 uppercase tracking-widest">{project.name} <span className="mx-2 opacity-30">|</span> {project.client.name}</p>
                    </div>
                </div>
                {isApproved && (
                    <div className="bg-primary/10 border border-primary/20 rounded-xl px-6 py-3 flex items-center gap-3 text-primary shadow-lg shadow-primary/5">
                        <CheckCircle className="h-5 w-5 animate-pulse" />
                        <span className="font-black text-xs uppercase tracking-widest">Pricing Locked & Approved</span>
                    </div>
                )}
            </div>

            {isApproved ? (
                <div className="space-y-8">
                    <div className="bg-[#1A1A2E] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="bg-white/5 p-5 border-b border-white/5 font-black grid grid-cols-12 gap-4 text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                            <div className="col-span-1 text-center">Reference</div>
                            <div className="col-span-1 border-r border-white/5 pr-2 text-center opacity-30">#</div>
                            <div className="col-span-5">Technical Specification</div>
                            <div className="col-span-1 text-center">Qty</div>
                            <div className="col-span-1">Unit</div>
                            <div className="col-span-1 text-right">Unit Price</div>
                            <div className="col-span-2 text-right text-primary">Line Total</div>
                        </div>
                        <div className="divide-y divide-white/5">
                            {wbp.items.map((item: any, idx: number) => (
                                <div key={item.id} className="p-6 grid grid-cols-12 gap-4 text-sm items-center hover:bg-white/[0.02] transition-all">
                                    <div className="col-span-1 text-center font-mono text-[10px] text-muted-foreground opacity-50">WB-{idx + 101}</div>
                                    <div className="col-span-1 border-r border-white/5 pr-2 text-center text-muted-foreground font-mono opacity-30">{idx + 1}</div>
                                    <div className="col-span-5 flex flex-col gap-1">
                                        <span className="font-black text-white text-base">{item.description}</span>
                                        {item.notes && <span className="text-[11px] text-muted-foreground italic font-medium mt-1">{item.notes}</span>}
                                    </div>
                                    <div className="col-span-1 text-center bg-white/5 rounded-lg py-2 font-black text-white">{item.quantity}</div>
                                    <div className="col-span-1 text-muted-foreground text-center font-bold uppercase tracking-widest text-[10px]">{item.unit || 'ea'}</div>
                                    <div className="col-span-1 text-right font-mono text-xs text-muted-foreground">R{item.unitPrice.toFixed(2)}</div>
                                    <div className="col-span-2 text-right font-black text-white text-lg">R{(item.quantity * item.unitPrice).toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-white/[0.03] p-8 flex justify-end">
                            <div className="text-right space-y-1">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block mb-2 opacity-50">Final Commercial Total (Inc VAT)</span>
                                <span className="text-5xl font-black text-primary shadow-primary/20 drop-shadow-2xl">
                                    {formatCurrency(wbp.items.reduce((sum: number, i: any) => sum + (i.quantity * i.unitPrice), 0) * 1.15)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <WorkBreakdownPricingEditor
                    wbp={wbp}
                    aiEnabled={aiEnabled}
                />
            )}
        </div>
    )
}

function Card({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
            {children}
        </div>
    )
}
