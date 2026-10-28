const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, number: true, companyId: true, metadata: true }
  });
  let withMeta = 0;
  invoices.forEach(inv => {
    if (inv.metadata && Object.keys(inv.metadata).length > 0) {
      withMeta++;
      console.log(`Invoice ${inv.number}: keys =`, Object.keys(inv.metadata));
      if (inv.metadata.siteVisitPhotos) {
        console.log(`  siteVisitPhotos length:`, inv.metadata.siteVisitPhotos.length);
      }
    }
  });
  console.log(`Total invoices with metadata: ${withMeta}`);
}

check().finally(() => prisma.$disconnect());
