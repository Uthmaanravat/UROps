const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : 'none');
  
  const settings = await prisma.companySettings.findMany();
  console.log('companySettings:', settings.map(s => ({ companyId: s.companyId, name: s.name, quotationValidityDays: s.quotationValidityDays })));

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, companyId: true, codePrefix: true, lastQuoteNumber: true }
  });
  console.log('Clients count:', clients.length);
  for (const c of clients) {
    console.log(`- ${c.name} (id: ${c.id}, company: ${c.companyId}, prefix: ${c.codePrefix}, lastQuote: ${c.lastQuoteNumber})`);
  }

  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, quoteNumber: true, type: true, companyId: true, clientId: true, createdAt: true, metadata: true }
  });
  console.log('Recent 10 invoices/quotes:');
  for (const inv of invoices) {
    console.log(`- [${inv.type}] ${inv.quoteNumber} (id: ${inv.id}, company: ${inv.companyId}, created: ${inv.createdAt.toISOString()})`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
