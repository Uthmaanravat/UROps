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

    nextServer.stdout.on('data', d => {
        const msg = d.toString().trim();
        console.log('[NEXT STDOUT]', msg);
    });
    nextServer.stderr.on('data', d => {
        const msg = d.toString().trim();
        console.error('[NEXT STDERR]', msg);
    });

    await sleep(3500);

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1440, height: 1100 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
    page.on('pageerror', err => console.error('[BROWSER PAGE ERROR]', err.message));

    try {
        await page.goto('http://localhost:3012/login', { waitUntil: 'networkidle0' });
        await page.type('input[type="email"]', 'uthmaan@aerowash.co.za');
        await page.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        await page.goto('http://localhost:3012/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(2000);

        // Print all buttons on page
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button')).map(b => ({
                text: b.innerText.trim(),
                type: b.getAttribute('type'),
                disabled: b.disabled,
                classes: b.className
            }));
        });
        console.log('Buttons on page:', buttons.filter(b => b.text.includes('Save') || b.text.includes('Quote') || b.text.includes('Create')));

        // Check form elements
        const formInfo = await page.evaluate(() => {
            const forms = Array.from(document.querySelectorAll('form'));
            return forms.map(f => ({
                action: f.action,
                method: f.method,
                id: f.id,
                className: f.className
            }));
        });
        console.log('Forms on page:', formInfo);

        // Click Save Quotation and capture console logs
        console.log('Attempting click on Save Quotation button...');
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const saveBtn = btns.find(b => b.innerText.includes('Save Quotation'));
            if (saveBtn) {
                console.log('Found Save Quotation button, clicking...');
                saveBtn.click();
            } else {
                console.log('Save Quotation button NOT FOUND');
            }
        });

        await sleep(3000);

        // Check if any error text appears on the page
        const errorText = await page.evaluate(() => {
            const alert = document.querySelector('[role="alert"], .border-red-500, .bg-red-500\\/10');
            return alert ? alert.innerText : 'No alert box';
        });
        console.log('Alert on page:', errorText);

    } finally {
        await browser.close();
        nextServer.kill('SIGTERM');
        process.exit(0);
    }
}

main();
