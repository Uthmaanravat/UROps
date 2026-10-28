const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const awQuotes = await prisma.invoice.findMany({
    where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`AeroWash has ${awQuotes.length} quotes/invoices in public:`);
  awQuotes.forEach(q => console.log(`  - number: ${q.number}, id: ${q.id}, type: ${q.type}, site: ${q.site}, created: ${q.createdAt}`));

  const lrQuotes = await prisma.invoice.findMany({
    where: { companyId: '299c43ec-9578-4c45-91cb-a881a539e25d', type: 'QUOTE' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(`Latest 5 LR Builders quotes in public:`);
  lrQuotes.forEach(q => console.log(`  - number: ${q.number}, id: ${q.id}, site: ${q.site}, created: ${q.createdAt}`));
}

check().finally(() => prisma.$disconnect());
