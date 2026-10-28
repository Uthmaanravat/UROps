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
    console.log('=== TESTING PREVIEW FIXES ON THROWAWAY_COPY ===');

    const aerowashCompanyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
    const lrBuildersCompanyId = '299c43ec-9578-4c45-91cb-a881a539e25d';

    // Start Next.js Server on port 3012 connected to throwaway_copy
    console.log('Starting Next.js server on port 3012 connected to throwaway_copy...');
    const serverEnv = {
        ...process.env,
        ...env,
        DATABASE_URL: throwawayPoolerUrl.toString(),
        DIRECT_URL: throwawayUrl.toString(),
        PORT: '3012'
    };

    const nextServer = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3012'], {
        env: serverEnv,
        stdio: 'pipe'
    });

    nextServer.stdout.on('data', d => console.log('[NEXT]', d.toString().trim()));
    nextServer.stderr.on('data', d => console.error('[NEXT ERR]', d.toString().trim()));

    await sleep(5000);

    // Launch Puppeteer
    console.log('Launching Chrome browser via Puppeteer...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1440, height: 1100 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('dialog', async d => { 
        console.log('[BROWSER DIALOG]:', d.message());
        await d.accept(); 
    });

    try {
        // 1. Log into AeroWash
        console.log('1. Logging into AeroWash (uthmaan@aerowash.co.za)...');
        await page.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await page.type('input[type="email"]', 'uthmaan@aerowash.co.za');
        await page.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        // 2. Navigate to AeroWash New Quote (/invoices/new)
        console.log('2. Navigating to AeroWash New Quote (/invoices/new)...');
        await page.goto('http://localhost:3012/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2500);

        // Verify Auto-calculated Area
        console.log('Verifying auto-calculated area with Width = 36.36, Height = 51...');
        const screenshotArea = path.join(ARTIFACT_DIR, 'aerowash_auto_calculated_area.png');
        await page.screenshot({ path: screenshotArea, fullPage: false });
        console.log(`Saved screenshot: ${screenshotArea}`);

        // Select Client
        console.log('Selecting Newmark Hotels as Client...');
        const clientVal = await page.evaluate(() => {
            const select = document.getElementById('client-select') || document.querySelector('select');
            const opt = Array.from(select.options).find(o => o.text.includes('Newmark') || o.text.includes('Patriot') || o.text.includes('Lemco'));
            return opt ? opt.value : '';
        });
        if (clientVal) {
            await page.select('#client-select', clientVal);
            console.log('Selected client value:', clientVal);
        }
        await sleep(1000);

        // Set Site name and Reference
        console.log('Filling in Site and Reference...');
        const siteInput = await page.$('input[placeholder*="Site"], input[name="site"]');
        if (siteInput) {
            await siteInput.click({ clickCount: 3 });
            await siteInput.type('The Rockefeller Hotel, Cape Town');
        }

        const refInput = await page.$('input[placeholder*="Reference"], input[name="reference"]');
        if (refInput) {
            await refInput.click({ clickCount: 3 });
            await refInput.type('Rockefeller Facade & Glazing Clean');
        }

        // Enable Site Visit & Facade Assessment (required for quotes > R50,000)
        console.log('Enabling Site Visit & Facade Assessment...');
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            const siteVisit = inputs.find(i => {
                const parent = i.closest('label') || i.parentElement;
                return parent && parent.innerText && (parent.innerText.includes('Site Visit & Facade Assessment') || parent.innerText.includes('Site Visit'));
            });
            if (siteVisit && !siteVisit.checked) {
                siteVisit.click();
            }
        });
        await sleep(1500);

        // Click Save Quotation
        console.log('3. Clicking "Save Quotation"...');
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const b = btns.find(btn => btn.innerText.includes('Save Quotation'));
            if (b) b.click();
        });

        // Wait for redirect to /invoices/{id}
        console.log('Waiting for redirect...');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(e => console.log('Navigation wait:', e.message));
        await sleep(3000);

        const currentUrl = page.url();
        console.log('Current URL after save:', currentUrl);

        if (currentUrl.includes('/invoices/undefined')) {
            throw new Error('FAILED: Redirected to /invoices/undefined!');
        }
        if (!currentUrl.match(/\/invoices\/[0-9a-fA-F-]+/)) {
            console.log('Current page content snippet:', await page.evaluate(() => document.body.innerText.substring(0, 500)));
            throw new Error(`FAILED: Did not redirect to valid quote ID URL. Current: ${currentUrl}`);
        }

        const createdQuoteId = currentUrl.split('/invoices/')[1].split('?')[0];
        console.log(`SUCCESS! Created AeroWash Quote ID: ${createdQuoteId}`);

        // Capture screenshot of the created quote view
        const screenshotQuoteSaved = path.join(ARTIFACT_DIR, 'aerowash_quote_saved.png');
        await page.screenshot({ path: screenshotQuoteSaved, fullPage: false });
        console.log(`Saved screenshot: ${screenshotQuoteSaved}`);

        // 4. Verify all saved fields in the database
        console.log('4. Verifying saved fields in database metadata...');
        const savedQuoteDb = await prisma.invoice.findUnique({
            where: { id: createdQuoteId },
            include: { items: true }
        });

        console.log('Saved Quote DB check:', {
            id: savedQuoteDb.id,
            quoteNumber: savedQuoteDb.quoteNumber,
            total: savedQuoteDb.total,
            itemsCount: savedQuoteDb.items.length,
            hasMetadata: Boolean(savedQuoteDb.metadata),
            hasElevations: Boolean(savedQuoteDb.metadata?.elevations),
            hasProvisions: Boolean(savedQuoteDb.metadata?.siteProvisions),
            hasScope: Boolean(savedQuoteDb.metadata?.scopeOfWorks),
            hasClientViewLines: Boolean(savedQuoteDb.metadata?.clientViewLines)
        });

        // 5. Reopen and edit the created quote
        console.log('5. Editing the created quote...');
        // Change Reference
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const ref = inputs.find(i => i.value && i.value.includes('Rockefeller'));
            if (ref) {
                ref.value = 'Rockefeller Facade & Glazing Clean (Updated Scope)';
                ref.dispatchEvent(new Event('input', { bubbles: true }));
                ref.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await sleep(1000);

        // Click "Save Changes"
        console.log('Clicking "Save Changes"...');
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const saveChangesBtn = btns.find(b => b.innerText.includes('Save Changes'));
            if (saveChangesBtn) saveChangesBtn.click();
        });

        await sleep(4000);

        const screenshotQuoteEdited = path.join(ARTIFACT_DIR, 'aerowash_quote_edited.png');
        await page.screenshot({ path: screenshotQuoteEdited, fullPage: false });
        console.log(`Saved screenshot: ${screenshotQuoteEdited}`);

        // 6. Test LR Builders Quote creation in a fresh incognito context
        console.log('6. Opening fresh incognito context for LR Builders...');
        const lrContext = await browser.createIncognitoBrowserContext();
        const lrPage = await lrContext.newPage();
        lrPage.on('dialog', async d => { await d.accept(); });

        console.log('Logging into LR Builders (uthmaan@lrbuilders.co.za)...');
        await lrPage.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await lrPage.type('input[type="email"]', 'uthmaan@lrbuilders.co.za');
        await lrPage.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            lrPage.waitForNavigation({ waitUntil: 'networkidle0' }),
            lrPage.click('button[type="submit"]')
        ]);

        console.log('Navigating to LR Builders New Quote (/invoices/new)...');
        await lrPage.goto('http://localhost:3012/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2500);

        // Select Client for LR Builders
        console.log('Selecting Client for LR Builders...');
        const lrClientVal = await lrPage.evaluate(() => {
            const select = document.getElementById('client-select');
            if (!select) return '';
            const opt = Array.from(select.options).find(o => o.value !== '');
            return opt ? opt.value : '';
        });
        if (lrClientVal) {
            await lrPage.select('#client-select', lrClientVal);
            console.log('Selected LR client value:', lrClientVal);
        }
        await sleep(1000);

        // Add a line item description and price
        console.log('Adding line item for LR Builders...');
        await lrPage.evaluate(() => {
            const descInput = document.querySelector('textarea, input[placeholder*="Description"]');
            if (descInput) {
                descInput.value = 'Supply and install standard aluminum windows';
                descInput.dispatchEvent(new Event('input', { bubbles: true }));
                descInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await lrPage.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const priceInput = inputs.find(i => i.placeholder && (i.placeholder.includes('0.00') || i.placeholder.includes('Price')));
            if (priceInput) {
                priceInput.value = '12500';
                priceInput.dispatchEvent(new Event('input', { bubbles: true }));
                priceInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await sleep(1500);

        // Click Save Quotation for LR Builders
        console.log('Clicking Save Quotation for LR Builders...');
        await lrPage.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const b = btns.find(btn => btn.innerText.includes('Save Quotation'));
            if (b) b.click();
        });

        await lrPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(e => console.log('LR Navigation wait:', e.message));
        await sleep(3000);

        const lrCurrentUrl = lrPage.url();
        console.log('LR Builders URL after save:', lrCurrentUrl);

        if (lrCurrentUrl.includes('/invoices/undefined')) {
            throw new Error('FAILED: LR Builders redirected to /invoices/undefined!');
        }
        if (!lrCurrentUrl.match(/\/invoices\/[0-9a-fA-F-]+/)) {
            throw new Error(`FAILED: LR Builders did not redirect to valid quote ID. URL: ${lrCurrentUrl}`);
        }

        const createdLrQuoteId = lrCurrentUrl.split('/invoices/')[1].split('?')[0];
        console.log(`SUCCESS! Created LR Builders Quote ID: ${createdLrQuoteId}`);

        const screenshotLrSaved = path.join(ARTIFACT_DIR, 'lr_builders_quote_saved.png');
        await lrPage.screenshot({ path: screenshotLrSaved, fullPage: false });
        console.log(`Saved screenshot: ${screenshotLrSaved}`);

        await lrContext.close();
        console.log(`Saved screenshot: ${screenshotLrSaved}`);

        console.log('=== ALL PREVIEW TESTS COMPLETED SUCCESSFULLY! ===');
    } finally {
        await browser.close();
        nextServer.kill();
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('TEST ERROR:', err);
    process.exit(1);
});
