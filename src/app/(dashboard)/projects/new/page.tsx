import { prisma } from "@/lib/prisma"
import { ProjectForm } from "@/components/projects/ProjectForm"

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
    const clients = await prisma.client.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true }
    })

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">New Project</h1>
                <p className="text-muted-foreground">Start a new project for a client.</p>
            </div>

            <ProjectForm clients={clients} />
        </div>
    )
}
