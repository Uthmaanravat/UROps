const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1440, height: 1100 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('[PAGE CONSOLE]', msg.text()));

    await page.goto('http://localhost:3015/login', { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'uthmaan@aerowash.co.za');
    await page.type('input[type="password"]', 'Uthmaan@09');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('button[type="submit"]')
    ]);

    await page.goto('http://localhost:3015/invoices/new', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    const info = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const saveBtn = btns.find(b => b.innerText.includes('Save Quotation'));
        return {
            saveBtnText: saveBtn ? saveBtn.innerText : 'NOT FOUND',
            saveBtnDisabled: saveBtn ? saveBtn.disabled : null,
            saveBtnOuterHTML: saveBtn ? saveBtn.outerHTML : null,
            hasAeroWashBuilder: Boolean(document.querySelector('h2')?.innerText.includes('AeroWash')),
            h2Text: document.querySelector('h2')?.innerText,
            clientSelectVal: document.getElementById('client-select')?.value
        };
    });
    console.log('PAGE INFO:', info);

    await browser.close();
}

main().catch(console.error);
