const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCreate() {
  const companyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9'; // AeroWash
  console.log('Testing company:', companyId);

  const settings = await prisma.companySettings.findUnique({ where: { companyId } });
  console.log('Settings found:', Boolean(settings), settings?.name);

  // Check clients for this company
  let client = await prisma.client.findFirst({ where: { companyId } });
  console.log('AeroWash client in public:', client);

  // If no client, check if there's any client in throwaway_copy
  const previewClients = await prisma.$queryRawUnsafe(`SELECT * FROM throwaway_copy."Client" WHERE "companyId" = $1`, companyId);
  console.log('AeroWash clients in throwaway_copy:', previewClients.map(c => ({ id: c.id, name: c.name })));
}

testCreate().catch(console.error).finally(() => prisma.$disconnect());
