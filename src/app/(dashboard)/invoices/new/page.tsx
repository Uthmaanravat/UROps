import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
import { QuoteForm } from "@/components/invoices/QuoteForm";
import { ensureAuth } from "@/lib/auth-actions";

export default async function NewQuotePage({
    searchParams
}: {
    searchParams: { clientId?: string; projectId?: string; scope?: string; type?: string; tenderId?: string }
}) {
    const companyId = await ensureAuth();

    const [clients, projects, settings, tenders, termsTemplates] = await Promise.all([
        prisma.client.findMany({
            where: { companyId },
            include: { contacts: true, defaultTermsTemplate: true },
            orderBy: { name: 'asc' }
        }),
        (prisma as any).project.findMany({
            where: { companyId, status: { not: 'COMPLETED' } },
            orderBy: { name: 'asc' }
        }),
        prisma.companySettings.findUnique({ where: { companyId } }),
        prisma.tender.findMany({
            where: { companyId, status: 'ACTIVE' },
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

    const aiEnabled = settings?.aiEnabled ?? true;
    const isInvoice = searchParams.type === 'INVOICE';

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">{isInvoice ? 'Create New Invoice' : 'Create New Quote'}</h1>
            <QuoteForm
                clients={clients as any}
                projects={projects}
                tenders={tenders}
                termsTemplates={termsTemplates}
                initialClientId={searchParams.clientId}
                initialProjectId={searchParams.projectId}
                initialScope={searchParams.scope}
                initialType={isInvoice ? 'INVOICE' : 'QUOTE'}
                initialTenderId={searchParams.tenderId}
                aiEnabled={aiEnabled}
            />
        </div>
    )
}
