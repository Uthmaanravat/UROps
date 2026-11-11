const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=throwaway_copy'
        }
    }
});

async function main() {
    const aerowashCompanyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';

    // 1. Check or create Client Marcella in throwaway_copy
    let client = await prisma.client.findFirst({
        where: {
            companyId: aerowashCompanyId,
            OR: [
                { name: { contains: 'Marcella', mode: 'insensitive' } },
                { companyName: { contains: 'Marcella', mode: 'insensitive' } }
            ]
        }
    });

    if (!client) {
        client = await prisma.client.create({
            data: {
                companyId: aerowashCompanyId,
                name: 'Marcella',
                companyName: 'Marcella Residence',
                email: 'marcella@example.com',
                phone: '0821234567',
                address: '12 Beach Road, Camps Bay, Cape Town',
                codePrefix: 'MARC'
            }
        });
        console.log('Created client Marcella in throwaway_copy:', client.id);
    } else {
        console.log('Found client Marcella in throwaway_copy:', client.id);
    }

    // 2. Check or create Quote AW-2026-014 in throwaway_copy
    let quote = await prisma.invoice.findFirst({
        where: {
            companyId: aerowashCompanyId,
            quoteNumber: 'AW-2026-014'
        },
        include: { items: true }
    });

    const quoteMetadata = {
        aerowashQuote: true,
        rateCardRevision: 13,
        hasOptions: true,
        fixedPricesNote: 'Fixed prices for the option chosen',
        paymentTermsOption: 'EFT_ON_COMPLETION',
        waiveMinimumJobAmount: true,
        scopeOfWorks: 'Exterior maintenance cleaning of the building elevations at 12 Beach Road, Camps Bay, delivered by drone or water-fed pole with no scaffolding, cradles, ladders or rope access and no obstruction of trading or parking.',
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
                name: 'Option A: Pure Water Drone Wash & Aviation Compliance',
                subtotal: 3000,
                total: 3000,
                taxAmount: 0,
                items: [
                    {
                        id: 'opt-a-1',
                        description: 'Solar Array Maintenance Clean — Drone\nPure water drone cleaning of photovoltaic solar panel surfaces. No detergents or abrasives are used, and no contact is made with panel wiring or mountings.',
                        quantity: 1,
                        unit: 'LOT',
                        unitPrice: 2200,
                        total: 2200,
                        area: 'Roof Solar Array'
                    },
                    {
                        id: 'opt-a-2',
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
                name: 'Option B: Water-Fed Pole Window Cleaning',
                subtotal: 1420,
                total: 1420,
                taxAmount: 0,
                items: [
                    {
                        id: 'opt-b-1',
                        description: 'Window cleaning — water-fed pole\nExterior window cleaning using water-fed telescopic pole with purified demineralised water for a spot-free finish without chemical residue (Ground & first floor windows).',
                        quantity: 1,
                        unit: 'LOT',
                        unitPrice: 1420,
                        total: 1420,
                        area: 'Ground & First Floor'
                    }
                ]
            }
        ]
    };

    if (quote) {
        // Delete old items and update
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
                metadata: quoteMetadata,
                items: {
                    create: [
                        {
                            description: 'Solar Array Maintenance Clean — Drone\nPure water drone cleaning of photovoltaic solar panel surfaces. No detergents or abrasives are used, and no contact is made with panel wiring or mountings.',
                            quantity: 1,
                            unit: 'LOT',
                            unitPrice: 2200,
                            total: 2200,
                            position: 0
                        },
                        {
                            description: 'Aviation regulatory compliance\nSACAA compliant flight planning, site risk assessment, airspace authorization and remote pilot operations compliance.',
                            quantity: 1,
                            unit: 'LOT',
                            unitPrice: 800,
                            total: 800,
                            position: 1
                        }
                    ]
                }
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
                metadata: quoteMetadata,
                items: {
                    create: [
                        {
                            description: 'Solar Array Maintenance Clean — Drone\nPure water drone cleaning of photovoltaic solar panel surfaces. No detergents or abrasives are used, and no contact is made with panel wiring or mountings.',
                            quantity: 1,
                            unit: 'LOT',
                            unitPrice: 2200,
                            total: 2200,
                            position: 0
                        },
                        {
                            description: 'Aviation regulatory compliance\nSACAA compliant flight planning, site risk assessment, airspace authorization and remote pilot operations compliance.',
                            quantity: 1,
                            unit: 'LOT',
                            unitPrice: 800,
                            total: 800,
                            position: 1
                        }
                    ]
                }
            }
        });
        console.log('Created quote AW-2026-014 in throwaway_copy:', quote.id);
    }

    console.log('Done! Quote ID:', quote.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
