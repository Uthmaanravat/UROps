import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ScopeEditor } from "./ScopeEditor"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { SOWChecklistButton } from "./SOWChecklistButton"
import { unlockSOWAction } from "./actions"

export const dynamic = 'force-dynamic'

export default async function ProjectSOWPage({ params }: { params: { id: string } }) {
    // Cast to any for missing types
    const project = await (prisma as any).project.findUnique({
        where: { id: params.id },
        include: {
            client: true,
            scopes: {
                orderBy: { version: 'desc' },
                include: {
                    items: {
                        orderBy: { position: 'asc' }
                    }
                },
                take: 1
            }
        }
    })

    if (!project) notFound()

    const settings = await prisma.companySettings.findUnique({
        where: { companyId: project.companyId }
    })

    const latestScope = project.scopes[0]
    const isDraft = !latestScope || latestScope.status === 'DRAFT'

    // Role Simulation (demo purposes)
    const isAdmin = true; // In a real app, this would come from session/context

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/projects/${project.id}`}>
                        <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Scope of Work</h1>
                        <p className="text-muted-foreground text-sm">{project.name}</p>
                    </div>
                </div>
                {!isDraft && latestScope && (
                    <SOWChecklistButton 
                        project={project as any} 
                        latestScope={latestScope as any} 
                        settings={settings} 
                    />
                )}
            </div>

            {!isDraft && latestScope && (
                <div className="space-y-6">
                    <div className={cn(
                        "border rounded-lg p-4 flex items-center justify-between gap-4",
                        latestScope.status === 'SUBMITTED' ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-green-50 border-green-200 text-green-800"
                    )}>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-semibold">
                                {latestScope.status === 'SUBMITTED' ? "SOW Submitted - Requirements Frozen" : `SOW Finalized (Version ${latestScope.version})`}
                            </span>
                        </div>
                        <form action={async () => {
                            'use server'
                            await unlockSOWAction(latestScope.id, project.id)
                        }}>
                            <Button type="submit" variant="outline" className="border-red-500/20 text-red-600 hover:bg-red-500/10 font-bold uppercase tracking-widest text-[10px] h-10 px-4 rounded-xl">
                                Unlock SOW
                            </Button>
                        </form>
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
                    project={project as any}
                    initialItems={latestScope?.items.map((i: any) => ({
                        area: i.area,
                        description: i.description,
                        quantity: i.quantity,
                        unit: i.unit,
                        notes: i.notes
                    }))}
                    settings={settings}
                />
            )}
        </div>
    )
}
