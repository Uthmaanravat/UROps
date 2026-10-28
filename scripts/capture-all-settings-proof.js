const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('Starting Puppeteer to capture settings pages...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1440, height: 1100 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('dialog', async d => { 
        console.log('[BROWSER DIALOG]:', d.message());
        await d.accept(); 
    });

    // 1. Login as AeroWash admin
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'uthmaan@aerowash.co.za');
    await page.type('input[type="password"]', 'Uthmaan@09');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('button[type="submit"]')
    ]);

    console.log('Logged into AeroWash. URL:', page.url());

    // 2. Go to /settings (Company Branding)
    await page.goto('http://localhost:3000/settings', { waitUntil: 'networkidle0' });
    await sleep(2000);
    const brandingPath = path.join(ARTIFACT_DIR, 'aerowash_settings_dark_logo_proof.png');
    await page.screenshot({ path: brandingPath, fullPage: true });
    console.log('Saved Settings Branding screenshot:', brandingPath);

    // 3. Go to /settings/terms (AeroWash Quote Terms)
    await page.goto('http://localhost:3000/settings/terms', { waitUntil: 'networkidle0' });
    await sleep(2000);
    const termsPath = path.join(ARTIFACT_DIR, 'aerowash_settings_terms_proof.png');
    await page.screenshot({ path: termsPath, fullPage: true });
    console.log('Saved Settings Terms screenshot:', termsPath);

    // 4. Go to /settings/catalogue (AeroWash Catalogue)
    await page.goto('http://localhost:3000/settings/catalogue', { waitUntil: 'networkidle0' });
    await sleep(2000);
    const catPath = path.join(ARTIFACT_DIR, 'aerowash_settings_catalogue_proof.png');
    await page.screenshot({ path: catPath, fullPage: true });
    console.log('Saved Settings Catalogue screenshot:', catPath);

    // 5. Go to /invoices/new (AeroWash Quote Builder)
    await page.goto('http://localhost:3000/invoices/new', { waitUntil: 'networkidle0' });
    await sleep(2500);
    const builderPath = path.join(ARTIFACT_DIR, 'aerowash_builder_full_width_proof.png');
    await page.screenshot({ path: builderPath, fullPage: false });
    console.log('Saved Builder Full Width screenshot:', builderPath);

    await browser.close();
    console.log('All settings and builder screenshots captured successfully!');
}

main().catch(err => {
    console.error('Puppeteer error:', err);
    process.exit(1);
});
