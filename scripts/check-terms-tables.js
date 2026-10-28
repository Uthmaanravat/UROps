const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['\"]|['\"]$/g, '');
}
const url = new URL(directUrl);
url.searchParams.set('schema', 'throwaway_copy');
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

async function main() {
    const tables = await prisma.$queryRawUnsafe(`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name ILIKE '%term%'
    `);
    console.log('TABLES:', tables);
}
main().finally(() => prisma.$disconnect());
