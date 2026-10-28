const { PrismaClient } = require('@prisma/client');
const pProd = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public' } }
});
const pThrow = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=throwaway_copy' } }
});

async function checkAll(p, name) {
  console.log(`=== All latest invoices in ${name} ===`);
  const invoices = await p.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { client: true }
  });
  for (const inv of invoices) {
    console.log({
      id: inv.id,
      companyId: inv.companyId,
      number: inv.number,
      quoteNumber: inv.quoteNumber,
      type: inv.type,
      total: inv.total,
      clientName: inv.client?.name || inv.client?.companyName,
      createdAt: inv.createdAt
    });
  }
}

async function main() {
  await checkAll(pProd, 'PRODUCTION (public)');
  await checkAll(pThrow, 'PREVIEW (throwaway_copy)');
}

main().finally(async () => {
  await pProd.$disconnect();
  await pThrow.$disconnect();
});
