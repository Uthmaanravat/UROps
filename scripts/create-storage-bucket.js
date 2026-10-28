const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function createBucketSql() {
    const url = new URL(directUrl);
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    try {
        console.log('Inserting quotation-photos into storage.buckets...');
        await prisma.$executeRawUnsafe(`
            INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
            VALUES ('quotation-photos', 'quotation-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
            ON CONFLICT (id) DO NOTHING;
        `);
        const buckets = await prisma.$queryRawUnsafe('SELECT * FROM storage.buckets');
        console.log('Buckets after insert:', buckets);
    } catch (e) {
        console.error('Error creating bucket via SQL:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
createBucketSql();
