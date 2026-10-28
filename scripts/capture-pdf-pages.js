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
    
    // Load local HTML with embed or pdf.js or simply navigate to file
    await page.goto(`file:///${pdfPath}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    const outPath = path.join(ARTIFACT_DIR, 'aerowash_patriot_pdf_preview.png');
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved PDF preview: ${outPath}`);

    await browser.close();
}

main().catch(console.error);
