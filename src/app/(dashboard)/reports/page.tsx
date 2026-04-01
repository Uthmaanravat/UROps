import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { ReportsList } from "./ReportsList"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
    const companyId = await ensureAuth()
    if (!companyId) redirect('/login')

    const [reports, clients, projects] = await Promise.all([
        prisma.report.findMany({
            where: { companyId },
            include: {
                client: { select: { name: true, companyName: true } },
                project: { select: { name: true } },
                _count: { select: { items: true } }
            },
            orderBy: { date: 'desc' }
        }),
        prisma.client.findMany({
            where: { companyId },
            select: { id: true, name: true }
        }),
        prisma.project.findMany({
            where: { companyId },
            select: { id: true, name: true, clientId: true }
        })
    ])

    return (
        <div className="max-w-7xl mx-auto py-6">
            <ReportsList 
                reports={reports} 
                clients={clients} 
                projects={projects} 
                companyId={companyId} 
            />
        </div>
    )
}
