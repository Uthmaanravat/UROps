const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function checkRLS() {
    const url = new URL(directUrl);
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    try {
        const policies = await prisma.$queryRawUnsafe(`
            SELECT policyname, permissive, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE schemaname = 'storage' AND tablename = 'objects'
        `);
        console.log('Policies on storage.objects:', policies);
    } catch (e) {
        console.error('Error querying policies:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
checkRLS();
