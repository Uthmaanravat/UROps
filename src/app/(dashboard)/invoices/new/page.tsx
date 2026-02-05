import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
import { QuoteForm } from "@/components/invoices/QuoteForm";

export default async function NewQuotePage({
    searchParams
}: {
    searchParams: { clientId?: string; projectId?: string; scope?: string }
}) {
    const [clients, projects, settings] = await Promise.all([
        prisma.client.findMany({ orderBy: { name: 'asc' } }),
        (prisma as any).project.findMany({
            where: { status: { not: 'COMPLETED' } },
            orderBy: { name: 'asc' }
        }),
        prisma.companySettings.findUnique({ where: { id: "default" } })
    ]);

    const aiEnabled = settings?.aiEnabled ?? true;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Create New Quote</h1>
            <QuoteForm
                clients={clients}
                projects={projects}
                initialClientId={searchParams.clientId}
                initialProjectId={searchParams.projectId}
                initialScope={searchParams.scope}
                aiEnabled={aiEnabled}
            />
        </div>
    )
}
