const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Query public invoices
  const invoices = await prisma.$queryRaw`
    SELECT id, number, type, "companyId", "createdAt", reference, site
    FROM "public"."Invoice"
    ORDER BY "createdAt" DESC;
  `;
  console.log('Production public.Invoice count:', invoices.length);
  console.log('Production invoices:', invoices);

  // Check sequences
  const sequences = await prisma.$queryRaw`
    SELECT sequence_name, last_value FROM information_schema.sequences;
  `;
  console.log('Sequences in DB:', sequences);

  // Check company settings for number counters
  const companySettings = await prisma.$queryRaw`
    SELECT "companyId", "quoteSequence", "invoiceSequence" FROM "public"."CompanySettings"
    WHERE "companyId" IN ('70af7281-072d-4ed5-9f2e-af4d93e99ea9', '299c43ec-9578-4c45-91cb-a881a539e25d');
  `;
  console.log('CompanySettings sequences:', companySettings);
}

check().catch(console.error).finally(() => prisma.$disconnect());
