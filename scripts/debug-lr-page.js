const puppeteer = require('puppeteer-core');
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

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
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
    await new Promise(r => setTimeout(r, 2000));

    const buttonTexts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
    });
    console.log('BUTTONS FOUND ON PAGE:', buttonTexts);

    const hasJustification = await page.evaluate(() => {
        return document.body.innerText.includes('Justification') || document.body.innerText.includes('JUSTIFICATION');
    });
    console.log('PAGE HAS JUSTIFICATION TEXT:', hasJustification);

    await browser.close();
}

main().catch(console.error);
