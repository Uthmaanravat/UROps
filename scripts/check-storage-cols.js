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
        const cols = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema = 'storage' AND table_name = 'buckets'
        `);
        console.log('Columns in storage.buckets:', cols);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
check();
