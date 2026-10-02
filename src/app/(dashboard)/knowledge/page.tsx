import { prisma } from "@/lib/prisma";
import { KnowledgeBaseClient } from "@/components/knowledge/KnowledgeBaseClient";
import { ensureAuth } from "@/lib/auth-actions";

export const dynamic = 'force-dynamic';

export default async function KnowledgePage({
    searchParams
}: {
    searchParams?: { filter?: string; tab?: string }
}) {
    const companyId = await ensureAuth();
    let items: any[] = [];
    let aiEnabled = true;
    let clients: any[] = [];
    let tenders: any[] = [];

    try {
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        aiEnabled = settings?.aiEnabled ?? true;

        const [historyData, clientsData, tendersData] = await Promise.all([
            prisma.pricingKnowledge.findMany({
                where: { companyId },
                orderBy: { frequency: 'desc' },
                take: 100
            }),
            prisma.client.findMany({
                where: { companyId },
                orderBy: { name: 'asc' },
                select: { id: true, name: true }
            }),
            prisma.tender.findMany({
                where: { companyId },
                orderBy: { createdAt: 'asc' },
                select: { id: true, name: true, tenderNumber: true }
            })
        ]);

        items = historyData;
        clients = clientsData;
        tenders = tendersData;
    } catch (e) {
        console.error("Knowledge DB Error:", e);
    }

    const initialTab = searchParams?.filter === 'tender' || searchParams?.tab === 'fixed' ? 'fixed' : 'historical';
    const initialScope = searchParams?.filter === 'tender' ? 'tender' : 'all';

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <KnowledgeBaseClient 
                historicalItems={items} 
                aiEnabled={aiEnabled} 
                clients={clients}
                tenders={tenders}
                initialTab={initialTab}
                initialScope={initialScope}
            />
        </div>
    );
}
