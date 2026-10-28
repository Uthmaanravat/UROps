const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function main() {
    const pdfPath = path.resolve('C:/Users/uthma/.gemini/antigravity/brain/5f53d62e-19db-40c8-8193-7eef56e18105/aerowash_patriot_quote_aw_2026_007.pdf');
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);

    console.log('PDF Number of pages:', data.numpages);
    console.log('--- EXTRACTED TEXT ---');
    console.log(data.text);
}

main().catch(console.error);
