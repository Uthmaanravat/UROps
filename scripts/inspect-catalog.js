const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clients = await prisma.client.findMany({ select: { id: true, name: true, codePrefix: true } });
    console.log("=== CLIENTS ===");
    console.log(clients);

    const items = await prisma.fixedPriceItem.findMany({
        select: { id: true, code: true, description: true, clientId: true, category: true, unitPrice: true, unit: true },
        orderBy: { code: 'asc' }
    });
    console.log("\n=== FIXED PRICE ITEMS COUNT ===", items.length);

    const cctClient = clients.find(c => c.name.toLowerCase().includes("cape town"));
    console.log("CCT client ID:", cctClient ? cctClient.id : 'not found');

    const cctItems = items.filter(i => i.clientId === cctClient?.id);
    console.log("\n=== CCT ITEMS COUNT ===", cctItems.length);
    console.log("Sample CCT items (first 15):", cctItems.slice(0, 15).map(i => ({ code: i.code, desc: i.description.slice(0, 40), price: i.unitPrice, unit: i.unit })));

    const nonCctItems = items.filter(i => i.clientId !== cctClient?.id);
    console.log("\n=== NON-CCT ITEMS COUNT ===", nonCctItems.length);
    console.log("Non-CCT items:", nonCctItems.map(i => ({ code: i.code, desc: i.description.slice(0, 40), clientId: i.clientId, price: i.unitPrice, unit: i.unit })));

    const invoices = await prisma.invoice.findMany({
        take: 10,
        orderBy: { date: 'desc' },
        select: { id: true, number: true, quoteNumber: true, type: true, status: true, clientId: true, total: true, date: true }
    });
    console.log("\n=== RECENT INVOICES/QUOTES (first 10) ===");
    console.log(invoices);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
