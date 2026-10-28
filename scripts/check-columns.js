const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=throwaway_copy' } }
});
async function check() {
  const cols = await p.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema = 'throwaway_copy' AND table_name = 'CompanySettings' ORDER BY column_name;`;
  console.log('CompanySettings columns in throwaway_copy:', cols.map(c => c.column_name));
}
check().finally(() => p.$disconnect());
