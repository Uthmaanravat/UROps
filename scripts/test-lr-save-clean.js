const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
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

    await sleep(3500);

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1440, height: 1100 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('dialog', async d => { await d.accept(); });

    try {
        await page.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await page.type('input[type="email"]', 'uthmaan@lrbuilders.co.za');
        await page.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        console.log('Navigating to LR Builders /invoices/new...');
        await page.goto('http://localhost:3012/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2500);

        // Select Client
        console.log('Selecting Client for LR Builders...');
        const clientVal = await page.evaluate(() => {
            const sel = document.querySelector('select');
            return sel && sel.options.length > 1 ? sel.options[1].value : '';
        });
        if (clientVal) {
            await page.select('select', clientVal);
            await sleep(1000);
        }

        // Click "Add" button on the first catalog item in the side panel
        console.log('Clicking "Add" on first catalog item...');
        await page.evaluate(() => {
            const panel = document.querySelector('.lg\\:w-96');
            if (panel) {
                const addBtn = Array.from(panel.querySelectorAll('button')).find(b => b.innerText.trim() === 'Add' || b.innerText.includes('Add'));
                if (addBtn) {
                    console.log('Found Add button, clicking:', addBtn.innerText);
                    addBtn.click();
                } else {
                    console.log('Add button NOT found in panel');
                }
            }
        });
        await sleep(1500);

        // Capture screenshot of builder with catalog item added
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'lr_builders_builder_with_catalog.png'), fullPage: true });
        console.log('Saved: lr_builders_builder_with_catalog.png');

        // Check form state before clicking save
        const formState = await page.evaluate(() => {
            const clientSel = document.querySelector('select');
            const items = Array.from(document.querySelectorAll('input[placeholder*="Description"]')).map(i => i.value);
            return {
                clientId: clientSel ? clientSel.value : '',
                itemsCount: items.length,
                descriptions: items
            };
        });
        console.log('Form state before save:', formState);

        // Click "Save Quotation"
        console.log('Clicking "Save Quotation"...');
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const saveBtn = btns.find(b => b.innerText.includes('Save Quotation'));
            if (saveBtn) saveBtn.click();
        });

        await sleep(3000);

        const pageErrors = await page.evaluate(() => {
            const el = document.querySelector('[role="alert"], .bg-red-500\\/10, .border-red-500, .text-red-400');
            return el ? el.innerText : null;
        });
        console.log('Errors on page after save:', pageErrors);

        console.log('Waiting for navigation to saved invoice...');
        await page.waitForFunction(() => {
            return window.location.href.includes('/invoices/') && !window.location.href.includes('/new');
        }, { timeout: 15000 });

        console.log('LR Builders saved quote URL:', page.url());
        await sleep(2000);

        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'lr_builders_quote_saved_proof.png'), fullPage: true });
        console.log('Saved: lr_builders_quote_saved_proof.png');

    } catch (e) {
        console.error('LR test error:', e.message);
    } finally {
        await browser.close();
        nextServer.kill('SIGTERM');
        process.exit(0);
    }
}

main();
