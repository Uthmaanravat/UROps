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

    const text = await page.evaluate(() => document.body.innerText);
    console.log('--- PAGE TEXT SAMPLE ---');
    console.log(text.slice(0, 1500));
    console.log('--- LINE ITEMS SECTION ---');
    const idx = text.indexOf('Line Items');
    if (idx !== -1) {
        console.log(text.slice(idx, idx + 1000));
    } else {
        console.log('No "Line Items" found in page text!');
    }

    await browser.close();
    nextServer.kill('SIGTERM');
}

main().catch(console.error);
