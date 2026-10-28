const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function check() {
    const url = new URL(directUrl);
    url.searchParams.set('schema', 'throwaway_copy');
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    try {
        const count = await prisma.catalogueItem.count();
        console.log('throwaway_copy CatalogueItem count:', count);
    } catch (e) {
        console.error('Error on throwaway_copy:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
check();
