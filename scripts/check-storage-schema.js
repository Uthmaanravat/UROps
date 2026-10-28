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
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    try {
        const buckets = await prisma.$queryRawUnsafe('SELECT * FROM storage.buckets');
        console.log('Buckets in storage.buckets:', buckets);
    } catch (e) {
        console.error('Error querying storage.buckets:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
check();
