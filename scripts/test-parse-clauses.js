const { PrismaClient } = require('@prisma/client');
const { parseClauses } = require('../src/lib/terms-utils.ts');
const p = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public'
    }
  }
});
async function main() {
  const t = await p.termsTemplate.findFirst({
    where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' }
  });
  console.log('Raw body:\n', JSON.stringify(t.body));
  const clauses = parseClauses(t.body);
  console.log('\nParsed clauses count:', clauses.length);
  clauses.forEach((c, i) => console.log(`${i + 1}: ${c}`));
}
main().finally(() => p.$disconnect());
