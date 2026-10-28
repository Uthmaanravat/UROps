const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function checkInvoiceConstraints() {
    const url = new URL(directUrl);
    url.searchParams.set('schema', 'public');
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    try {
        const constraints = await prisma.$queryRaw`
            SELECT conname, contype, pg_get_constraintdef(c.oid) 
            FROM pg_constraint c 
            JOIN pg_namespace n ON n.oid = c.connamespace 
            WHERE n.nspname = 'public' AND conrelid = 'public."Invoice"'::regclass;
        `;
        console.log('Invoice Constraints in public:');
        console.dir(constraints, { depth: null });

        const indexes = await prisma.$queryRaw`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE schemaname = 'public' AND tablename = 'Invoice';
        `;
        console.log('Invoice Indexes in public:');
        console.dir(indexes, { depth: null });
    } finally {
        await prisma.$disconnect();
    }
}

checkInvoiceConstraints().catch(console.error);
