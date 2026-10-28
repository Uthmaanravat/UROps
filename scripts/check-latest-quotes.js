const { PrismaClient } = require('@prisma/client');
const pProd = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public' } }
});
const pThrow = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=throwaway_copy' } }
});

async function check(p, name) {
  console.log(`=== Checking ${name} ===`);
  const invoices = await p.invoice.findMany({
    where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { client: true, items: true }
  });
  console.log(`Found ${invoices.length} AeroWash invoices/quotes:`);
  for (const inv of invoices) {
    console.log({
      id: inv.id,
      number: inv.number,
      quoteNumber: inv.quoteNumber,
      type: inv.type,
      total: inv.total,
      clientName: inv.client?.name || inv.client?.companyName,
      createdAt: inv.createdAt,
      itemsCount: inv.items?.length,
      hasMetadata: Boolean(inv.metadata),
      metadataKeys: inv.metadata ? Object.keys(inv.metadata) : []
    });
  }
}

async function main() {
  await check(pProd, 'PRODUCTION (public)');
  await check(pThrow, 'PREVIEW (throwaway_copy)');
}

main().finally(async () => {
  await pProd.$disconnect();
  await pThrow.$disconnect();
});
