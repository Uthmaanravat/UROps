const fs = require('fs');
let code = fs.readFileSync('src/app/(dashboard)/invoices/actions.ts', 'utf8');

if (!code.includes('getWorkspaceCatalogAction')) {
  const addition = `

/**
 * Fetches catalog items for the active workspace.
 * AeroWash: loads from CatalogueItem (22 items: 10 cleaning, 4 assessment, 6 site conditions, 2 contracts)
 * LR Builders: loads from FixedPriceItem (123 items: 115 tender, 8 general)
 */
export async function getWorkspaceCatalogAction() {
    const companyId = await ensureAuth();
    try {
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        const isAeroWash = companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' 
            || settings?.theme === 'dark-orange'
            || settings?.name?.toLowerCase().includes('aerowash');

        if (isAeroWash) {
            const items = await (prisma as any).catalogueItem.findMany({
                where: { companyId, isActive: true },
                orderBy: { itemNumber: 'asc' }
            }).catch(() => []);

            if (items && items.length > 0) {
                const getRateNote = (pricingMethod: string) => {
                    switch (pricingMethod) {
                        case 'BAND_RATE': return 'Band A–E (R16–R34/m²)';
                        case 'ITEM_1_PLUS_15_PERCENT': return 'Item 1 +15%';
                        case 'PERCENT_OF_ELEVATION_BAND_DEFAULT_12': return '12% of elevation';
                        case 'PERCENT_OF_ELEVATION_DEFAULT_25': return '25% of elevation';
                        case 'PRICE_ON_QUOTE': return 'Price on quote';
                        case 'SOLAR_PANEL_RATE': return 'R6 client / R10 AeroWash';
                        case 'FREE_ASSESSMENT': return 'No charge (R0)';
                        case 'PHOTO_RECORD': return 'Included / On quote';
                        case 'PERCENT_OF_CLEANING_LINES_10': return '10% of cleaning lines';
                        case 'REGIONAL_WATER_PER_LITRE': return "Atlantis R0.30/L · Simon's Town R0.85/L";
                        case 'CONTRACT_PROGRAMME_DISCOUNT': return 'Biannual -10% · Quarterly -15% · Monthly -20%';
                        case 'CONTRACT_COMBINED_PROGRAMME': return '8× Glazing + 4× Facade / yr';
                        default: return 'Rate Card Rev 13';
                    }
                };

                return items.map((i: any) => ({
                    id: i.id,
                    code: \`#\${i.itemNumber}\`,
                    itemNumber: i.itemNumber,
                    name: i.name,
                    description: i.name,
                    clientDescription: i.clientDescription,
                    category: i.category,
                    pricingMethod: i.pricingMethod,
                    internalNotes: i.internalNotes,
                    unitPrice: 0,
                    unit: i.category === 'CONTRACTS' ? 'programme' : 'service',
                    isCatalogueItem: true,
                    rateNote: getRateNote(i.pricingMethod)
                }));
            }
        }

        // LR Builders or other: read FixedPriceItem
        return await prisma.fixedPriceItem.findMany({
            where: { companyId },
            include: { 
                client: { select: { id: true, name: true } },
                tender: { select: { id: true, name: true, tenderNumber: true } }
            },
            orderBy: { description: 'asc' }
        });
    } catch (error) {
        console.error("Error fetching workspace catalog:", error);
        return [];
    }
}
`;
  code = code + addition;
  fs.writeFileSync('src/app/(dashboard)/invoices/actions.ts', code, 'utf8');
  console.log('Added getWorkspaceCatalogAction to invoices/actions.ts');
} else {
  console.log('Already present');
}
