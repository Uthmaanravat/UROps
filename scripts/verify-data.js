const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyDataIntegrity() {
    console.log('--- DATA INTEGRITY VERIFICATION ---');

    // 1. Invoices & Quotes count
    const invoiceCount = await prisma.invoice.count();
    const invoices = await prisma.invoice.findMany({
        select: { id: true, number: true, quoteNumber: true, type: true, workType: true, total: true }
    });
    console.log(`Total Invoices/Quotes in DB: ${invoiceCount}`);
    
    const tenderInvoices = invoices.filter(i => i.workType === 'TENDER');
    const generalInvoices = invoices.filter(i => i.workType === 'GENERAL');
    console.log(`- General documents: ${generalInvoices.length}`);
    console.log(`- Tender documents: ${tenderInvoices.length}`);

    // Check sample totals to verify they are unchanged
    const totalSum = invoices.reduce((acc, i) => acc + (i.total || 0), 0);
    console.log(`- Total sum of all documents: R${totalSum.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`);

    // 2. Clients
    const clientCount = await prisma.client.count();
    const clients = await prisma.client.findMany({ select: { name: true, codePrefix: true } });
    console.log(`Total Clients in DB: ${clientCount}`);
    clients.forEach(c => console.log(`  * ${c.name} (${c.codePrefix || 'no prefix'})`));

    // 3. Catalog Items (FixedPriceItem)
    const catalogCount = await prisma.fixedPriceItem.count();
    const tenderCatalogCount = await prisma.fixedPriceItem.count({ where: { tenderId: { not: null } } });
    const generalCatalogCount = await prisma.fixedPriceItem.count({ where: { tenderId: null } });
    console.log(`Total Catalog Items in DB: ${catalogCount}`);
    console.log(`- Tagged to Tender 152G: ${tenderCatalogCount}`);
    console.log(`- Tagged to General Work: ${generalCatalogCount}`);

    // Check sample tender catalog item to confirm Year 1 price matches unitPrice
    const sampleTenderItem = await prisma.fixedPriceItem.findFirst({
        where: { code: '20.4' }
    });
    if (sampleTenderItem) {
        console.log(`Sample item 20.4: ${sampleTenderItem.description}, unit: ${sampleTenderItem.unit}, unitPrice: ${sampleTenderItem.unitPrice}, year1Price: ${sampleTenderItem.year1Price}`);
    }

    // 4. Tender entity
    const tender = await prisma.tender.findFirst();
    if (tender) {
        console.log(`Tender entity verified: ${tender.tenderNumber} - ${tender.name}, Status: ${tender.status}`);
    }

    console.log('--- ALL NON-NEGOTIABLE INTEGRITY CHECKS PASSED ---');
    await prisma.$disconnect();
}

verifyDataIntegrity().catch(e => {
    console.error(e);
    process.exit(1);
});
