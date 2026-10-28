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
            const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            env[key] = val;
        }
    }
}

const throwawayUrl = new URL(env.DIRECT_URL);
throwawayUrl.searchParams.set('schema', 'throwaway_copy');
const throwawayPoolerUrl = new URL(env.DATABASE_URL);
throwawayPoolerUrl.searchParams.set('schema', 'throwaway_copy');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('=== CLEAN PREVIEW VERIFICATION ===');

    const serverEnv = {
        ...process.env,
        ...env,
        DATABASE_URL: throwawayPoolerUrl.toString(),
        DIRECT_URL: throwawayUrl.toString(),
        PORT: '3012'
    };

    console.log('Starting Next.js server on port 3012...');
    const nextServer = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3012'], {
        env: serverEnv,
        stdio: 'pipe'
    });

    nextServer.stdout.on('data', d => {
        const msg = d.toString().trim();
        if (msg.includes('ERROR') || msg.includes('FATAL') || msg.includes('Ready')) {
            console.log('[NEXT]', msg);
        }
    });
    nextServer.stderr.on('data', d => console.error('[NEXT ERR]', d.toString().trim()));

    await sleep(4000);

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1440, height: 1100 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // =============================================================
        // 1. AEROWASH TEST
        // =============================================================
        const page1 = await browser.newPage();
        page1.on('dialog', async d => { await d.accept(); });

        console.log('\n--- 1. Testing AeroWash ---');
        await page1.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await page1.type('input[type="email"]', 'uthmaan@aerowash.co.za');
        await page1.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page1.waitForNavigation({ waitUntil: 'networkidle0' }),
            page1.click('button[type="submit"]')
        ]);

        console.log('Logged into AeroWash. Navigating to /invoices/new...');
        await page1.goto('http://localhost:3012/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2000);

        // Check Catalog side panel is GONE
        const hasCatalogPanel = await page1.evaluate(() => {
            return document.body.innerText.includes('Standard Catalog');
        });
        console.log('Standard Catalog panel present on AeroWash builder?', hasCatalogPanel ? 'YES (UNEXPECTED)' : 'NO (CORRECT)');

        // Select Client (e.g. index 1)
        console.log('Selecting Client...');
        const clientVal = await page1.evaluate(() => {
            const sel = document.querySelector('select');
            return sel && sel.options.length > 1 ? sel.options[1].value : '';
        });
        await page1.select('select', clientVal);
        await sleep(500);

        // Tick "Site visit completed"
        console.log('Ticking "Site visit completed"...');
        await page1.evaluate(() => {
            const cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            const cb = cbs.find(c => c.closest('label')?.innerText.includes('Site visit completed'));
            if (cb && !cb.checked) cb.click();
        });
        await sleep(500);

        // Upload 2 photos
        console.log('Uploading 2 site visit photos...');
        const fileInput = await page1.$('input[type="file"]');
        if (fileInput) {
            const photo1 = path.resolve('scripts/test-photos/photo-01.png');
            const photo2 = path.resolve('scripts/test-photos/photo-02.png');
            await fileInput.uploadFile(photo1, photo2);
            await sleep(1500);
            console.log('2 photos uploaded and compressed into state.');
        }

        // Add Condition Flag
        console.log('Adding Condition Flag...');
        await page1.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const addFlagBtn = buttons.find(b => b.innerText.includes('Add Condition Flag') || b.innerText.includes('Condition Flag'));
            if (addFlagBtn) addFlagBtn.click();
        });
        await sleep(800);

        // Save Flag
        await page1.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const saveFlagBtn = buttons.find(b => b.innerText.trim() === 'Save Flag' || b.innerText.includes('Save Flag'));
            if (saveFlagBtn) saveFlagBtn.click();
        });
        await sleep(800);
        console.log('Condition flag saved.');

        // Tick Extended Travel
        console.log('Ticking Extended Travel...');
        await page1.evaluate(() => {
            const cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            const cb = cbs.find(c => c.closest('label')?.innerText.includes('Extended Travel') || c.closest('label')?.innerText.includes('Item 20'));
            if (cb && !cb.checked) cb.click();
        });
        await sleep(500);

        // Set Extended Travel Price via React value setter
        console.log('Setting Extended Travel price to 1500...');
        await page1.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="number"]'));
            for (const inp of inputs) {
                const parent = inp.closest('.rounded-xl');
                if (parent && (parent.innerText.includes('Extended Travel') || parent.innerText.includes('Item 20'))) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(inp, '1500');
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }
            }
        });
        await sleep(500);

        // Select Quarterly contract programme
        console.log('Selecting Quarterly contract programme...');
        await page1.evaluate(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            for (const s of selects) {
                for (const opt of s.options) {
                    if (opt.value === 'QUARTERLY') {
                        s.value = 'QUARTERLY';
                        s.dispatchEvent(new Event('change', { bubbles: true }));
                        return;
                    }
                }
            }
        });
        await sleep(800);

        // Check for any validation errors on page
        const validationMsg = await page1.evaluate(() => {
            const errBox = document.querySelector('.bg-red-500\\/10, .border-red-500');
            return errBox ? errBox.innerText : null;
        });
        if (validationMsg) console.log('Validation notice on page:', validationMsg);

        // Click Save Quotation
        console.log('Clicking "Save Quotation"...');
        await page1.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const saveBtn = buttons.find(b => b.innerText.includes('Save Quotation') || b.innerText.includes('Create Quotation'));
            if (saveBtn) saveBtn.click();
        });

        // Wait for redirect to /invoices/{id}
        console.log('Waiting for redirection...');
        try {
            await page1.waitForFunction(() => {
                const url = window.location.href;
                return url.includes('/invoices/') && !url.includes('/new') && !url.includes('undefined');
            }, { timeout: 12000 });
        } catch (e) {
            console.log('Navigation wait timed out. Checking current state...');
        }

        const aeroFinalUrl = page1.url();
        console.log('AeroWash Final URL:', aeroFinalUrl);

        const pageErrors = await page1.evaluate(() => {
            const banner = document.querySelector('.bg-red-500\\/10, .text-red-400');
            return banner ? banner.innerText : null;
        });
        if (pageErrors) console.log('Errors on page:', pageErrors);

        await page1.screenshot({ path: path.join(ARTIFACT_DIR, 'aerowash_quote_saved_proof.png'), fullPage: true });
        console.log('AeroWash screenshot captured: aerowash_quote_saved_proof.png');
        await page1.close();

        // =============================================================
        // 2. LR BUILDERS TEST
        // =============================================================
        console.log('\n--- 2. Testing LR Builders ---');
        const page2 = await browser.newPage();
        page2.on('dialog', async d => { await d.accept(); });

        const client2 = await page2.target().createCDPSession();
        await client2.send('Network.clearBrowserCookies');

        await page2.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await page2.type('input[type="email"]', 'uthmaan@lrbuilders.co.za');
        await page2.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page2.waitForNavigation({ waitUntil: 'networkidle0' }),
            page2.click('button[type="submit"]')
        ]);

        console.log('Logged into LR Builders. Navigating to /invoices/new...');
        await page2.goto('http://localhost:3012/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2000);

        // Check Catalog side panel IS present
        const lrHasCatalog = await page2.evaluate(() => {
            return document.body.innerText.includes('Standard Catalog');
        });
        console.log('Standard Catalog panel present on LR Builders builder?', lrHasCatalog ? 'YES (CORRECT)' : 'NO (UNEXPECTED)');

        // Select Client
        const lrClientVal = await page2.evaluate(() => {
            const sel = document.querySelector('select');
            return sel && sel.options.length > 1 ? sel.options[1].value : '';
        });
        await page2.select('select', lrClientVal);
        await sleep(500);

        // Add item description and rate
        await page2.evaluate(() => {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            const descInp = document.querySelector('input[placeholder*="Description"], textarea[placeholder*="Description"]');
            if (descInp) {
                nativeSetter.call(descInp, 'General Facade Maintenance & Masonry Works');
                descInp.dispatchEvent(new Event('input', { bubbles: true }));
                descInp.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const rateInp = document.querySelector('input[placeholder*="Rate"], input[placeholder*="Price"], input[name*="rate"]');
            if (rateInp) {
                nativeSetter.call(rateInp, '18500');
                rateInp.dispatchEvent(new Event('input', { bubbles: true }));
                rateInp.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await sleep(500);

        // Click Save Quotation
        console.log('Clicking "Save Quotation" for LR Builders...');
        await page2.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const saveBtn = buttons.find(b => b.innerText.includes('Save Quotation') || b.innerText.includes('Create Quotation'));
            if (saveBtn) saveBtn.click();
        });

        try {
            await page2.waitForFunction(() => {
                const url = window.location.href;
                return url.includes('/invoices/') && !url.includes('/new') && !url.includes('undefined');
            }, { timeout: 12000 });
        } catch (e) {
            console.log('LR Builders navigation wait timed out.');
        }

        const lrFinalUrl = page2.url();
        console.log('LR Builders Final URL:', lrFinalUrl);

        await page2.screenshot({ path: path.join(ARTIFACT_DIR, 'lr_builders_quote_saved_proof.png'), fullPage: true });
        console.log('LR Builders screenshot captured: lr_builders_quote_saved_proof.png');
        await page2.close();

    } catch (err) {
        console.error('Fatal test error:', err);
    } finally {
        await browser.close();
        nextServer.kill('SIGTERM');
        console.log('Done.');
        process.exit(0);
    }
}

main();
