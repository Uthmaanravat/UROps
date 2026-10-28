const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });
async function main() {
    const templates = await prisma.$queryRawUnsafe(`
        SELECT id, business_id, name, version, is_default, created_at, updated_at
        FROM public.terms_templates
        WHERE business_id = '70af7281-072d-4ed5-9f2e-af4d93e99ea9'
    `);
    console.log('TEMPLATES IN PUBLIC FOR AEROWASH:', templates);
}
main().finally(() => prisma.$disconnect());
