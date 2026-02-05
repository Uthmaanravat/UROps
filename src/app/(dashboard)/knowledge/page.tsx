import { prisma } from "@/lib/prisma";
import { KnowledgeBaseClient } from "@/components/knowledge/KnowledgeBaseClient";

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
    let items: any[] = [];
    let aiEnabled = true;
    try {
        const settings = await prisma.companySettings.findUnique({ where: { id: "default" } });
        aiEnabled = settings?.aiEnabled ?? true;

        items = await prisma.pricingKnowledge.findMany({
            orderBy: { frequency: 'desc' },
            take: 100
        });
    } catch (e) {
        console.error("Knowledge DB Error:", e);
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <KnowledgeBaseClient historicalItems={items} aiEnabled={aiEnabled} />
        </div>
    )
}
