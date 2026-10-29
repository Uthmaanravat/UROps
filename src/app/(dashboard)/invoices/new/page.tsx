import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
import { QuoteForm } from "@/components/invoices/QuoteForm";
import { ensureAuth, getAuthUser } from "@/lib/auth-actions";
import { ensureAeroWashCatalogueAndTerms } from "@/lib/aerowash-catalogue-seed";

export default async function NewQuotePage({
    searchParams
}: {
    searchParams: { clientId?: string; projectId?: string; scope?: string; type?: string; tenderId?: string; site?: string; prospectId?: string }
}) {
    const companyId = await ensureAuth();
    const authUser = await getAuthUser();
    await ensureAeroWashCatalogueAndTerms(companyId);

    const [clients, projects, settings, tenders, termsTemplates, catalogueItems] = await Promise.all([
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
        }),
        (prisma as any).catalogueItem.findMany({
            where: { companyId },
            orderBy: { itemNumber: 'asc' }
        }).catch(() => [])
    ]);

    const isTendersEnabled = settings?.tendersEnabled === true;
    const aiEnabled = settings?.aiEnabled ?? true;
    const isInvoice = searchParams.type === 'INVOICE';
    const isAeroWashWorkspace = companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' || settings?.theme === 'dark-orange';

    return (
        <div className={isAeroWashWorkspace ? "w-full max-w-full px-4 sm:px-6 lg:px-8 space-y-6" : "max-w-7xl mx-auto space-y-6"}>
            <h1 className="text-2xl font-bold">{isInvoice ? 'Create New Invoice' : 'Create New Quote'}</h1>
            <QuoteForm
                clients={clients as any}
                projects={projects}
                tenders={isTendersEnabled ? tenders : []}
                tendersEnabled={isTendersEnabled}
                termsTemplates={termsTemplates}
                initialClientId={searchParams.clientId}
                initialProjectId={searchParams.projectId}
                initialScope={searchParams.scope}
                initialType={isInvoice ? 'INVOICE' : 'QUOTE'}
                initialTenderId={isTendersEnabled ? searchParams.tenderId : undefined}
                initialSite={searchParams.site}
                initialProspectId={searchParams.prospectId}
                aiEnabled={aiEnabled}
                isAeroWashWorkspace={isAeroWashWorkspace}
                surveyCameraEnabled={(settings as any)?.surveyCameraEnabled ?? false}
                thermalCameraEnabled={(settings as any)?.thermalCameraEnabled ?? false}
                companySettings={settings}
                hasVatRegistration={!!settings?.taxId && settings.taxId.trim() !== ''}
                catalogueItems={catalogueItems}
                isAdmin={authUser?.role === 'ADMIN'}
                currentUserEmail={authUser?.email || ''}
                isOwner={Boolean(authUser?.isOwner)}
            />
        </div>
    )
}
