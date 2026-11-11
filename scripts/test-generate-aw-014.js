const fs = require('fs');
const path = require('path');
const { generateAeroWashQuotePdf } = require('../src/lib/aerowash-quote-pdf');

async function main() {
    // 1. REBUILD AW-2026-014 (Marcella)
    const quote014 = {
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
                description: 'Solar panel cleaning — drone\n12 panels @ R150/panel. Pure water drone cleaning of photovoltaic solar panel surfaces. No detergents or abrasives are used, and no contact is made with panel wiring or mountings.',
                quantity: 12,
                unit: 'PANEL',
                unitPrice: 150,
                total: 1800,
                area: 'Roof Solar Array'
            },
            {
                id: 'item-2',
                description: 'Window cleaning — water-fed pole\n6 windows (R400) — Ground & first floor. Exterior window cleaning using water-fed telescopic pole with purified demineralised water for a spot-free finish without chemical residue.',
                quantity: 6,
                unit: 'WINDOW',
                unitPrice: 66.67,
                total: 400,
                area: 'Ground & First Floor'
            },
            {
                id: 'item-3',
                description: 'Aviation regulatory compliance\nSACAA compliant flight planning, site risk assessment, airspace authorization and remote pilot operations compliance.',
                quantity: 1,
                unit: 'LOT',
                unitPrice: 800,
                total: 800,
                area: 'Flight Operations'
            }
        ],
        metadata: {
            aerowashQuote: true,
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
        }
    };

    // 2. COMMERCIAL TEST QUOTE
    const commercialQuote = {
        id: 'test-aw-comm-01',
        type: 'QUOTE',
        status: 'SENT',
        number: 15,
        quoteNumber: 'AW-2026-015',
        date: new Date('2026-11-11'),
        validityDays: 45,
        site: 'Apex Office Park, 45 Century Boulevard, Century City',
        subtotal: 12300,
        total: 12300,
        taxAmount: 0,
        taxRate: 0,
        notes: '',
        client: {
            name: 'Apex Commercial Properties',
            companyName: 'Apex Properties (Pty) Ltd',
            email: 'facilities@apexproperties.co.za',
            phone: '021 555 0199',
            address: '45 Century Boulevard, Century City, Cape Town'
        },
        items: [
            {
                id: 'comm-item-1',
                name: 'Window cleaning — water-fed pole',
                description: 'Window cleaning — water-fed pole\n240 panes @ R25/pane — Ground floor. Exterior window cleaning using water-fed telescopic pole with purified demineralised water for a spot-free finish without chemical residue.',
                quantity: 240,
                unit: 'PANE',
                unitPrice: 25,
                total: 6000,
                area: 'Ground floor'
            },
            {
                id: 'comm-item-2',
                name: 'Window cleaning — water-fed pole',
                description: 'Window cleaning — water-fed pole\n180 panes @ R35/pane — Floors 2–5. Exterior window cleaning using water-fed telescopic pole with purified demineralised water for a spot-free finish without chemical residue.',
                quantity: 180,
                unit: 'PANE',
                unitPrice: 35,
                total: 6300,
                area: 'Floors 2–5'
            }
        ],
        metadata: {
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
        }
    };

    const company = {
        name: 'AeroWash (Pty) Ltd',
        registrationNumber: '2026/475172/07',
        phone: '067 829 3350',
        email: 'info@aerowash.co.za',
        address: '15 Culemborg Street, Parow, Cape Town, 7500',
        website: 'www.aerowash.co.za',
        isVatRegistered: false,
        vatNumber: null,
        bankName: 'First National Bank',
        accountName: 'AeroWash (Pty) Ltd',
        accountNumber: '63081234567',
        branchCode: '250655'
    };

    const outDir = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';

    // Generate AW-2026-014 PDF
    console.log('Generating AW-2026-014 PDF...');
    const doc014 = await generateAeroWashQuotePdf({
        invoice: quote014,
        company,
        companySettings: { currency: 'R' }
    });
    const pdfPath014 = path.join(outDir, 'AW-2026-014-Marcella.pdf');
    fs.writeFileSync(pdfPath014, Buffer.from(doc014.output('arraybuffer')));
    console.log('Wrote:', pdfPath014);

    // Generate Commercial Test Quote PDF
    console.log('Generating Commercial Test Quote PDF...');
    const docComm = await generateAeroWashQuotePdf({
        invoice: commercialQuote,
        company,
        companySettings: { currency: 'R' }
    });
    const pdfPathComm = path.join(outDir, 'AW-Commercial-Test-Quote.pdf');
    fs.writeFileSync(pdfPathComm, Buffer.from(docComm.output('arraybuffer')));
    console.log('Wrote:', pdfPathComm);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
