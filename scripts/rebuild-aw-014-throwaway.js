const { PrismaClient } = require('@prisma/client');

const basePrisma = new PrismaClient();

async function main() {
    const aerowashCompanyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';

    // 1. Ensure throwaway_copy search path
    await basePrisma.$executeRawUnsafe('SET search_path TO throwaway_copy, public;');
    const searchPathRes = await basePrisma.$queryRawUnsafe('SHOW search_path;');
    console.log('Search path:', searchPathRes);

    const prisma = basePrisma;

    // 2. SEED CLIENT: Marcella
    let client = await prisma.client.findFirst({
        where: {
            companyId: aerowashCompanyId,
            name: { contains: 'Marcella', mode: 'insensitive' }
        }
    });

    if (!client) {
        client = await prisma.client.create({
            data: {
                companyId: aerowashCompanyId,
                name: 'Marcella',
                companyName: 'Marcella Residence',
                email: 'marcella@example.com',
                phone: '082 123 4567',
                address: '12 Beach Road, Camps Bay, Cape Town'
            }
        });
        console.log('Created client Marcella in throwaway_copy:', client.id);
    } else {
        console.log('Found client Marcella in throwaway_copy:', client.id);
    }

    // 3. SEED QUOTE: AW-2026-014
    let quote = await prisma.invoice.findFirst({
        where: {
            companyId: aerowashCompanyId,
            quoteNumber: 'AW-2026-014'
        }
    });

    const quoteMetadata014 = {
        aerowashQuote: true,
        rateCardRevision: 13,
        hasOptions: true,
        fixedPricesNote: 'Fixed prices for the option chosen',
        paymentTermsOption: 'EFT_ON_COMPLETION',
        waiveMinimumJobAmount: true,
        scopeOfWorks: 'Exterior maintenance cleaning at 12 Beach Road, Camps Bay, delivered by drone or water-fed pole with no scaffolding, cradles, ladders or rope access and no obstruction of trading or parking.',
        customInclusions: [
            'Pre- and post-clean photographic record',
            'All labour, equipment and remote pilot crew'
        ],
        customExclusions: [
            'Walking on the tiled roof',
            'Internal faces of glass, unless separately agreed',
            'Hardened cement, paint and adhesive residue',
            'Repair of existing damage, failed sealant or penetrated staining'
        ],
        options: [
            {
                id: 'A',
                name: 'Option A',
                subtotal: 3000,
                total: 3000,
                taxAmount: 0,
                items: [
                    {
                        id: 'opt-a-1',
                        name: 'Solar panel cleaning — drone',
                        description: 'Solar panel cleaning — drone\n12 panels @ R150/panel. Pure water drone cleaning of photovoltaic solar panel surfaces. No detergents or abrasives are used, and no contact is made with panel wiring or mountings.',
                        quantity: 12,
                        unit: 'PANEL',
                        unitPrice: 150,
                        total: 1800,
                        area: 'Roof Solar Array'
                    },
                    {
                        id: 'opt-a-2',
                        name: 'Window cleaning — water-fed pole',
                        description: 'Window cleaning — water-fed pole\n6 windows (R400) — Ground & first floor. Exterior window cleaning using water-fed telescopic pole with purified demineralised water for a spot-free finish without chemical residue.',
                        quantity: 6,
                        unit: 'WINDOW',
                        unitPrice: 66.67,
                        total: 400,
                        area: 'Ground & First Floor'
                    },
                    {
                        id: 'opt-a-3',
                        name: 'Aviation regulatory compliance',
                        description: 'Aviation regulatory compliance\nSACAA compliant flight planning, site risk assessment, airspace authorization and remote pilot operations compliance.',
                        quantity: 1,
                        unit: 'LOT',
                        unitPrice: 800,
                        total: 800,
                        area: 'Flight Operations'
                    }
                ]
            },
            {
                id: 'B',
                name: 'Option B',
                subtotal: 1420,
                total: 1420,
                taxAmount: 0,
                items: [
                    {
                        id: 'opt-b-1',
                        name: 'Solar panel cleaning — water-fed pole',
                        description: 'Solar panel cleaning — water-fed pole\n12 panels @ R85/panel. Pure water cleaning of photovoltaic solar panel surfaces using water-fed telescopic pole. No detergents or abrasives are used, and no contact is made with panel wiring or mountings.',
                        quantity: 12,
                        unit: 'PANEL',
                        unitPrice: 85,
                        total: 1020,
                        area: 'Roof Solar Array'
                    },
                    {
                        id: 'opt-b-2',
                        name: 'Window cleaning — water-fed pole',
                        description: 'Window cleaning — water-fed pole\n6 windows (R400) — Ground & first floor. Exterior window cleaning using water-fed telescopic pole with purified demineralised water for a spot-free finish without chemical residue.',
                        quantity: 6,
                        unit: 'WINDOW',
                        unitPrice: 66.67,
                        total: 400,
                        area: 'Ground & First Floor'
                    }
                ]
            }
        ]
    };

    const quoteItems014 = [
        {
            description: 'Solar panel cleaning — drone\n12 panels @ R150/panel. Pure water drone cleaning of photovoltaic solar panel surfaces. No detergents or abrasives are used, and no contact is made with panel wiring or mountings.',
            quantity: 12,
            unit: 'PANEL',
            unitPrice: 150,
            total: 1800,
            position: 0
        },
        {
            description: 'Window cleaning — water-fed pole\n6 windows (R400) — Ground & first floor. Exterior window cleaning using water-fed telescopic pole with purified demineralised water for a spot-free finish without chemical residue.',
            quantity: 6,
            unit: 'WINDOW',
            unitPrice: 66.67,
            total: 400,
            position: 1
        },
        {
            description: 'Aviation regulatory compliance\nSACAA compliant flight planning, site risk assessment, airspace authorization and remote pilot operations compliance.',
            quantity: 1,
            unit: 'LOT',
            unitPrice: 800,
            total: 800,
            position: 2
        }
    ];

    if (quote) {
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: quote.id } });
        quote = await prisma.invoice.update({
            where: { id: quote.id },
            data: {
                clientId: client.id,
                subtotal: 3000,
                total: 3000,
                taxAmount: 0,
                taxRate: 0,
                site: '12 Beach Road, Camps Bay',
                metadata: quoteMetadata014,
                items: { create: quoteItems014 }
            }
        });
        console.log('Updated quote AW-2026-014 in throwaway_copy:', quote.id);
    } else {
        quote = await prisma.invoice.create({
            data: {
                companyId: aerowashCompanyId,
                clientId: client.id,
                type: 'QUOTE',
                status: 'SENT',
                number: 14,
                quoteNumber: 'AW-2026-014',
                date: new Date('2026-11-11'),
                dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
                subtotal: 3000,
                total: 3000,
                taxAmount: 0,
                taxRate: 0,
                site: '12 Beach Road, Camps Bay',
                metadata: quoteMetadata014,
                items: { create: quoteItems014 }
            }
        });
        console.log('Created quote AW-2026-014 in throwaway_copy:', quote.id);
    }

    // 4. SEED COMMERCIAL TEST QUOTE
    let commClient = await prisma.client.findFirst({
        where: {
            companyId: aerowashCompanyId,
            name: { contains: 'Apex', mode: 'insensitive' }
        }
    });

    if (!commClient) {
        commClient = await prisma.client.create({
            data: {
                companyId: aerowashCompanyId,
                name: 'Apex Commercial Properties',
                companyName: 'Apex Properties (Pty) Ltd',
                email: 'facilities@apexproperties.co.za',
                phone: '021 555 0199',
                address: '45 Century Boulevard, Century City, Cape Town'
            }
        });
        console.log('Created client Apex Commercial in throwaway_copy:', commClient.id);
    }

    let commQuote = await prisma.invoice.findFirst({
        where: {
            companyId: aerowashCompanyId,
            quoteNumber: 'AW-COMM-001'
        }
    });

    const commMetadata = {
        aerowashQuote: true,
        hasOptions: false,
        paymentTermsOption: 'DEPOSIT_60',
        scopeOfWorks: 'Exterior commercial window cleaning at Apex Office Park, 45 Century Boulevard, Century City, delivered using pure water telescopic poles with no scaffolding, cradles, or ladders and no obstruction of tenant trading or parking.',
        siteProvisions: {
            hasWindowCleaningPole: true,
            windowCleaningLines: [
                { id: 'wcl-1', unitType: 'pane', quantity: 240, rate: 25, location: 'Ground floor' },
                { id: 'wcl-2', unitType: 'pane', quantity: 180, rate: 35, location: 'Floors 2–5' }
            ]
        }
    };

    const commItems = [
        {
            description: 'Window cleaning — water-fed pole\n240 panes @ R25/pane — Ground floor. Exterior window cleaning using water-fed telescopic pole with purified demineralised water for a spot-free finish without chemical residue.',
            quantity: 240,
            unit: 'PANE',
            unitPrice: 25,
            total: 6000,
            position: 0
        },
        {
            description: 'Window cleaning — water-fed pole\n180 panes @ R35/pane — Floors 2–5. Exterior window cleaning using water-fed telescopic pole with purified demineralised water for a spot-free finish without chemical residue.',
            quantity: 180,
            unit: 'PANE',
            unitPrice: 35,
            total: 6300,
            position: 1
        }
    ];

    if (commQuote) {
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: commQuote.id } });
        commQuote = await prisma.invoice.update({
            where: { id: commQuote.id },
            data: {
                clientId: commClient.id,
                subtotal: 12300,
                total: 12300,
                taxAmount: 0,
                taxRate: 0,
                site: 'Apex Office Park, 45 Century Boulevard, Century City',
                metadata: commMetadata,
                items: { create: commItems }
            }
        });
        console.log('Updated commercial quote in throwaway_copy:', commQuote.id);
    } else {
        commQuote = await prisma.invoice.create({
            data: {
                companyId: aerowashCompanyId,
                clientId: commClient.id,
                type: 'QUOTE',
                status: 'SENT',
                number: 99,
                quoteNumber: 'AW-COMM-001',
                date: new Date('2026-11-11'),
                dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
                subtotal: 12300,
                total: 12300,
                taxAmount: 0,
                taxRate: 0,
                site: 'Apex Office Park, 45 Century Boulevard, Century City',
                metadata: commMetadata,
                items: { create: commItems }
            }
        });
        console.log('Created commercial quote in throwaway_copy:', commQuote.id);
    }

    console.log('All preview records seeded successfully in throwaway_copy!');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
}).finally(async () => {
    await basePrisma.$disconnect();
});
