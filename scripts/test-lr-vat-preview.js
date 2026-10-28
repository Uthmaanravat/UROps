const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const envText = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
envText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            let val = trimmed.slice(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            env[key] = val;
        }
    }
});

const throwawayUrl = new URL(env.DIRECT_URL || env.DATABASE_URL);
throwawayUrl.searchParams.set('schema', 'throwaway_copy');

const throwawayPoolerUrl = new URL(env.DATABASE_URL);
throwawayPoolerUrl.searchParams.set('schema', 'throwaway_copy');

const prisma = new PrismaClient({
    datasources: { db: { url: throwawayUrl.toString() } }
});

const ARTIFACT_DIR = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
    console.log('=== LR BUILDERS VAT VERIFICATION TEST (throwaway_copy) ===');
    const lrId = '299c43ec-9578-4c45-91cb-a881a539e25d';

    // 1. Fetch LR Builders Settings
    const lrSettings = await prisma.companySettings.findUnique({
        where: { companyId: lrId }
    });
    console.log('1. LR Builders CompanySettings in throwaway_copy:');
    console.log({
        companyId: lrSettings.companyId,
        taxId: lrSettings.taxId,
        vatRegistrationDate: lrSettings.vatRegistrationDate,
        vatRate: lrSettings.vatRate,
        tendersEnabled: lrSettings.tendersEnabled,
        reactiveEnabled: lrSettings.reactiveEnabled
    });

    const existingInvoiceId = 'b139d4f6-5ef0-43e4-8c75-30f537fcbee0'; // INV-2026-027

    // 2. Create a temporary new invoice for LR Builders on throwaway_copy
    const boshard = await prisma.client.findFirst({
        where: { companyId: lrId, name: { contains: 'Boshard' } }
    });
    const lrProject = await prisma.project.findFirst({
        where: { companyId: lrId, clientId: boshard.id }
    });

    console.log('2. Creating new test invoice for LR Builders...');
    const newInvoice = await prisma.invoice.create({
        data: {
            companyId: lrId,
            clientId: boshard.id,
            projectId: lrProject?.id || null,
            type: 'INVOICE',
            status: 'SENT',
            number: 999,
            quoteNumber: 'INV-2026-TEST-LR',
            date: new Date('2026-10-28T08:00:00.000Z'),
            subtotal: 40000,
            taxRate: 0.15,
            taxAmount: 6000,
            total: 46000,
            site: 'Koeberg Rd, Milnerton',
            reference: 'Test General Contracting Work',
            items: {
                create: [
                    {
                        description: 'External Wall Repair & Waterproofing',
                        quantity: 1,
                        unitPrice: 40000,
                        area: 'Main Elevation'
                    }
                ]
            }
        }
    });
    console.log(`   Created new test invoice ID: ${newInvoice.id}`);

    // 3. Start Next.js Server on port 3009
    console.log('3. Starting Next.js server on port 3009 connected to throwaway_copy...');
    const serverEnv = {
        ...process.env,
        ...env,
        DATABASE_URL: throwawayPoolerUrl.toString(),
        DIRECT_URL: throwawayUrl.toString(),
        PORT: '3009'
    };

    const nextServer = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', '3009'], {
        env: serverEnv,
        stdio: 'pipe'
    });

    nextServer.stdout.on('data', d => console.log('[NEXT]', d.toString().trim()));
    nextServer.stderr.on('data', d => console.error('[NEXT ERR]', d.toString().trim()));

    await new Promise(r => setTimeout(r, 4000));

    // 4. Launch Puppeteer
    console.log('4. Launching Chrome...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1440, height: 1100 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('dialog', async d => { await d.accept(); });

    console.log('5. Logging into LR Builders account (uthmaan@lrbuilders.co.za)...');
    await page.goto('http://localhost:3009/login', { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'uthmaan@lrbuilders.co.za');
    await page.type('input[type="password"]', 'Uthmaan@09');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('button[type="submit"]')
    ]);

    // TEST EXISTING LR BUILDERS INVOICE
    console.log('\n--- TESTING EXISTING LR BUILDERS INVOICE (INV-2026-027) ---');
    await page.goto(`http://localhost:3009/invoices/${existingInvoiceId}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('INV-2026-027') || document.body.innerText.includes('64,147'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    const existingText = await page.evaluate(() => document.body.innerText);
    const hasTaxHeadingExist = existingText.includes('TAX INVOICE');
    const hasLrVatExist = existingText.includes('VAT: 4130275342') || existingText.includes('4130275342');
    const hasVatLineExist = existingText.includes('VAT (15%):') || existingText.includes('VAT (15%)');
    const hasTaxAmountExist = existingText.includes('8,367.00') || existingText.includes('8,367');
    const hasTotalExist = existingText.includes('64,147.00') || existingText.includes('64,147');

    console.log('ASSERTIONS FOR EXISTING LR BUILDERS INVOICE:');
    console.log('  - Heading is "TAX INVOICE":', hasTaxHeadingExist ? 'PASS' : 'FAIL');
    console.log('  - LR Builders VAT (4130275342) IS shown:', hasLrVatExist ? 'PASS' : 'FAIL');
    console.log('  - VAT 15% line IS shown:', hasVatLineExist ? 'PASS' : 'FAIL');
    console.log('  - VAT Amount (R8,367.00) IS shown:', hasTaxAmountExist ? 'PASS' : 'FAIL');
    console.log('  - Total Due (R64,147.00) IS shown:', hasTotalExist ? 'PASS' : 'FAIL');

    const existScreenshotPath = path.join(ARTIFACT_DIR, 'lrbuilders_existing_invoice_vat.png');
    await page.screenshot({ path: existScreenshotPath, fullPage: true });
    console.log('   Saved existing invoice screenshot:', existScreenshotPath);

    // TEST NEW LR BUILDERS INVOICE
    console.log('\n--- TESTING NEW LR BUILDERS INVOICE (INV-2026-TEST-LR) ---');
    await page.goto(`http://localhost:3009/invoices/${newInvoice.id}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('INV-2026-TEST-LR') || document.body.innerText.includes('46,000'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    const newText = await page.evaluate(() => document.body.innerText);
    const hasTaxHeadingNew = newText.includes('TAX INVOICE');
    const hasLrVatNew = newText.includes('VAT: 4130275342') || newText.includes('4130275342');
    const hasVatLineNew = newText.includes('VAT (15%):') || newText.includes('VAT (15%)');
    const hasTaxAmountNew = newText.includes('6,000.00') || newText.includes('6,000');
    const hasTotalNew = newText.includes('46,000.00') || newText.includes('46,000');

    console.log('ASSERTIONS FOR NEW LR BUILDERS INVOICE:');
    console.log('  - Heading is "TAX INVOICE":', hasTaxHeadingNew ? 'PASS' : 'FAIL');
    console.log('  - LR Builders VAT (4130275342) IS shown:', hasLrVatNew ? 'PASS' : 'FAIL');
    console.log('  - VAT 15% line IS shown:', hasVatLineNew ? 'PASS' : 'FAIL');
    console.log('  - VAT Amount (R6,000.00) IS shown:', hasTaxAmountNew ? 'PASS' : 'FAIL');
    console.log('  - Total Due (R46,000.00) IS shown:', hasTotalNew ? 'PASS' : 'FAIL');

    const newScreenshotPath = path.join(ARTIFACT_DIR, 'lrbuilders_new_invoice_vat.png');
    await page.screenshot({ path: newScreenshotPath, fullPage: true });
    console.log('   Saved new invoice screenshot:', newScreenshotPath);

    // Clean up test invoice
    console.log('\n6. Cleaning up test invoice...');
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: newInvoice.id } });
    await prisma.invoice.delete({ where: { id: newInvoice.id } });

    await browser.close();
    nextServer.kill('SIGTERM');
    console.log('=== LR BUILDERS VERIFICATION COMPLETED SUCCESSFULLY ===');
}

main().catch(async err => {
    console.error('Test execution failed:', err);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
