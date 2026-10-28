const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';

async function main() {
    const pdfPath = path.join(ARTIFACT_DIR, 'aerowash_rockefeller_quote_aw_2026_008.pdf');
    const pdfData = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfData.toString('base64');

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1700 });

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
            body { margin: 0; padding: 20px; background: #525659; display: flex; justify-content: center; }
            canvas { box-shadow: 0 4px 12px rgba(0,0,0,0.3); background: white; }
        </style>
    </head>
    <body>
        <canvas id="the-canvas"></canvas>
        <script>
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const pdfData = atob("${pdfBase64}");
            let pdfDoc = null;

            async function renderPageNum(num) {
                if (!pdfDoc) {
                    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
                    pdfDoc = await loadingTask.promise;
                }
                const page = await pdfDoc.getPage(num);
                const scale = 2.0; // High DPI
                const viewport = page.getViewport({ scale });
                const canvas = document.getElementById('the-canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                await page.render(renderContext).promise;
                return { totalPages: pdfDoc.numPages, width: viewport.width, height: viewport.height };
            }
        </script>
    </body>
    </html>
    `;

    await page.setContent(htmlContent);
    await new Promise(r => setTimeout(r, 1500));

    // Render Page 1
    const p1Info = await page.evaluate(() => window.renderPageNum(1));
    console.log('Page 1 rendered:', p1Info);
    const canvasElement = await page.$('#the-canvas');
    const p1Path = path.join(ARTIFACT_DIR, 'aerowash_rockefeller_pdf_page1.png');
    await canvasElement.screenshot({ path: p1Path });
    console.log('Saved Page 1 image:', p1Path);

    // Render Page 2
    await page.evaluate(() => window.renderPageNum(2));
    const p2Path = path.join(ARTIFACT_DIR, 'aerowash_rockefeller_pdf_page2.png');
    await canvasElement.screenshot({ path: p2Path });
    console.log('Saved Page 2 image:', p2Path);

    // Render Page 3
    await page.evaluate(() => window.renderPageNum(3));
    const p3Path = path.join(ARTIFACT_DIR, 'aerowash_rockefeller_pdf_page3.png');
    await canvasElement.screenshot({ path: p3Path });
    console.log('Saved Page 3 image:', p3Path);

    await browser.close();
}

main().catch(console.error);
