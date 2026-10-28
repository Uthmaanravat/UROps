const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public' } }
});
async function run() {
  const versions = await p.termsTemplateVersion.findMany();
  for (const v of versions) {
    console.log(v.body);
  }
}
run().finally(() => p.$disconnect());
