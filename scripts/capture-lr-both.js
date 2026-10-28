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
            const val = trimmed.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, '');
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
        PORT: '3009'
    };

    const nextServer = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3009'], {
        env: serverEnv,
        stdio: 'pipe'
    });

    await sleep(4000);

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1440, height: 1100 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('http://localhost:3009/login', { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'uthmaan@lrbuilders.co.za');
    await page.type('input[type="password"]', 'Uthmaan@09');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('button[type="submit"]')
    ]);

    await page.goto('http://localhost:3009/invoices/new', { waitUntil: 'networkidle0' });
    await sleep(2500);

    // Scroll to Line Items
    await page.evaluate(() => {
        window.scrollTo(0, 520);
    });
    await sleep(800);

    // 1. Screenshot of General Work with Justification visible
    const path1 = path.join(ARTIFACT_DIR, 'lr_general_quote_justification_visible.png');
    await page.screenshot({ path: path1, fullPage: false });
    console.log(`Saved screenshot 1: ${path1}`);

    // 2. Click "TENDER WORK"
    console.log('Clicking "TENDER WORK"...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tenderBtn = buttons.find(b => b.innerText.includes('TENDER WORK'));
        if (tenderBtn) tenderBtn.click();
    });
    await sleep(1500);

    // Keep scroll at line items
    await page.evaluate(() => {
        window.scrollTo(0, 520);
    });
    await sleep(500);

    // Screenshot of Tender Work with Justification hidden
    const path2 = path.join(ARTIFACT_DIR, 'lr_tender_quote_no_justification.png');
    await page.screenshot({ path: path2, fullPage: false });
    console.log(`Saved screenshot 2: ${path2}`);

    const hasJustificationNow = await page.evaluate(() => {
        return document.body.innerText.includes('JUSTIFICATION:');
    });
    console.log('Is JUSTIFICATION: present on Tender Work?', hasJustificationNow);

    await browser.close();
    nextServer.kill('SIGTERM');
}

main().catch(console.error);
