import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { ReportEditor } from "./ReportEditor"
import { redirect, notFound } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function ReportDetailPage({ params }: { params: { id: string } }) {
    const companyId = await ensureAuth()
    if (!companyId) redirect('/login')

    const [report, settings, clients, projects] = await Promise.all([
        prisma.report.findFirst({
            where: { id: params.id, companyId },
            include: {
                client: true,
                project: true,
                items: {
                    orderBy: [
                        { order: 'asc' },
                        { createdAt: 'asc' }
                    ]
                }
            }
        }),
        prisma.companySettings.findUnique({
            where: { companyId }
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

    if (!report) notFound()

    const company = {
        name: settings?.name || "Company",
        address: settings?.address || "",
        email: settings?.email || "",
        phone: settings?.phone || "",
        logoUrl: settings?.logoUrl || "",
        slogan: settings?.slogan || "",
        vatNumber: settings?.taxId || "",
        layoutPreferences: settings?.layoutPreferences
    }

    const serializedReport = JSON.parse(JSON.stringify(report));
    serializedReport.items = serializedReport.items || [];

    return (
        <div className="space-y-6">
            <ReportEditor
                report={serializedReport}
                company={company}
                clients={clients}
                projects={projects}
            />
        </div>
    )
}
