const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function main() {
    const url = new URL(directUrl);
    url.searchParams.set('schema', 'public');
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    try {
        const clients = await prisma.client.findMany({
            where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' }
        });
        console.log('Clients in public:');
        console.dir(clients, { depth: null });
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);
