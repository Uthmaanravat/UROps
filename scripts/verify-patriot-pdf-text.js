const fs = require('fs');
const path = require('path');

async function main() {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfPath = path.resolve('C:/Users/uthma/.gemini/antigravity/brain/5f53d62e-19db-40c8-8193-7eef56e18105/aerowash_patriot_quote_aw_2026_007.pdf');
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const doc = await loadingTask.promise;
    console.log(`PDF Pages: ${doc.numPages}`);

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');
        console.log(`\n--- PAGE ${i} ---`);
        console.log(text);
    }
}

main().catch(err => {
    // If pdfjs-dist import fails, try cjs
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const pdfPath = path.resolve('C:/Users/uthma/.gemini/antigravity/brain/5f53d62e-19db-40c8-8193-7eef56e18105/aerowash_patriot_quote_aw_2026_007.pdf');
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    pdfjsLib.getDocument({ data }).promise.then(async doc => {
        console.log(`PDF Pages: ${doc.numPages}`);
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');
            console.log(`\n--- PAGE ${i} ---`);
            console.log(text);
        }
    });
});
