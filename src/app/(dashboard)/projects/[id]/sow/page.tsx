import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ScopeEditor } from "./ScopeEditor"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function ProjectSOWPage({ params }: { params: { id: string } }) {
    // Cast to any for missing types
    const project = await (prisma as any).project.findUnique({
        where: { id: params.id },
        include: {
            scopes: {
                orderBy: { version: 'desc' },
                include: { items: true },
                take: 1
            }
        }
    })

    if (!project) notFound()

    const latestScope = project.scopes[0]
    const isDraft = !latestScope || latestScope.status === 'DRAFT'

    // Role Simulation (demo purposes)
    const isAdmin = true; // In a real app, this would come from session/context

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href={`/projects/${project.id}`}>
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Scope of Work</h1>
                    <p className="text-muted-foreground text-sm">{project.name}</p>
                </div>
            </div>

            {/* Read-only Summary if Submitted */}
            {!isDraft && latestScope && (
                <div className="space-y-6">
                    <div className={cn(
                        "border rounded-lg p-4 flex items-center gap-2",
                        latestScope.status === 'SUBMITTED' ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-green-50 border-green-200 text-green-800"
                    )}>
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-semibold">
                            {latestScope.status === 'SUBMITTED' ? "SOW Submitted - Requirements Frozen" : `SOW Finalized (Version ${latestScope.version})`}
                        </span>
                    </div>

                    <div className="border rounded-lg bg-card overflow-hidden">
                        <div className="bg-muted/50 p-4 border-b font-semibold grid grid-cols-12 gap-4 text-sm text-muted-foreground uppercase tracking-wider">
                            <div className="col-span-6">Description</div>
                            <div className="col-span-2 text-center">Qty</div>
                            <div className="col-span-2">Unit</div>
                            <div className="col-span-2">Notes</div>
                        </div>
                        <div className="divide-y">
                            {latestScope.items.map((item: any) => (
                                <div key={item.id} className="p-4 grid grid-cols-12 gap-4 text-sm items-center">
                                    <div className="col-span-6 font-medium whitespace-pre-wrap">{item.description}</div>
                                    <div className="col-span-2 text-center bg-gray-50 rounded py-1">{item.quantity}</div>
                                    <div className="col-span-2 text-muted-foreground">{item.unit || '-'}</div>
                                    <div className="col-span-2 text-muted-foreground italic text-xs">{item.notes || '-'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Editor if Draft or New */}
            {isDraft && (
                <ScopeEditor
                    projectId={project.id}
                    initialItems={latestScope?.items.map((i: any) => ({
                        description: i.description,
                        quantity: i.quantity,
                        unit: i.unit,
                        notes: i.notes
                    }))}
                />
            )}
        </div>
    )
}
