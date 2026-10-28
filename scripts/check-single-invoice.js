const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const inv = await prisma.invoice.findUnique({
    where: { id: 'c2a20260-1c46-4e7a-b1b1-35520da9fd31' },
    include: { client: true, items: true }
  });
  console.log('Invoice details:', {
    number: inv.number,
    reference: inv.reference,
    site: inv.site,
    total: inv.total,
    client: inv.client?.name,
    itemCount: inv.items.length,
    metadata: inv.metadata
  });
}

check().finally(() => prisma.$disconnect());
