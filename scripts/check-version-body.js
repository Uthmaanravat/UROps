const { PrismaClient } = require('@prisma/client');
const { parseClauses } = require('../src/lib/terms-utils.ts');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public' } }
});
async function run() {
  const versions = await p.termsTemplateVersion.findMany();
  for (const v of versions) {
    console.log('=== VERSION', v.version, v.name, '===');
    const parsed = parseClauses(v.body);
    console.log('Clauses count:', parsed.length);
    parsed.forEach((c, i) => console.log(`${i + 1}: ${c.slice(0, 80)}...`));
  }
}
run().finally(() => p.$disconnect());
