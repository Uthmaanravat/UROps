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
    include: { company: { select: { id: true, name: true } } }
  });
  console.log('All templates in public:', templates.length);
  for (const t of templates) {
    const lines = t.body.split('\n').filter(l => l.trim().length > 0);
    console.log(`- [${t.company?.name}] "${t.name}" (id: ${t.id}, isDefault: ${t.isDefault}): ${lines.length} lines`);
  }
}
main().finally(() => p.$disconnect());
