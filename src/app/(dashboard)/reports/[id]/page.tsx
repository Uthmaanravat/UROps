import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { ReportEditor } from "./ReportEditor"
import { redirect, notFound } from "next/navigation"



export default async function ReportDetailPage({ params }: { params: { id: string } }) {
    const companyId = await ensureAuth()
    if (!companyId) redirect('/login')

    const [report, settings, clients, projects] = await Promise.all([
        prisma.report.findUnique({
            where: { id: params.id },
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
    if (report.companyId !== companyId) redirect('/reports')

    const company = {
        name: settings?.name || "LR Builders & Maintenance Pty (Ltd)",
        address: settings?.address || "15 Culemborg Street, Avondale, Parow, Cape Town, 7500",
        email: settings?.email || "Loedvi@lrbuilders.co.za",
        phone: settings?.phone || "082 448 7490",
        logoUrl: settings?.logoUrl || "",
        slogan: settings?.slogan || "",
        vatNumber: settings?.taxId || "", // Fixed mapping from schema taxId
        layoutPreferences: settings?.layoutPreferences
    }

    const serializedReport = JSON.parse(JSON.stringify(report));
    serializedReport.items = serializedReport.items || [];

    return (
        <div className="max-w-5xl mx-auto py-6">
            <ReportEditor 
                report={serializedReport} 
                company={company} 
                clients={clients || []} 
                projects={projects || []} 
            />
        </div>
    )
}
