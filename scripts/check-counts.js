const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=throwaway_copy'
    }
  }
});
async function main() {
  const aeroCount = await p.catalogueItem.count({ where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' } });
  const items = await p.catalogueItem.findMany({ 
    where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' },
    orderBy: { itemNumber: 'asc' }
  });
  console.log('AeroWash Catalogue items count:', aeroCount);
  console.log(items.map(i => `${i.itemNumber}: ${i.name} [${i.category}]`));
}
main().finally(() => p.$disconnect());
