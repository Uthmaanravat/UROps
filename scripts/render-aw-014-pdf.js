const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';

async function renderPage(browser, pdfBase64, pageNum, outFilename) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 2000 });

    await page.setContent(`
        <!DOCTYPE html><html><head><script src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'></script></head>
        <body style='margin:0;padding:20px;background:#262626;display:flex;justify-content:center;'><canvas id='c'></canvas>
        <script>
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            window.rendered = false;
            pdfjsLib.getDocument({ data: atob("${pdfBase64}") }).promise
                .then(doc => doc.getPage(${pageNum}))
                .then(p => {
                    const vp = p.getViewport({ scale: 2.0 });
                    const c = document.getElementById('c');
                    c.width = vp.width;
                    c.height = vp.height;
                    return p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
                })
                .then(() => { window.rendered = true; });
        </script></body></html>
    `);

    await page.waitForFunction(() => window.rendered === true, { timeout: 15000 });
    const dims = await page.evaluate(() => {
        const c = document.getElementById('c');
        return { width: c.width, height: c.height };
    });
    await page.setViewport({ width: Math.ceil(dims.width + 60), height: Math.ceil(dims.height + 60) });
    const el = await page.$('#c');
    const outPath = path.join(ARTIFACT_DIR, outFilename);
    await el.screenshot({ path: outPath });
    await page.close();
    console.log(`Rendered page ${pageNum} to ${outPath}`);
}

async function main() {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // 1. Render AW-2026-014
        const pdf014Path = path.join(ARTIFACT_DIR, 'AW-2026-014-Marcella.pdf');
        const pdf014Base64 = fs.readFileSync(pdf014Path).toString('base64');
        await renderPage(browser, pdf014Base64, 1, 'preview_aw_2026_014_page1.png');
        await renderPage(browser, pdf014Base64, 2, 'preview_aw_2026_014_page2.png');

        // 2. Render AW Commercial Test Quote
        const pdfCommPath = path.join(ARTIFACT_DIR, 'AW-Commercial-Test-Quote.pdf');
        const pdfCommBase64 = fs.readFileSync(pdfCommPath).toString('base64');
        await renderPage(browser, pdfCommBase64, 1, 'preview_aw_comm_test_page1.png');
        await renderPage(browser, pdfCommBase64, 2, 'preview_aw_comm_test_page2.png');
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
