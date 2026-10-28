const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const templates = await prisma.termsTemplate.findMany();
  console.log(`Found ${templates.length} terms templates:`);
  templates.forEach(t => {
    console.log(`- ID: ${t.id}, name: ${t.name}, companyId: ${t.companyId}, isDefault: ${t.isDefault}`);
    console.log(`  body length: ${t.body?.length}, preview: ${t.body?.substring(0, 80).replace(/\n/g, ' ')}...`);
  });
}

check().finally(() => prisma.$disconnect());
