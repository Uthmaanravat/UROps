const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=throwaway_copy' } }
});
async function migrate() {
  await p.$executeRawUnsafe(`ALTER TABLE "throwaway_copy"."CompanySettings" ADD COLUMN IF NOT EXISTS "justificationEnabled" BOOLEAN NOT NULL DEFAULT true;`);
  await p.$executeRawUnsafe(`UPDATE "throwaway_copy"."CompanySettings" SET "justificationEnabled" = false WHERE "companyId" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';`);
  const settings = await p.$queryRawUnsafe(`SELECT "companyId", "justificationEnabled" FROM "throwaway_copy"."CompanySettings";`);
  console.log('throwaway_copy CompanySettings justificationEnabled:', settings);
}
migrate().finally(() => p.$disconnect());
