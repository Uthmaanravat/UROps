import { prisma } from "@/lib/prisma";
import { KnowledgeBaseClient } from "@/components/knowledge/KnowledgeBaseClient";
import { ensureAuth } from "@/lib/auth-actions";

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
    const companyId = await ensureAuth();
    let items: any[] = [];
    let aiEnabled = true;
    let clients: any[] = [];
    try {
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        aiEnabled = settings?.aiEnabled ?? true;

        items = await prisma.pricingKnowledge.findMany({
            where: { companyId },
            orderBy: { frequency: 'desc' },
            take: 100
        });

        clients = await prisma.client.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
            select: { id: true, name: true }
        });
    } catch (e) {
        console.error("Knowledge DB Error:", e);
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <KnowledgeBaseClient historicalItems={items} aiEnabled={aiEnabled} clients={clients} />
        </div>
    )
}

