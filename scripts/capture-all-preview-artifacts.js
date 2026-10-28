const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
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

const prisma = new PrismaClient({
    datasources: { db: { url: throwawayUrl.toString() } }
});

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('=== PREPARING PREVIEW ARTIFACT CAPTURE ===');

    const aerowashCompanyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
    const lrBuildersCompanyId = '299c43ec-9578-4c45-91cb-a881a539e25d';

    // 1. Ensure AeroWash CompanySettings are exact
    await prisma.companySettings.update({
        where: { companyId: aerowashCompanyId },
        data: {
            name: 'AeroWash (Pty) Ltd',
            registrationNumber: '2026/475172/07',
            address: '15 Culemborg Street, Parow, Cape Town, 7500',
            phone: '067 829 3350',
            email: 'info@aerowash.co.za',
            taxId: null, // Not VAT registered
            vatRegistrationDate: null,
            bankDetails: 'Bank: First National Bank (FNB)\nAccount Name: AeroWash (Pty) Ltd\nAccount Number: 63012345678\nBranch Code: 250655\nReference: AW-2026-007',
            theme: 'dark-orange',
            justificationEnabled: false
        }
    });

    // 2. Ensure LR Builders CompanySettings are exact
    await prisma.companySettings.update({
        where: { companyId: lrBuildersCompanyId },
        data: {
            taxId: '4420198811',
            vatRegistrationDate: null,
            justificationEnabled: true
        }
    });

    // 3. Upsert Patriot Client
    let patriot = await prisma.client.findFirst({
        where: { companyId: aerowashCompanyId, name: 'Patriot (Pty) Ltd' }
    });
    if (!patriot) {
        patriot = await prisma.client.create({
            data: {
                companyId: aerowashCompanyId,
                name: 'Patriot (Pty) Ltd',
                attentionTo: 'Greg',
                email: 'greg@patriot.co.za',
                phone: '082 123 4567',
                address: '18 Moorsom Ave, Epping 2, Cape Town'
            }
        });
    }

    // 4. Create or update Patriot Quote AW-2026-007
    let patriotQuote = await prisma.invoice.findFirst({
        where: { companyId: aerowashCompanyId, quoteNumber: 'AW-2026-007', type: 'QUOTE' }
    });

    const patriotItemsData = [
        {
            description: 'Exterior Glazing Maintenance Clean – North Elevation\nDrone cleaning of all windows, glazing and frames across this face of the building, excluding balcony areas (see Balcony & Detail Areas). Removes dirt, pollution, salt and light grime, leaving the glazing visibly clean across the elevation.',
            quantity: 1,
            unitPrice: 7500,
            area: 'North Elevation',
            total: 7500,
            position: 0
        },
        {
            description: 'Exterior Glazing Maintenance Clean – East Elevation\nDrone cleaning of all windows, glazing and frames across this face of the building, excluding balcony areas (see Balcony & Detail Areas). Removes dirt, pollution, salt and light grime, leaving the glazing visibly clean across the elevation.',
            quantity: 1,
            unitPrice: 4500,
            area: 'East Elevation',
            total: 4500,
            position: 1
        },
        {
            description: 'Exterior Glazing Maintenance Clean – South Elevation\nDrone cleaning of all windows, glazing and frames across this face of the building, excluding balcony areas (see Balcony & Detail Areas). Removes dirt, pollution, salt and light grime, leaving the glazing visibly clean across the elevation.',
            quantity: 1,
            unitPrice: 6750,
            area: 'South Elevation',
            total: 6750,
            position: 2
        },
        {
            description: 'Site Visit & Facade Assessment\nOn-site visit to confirm scope, condition, access and water supply, with a photographic record of the building taken before work starts.',
            quantity: 1,
            unitPrice: 0,
            area: 'Site Provisions',
            total: 0,
            position: 3
        },
        {
            description: 'Service Photo Record\nPhotographic record of each elevation before and after service, supplied with the completion report.',
            quantity: 1,
            unitPrice: 0,
            area: 'Site Provisions',
            total: 0,
            position: 4
        }
    ];

    const patriotMetadata = {
        aerowashQuote: true,
        rateCardRevision: 13,
        scopeOfWorks: 'Exterior maintenance cleaning of North, East, and South elevations at Patriot, 18 Moorsom Ave, Epping 2, Cape Town, delivered by drone with no scaffolding, cradles, ladders or rope access and no obstruction of trading or parking.',
        elevations: [
            { id: 'e1', name: 'North Elevation', width: 25, height: 15, band: 'B', condition: 'Sound', selectedCleaning: 'GLAZING' },
            { id: 'e2', name: 'East Elevation', width: 15, height: 15, band: 'B', condition: 'Sound', selectedCleaning: 'GLAZING' },
            { id: 'e3', name: 'South Elevation', width: 22.5, height: 15, band: 'B', condition: 'Sound', selectedCleaning: 'GLAZING' }
        ],
        siteProvisions: {
            hasSiteVisit: true,
            hasPhotoRecord: true,
            hasOccupiedBuilding: false
        }
    };

    if (patriotQuote) {
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: patriotQuote.id } });
        patriotQuote = await prisma.invoice.update({
            where: { id: patriotQuote.id },
            data: {
                site: 'Patriot, 18 Moorsom Ave, Epping 2, Cape Town',
                subtotal: 18750,
                taxRate: 0,
                taxAmount: 0,
                total: 18750,
                metadata: patriotMetadata,
                items: { create: patriotItemsData }
            }
        });
    } else {
        patriotQuote = await prisma.invoice.create({
            data: {
                companyId: aerowashCompanyId,
                clientId: patriot.id,
                date: new Date('2026-10-28'),
                number: 7,
                quoteNumber: 'AW-2026-007',
                type: 'QUOTE',
                status: 'DRAFT',
                site: 'Patriot, 18 Moorsom Ave, Epping 2, Cape Town',
                subtotal: 18750,
                taxRate: 0,
                taxAmount: 0,
                total: 18750,
                metadata: patriotMetadata,
                items: { create: patriotItemsData }
            }
        });
    }

    // 5. Create or update Patriot Invoice INV-2026-007
    let patriotInvoice = await prisma.invoice.findFirst({
        where: { companyId: aerowashCompanyId, quoteNumber: 'INV-2026-007', type: 'INVOICE' }
    });
    if (patriotInvoice) {
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: patriotInvoice.id } });
        patriotInvoice = await prisma.invoice.update({
            where: { id: patriotInvoice.id },
            data: {
                site: 'Patriot, 18 Moorsom Ave, Epping 2, Cape Town',
                subtotal: 18750,
                taxRate: 0,
                taxAmount: 0,
                total: 18750,
                metadata: patriotMetadata,
                items: { create: patriotItemsData }
            }
        });
    } else {
        patriotInvoice = await prisma.invoice.create({
            data: {
                companyId: aerowashCompanyId,
                clientId: patriot.id,
                date: new Date('2026-10-28'),
                number: 7,
                quoteNumber: 'INV-2026-007',
                type: 'INVOICE',
                status: 'DRAFT',
                site: 'Patriot, 18 Moorsom Ave, Epping 2, Cape Town',
                subtotal: 18750,
                taxRate: 0,
                taxAmount: 0,
                total: 18750,
                metadata: patriotMetadata,
                items: { create: patriotItemsData }
            }
        });
    }

    console.log(`Patriot Quote ID: ${patriotQuote.id}`);
    console.log(`Patriot Invoice ID: ${patriotInvoice.id}`);

    // 6. Start Next.js Server on port 3009
    console.log('Starting Next.js production server on port 3009 connected to throwaway_copy...');
    const serverEnv = {
        ...process.env,
        ...env,
        DATABASE_URL: throwawayPoolerUrl.toString(),
        DIRECT_URL: throwawayUrl.toString(),
        PORT: '3009'
    };

    const nextServer = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3009'], {
        env: serverEnv,
        stdio: 'pipe'
    });

    nextServer.stdout.on('data', d => console.log('[NEXT]', d.toString().trim()));
    nextServer.stderr.on('data', d => console.error('[NEXT ERR]', d.toString().trim()));

    await new Promise(r => setTimeout(r, 4500));

    // 7. Launch Puppeteer
    console.log('Launching Chrome browser via Puppeteer...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1440, height: 1100 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('dialog', async d => { await d.accept(); });

    // ==========================================
    // CAPTURE 1: AeroWash New Quote Builder + 22 Catalog Items
    // ==========================================
    console.log('1. Logging into AeroWash (uthmaan@aerowash.co.za)...');
    await page.goto('http://localhost:3009/login', { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'uthmaan@aerowash.co.za');
    await page.type('input[type="password"]', 'Uthmaan@09');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('button[type="submit"]')
    ]);

    console.log('Navigating to AeroWash New Quote (/invoices/new)...');
    await page.goto('http://localhost:3009/invoices/new', { waitUntil: 'networkidle0' });
    await sleep(2000);

    // Click "Standard Catalog" button to open the panel
    console.log('Opening Standard Catalog panel...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const b = buttons.find(btn => btn.innerText.includes('Catalog') || btn.innerText.includes('Standard Catalog'));
        if (b) b.click();
    });
    await sleep(1500);

    const path1 = path.join(ARTIFACT_DIR, 'aerowash_quote_builder_22_items.png');
    await page.screenshot({ path: path1, fullPage: false });
    console.log(`Saved screenshot: ${path1}`);

    // ==========================================
    // CAPTURE 2: AeroWash In-App Patriot Quote AW-2026-007
    // ==========================================
    console.log(`Navigating to Patriot Quote AW-2026-007 (/invoices/${patriotQuote.id})...`);
    await page.goto(`http://localhost:3009/invoices/${patriotQuote.id}`, { waitUntil: 'networkidle0' });
    await sleep(2000);

    const path2 = path.join(ARTIFACT_DIR, 'aerowash_patriot_quote_in_app.png');
    await page.screenshot({ path: path2, fullPage: false });
    console.log(`Saved screenshot: ${path2}`);

    // ==========================================
    // CAPTURE 3: AeroWash In-App Patriot Invoice INV-2026-007
    // ==========================================
    console.log(`Navigating to Patriot Invoice INV-2026-007 (/invoices/${patriotInvoice.id})...`);
    await page.goto(`http://localhost:3009/invoices/${patriotInvoice.id}`, { waitUntil: 'networkidle0' });
    await sleep(2000);

    const path3 = path.join(ARTIFACT_DIR, 'aerowash_patriot_invoice_in_app.png');
    await page.screenshot({ path: path3, fullPage: false });
    console.log(`Saved screenshot: ${path3}`);

    // ==========================================
    // CAPTURE 4 & 5: LR Builders General Quote vs Tender 152G Justification
    // ==========================================
    console.log('Logging out from AeroWash...');
    await page.goto('http://localhost:3009/login', { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    console.log('Logging into LR Builders (uthmaan@lrbuilders.co.za)...');
    await page.type('input[type="email"]', 'uthmaan@lrbuilders.co.za');
    await page.type('input[type="password"]', 'Uthmaan@09');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('button[type="submit"]')
    ]);

    console.log('Navigating to LR Builders New Quote (/invoices/new)...');
    await page.goto('http://localhost:3009/invoices/new', { waitUntil: 'networkidle0' });
    await sleep(2000);

    // Select Client if needed
    const clientSelect = await page.$('select');
    if (clientSelect) {
        await page.select('select', await page.evaluate(el => el.options[1]?.value || ''));
        await sleep(500);
    }

    const path4 = path.join(ARTIFACT_DIR, 'lr_general_quote_justification_visible.png');
    await page.screenshot({ path: path4, fullPage: false });
    console.log(`Saved screenshot: ${path4}`);

    // Switch to Tender 152G work type
    console.log('Switching to Tender 152G...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tenderBtn = buttons.find(b => b.innerText.includes('Tender 152G') || b.innerText.includes('Tender'));
        if (tenderBtn) tenderBtn.click();
    });
    await sleep(1000);

    const path5 = path.join(ARTIFACT_DIR, 'lr_tender_quote_no_justification.png');
    await page.screenshot({ path: path5, fullPage: false });
    console.log(`Saved screenshot: ${path5}`);

    // Cleanup
    await browser.close();
    nextServer.kill('SIGTERM');
    await prisma.$disconnect();
    console.log('=== PREVIEW CAPTURE COMPLETED SUCCESSFULLY ===');
}

main().catch(err => {
    console.error('Error in capture script:', err);
    process.exit(1);
});
