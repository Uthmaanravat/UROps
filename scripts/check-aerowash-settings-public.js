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
    const settings = await prisma.companySettings.findUnique({
        where: { companyId: aerowashCompanyId }
    });
    console.log('AeroWash CompanySettings on public:');
    console.log('lastQuoteNumber:', settings?.lastQuoteNumber);
    console.log('quotePrefix:', settings?.quotePrefix);
    console.log('lastInvoiceNumber:', settings?.lastInvoiceNumber);
    console.log('invoicePrefix:', settings?.invoicePrefix);

    const clients = await prisma.client.findMany({
        where: { companyId: aerowashCompanyId }
    });
    console.log('AeroWash clients on public:');
    clients.forEach(c => console.log(`  ${c.id} | ${c.name} | codePrefix: ${c.codePrefix} | lastQuoteNumber: ${c.lastQuoteNumber}`));

    await prisma.$disconnect();
}
check();
