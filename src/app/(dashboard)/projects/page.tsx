import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { ProjectDashboardClient } from "@/components/projects/ProjectDashboardClient"

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
    const companyId = await ensureAuth()
    let projects: any[] = []
    let company: any = null

    try {
        company = await prisma.company.findUnique({
            where: { id: companyId }
        })

        projects = await prisma.project.findMany({
            where: { companyId },
            orderBy: { updatedAt: 'desc' },
            include: {
                client: true,
                scopes: {
                    include: {
                        items: {
                            orderBy: { position: 'asc' }
                        }
                    },
                    orderBy: { version: 'desc' },
                    take: 1
                },
                workBreakdowns: {
                    include: {
                        items: {
                            orderBy: { position: 'asc' }
                        }
                    },
                    orderBy: { version: 'desc' },
                    take: 1
                },
                invoices: {
                    select: {
                        id: true,
                        total: true,
                        type: true,
                        status: true,
                        site: true,
                        reference: true,
                        quoteNumber: true,
                        workType: true,
                        tenderId: true,
                        notes: true,
                        items: {
                            select: {
                                description: true,
                                quantity: true,
                                unit: true,
                                unitPrice: true,
                                code: true,
                                area: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            },
            take: 100
        }) || []
    } catch (error) {
        console.error("Error fetching projects:", error)
        projects = []
    }

    return <ProjectDashboardClient projects={projects} company={company} />
}
