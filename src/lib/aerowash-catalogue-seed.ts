import { prisma } from "@/lib/prisma"
import {
    AEROWASH_CATALOGUE_ITEMS,
    AEROWASH_STANDARD_TERMS_NAME,
    AEROWASH_STANDARD_TERMS_BODY
} from "@/lib/aerowash-catalogue"

export const AEROWASH_COMPANY_ID = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';

/**
 * Idempotently ensures AeroWash has its 20 catalogue items seeded in CatalogueItem
 * and the AeroWash Standard Terms seeded in TermsTemplate.
 */
export async function ensureAeroWashCatalogueAndTerms(companyId: string) {
    if (companyId !== AEROWASH_COMPANY_ID) {
        return;
    }

    try {
        // 1. Check CatalogueItem table (with defensive fallback if table not yet created on public)
        const existingItems = await (prisma as any).catalogueItem.findMany({
            where: { companyId },
            select: { itemNumber: true }
        }).catch(() => null);

        if (existingItems !== null) {
            const existingNumbers = new Set<number>(existingItems.map((i: any) => i.itemNumber));
            const missing = AEROWASH_CATALOGUE_ITEMS.filter(item => !existingNumbers.has(item.itemNumber));

            if (missing.length > 0) {
                await (prisma as any).catalogueItem.createMany({
                    data: missing.map(item => ({
                        companyId,
                        itemNumber: item.itemNumber,
                        name: item.name,
                        clientDescription: item.clientDescription,
                        category: item.category,
                        pricingMethod: item.pricingMethod,
                        internalNotes: item.internalNotes || null,
                        isActive: true,
                        metadata: {
                            isProvisional: item.isProvisional || false,
                            requiresElevation: item.requiresElevation || false,
                            requiresSiteVisitDone: item.requiresSiteVisitDone || false,
                            requiresContractorSpec: item.requiresContractorSpec || false,
                            settingsKeyRequired: item.settingsKeyRequired || null
                        }
                    }))
                });
            }
        }
    } catch (e) {
        console.warn('CatalogueItem seeding deferred (table may await production migration):', e);
    }

    try {
        // 2. Ensure AeroWash Standard Quotation Terms template exists
        const existingTemplate = await prisma.termsTemplate.findFirst({
            where: {
                companyId,
                name: AEROWASH_STANDARD_TERMS_NAME
            }
        });

        if (!existingTemplate) {
            await prisma.termsTemplate.create({
                data: {
                    companyId,
                    name: AEROWASH_STANDARD_TERMS_NAME,
                    body: AEROWASH_STANDARD_TERMS_BODY,
                    isDefault: true,
                    version: 1,
                    versions: {
                        create: {
                            version: 1,
                            name: AEROWASH_STANDARD_TERMS_NAME,
                            body: AEROWASH_STANDARD_TERMS_BODY
                        }
                    }
                }
            });
        }
    } catch (e) {
        console.warn('TermsTemplate seeding error:', e);
    }
}
