const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, companyId: true, role: true }
  });
  console.log('USERS:', users);

  // Check raw postgres queries on public vs throwaway_copy
  try {
    const pubQuotes = await prisma.$queryRawUnsafe(`SELECT id, "companyId", "quoteNumber", type, "clientId", "createdAt" FROM public."Invoice" ORDER BY "createdAt" DESC LIMIT 5`);
    console.log('PUBLIC INVOICES:', pubQuotes);
  } catch (e) {
    console.error('Error querying public Invoice:', e.message);
  }

  try {
    const previewQuotes = await prisma.$queryRawUnsafe(`SELECT id, "companyId", "quoteNumber", type, "clientId", "createdAt" FROM throwaway_copy."Invoice" ORDER BY "createdAt" DESC LIMIT 5`);
    console.log('THROWAWAY_COPY INVOICES:', previewQuotes);
  } catch (e) {
    console.error('Error querying throwaway_copy Invoice:', e.message);
  }

  try {
    const previewClients = await prisma.$queryRawUnsafe(`SELECT id, "companyId", name, "codePrefix" FROM throwaway_copy."Client"`);
    console.log('THROWAWAY_COPY CLIENTS:', previewClients);
  } catch (e) {
    console.error('Error querying throwaway_copy Client:', e.message);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
