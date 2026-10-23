import { prisma } from "@/lib/prisma";
import { InvoiceViewer } from "@/components/invoices/InvoiceViewer";
import { getCompanySettings } from "@/app/(dashboard)/settings/actions";
import { notFound } from "next/navigation";
import { ensureAuth } from "@/lib/auth-actions";

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
    const companyId = await ensureAuth();
    const supabase = (await import("@/lib/supabase/server")).createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const dbUser = user ? await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } }) : null;
    const isAdmin = dbUser?.role === 'ADMIN';

    const [invoice, companySettings, projects, tenders, termsTemplates] = await Promise.all([
        prisma.invoice.findFirst({
            where: { id: params.id, companyId },
            include: {
                client: {
                    include: {
                        contacts: true
                    }
                },
                items: {
                    orderBy: { position: 'asc' }
                },
                payments: true,
                tender: true,
                creditNotes: {
                    orderBy: { createdAt: 'desc' }
                },
                unlockLogs: {
                    orderBy: { createdAt: 'desc' }
                },
                terms: {
                    orderBy: { position: 'asc' },
                    include: { template: true }
                },
                project: {
                    include: {
                        invoices: {
                            select: { id: true, number: true, quoteNumber: true, type: true, status: true, date: true }
                        }
                    }
                }
            } as any
        }),
        getCompanySettings(),
        prisma.project.findMany({
            where: { companyId },
            orderBy: { name: 'asc' }
        }),
        prisma.tender.findMany({
            where: { companyId },
            include: { client: true },
            orderBy: { createdAt: 'asc' }
        }),
        prisma.termsTemplate.findMany({
            where: { companyId },
            orderBy: [
                { isDefault: 'desc' },
                { name: 'asc' }
            ]
        })
    ]);

    if (!invoice) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <InvoiceViewer
                invoice={invoice}
                companySettings={companySettings}
                availableProjects={projects as any[]}
                tenders={tenders as any[]}
                termsTemplates={termsTemplates as any[]}
                isAdmin={isAdmin}
            />
        </div>
    )
}
