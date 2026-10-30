import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { ProjectDashboardClient } from "@/components/projects/ProjectDashboardClient"
import { enrichAeroWashProjectsWithWeather, isAeroWashCompany } from "@/lib/weather-alerts"

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
    const companyId = await ensureAuth()
    let projects: any[] = []
    let company: any = null
    let clients: any[] = []
    let isTendersEnabled = false
    let isReactiveEnabled = false
    let quotes: any[] = []
    let prospects: any[] = []

    try {
        company = await prisma.company.findUnique({
            where: { id: companyId },
            include: { settings: true }
        })

        isTendersEnabled = company?.settings?.tendersEnabled === true
        isReactiveEnabled = (company?.settings as any)?.reactiveEnabled ?? (companyId === '299c43ec-9578-4c45-91cb-a881a539e25d')

        const [fetchedProjects, fetchedClients, fetchedQuotes, fetchedProspects] = await Promise.all([
            prisma.project.findMany({
                where: {
                    companyId,
                    ...(isTendersEnabled ? {} : { workType: { not: 'TENDER' } })
                },
                orderBy: { updatedAt: 'desc' },
                include: {
                    client: true,
                    parentProject: true,
                    recurringVisits: {
                        orderBy: { startDate: 'asc' }
                    },
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
                            clientPoNumber: true,
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
                take: 200
            }),
            prisma.client.findMany({
                where: { companyId },
                select: { id: true, name: true, companyName: true, phone: true, address: true },
                orderBy: { name: 'asc' }
            }),
            prisma.invoice.findMany({
                where: { companyId, type: 'QUOTE' },
                select: {
                    id: true,
                    quoteNumber: true,
                    total: true,
                    date: true,
                    status: true,
                    site: true,
                    client: { select: { name: true } }
                },
                orderBy: { date: 'desc' },
                take: 50
            }),
            prisma.prospect.findMany({
                where: { companyId, nextFollowupDate: { not: null } },
                select: {
                    id: true,
                    name: true,
                    location: true,
                    nextFollowupDate: true,
                    status: true,
                    propertyManagerName: true,
                    propertyManagerPhone: true
                },
                orderBy: { nextFollowupDate: 'asc' }
            })
        ])

        projects = fetchedProjects || []
        clients = fetchedClients || []
        quotes = fetchedQuotes || []
        prospects = fetchedProspects || []
    } catch (error) {
        console.warn("Retrying projects fetch with fallback include (pre-migration compatibility):", error)
        try {
            const [fallbackProjects, fetchedClients, fetchedQuotes, fetchedProspects] = await Promise.all([
                prisma.project.findMany({
                    where: {
                        companyId,
                        ...(isTendersEnabled ? {} : { workType: { not: 'TENDER' } })
                    },
                    orderBy: { updatedAt: 'desc' },
                    include: {
                        client: true,
                        scopes: {
                            include: { items: { orderBy: { position: 'asc' } } },
                            orderBy: { version: 'desc' },
                            take: 1
                        },
                        workBreakdowns: {
                            include: { items: { orderBy: { position: 'asc' } } },
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
                                clientPoNumber: true,
                                quoteNumber: true,
                                workType: true,
                                tenderId: true,
                                notes: true
                            },
                            orderBy: { createdAt: 'desc' }
                        }
                    },
                    take: 200
                }),
                prisma.client.findMany({
                    where: { companyId },
                    select: { id: true, name: true, companyName: true, phone: true, address: true },
                    orderBy: { name: 'asc' }
                }),
                prisma.invoice.findMany({
                    where: { companyId, type: 'QUOTE' },
                    select: { id: true, quoteNumber: true, total: true, date: true, status: true, site: true, client: { select: { name: true } } },
                    orderBy: { date: 'desc' },
                    take: 50
                }),
                prisma.prospect.findMany({
                    where: { companyId, nextFollowupDate: { not: null } },
                    select: { id: true, name: true, location: true, nextFollowupDate: true, status: true, propertyManagerName: true, propertyManagerPhone: true },
                    orderBy: { nextFollowupDate: 'asc' }
                })
            ])
            projects = fallbackProjects || []
            clients = fetchedClients || []
            quotes = fetchedQuotes || []
            prospects = fetchedProspects || []
        } catch (innerErr) {
            console.error("Critical projects fetch failure:", innerErr)
            projects = []
        }
    }

    // Enrich AeroWash projects with Open-Meteo site forecasts
    if (isAeroWashCompany(companyId, company?.settings)) {
        projects = await enrichAeroWashProjectsWithWeather(projects, company?.settings as any, companyId)
    }

    return (
        <ProjectDashboardClient
            projects={projects}
            company={company}
            tendersEnabled={isTendersEnabled}
            reactiveEnabled={isReactiveEnabled}
            clients={clients}
            quotes={quotes}
            prospects={prospects}
        />
    )
}
