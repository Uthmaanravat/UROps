const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const s = await prisma.companySettings.findUnique({
    where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' }
  });
  console.log('logoUrl start:', s?.logoUrl?.substring(0, 100));
  console.log('logoUrl length:', s?.logoUrl?.length);
  console.log('layoutPreferences:', JSON.stringify(s?.layoutPreferences, null, 2));
}

run().finally(() => prisma.$disconnect());
