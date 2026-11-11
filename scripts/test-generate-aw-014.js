const fs = require('fs');
const path = require('path');
const { generateAeroWashQuotePdf } = require('../src/lib/aerowash-quote-pdf');

async function main() {
    const quote = {
        id: 'test-aw-2026-014',
        type: 'QUOTE',
        status: 'SENT',
        number: 14,
        quoteNumber: 'AW-2026-014',
        date: new Date('2026-11-11'),
        validityDays: 45,
        site: '12 Beach Road, Camps Bay',
        subtotal: 3000,
        total: 3000,
        taxAmount: 0,
        taxRate: 0,
        notes: '',
        client: {
            name: 'Marcella',
            companyName: 'Marcella Residence',
            email: 'marcella@example.com',
            phone: '082 123 4567',
            address: '12 Beach Road, Camps Bay, Cape Town'
        },
        items: [
            {
                id: 'item-1',
                description: 'Window cleaning — water-fed pole\nExterior window cleaning using water-fed telescopic pole with purified demineralised water for a spot-free finish (First-floor, exterior, from ground).',
                quantity: 1,
                unit: 'LOT',
                unitPrice: 1420,
                total: 1420,
                area: 'First-floor, exterior, from ground'
            }
        ],
        metadata: {
            aerowashQuote: true,
            hasOptions: true,
            fixedPricesNote: 'Fixed prices for the option chosen',
            paymentTermsOption: 'EFT_ON_COMPLETION',
            waiveMinimumJobAmount: true,
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
        }
    };

    const company = {
        name: 'AeroWash (Pty) Ltd',
        email: 'info@aerowash.co.za',
        phone: '+27 21 555 0199',
        address: 'Parow Industrial, Cape Town, 7500',
        regNo: '2023/123456/07',
        isVatActive: false,
        vatRate: 15
    };

    const doc = await generateAeroWashQuotePdf({
        invoice: quote,
        company,
        companySettings: { currency: 'R' }
    });
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const outPath = path.resolve('C:/Users/uthma/.gemini/antigravity/brain/5f53d62e-19db-40c8-8193-7eef56e18105/AW-2026-014-Marcella.pdf');
    fs.writeFileSync(outPath, pdfBuffer);
    console.log('PDF written successfully to:', outPath);
}

main().catch(console.error);
