const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['\"]|['\"]$/g, '');
}
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });
async function main() {
    const versions = await prisma.$queryRawUnsafe(`
        SELECT id, template_id, version, name, created_at 
        FROM public.terms_template_versions 
        WHERE template_id = '8edfe964-2790-4ef8-8486-3e56179a8008'
        ORDER BY version ASC
    `);
    console.log('VERSIONS IN PUBLIC:', versions);
}
main().finally(() => prisma.$disconnect());
