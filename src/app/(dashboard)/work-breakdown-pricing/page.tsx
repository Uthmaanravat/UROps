import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { deleteWBPAction } from "./actions";
import { DeleteButton } from "@/components/ui/DeleteButton";

export const dynamic = 'force-dynamic';

export default async function WorkBreakdownPricingListPage() {
    const breakdowns = await prisma.workBreakdownPricing.findMany({
        include: {
            project: {
                include: {
                    client: true
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    return (
        <div className="space-y-8 max-w-5xl mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-primary/10 pb-8">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
                        Work Breakdown <span className="text-primary">&</span> Pricing
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Commercial Review & Estimation Queue</p>
                </div>
                <Link href="/scope/new">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 h-12 shadow-xl shadow-primary/10 rounded-xl">
                        <Plus className="mr-2 h-5 w-5" /> New Scope Entry
                    </Button>
                </Link>
            </div>

            <div className="grid gap-6">
                {breakdowns.length === 0 ? (
                    <Card className="bg-[#1A1A2E] border-dashed border-white/10">
                        <CardContent className="py-20 text-center text-muted-foreground italic">
                            No pending work breakdowns found in the queue.
                        </CardContent>
                    </Card>
                ) : (
                    breakdowns.map((wbp: any) => (
                        <Card key={wbp.id} className="bg-[#1A1A2E] border-white/5 hover:border-primary/30 transition-all hover:bg-white/[0.02] group shadow-2xl rounded-2xl overflow-hidden">
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row md:items-stretch">
                                    {/* Site Name Identifier (Primary) */}
                                    <div className="bg-white/[0.03] p-8 md:w-1/3 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/5">
                                        <span className="text-[10px] font-black uppercase text-primary tracking-widest block mb-2 opacity-70">Site Identification</span>
                                        <h3 className="text-2xl font-black text-white tracking-widest uppercase italic group-hover:text-primary transition-colors leading-tight">
                                            {wbp.site || 'Project Delta'}
                                        </h3>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Badge variant={wbp.status === 'APPROVED' ? 'default' : 'secondary'} className="rounded-md font-black text-[9px] uppercase tracking-tighter px-2 py-0.5 shadow-lg">
                                                {wbp.status}
                                            </Badge>
                                            {wbp.project?.commercialStatus && (
                                                <Badge className={`rounded-md font-black text-[9px] uppercase tracking-tighter px-2 py-0.5 shadow-lg border-2
                                                    ${wbp.project.commercialStatus === 'EMERGENCY_WORK' ? 'bg-red-500 text-white animate-pulse border-white/50' :
                                                        wbp.project.commercialStatus === 'PO_RECEIVED' ? 'bg-primary/20 text-primary border-primary' :
                                                            'bg-amber-500/20 text-amber-500 border-amber-500'}`}>
                                                    {wbp.project.commercialStatus.replace('_', ' ')}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Metadata & Actions */}
                                    <div className="p-8 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-8">
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground block tracking-widest">Linked Project / Client</span>
                                                <p className="text-sm font-bold text-white uppercase tracking-tight">
                                                    {wbp.project?.name} <span className="text-muted-foreground mx-2">•</span> {wbp.project?.client?.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-primary rounded-full" /> Version {wbp.version}</span>
                                                <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-muted-foreground rounded-full" /> Updated {new Date(wbp.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <Link href={`/work-breakdown-pricing/${wbp.id}`} className="flex-1 sm:flex-none">
                                                <Button className="w-full bg-white/5 hover:bg-white/10 text-white font-black px-6 h-12 rounded-xl transition-all group-hover:bg-primary group-hover:text-primary-foreground border border-white/5 group-hover:border-primary">
                                                    Review & Price <ArrowRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </Link>
                                            <DeleteButton
                                                id={wbp.id}
                                                action={deleteWBPAction}
                                                confirmText="Delete this work breakdown?"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
