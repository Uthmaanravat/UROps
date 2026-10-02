import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
import { QuoteForm } from "@/components/invoices/QuoteForm";

export default async function NewQuotePage({
    searchParams
}: {
    searchParams: { clientId?: string; projectId?: string; scope?: string; type?: string; tenderId?: string }
}) {
    const [clients, projects, settings, tenders] = await Promise.all([
        prisma.client.findMany({
            include: { contacts: true },
            orderBy: { name: 'asc' }
        }),
        (prisma as any).project.findMany({
            where: { status: { not: 'COMPLETED' } },
            orderBy: { name: 'asc' }
        }),
        prisma.companySettings.findUnique({ where: { id: "default" } }),
        prisma.tender.findMany({
            where: { status: 'ACTIVE' },
            include: { client: true },
            orderBy: { createdAt: 'asc' }
        })
    ]);

    const aiEnabled = settings?.aiEnabled ?? true;
    const isInvoice = searchParams.type === 'INVOICE';

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">{isInvoice ? 'Create New Invoice' : 'Create New Quote'}</h1>
            <QuoteForm
                clients={clients}
                projects={projects}
                tenders={tenders}
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
