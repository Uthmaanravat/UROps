const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public'
    }
  }
});
async function main() {
  const clients = await p.client.findMany({
    where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' },
    select: { id: true, name: true, defaultTermsTemplateId: true, defaultCustomTerms: true }
  });
  console.log('AeroWash clients:', clients);
}
main().finally(() => p.$disconnect());
