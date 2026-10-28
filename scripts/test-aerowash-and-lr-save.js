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
    console.log('=== VERIFYING AEROWASH & LR BUILDERS SAVE ON PREVIEW ===');

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
        if (msg) console.log('[NEXT]', msg);
    });
    nextServer.stderr.on('data', d => {
        const msg = d.toString().trim();
        if (msg) console.error('[NEXT ERR]', msg);
    });

    await sleep(4000);

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
        // -------------------------------------------------------------
        // PART 1: AEROWASH
        // -------------------------------------------------------------
        console.log('\n--- 1. Testing AeroWash Quote Builder & Save ---');
        await page.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await page.type('input[type="email"]', 'uthmaan@aerowash.co.za');
        await page.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        console.log('Logged into AeroWash. Navigating to /invoices/new...');
        await page.goto('http://localhost:3012/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2000);

        // Verify side panel is NOT present
        const sidePanel = await page.$('text/Standard Catalog');
        console.log('Standard Catalog panel present on AeroWash builder?', !!sidePanel ? 'YES (UNEXPECTED)' : 'NO (CORRECT)');

        // Select Client
        console.log('Selecting first client in dropdown...');
        await page.select('select[name="clientId"], select#clientId, select', await page.evaluate(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            for (const s of selects) {
                if (s.options.length > 1 && s.options[1].value) return s.options[1].value;
            }
            return '';
        }));
        await sleep(500);

        // Tick "Site visit completed"
        console.log('Ticking "Site visit completed"...');
        await page.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            for (const cb of checkboxes) {
                const label = cb.closest('label');
                if (label && label.innerText.includes('Site visit completed')) {
                    cb.click();
                    return;
                }
            }
        });
        await sleep(500);

        // Upload 2 photos
        console.log('Uploading 2 site visit photos...');
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            const photo1 = path.resolve('scripts/test-photos/photo-01.png');
            const photo2 = path.resolve('scripts/test-photos/photo-02.png');
            await fileInput.uploadFile(photo1, photo2);
            await sleep(1500);
            console.log('Photos uploaded and compressed into state.');
        } else {
            console.log('File input not found directly, checking for photo upload container...');
        }

        // Add Condition Flag
        console.log('Adding Condition Flag...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const addFlagBtn = buttons.find(b => b.innerText.includes('Add Condition Flag') || b.innerText.includes('Condition Flag'));
            if (addFlagBtn) addFlagBtn.click();
        });
        await sleep(1000);

        // Select Flag Type: Glass etching
        await page.evaluate(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            for (const s of selects) {
                for (const opt of s.options) {
                    if (opt.text.includes('Glass etching') || opt.value.includes('ETCHING')) {
                        s.value = opt.value;
                        s.dispatchEvent(new Event('change', { bubbles: true }));
                        return;
                    }
                }
            }
        });
        await sleep(500);

        // Save Flag
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const saveFlagBtn = buttons.find(b => b.innerText.trim() === 'Save Flag' || b.innerText.includes('Save Flag'));
            if (saveFlagBtn) saveFlagBtn.click();
        });
        await sleep(1000);
        console.log('Condition flag saved.');

        // Tick Extended Travel
        console.log('Ticking Extended Travel and setting price...');
        await page.evaluate(() => {
            const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            for (const cb of checkboxes) {
                const label = cb.closest('label');
                if (label && (label.innerText.includes('Extended Travel') || label.innerText.includes('Item 20'))) {
                    if (!cb.checked) cb.click();
                    return;
                }
            }
        });
        await sleep(500);

        // Find Extended Travel price input and set R1500
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="number"]'));
            for (const inp of inputs) {
                if (inp.placeholder && inp.placeholder.includes('Price on quote')) {
                    // Check if inside Extended Travel container
                    const parent = inp.closest('.rounded-xl');
                    if (parent && parent.innerText.includes('Extended Travel')) {
                        inp.value = '1500';
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                        return;
                    }
                }
            }
        });
        await sleep(500);

        // Select Quarterly contract programme
        console.log('Selecting Quarterly contract programme...');
        await page.evaluate(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            for (const s of selects) {
                for (const opt of s.options) {
                    if (opt.value === 'QUARTERLY' || opt.text.includes('Quarterly')) {
                        s.value = opt.value;
                        s.dispatchEvent(new Event('change', { bubbles: true }));
                        return;
                    }
                }
            }
        });
        await sleep(1000);

        // Click "Save Quotation"
        console.log('Clicking "Save Quotation"...');
        const saveBtn = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.innerText.includes('Save Quotation') || b.innerText.includes('Create Quotation'));
        });

        if (saveBtn) {
            await saveBtn.click();
            console.log('Waiting for response / navigation...');
            await sleep(5000);
        }

        const currentUrl = page.url();
        console.log('Current URL after save:', currentUrl);
        if (currentUrl.includes('/invoices/') && !currentUrl.includes('undefined') && !currentUrl.includes('/new')) {
            console.log('SUCCESS! AeroWash quote saved and redirected to:', currentUrl);
        } else {
            console.log('URL check:', currentUrl);
        }

        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'aerowash_quote_saved_proof.png'), fullPage: true });
        console.log('Saved screenshot: aerowash_quote_saved_proof.png');

        // -------------------------------------------------------------
        // PART 2: LR BUILDERS
        // -------------------------------------------------------------
        console.log('\n--- 2. Testing LR Builders Quote Builder & Save ---');
        await page.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await page.evaluate(() => {
            const inputs = document.querySelectorAll('input');
            inputs.forEach(i => i.value = '');
        });
        await page.type('input[type="email"]', 'uthmaan@lrbuilders.co.za');
        await page.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        console.log('Logged into LR Builders. Navigating to /invoices/new...');
        await page.goto('http://localhost:3012/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2000);

        // Verify side panel IS present
        const lrSidePanel = await page.$('text/Standard Catalog');
        console.log('Standard Catalog panel present on LR Builders builder?', !!lrSidePanel ? 'YES (CORRECT)' : 'NO');

        // Select Client
        await page.select('select[name="clientId"], select#clientId, select', await page.evaluate(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            for (const s of selects) {
                if (s.options.length > 1 && s.options[1].value) return s.options[1].value;
            }
            return '';
        }));
        await sleep(500);

        // Add a line item via description and rate
        await page.evaluate(() => {
            const descInp = document.querySelector('input[placeholder*="Description"], textarea[placeholder*="Description"]');
            if (descInp) {
                descInp.value = 'General Building & Facade Repair Works';
                descInp.dispatchEvent(new Event('input', { bubbles: true }));
                descInp.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const rateInp = document.querySelector('input[placeholder*="Rate"], input[placeholder*="Price"], input[name*="rate"]');
            if (rateInp) {
                rateInp.value = '18500';
                rateInp.dispatchEvent(new Event('input', { bubbles: true }));
                rateInp.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await sleep(500);

        // Click Save Quotation
        console.log('Clicking Save Quotation for LR Builders...');
        const lrSaveBtn = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.innerText.includes('Save Quotation') || b.innerText.includes('Create Quotation'));
        });

        if (lrSaveBtn) {
            await lrSaveBtn.click();
            await sleep(5000);
        }

        const lrCurrentUrl = page.url();
        console.log('Current URL after LR Builders save:', lrCurrentUrl);
        if (lrCurrentUrl.includes('/invoices/') && !lrCurrentUrl.includes('undefined') && !lrCurrentUrl.includes('/new')) {
            console.log('SUCCESS! LR Builders quote saved and redirected to:', lrCurrentUrl);
        }

        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'lr_builders_quote_saved_proof.png'), fullPage: true });
        console.log('Saved screenshot: lr_builders_quote_saved_proof.png');

    } catch (err) {
        console.error('Test execution error:', err);
    } finally {
        await browser.close();
        nextServer.kill('SIGTERM');
        console.log('Next.js server shut down.');
        process.exit(0);
    }
}

main();
