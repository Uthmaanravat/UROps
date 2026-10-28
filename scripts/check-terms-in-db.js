const { PrismaClient } = require('@prisma/client');
const { parseClauses, buildNumberedClauses } = require('../src/lib/terms-utils.ts');
const p = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public'
    }
  }
});
async function main() {
  const allTemplates = await p.termsTemplate.findMany();
  for (const t of allTemplates) {
    const parsed = parseClauses(t.body);
    console.log(`Template "${t.name}" (id: ${t.id}, company: ${t.companyId}): parseClauses count = ${parsed.length}`);
  }
}
main().finally(() => p.$disconnect());
