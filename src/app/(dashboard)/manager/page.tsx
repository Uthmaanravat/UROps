import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PlusCircle, Mic, ListTodo } from "lucide-react"

export default async function ManagerDashboard() {
    const activeProjects = await (prisma as any).project.findMany({
        where: { status: 'IN_PROGRESS' },
        take: 3,
        orderBy: { updatedAt: 'desc' }
    })

    const recentSOWs = await (prisma as any).scopeOfWork.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            project: {
                include: { client: true }
            }
        }
    })

    return (
        <div className="space-y-6 pb-20 max-w-lg mx-auto px-4">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">PM Dashboard</h1>
                <p className="text-muted-foreground">Mobile Scope Entry & Projects</p>
            </div>

            {/* Quick Voice Entry */}
            <Card className="border-lime-500/30 bg-lime-500/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mic className="h-5 w-5 text-lime-500" />
                        Quick Voice Quote
                    </CardTitle>
                    <CardDescription>
                        Record a scope of work to instantly generate a draft quotation for a new client.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/scope/new">
                        <Button className="w-full bg-lime-500 hover:bg-lime-600 text-black font-bold h-12 shadow-lg">
                            Start New Scope Entry
                        </Button>
                    </Link>
                </CardContent>
            </Card>

            {/* Recent Scopes List */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <ListTodo className="h-5 w-5 text-blue-500" />
                    Pending Scopes
                </h2>
                <div className="grid gap-3">
                    {(recentSOWs || []).map((sow: any) => (
                        <Link key={sow.id} href={`/projects/${sow.projectId}/sow`}>
                            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:bg-muted/50 transition-colors">
                                <CardContent className="p-4 flex flex-col gap-1">
                                    <div className="flex justify-between items-center">
                                        <p className="font-bold text-sm">{sow.project?.name}</p>
                                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase">{sow.status}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{sow.project?.client?.name}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                    {(recentSOWs || []).length === 0 && (
                        <p className="text-xs text-center text-muted-foreground py-4 italic">
                            No recent scopes found.
                        </p>
                    )}
                </div>
            </div>

            {/* Bottom Nav Hint (Mobile UI usually handled in layout) */}
        </div>
    )
}
