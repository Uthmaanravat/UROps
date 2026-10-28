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

    const latest = await prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { client: true }
    });
    console.log('Latest invoices on throwaway_copy:');
    latest.forEach(inv => {
        console.log(`${inv.id} | ${inv.number} | ${inv.client?.name} | ${inv.createdAt.toISOString()} | amount: ${inv.amount}`);
    });
    await prisma.$disconnect();
}
check();
