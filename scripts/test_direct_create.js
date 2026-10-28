const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
const env = {};
for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, '');
            env[key] = val;
        }
    }
}

const throwawayUrl = new URL(env.DIRECT_URL);
throwawayUrl.searchParams.set('schema', 'throwaway_copy');
const throwawayPoolerUrl = new URL(env.DATABASE_URL);
throwawayPoolerUrl.searchParams.set('schema', 'throwaway_copy');

process.env.DATABASE_URL = throwawayPoolerUrl.toString();
process.env.DIRECT_URL = throwawayUrl.toString();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDirectCreate() {
    console.log('Testing createInvoiceAction directly via DB on throwaway_copy...');
    const aerowashCompanyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
    const client = await prisma.client.findFirst({ where: { companyId: aerowashCompanyId } });
    console.log('Using client:', client.id, client.name);

    // Call the exact createInvoiceAction logic
    const { createInvoiceAction } = require('../src/app/(dashboard)/invoices/actions');

    // Mock ensureAuth
    const authActions = require('../src/lib/auth-actions');
    authActions.ensureAuth = async () => aerowashCompanyId;

    const metadata = {
        aerowashQuote: true,
        rateCardRevision: 13,
        scopeOfWorks: 'Exterior facade and glazing clean of Front Elevation at The Rockefeller Hotel.',
        elevations: [
            {
                id: 'elev-1',
                name: 'Front Elevation',
                width: 36.36,
                height: 51.0,
                band: 'D',
                condition: 'Sound',
                selectedCleaning: 'FULL_FACADE'
            }
        ],
        siteProvisions: {
            hasSiteVisit: true,
            hasPhotoRecord: true
        },
        programme: 'ONCE_OFF',
        siteVisitDone: true,
        siteVisitDate: '2026-11-12',
        siteVisitAttendedBy: 'Uthmaan Ravat',
        conditionFlags: [
            {
                id: 'flag-1',
                elevation: 'Front Elevation',
                location: 'levels 3 and 4',
                conditionType: 'GLASS_ETCHING',
                photoRefs: ['04', '05', '06', '07', '08', '09'],
                customWording: 'Pre-clean inspection on 12 Nov 2026 recorded existing surface etching to the glass on the Front Elevation, levels 3 and 4 (photographs 04–09 attached). This condition is in the glass and cannot be removed by cleaning. These panels will be washed but will retain a visible cloudy appearance afterwards. No allowance for glass restoration or replacement is included in this quotation.'
            }
        ],
        siteVisitPhotos: [
            { photoNumber: '04', caption: 'Etching level 3', elevation: 'Front Elevation', url: 'data:image/png;base64,mock' },
            { photoNumber: '05', caption: 'Etching level 3 window 2', elevation: 'Front Elevation', url: 'data:image/png;base64,mock' },
            { photoNumber: '06', caption: 'Etching level 4', elevation: 'Front Elevation', url: 'data:image/png;base64,mock' },
            { photoNumber: '07', caption: 'Etching level 4 window 2', elevation: 'Front Elevation', url: 'data:image/png;base64,mock' },
            { photoNumber: '08', caption: 'Close up level 3', elevation: 'Front Elevation', url: 'data:image/png;base64,mock' },
            { photoNumber: '09', caption: 'Close up level 4', elevation: 'Front Elevation', url: 'data:image/png;base64,mock' }
        ],
        totalCalculatedArea: 1854.36,
        clientViewLines: [
            {
                name: 'Full Facade Maintenance Clean – Front Elevation',
                description: 'Drone cleaning of the full face of the building...',
                area: 'Front Elevation',
                amount: 59750
            }
        ]
    };

    const items = [
        {
            description: 'Full Facade Maintenance Clean – Front Elevation\nDrone cleaning of the full face of the building...',
            quantity: 1,
            unitPrice: 59750,
            area: 'Front Elevation',
            unit: 'LOT',
            metadata: { itemNumber: 2 }
        }
    ];

    const quoteId = await createInvoiceAction({
        clientId: client.id,
        date: '2026-10-28',
        items,
        metadata,
        site: 'The Rockefeller Hotel, Cape Town',
        reference: 'Rockefeller Facade & Glazing Clean',
        type: 'QUOTE'
    });

    console.log('CREATED QUOTE ID:', quoteId);

    const saved = await prisma.invoice.findUnique({
        where: { id: quoteId },
        include: { items: true }
    });

    console.log('VERIFIED IN DATABASE:', {
        id: saved.id,
        quoteNumber: saved.quoteNumber,
        type: saved.type,
        subtotal: saved.subtotal,
        total: saved.total,
        taxAmount: saved.taxAmount,
        hasMetadata: Boolean(saved.metadata),
        metadataElevations: saved.metadata?.elevations?.length,
        metadataFlags: saved.metadata?.conditionFlags?.length,
        metadataPhotos: saved.metadata?.siteVisitPhotos?.length,
        metadataClientLines: saved.metadata?.clientViewLines?.length,
        metadataScope: Boolean(saved.metadata?.scopeOfWorks)
    });
}

testDirectCreate().catch(console.error).finally(() => prisma.$disconnect());
