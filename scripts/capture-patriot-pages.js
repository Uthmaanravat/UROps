const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';

async function main() {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1200, height: 1600 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const pdfPath = path.join(ARTIFACT_DIR, 'aerowash_patriot_quote_aw_2026_007.pdf').replace(/\\/g, '/');
    
    // Load local PDF file in Chrome PDF viewer
    await page.goto(`file:///${pdfPath}#page=1`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    const p1Path = path.join(ARTIFACT_DIR, 'aerowash_patriot_pdf_page1.png');
    await page.screenshot({ path: p1Path, fullPage: false });
    console.log(`Saved Page 1: ${p1Path}`);

    // Navigate or scroll to page 2
    await page.goto(`file:///${pdfPath}#page=2`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    // Also scroll down inside page to ensure page 2 is visible
    await page.evaluate(() => {
        window.scrollBy(0, 1400);
    });
    await new Promise(r => setTimeout(r, 1000));

    const p2Path = path.join(ARTIFACT_DIR, 'aerowash_patriot_pdf_page2.png');
    await page.screenshot({ path: p2Path, fullPage: false });
    console.log(`Saved Page 2: ${p2Path}`);

    await browser.close();
}

main().catch(console.error);
