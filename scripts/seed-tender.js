const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== STARTING TENDER TAGGING MIGRATION (ADDITIVE ONLY) ===");

    // 1. Locate CCT Client
    const cctClient = await prisma.client.findFirst({
        where: { name: { contains: "Cape Town", mode: "insensitive" } }
    });

    if (!cctClient) {
        throw new Error("City of Cape Town client not found in database!");
    }
    console.log("Found CCT Client:", cctClient.id, cctClient.name, "Company:", cctClient.companyId);

    // 2. Find or create Tender 152G/2025/26
    let tender = await prisma.tender.findFirst({
        where: {
            companyId: cctClient.companyId,
            tenderNumber: "152G/2025/26"
        }
    });

    if (!tender) {
        tender = await prisma.tender.create({
            data: {
                companyId: cctClient.companyId,
                clientId: cctClient.id,
                name: "City of Cape Town - Park Play Equipment & Street Furniture",
                tenderNumber: "152G/2025/26",
                startDate: new Date("2025-07-01T00:00:00Z"),
                endDate: new Date("2028-06-30T23:59:59Z"),
                status: "ACTIVE",
                quotePrefix: "CCT-T",
                invoicePrefix: "CCT-TI"
            }
        });
        console.log("Created Tender 152G/2025/26 with ID:", tender.id);
    } else {
        console.log("Tender 152G/2025/26 already exists with ID:", tender.id);
    }

    // 3. Tag CCT catalog items with tender numeric codes
    const cctItems = await prisma.fixedPriceItem.findMany({
        where: { clientId: cctClient.id }
    });
    console.log(`Found ${cctItems.length} CCT catalog items to inspect for tender tagging.`);

    let taggedCount = 0;
    for (const item of cctItems) {
        // Tender items have numeric-style codes like "1.1", "17.30", "20.12", "21"
        const hasTenderCode = item.code && /^\d+(\.\d+)?$/.test(item.code.trim());
        if (hasTenderCode) {
            await prisma.fixedPriceItem.update({
                where: { id: item.id },
                data: {
                    tenderId: tender.id,
                    year1Price: item.year1Price ?? item.unitPrice
                }
            });
            taggedCount++;
        }
    }
    console.log(`Successfully tagged ${taggedCount} CCT items to Tender 152G/2025/26.`);

    // 4. Verify existing invoices are all GENERAL
    const nonGeneralInvoices = await prisma.invoice.count({
        where: { workType: { not: "GENERAL" } }
    });
    console.log(`Verified: ${nonGeneralInvoices} non-general invoices exist (should be 0).`);

    const tenderItemsCount = await prisma.fixedPriceItem.count({
        where: { tenderId: tender.id }
    });
    const generalItemsCount = await prisma.fixedPriceItem.count({
        where: { tenderId: null }
    });
    console.log(`Current Catalog breakdown: ${tenderItemsCount} Tender items, ${generalItemsCount} General items.`);

    console.log("=== TENDER TAGGING COMPLETED SAFELY ===");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
