const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public'
    }
  }
});
async function main() {
  const templates = await p.termsTemplate.findMany({
    where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' }
  });
  console.log('Production AeroWash templates count:', templates.length);
  for (const t of templates) {
    console.log(`\n=== Template: ${t.name} (id: ${t.id}, isDefault: ${t.isDefault}) ===`);
    console.log(t.body);
  }
}
main().finally(() => p.$disconnect());
