const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function inspect(schema) {
    const url = new URL(directUrl);
    url.searchParams.set('schema', schema);
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    try {
        const items = await prisma.catalogueItem.findMany({
            where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' },
            orderBy: { itemNumber: 'asc' }
        });
        console.log(`Schema [${schema}] CatalogueItem count: ${items.length}`);
        const item23 = items.find(i => i.itemNumber === 23);
        console.log(`Item 23 in [${schema}]:`, item23);
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    await inspect('throwaway_copy');
    await inspect('public');
}

main().catch(console.error);
