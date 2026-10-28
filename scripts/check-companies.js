const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const companies = await p.company.findMany({ include: { settings: true } });
  console.log('Companies:', companies.map(c => ({ 
    id: c.id, 
    name: c.name, 
    theme: c.settings?.theme, 
    tendersEnabled: c.settings?.tendersEnabled,
    taxId: c.settings?.taxId,
    vatRegistrationDate: c.settings?.vatRegistrationDate
  })));
}
main().finally(() => p.$disconnect());
