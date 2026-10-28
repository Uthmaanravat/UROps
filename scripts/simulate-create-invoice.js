const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function simulate() {
    const url = new URL(directUrl);
    url.searchParams.set('schema', 'public');
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    const companyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9'; // AeroWash

    try {
        console.log('Simulating createInvoiceAction on schema: public for AeroWash...\n');

        // Check clients
        const clients = await prisma.client.findMany({ where: { companyId } });
        console.log(`Found ${clients.length} clients for AeroWash:`, clients.map(c => ({ id: c.id, name: c.name, codePrefix: c.codePrefix })));

        if (clients.length === 0) {
            console.error('CRITICAL: AeroWash has NO clients in public!');
            return;
        }

        const clientId = clients[0].id;
        const clientObj = clients[0];

        // Try creating quote inside a transaction that we immediately rollback
        await prisma.$transaction(async (tx) => {
            const year = new Date().getFullYear();
            const settings = await tx.companySettings.findUnique({ where: { companyId } });
            console.log('CompanySettings found:', !!settings);

            let nextNumber = 0;
            let formattedQuoteNumber = '';
            const codePrefix = clientObj.codePrefix;

            console.log('Client codePrefix:', codePrefix);

            if (codePrefix) {
                const updatedClient = await tx.client.update({
                    where: { id: clientId },
                    data: { lastQuoteNumber: { increment: 1 } }
                });
                nextNumber = updatedClient.lastQuoteNumber;
                formattedQuoteNumber = `${codePrefix}-Q-${year}-${nextNumber.toString().padStart(3, '0')}`;
                console.log('Generated Quote Number with codePrefix:', formattedQuoteNumber);
            }

            // Test Project creation
            const project = await tx.project.create({
                data: {
                    companyId,
                    name: 'Test Rockefeller Simulation',
                    clientId,
                    status: 'SOW',
                    workflowStage: 'SOW',
                    description: `Created from Quotation ${formattedQuoteNumber}`
                }
            });
            console.log('Project created:', project.id);

            // Test Invoice creation with metadata (including condition flags and photos!)
            const samplePhotos = [
                { id: 'photo-1', photoNumber: '01', url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', caption: 'Test 1', elevation: 'Front Elevation' },
                { id: 'photo-2', photoNumber: '02', url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', caption: 'Test 2', elevation: 'Front Elevation' }
            ];

            const sampleFlags = [
                {
                    id: 'flag-1',
                    elevation: 'Front Elevation',
                    location: 'levels 3 and 4',
                    conditionType: 'GLASS_ETCHING',
                    photoRefs: ['01', '02'],
                    wording: 'Pre-clean inspection on 12 Nov 2026 recorded existing surface etching to the glass on the Front Elevation, levels 3 and 4 (photographs 01–02 attached).'
                }
            ];

            const metadata = {
                elevations: [{ name: 'Front Elevation', width: 36.36, height: 51 }],
                siteVisitDone: true,
                siteVisitDate: '2026-11-12',
                siteVisitAttendedBy: 'Uthmaan',
                siteVisitPhotos: samplePhotos,
                conditionFlags: sampleFlags,
                hasExtendedTravel: true,
                programme: 'QUARTERLY'
            };

            const invoice = await tx.invoice.create({
                data: {
                    companyId,
                    clientId,
                    projectId: project.id,
                    date: new Date(),
                    type: 'QUOTE',
                    status: 'DRAFT',
                    number: nextNumber,
                    subtotal: 65000,
                    taxRate: 0,
                    taxAmount: 0,
                    total: 65000,
                    site: 'Rockefeller Cape Town',
                    quoteNumber: formattedQuoteNumber,
                    reference: 'Exterior Facade Clean',
                    workType: 'GENERAL',
                    rateYear: 1,
                    metadata: metadata,
                    items: {
                        create: [
                            {
                                description: 'Exterior Glazing Maintenance Clean – Front Elevation',
                                quantity: 1,
                                unitPrice: 50000,
                                area: 'Front Elevation',
                                unit: 'LOT',
                                total: 50000,
                                position: 0,
                                metadata: { itemNumber: 1 }
                            },
                            {
                                description: 'Extended Travel',
                                quantity: 1,
                                unitPrice: 15000,
                                area: 'Site Provisions',
                                unit: 'LOT',
                                total: 15000,
                                position: 1,
                                metadata: { itemNumber: 20 }
                            }
                        ]
                    }
                }
            });
            console.log('Invoice created successfully! ID:', invoice.id);

            // Test terms snapshot
            const template = await tx.termsTemplate.findFirst({
                where: { companyId, isDefault: true }
            });
            console.log('Default terms template found:', template?.name);

            if (template) {
                const term = await tx.quoteTerm.create({
                    data: {
                        quoteId: invoice.id,
                        source: 'template',
                        templateId: template.id,
                        bodySnapshot: template.body.trim(),
                        position: 0
                    }
                });
                console.log('QuoteTerm created:', term.id);
            }

            console.log('\n>>> SUCCESS! All operations in createInvoiceAction succeeded on public! <<<');
            // Force rollback so we don't pollute public
            throw new Error('SIMULATION_ROLLBACK_OK');
        });
    } catch (e) {
        if (e.message === 'SIMULATION_ROLLBACK_OK') {
            console.log('\nRollback confirmed. Production database was NOT modified.');
        } else {
            console.error('\nERROR DURING SIMULATION:', e);
        }
    } finally {
        await prisma.$disconnect();
    }
}

simulate().catch(console.error);
