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

    const inv = await prisma.invoice.findUnique({
        where: { id: '8172f92f-06cb-4b76-9e47-1c7bec1aa761' },
        include: { items: true, client: true }
    });
    console.log('Invoice details:');
    console.log('ID:', inv.id);
    console.log('Number:', inv.number);
    console.log('Amount:', inv.amount);
    console.log('Items count:', inv.items.length);
    inv.items.forEach(it => console.log(' - ' + it.description + ' | ' + it.unitPrice));
    console.log('Metadata keys:', Object.keys(inv.metadata || {}));
    console.log('AeroWash metadata:', JSON.stringify(inv.metadata, null, 2));
    await prisma.$disconnect();
}
check();
