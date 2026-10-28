const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
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

const throwawayUrl = new URL(env.DIRECT_URL);
throwawayUrl.searchParams.set('schema', 'throwaway_copy');
const throwawayPoolerUrl = new URL(env.DATABASE_URL);
throwawayPoolerUrl.searchParams.set('schema', 'throwaway_copy');

const prisma = new PrismaClient({
    datasources: { db: { url: throwawayUrl.toString() } }
});

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('=== VERIFYING AND CAPTURING LR BUILDERS JUSTIFICATION ===');

    const lrBuildersCompanyId = '299c43ec-9578-4c45-91cb-a881a539e25d';

    // Ensure tendersEnabled = true, justificationEnabled = true
    await prisma.companySettings.update({
        where: { companyId: lrBuildersCompanyId },
        data: {
            tendersEnabled: true,
            justificationEnabled: true
        }
    });

    // Ensure user has completed onboarding
    await prisma.user.updateMany({
        where: { email: 'uthmaan@lrbuilders.co.za' },
        data: { hasCompletedOnboarding: true }
    });

    console.log('Starting Next.js server on 3009...');
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

    await sleep(4000);

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1440, height: 1100 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('dialog', async d => { await d.accept(); });

    console.log('Logging in as uthmaan@lrbuilders.co.za...');
    await page.goto('http://localhost:3009/login', { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'uthmaan@lrbuilders.co.za');
    await page.type('input[type="password"]', 'Uthmaan@09');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('button[type="submit"]')
    ]);

    console.log('Navigating to /invoices/new...');
    await page.goto('http://localhost:3009/invoices/new', { waitUntil: 'networkidle0' });
    await sleep(2500);

    // 1. General Work: Ensure General Work is active
    console.log('Ensuring General Work is active...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const genBtn = buttons.find(b => b.innerText.includes('General Work'));
        if (genBtn) genBtn.click();
    });
    await sleep(1500);

    // Scroll to Line Items section
    await page.evaluate(() => {
        window.scrollTo(0, 500);
    });
    await sleep(500);

    const path1 = path.join(ARTIFACT_DIR, 'lr_general_quote_justification_visible.png');
    await page.screenshot({ path: path1, fullPage: false });
    console.log(`Saved screenshot 1: ${path1}`);

    const hasJustificationGen = await page.evaluate(() => {
        return document.body.innerText.includes('Justification:');
    });
    console.log('Justification label visible on General Work?', hasJustificationGen);

    // 2. Tender Work: Switch to Tender Work
    console.log('Switching to Tender Work...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tenderBtn = buttons.find(b => b.innerText.includes('Tender Work'));
        if (tenderBtn) tenderBtn.click();
    });
    await sleep(1500);

    const path2 = path.join(ARTIFACT_DIR, 'lr_tender_quote_no_justification.png');
    await page.screenshot({ path: path2, fullPage: false });
    console.log(`Saved screenshot 2: ${path2}`);

    const hasJustificationTender = await page.evaluate(() => {
        return document.body.innerText.includes('Justification:');
    });
    console.log('Justification label visible on Tender Work?', hasJustificationTender);

    await browser.close();
    nextServer.kill('SIGTERM');
    await prisma.$disconnect();
    console.log('=== DONE ===');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
