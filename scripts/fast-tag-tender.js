const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== CHECK & FAST TAG ===");
    const tender = await prisma.tender.findFirst({
        where: { tenderNumber: "152G/2025/26" }
    });
    console.log("Tender found:", tender ? tender.id : "None");

    if (!tender) {
        console.error("No tender found!");
        return;
    }

    const cctClient = await prisma.client.findFirst({
        where: { name: { contains: "Cape Town", mode: "insensitive" } }
    });
    console.log("CCT Client:", cctClient.id);

    // Fast batch update with raw SQL
    const updatedCount = await prisma.$executeRaw`
        UPDATE "FixedPriceItem"
        SET "tenderId" = ${tender.id},
            "year1Price" = COALESCE("year1Price", "unitPrice")
        WHERE "clientId" = ${cctClient.id}
          AND "code" IS NOT NULL
          AND "code" ~ '^[0-9]+(\.[0-9]+)?$'
    `;
    console.log("Updated items count with raw SQL:", updatedCount);

    const tenderItemsCount = await prisma.fixedPriceItem.count({
        where: { tenderId: tender.id }
    });
    const generalItemsCount = await prisma.fixedPriceItem.count({
        where: { tenderId: null }
    });
    console.log(`Summary: ${tenderItemsCount} Tender items, ${generalItemsCount} General items.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
