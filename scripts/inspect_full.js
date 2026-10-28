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
    console.log('Starting Next.js on 3016...');
    const serverEnv = {
        ...process.env,
        ...env,
        DATABASE_URL: throwawayPoolerUrl.toString(),
        DIRECT_URL: throwawayUrl.toString(),
        PORT: '3016'
    };

    const nextServer = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3016'], {
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
    page.on('console', msg => console.log('[PAGE CONSOLE]', msg.text()));

    try {
        await page.goto('http://localhost:3016/login', { waitUntil: 'networkidle0' });
        await page.type('input[type="email"]', 'uthmaan@aerowash.co.za');
        await page.type('input[type="password"]', 'Uthmaan@09');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        await page.goto('http://localhost:3016/invoices/new', { waitUntil: 'networkidle0' });
        await sleep(3000);

        const info = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const saveBtn = btns.find(b => b.innerText.includes('Save Quotation'));
            return {
                saveBtnText: saveBtn ? saveBtn.innerText : 'NOT FOUND',
                saveBtnDisabled: saveBtn ? saveBtn.disabled : null,
                saveBtnClass: saveBtn ? saveBtn.className : null,
                hasAeroWashBuilder: Boolean(document.querySelector('h2')?.innerText.includes('AeroWash')),
                h2Text: document.querySelector('h2')?.innerText,
                clientSelectVal: document.getElementById('client-select')?.value,
                allSelects: Array.from(document.querySelectorAll('select')).map(s => ({ id: s.id, value: s.value, options: Array.from(s.options).map(o => o.text) }))
            };
        });
        console.log('PAGE INFO AT LOAD:', JSON.stringify(info, null, 2));

        // Now select a client
        const clientVal = await page.evaluate(() => {
            const select = document.getElementById('client-select');
            const opt = Array.from(select.options).find(o => o.text.includes('Newmark') || o.text.includes('Patriot') || o.text.includes('Lemco'));
            return opt ? opt.value : '';
        });
        console.log('Selected client value:', clientVal);
        await page.select('#client-select', clientVal);
        await sleep(1000);

        const infoAfterSelect = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const saveBtn = btns.find(b => b.innerText.includes('Save Quotation'));
            return {
                saveBtnDisabled: saveBtn ? saveBtn.disabled : null,
                clientSelectVal: document.getElementById('client-select')?.value
            };
        });
        console.log('PAGE INFO AFTER CLIENT SELECT:', infoAfterSelect);

        // Click Save Quotation
        console.log('Clicking Save Quotation button directly via DOM...');
        const clickResult = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const saveBtn = btns.find(b => b.innerText.includes('Save Quotation'));
            if (!saveBtn) return 'Button not found';
            if (saveBtn.disabled) return 'Button is disabled!';
            saveBtn.click();
            return 'Clicked!';
        });
        console.log('Click result:', clickResult);

        // Wait 5 seconds
        await sleep(5000);

        console.log('Current URL after 5s:', page.url());
        const errors = await page.evaluate(() => {
            const el = document.querySelector('.bg-red-500\\/20');
            return el ? el.innerText : 'NO ERROR BANNER';
        });
        console.log('Errors on page:', errors);

    } finally {
        await browser.close();
        nextServer.kill();
    }
}

main().catch(console.error);
