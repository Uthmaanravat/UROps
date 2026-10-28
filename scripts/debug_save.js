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
    console.log('Starting Next.js on 3015...');
    const serverEnv = {
        ...process.env,
        ...env,
        DATABASE_URL: throwawayPoolerUrl.toString(),
        DIRECT_URL: throwawayUrl.toString(),
        PORT: '3015'
    };

    const nextServer = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3015'], {
        env: serverEnv,
        stdio: 'pipe'
    });

    nextServer.stdout.on('data', d => console.log('[NEXT]', d.toString().trim()));
    nextServer.stderr.on('data', d => console.error('[NEXT ERR]', d.toString().trim()));

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

    page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.text()));

    try {
        await page.goto('http://localhost:3015/login', { waitUntil: 'networkidle0' });
        await page.type('input[type="email"]', 'uthmaan@aerowash.co.za');
        await page.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        await page.goto('http://localhost:3015/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2500);

        const clientVal = await page.evaluate(() => {
            const select = document.getElementById('client-select');
            const opt = Array.from(select.options).find(o => o.text.includes('Newmark') || o.text.includes('Patriot') || o.text.includes('Lemco'));
            return opt ? opt.value : '';
        });
        console.log('Selected client value:', clientVal);
        await page.select('#client-select', clientVal);
        await sleep(1000);

        // Click Save Quotation
        console.log('Clicking Save Quotation...');
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const b = btns.find(btn => btn.innerText.includes('Save Quotation'));
            if (b) b.click();
        });

        await sleep(4000);

        // Check for error elements or text
        const errorText = await page.evaluate(() => {
            const errs = Array.from(document.querySelectorAll('.bg-red-500\\/20, [class*="red"], .text-red-200'));
            return errs.map(e => e.innerText).join('\n---\n');
        });
        console.log('PAGE ERROR TEXT:', errorText);

        const currentUrl = page.url();
        console.log('Current URL:', currentUrl);

        const screenshot = path.join(ARTIFACT_DIR, 'debug_save_error.png');
        await page.screenshot({ path: screenshot, fullPage: true });
        console.log(`Saved screenshot: ${screenshot}`);
    } finally {
        await browser.close();
        nextServer.kill();
    }
}

main().catch(console.error);
