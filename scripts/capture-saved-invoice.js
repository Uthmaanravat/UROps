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

    try {
        // 1. Log in to AeroWash
        await page.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await page.type('input[type="email"]', 'uthmaan@aerowash.co.za');
        await page.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        // 2. Open saved invoice
        console.log('Navigating to saved invoice /invoices/8172f92f-06cb-4b76-9e47-1c7bec1aa761...');
        await page.goto('http://localhost:3012/invoices/8172f92f-06cb-4b76-9e47-1c7bec1aa761', { waitUntil: 'networkidle0' });
        await sleep(3000);

        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'aerowash_quote_saved_proof.png'), fullPage: true });
        console.log('Saved screenshot: aerowash_quote_saved_proof.png');

        // 3. Test LR Builders
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');

        await page.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await page.type('input[type="email"]', 'uthmaan@lrbuilders.co.za');
        await page.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        console.log('Navigating to LR Builders /invoices/new...');
        await page.goto('http://localhost:3012/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2000);

        // Check if catalog panel exists for LR Builders
        const hasCatalog = await page.evaluate(() => {
            return document.body.innerText.includes('Standard Catalog') || document.body.innerText.includes('Catalog');
        });
        console.log('LR Builders has Catalog Panel:', hasCatalog);

        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'lr_builders_builder_with_catalog.png'), fullPage: true });
        console.log('Saved screenshot: lr_builders_builder_with_catalog.png');

    } finally {
        await browser.close();
        nextServer.kill('SIGTERM');
        process.exit(0);
    }
}

main();
