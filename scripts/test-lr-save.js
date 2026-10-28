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
    console.log('=== RUNNING LR BUILDERS QUOTE SAVE TEST ===');

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

    await sleep(4000);

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        page.on('dialog', async d => { await d.accept(); });

        console.log('Logging into LR Builders...');
        await page.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await page.type('input[type="email"]', 'uthmaan@lrbuilders.co.za');
        await page.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        console.log('Navigating to LR Builders New Quote (/invoices/new)...');
        await page.goto('http://localhost:3012/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2500);

        // Select Client
        const lrClientVal = await page.evaluate(() => {
            const select = document.getElementById('client-select');
            if (!select) return '';
            const opt = Array.from(select.options).find(o => o.value !== '');
            return opt ? opt.value : '';
        });
        if (lrClientVal) {
            await page.select('#client-select', lrClientVal);
        }
        await sleep(1000);

        // Click first "Add" button from catalog
        console.log('Clicking catalog Add button...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const addBtn = buttons.find(b => b.innerText.trim() === 'Add');
            if (addBtn) addBtn.click();
        });
        await sleep(1500);

        // Click Save Quotation
        console.log('Clicking Save Quotation...');
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const b = btns.find(btn => btn.innerText.includes('Save Quotation'));
            if (b) b.click();
        });

        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(e => console.log('Wait timeout:', e.message));
        await sleep(3000);

        const currentUrl = page.url();
        console.log('URL after save:', currentUrl);

        if (!currentUrl.match(/\/invoices\/[0-9a-fA-F-]+/)) {
            throw new Error(`Failed to redirect to quote ID: ${currentUrl}`);
        }

        const screenshotLrSaved = path.join(ARTIFACT_DIR, 'lr_builders_quote_saved.png');
        await page.screenshot({ path: screenshotLrSaved, fullPage: false });
        console.log(`Saved screenshot: ${screenshotLrSaved}`);
        console.log('SUCCESS! LR Builders Quote saved successfully.');
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
