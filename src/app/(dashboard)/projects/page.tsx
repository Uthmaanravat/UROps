import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { ProjectDashboardClient } from "@/components/projects/ProjectDashboardClient"

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
                    },
                    orderBy: { createdAt: 'desc' }
                }
            },
            take: 50
        }) || []
    } catch (error) {
        console.error("Error fetching projects:", error)
        projects = []
    }

    return <ProjectDashboardClient projects={projects} />
}
