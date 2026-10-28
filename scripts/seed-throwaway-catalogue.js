const { PrismaClient } = require('@prisma/client');
const { AEROWASH_CATALOGUE_ITEMS, AEROWASH_STANDARD_TERMS_NAME, AEROWASH_STANDARD_TERMS_BODY } = require('../src/lib/aerowash-catalogue.ts');

const AEROWASH_COMPANY_ID = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=throwaway_copy' } }
});

async function main() {
  const existingItems = await p.catalogueItem.findMany({
    where: { companyId: AEROWASH_COMPANY_ID },
    select: { itemNumber: true }
  });
  const existingNumbers = new Set(existingItems.map(i => i.itemNumber));
  const missing = AEROWASH_CATALOGUE_ITEMS.filter(item => !existingNumbers.has(item.itemNumber));

  if (missing.length > 0) {
    await p.catalogueItem.createMany({
      data: missing.map(item => ({
        companyId: AEROWASH_COMPANY_ID,
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
    console.log(`Inserted ${missing.length} missing catalogue items.`);
  }

  // Update terms template body
  await p.termsTemplate.updateMany({
    where: { companyId: AEROWASH_COMPANY_ID },
    data: {
      name: AEROWASH_STANDARD_TERMS_NAME,
      body: AEROWASH_STANDARD_TERMS_BODY,
      isDefault: true
    }
  });

  const count = await p.catalogueItem.count({ where: { companyId: AEROWASH_COMPANY_ID } });
  console.log('Total CatalogueItem count in throwaway_copy:', count);
}
main().finally(() => p.$disconnect());
