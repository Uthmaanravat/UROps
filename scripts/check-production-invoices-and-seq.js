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
    url.searchParams.set('schema', 'public');
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    const aerowashCompanyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
    const lrCompanyId = '299c43ec-9578-4c45-91cb-a881a539e25d';

    console.log('--- PRODUCTION (public schema) ---');
    const aeroInvoices = await prisma.invoice.findMany({
        where: { companyId: aerowashCompanyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { client: true }
    });
    console.log('AeroWash Invoices on public:');
    aeroInvoices.forEach(i => console.log(`  ID: ${i.id} | No: ${i.number} | Ref: ${i.reference} | QuoteNo: ${i.quoteNumber} | Client: ${i.client?.name} | CreatedAt: ${i.createdAt.toISOString()}`));

    const lrInvoices = await prisma.invoice.findMany({
        where: { companyId: lrCompanyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { client: true }
    });
    console.log('LR Builders Invoices on public:');
    lrInvoices.forEach(i => console.log(`  ID: ${i.id} | No: ${i.number} | Ref: ${i.reference} | QuoteNo: ${i.quoteNumber} | Client: ${i.client?.name} | CreatedAt: ${i.createdAt.toISOString()}`));

    // Also check sequences
    try {
        const sequences = await prisma.companySequence.findMany({
            where: { companyId: { in: [aerowashCompanyId, lrCompanyId] } }
        });
        console.log('CompanySequences on public:', sequences);
    } catch (e) {
        console.log('No CompanySequence table or error:', e.message);
    }

    await prisma.$disconnect();
}
check();
