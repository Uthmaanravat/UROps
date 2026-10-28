const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { generateAeroWashQuotePdf } = require('../src/lib/aerowash-quote-pdf');
const { generateConditionFlagWording, formatPhotoRefs } = require('../src/lib/aerowash-catalogue');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\uthma\\.gemini\\antigravity\\brain\\5f53d62e-19db-40c8-8193-7eef56e18105';

async function generateInspectionPhotos() {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });

    const photosMeta = [
        {
            num: '04',
            title: 'Front Elevation Levels 3–4',
            subtitle: 'Overview: Surface etching & glass clouding',
            elev: 'Front Elevation',
            loc: 'levels 3 and 4',
            bg: '#1e293b',
            accent: '#38bdf8'
        },
        {
            num: '05',
            title: 'Level 3 Glazing Panel',
            subtitle: 'Bonded mineral deposit staining on outer face',
            elev: 'Front Elevation',
            loc: 'level 3 pane 2B',
            bg: '#1e2530',
            accent: '#94a3b8'
        },
        {
            num: '06',
            title: 'Level 3 Window Pane',
            subtitle: 'Cloudy haze unaffected by spot wash test',
            elev: 'Front Elevation',
            loc: 'level 3 pane 4C',
            bg: '#1a2332',
            accent: '#38bdf8'
        },
        {
            num: '07',
            title: 'Level 4 Window Pane',
            subtitle: 'Surface degradation from marine atmospheric salts',
            elev: 'Front Elevation',
            loc: 'level 4 pane 1A',
            bg: '#20293a',
            accent: '#cbd5e1'
        },
        {
            num: '08',
            title: 'Level 4 Frame & Glass Junction',
            subtitle: 'Permanent cloudy appearance across perimeter',
            elev: 'Front Elevation',
            loc: 'level 4 pane 3B',
            bg: '#1c2434',
            accent: '#94a3b8'
        },
        {
            num: '09',
            title: 'Front Elevation Levels 3–4',
            subtitle: 'Macro view of glass surface etching defect',
            elev: 'Front Elevation',
            loc: 'level 4 detail',
            bg: '#1e293b',
            accent: '#38bdf8'
        }
    ];

    const generatedPhotos = [];

    for (const item of photosMeta) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    width: 640px;
                    height: 480px;
                    background: ${item.bg};
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-sizing: border-box;
                    padding: 24px;
                    color: #fff;
                    position: relative;
                    overflow: hidden;
                }
                /* Simulated facade grid background */
                .facade-grid {
                    position: absolute;
                    inset: 0;
                    background-image: 
                        linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px);
                    background-size: 80px 80px;
                }
                /* Etched glass cloud effect overlay */
                .etch-cloud {
                    position: absolute;
                    width: 380px;
                    height: 260px;
                    top: 100px;
                    left: 130px;
                    background: radial-gradient(ellipse at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.18) 45%, transparent 75%);
                    filter: blur(12px);
                    border: 2px dashed rgba(208, 94, 0, 0.4);
                    border-radius: 20px;
                }
                .header {
                    position: relative;
                    z-index: 10;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .badge {
                    background: #D05E00;
                    color: white;
                    font-weight: 900;
                    font-size: 14px;
                    padding: 6px 14px;
                    border-radius: 6px;
                    letter-spacing: 0.1em;
                }
                .telemetry {
                    font-family: monospace;
                    font-size: 11px;
                    color: #94a3b8;
                    text-align: right;
                    line-height: 1.4;
                }
                .hud {
                    position: relative;
                    z-index: 10;
                    background: rgba(10, 10, 10, 0.75);
                    border-left: 4px solid #D05E00;
                    padding: 12px 16px;
                    border-radius: 0 8px 8px 0;
                    backdrop-filter: blur(4px);
                }
                .hud h2 {
                    margin: 0 0 4px 0;
                    font-size: 16px;
                    font-weight: 800;
                    color: #fff;
                }
                .hud p {
                    margin: 0;
                    font-size: 12px;
                    color: #cbd5e1;
                }
                .hud .coords {
                    margin-top: 6px;
                    font-family: monospace;
                    font-size: 10px;
                    color: #f97316;
                }
                .crosshair {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 60px;
                    height: 60px;
                    border: 1px solid rgba(255,255,255,0.25);
                    border-radius: 50%;
                    z-index: 5;
                }
                .crosshair::before, .crosshair::after {
                    content: '';
                    position: absolute;
                    background: rgba(255,255,255,0.3);
                }
                .crosshair::before {
                    top: 50%;
                    left: -10px;
                    right: -10px;
                    height: 1px;
                }
                .crosshair::after {
                    left: 50%;
                    top: -10px;
                    bottom: -10px;
                    width: 1px;
                }
            </style>
        </head>
        <body>
            <div class="facade-grid"></div>
            <div class="etch-cloud"></div>
            <div class="crosshair"></div>
            <div class="header">
                <span class="badge">PHOTO ${item.num}</span>
                <div class="telemetry">
                    <div>AEROWASH SURVEY CAM 01</div>
                    <div>DATE: 2026-11-12  10:14:22 SAST</div>
                    <div>SITE: THE ROCKEFELLER</div>
                </div>
            </div>
            <div class="hud">
                <h2>${item.title}</h2>
                <p>${item.subtitle}</p>
                <div class="coords">TARGET: ${item.elev.toUpperCase()} · ${item.loc.toUpperCase()} · 33°55'18"S 18°25'42"E</div>
            </div>
        </body>
        </html>
        `;

        await page.setContent(html);
        const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 90 });
        const dataUrl = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;

        generatedPhotos.push({
            id: `photo-${item.num}`,
            photoNumber: item.num,
            url: dataUrl,
            caption: `${item.title}: ${item.subtitle}`,
            elevation: item.elev
        });
    }

    await browser.close();
    return generatedPhotos;
}

async function main() {
    console.log('Generating inspection photos with drone telemetry...');
    const photos = await generateInspectionPhotos();
    console.log(`Generated ${photos.length} inspection photographs (04 to 09).`);

    const companyData = {
        name: 'AeroWash (Pty) Ltd',
        address: '15 Culemborg Street, Parow, Cape Town, 7500',
        phone: '067 829 3350',
        email: 'info@aerowash.co.za',
        website: 'www.aerowash.co.za',
        registrationNumber: '2026/475172/07',
        vatNumber: null, // Pre-VAT registration as per today
        vatRegistrationDate: null,
        vatRate: 15
    };

    const settingsData = {
        theme: 'dark-orange',
        currency: 'R',
        validityDays: 45, // 45 days validity as requested
        preparedByName: 'Uthmaan Ravat',
        preparedByPhone: '067 829 3350'
    };

    // Auto-generated wording using exact helper
    const flagWording = generateConditionFlagWording({
        date: '12 Nov 2026',
        condition: 'existing surface etching to the glass',
        elevation: 'Front Elevation',
        location: 'levels 3–4',
        photoRefs: ['04', '05', '06', '07', '08', '09'],
        consequence: 'This condition is in the glass and cannot be removed by cleaning. These panels will be washed but will retain a visible cloudy appearance afterwards.',
        restoration: 'glass restoration or replacement'
    });

    console.log('\nExact Condition Flag Wording:\n"' + flagWording + '"\n');

    const rockefellerInvoice = {
        number: 8,
        quoteNumber: 'AW-2026-008',
        date: '2026-11-12',
        type: 'QUOTE',
        site: 'The Rockefeller, 12 Christiaan Barnard St, Foreshore, Cape Town',
        reference: 'The Rockefeller Facade Maintenance Clean',
        subtotal: 111300,
        taxAmount: 0,
        total: 111300,
        client: {
            name: 'Newmark Hotels',
            companyName: 'The Rockefeller Hotel (Pty) Ltd',
            attentionTo: 'Operations Manager',
            email: 'ops@rockefeller.co.za',
            phone: '021 418 0000',
            address: '12 Christiaan Barnard St, Foreshore, Cape Town, 8001'
        },
        items: [
            {
                id: '1',
                area: 'Front Elevation',
                description: 'Exterior Glazing Maintenance Clean – Front Elevation\nDrone cleaning of all windows, glazing and frames across this face of the building, excluding balcony areas (see Balcony & Detail Areas). Removes dirt, pollution, salt and light grime, leaving the glazing visibly clean across the elevation.',
                quantity: 1,
                unitPrice: 51750,
                total: 51750
            },
            {
                id: '2',
                area: 'Front Elevation',
                description: 'Full Facade Maintenance Clean – Front Elevation\nDrone cleaning of the full face of the building: windows, frames, walls, cladding and concrete surfaces, excluding balcony areas (see Balcony & Detail Areas). Completed in a single visit.',
                quantity: 1,
                unitPrice: 59550,
                total: 59550
            }
        ],
        metadata: {
            siteVisitDone: true,
            siteVisitDate: '2026-11-12',
            siteVisitAttendedBy: 'Flight Operations Team',
            siteVisitPhotos: photos,
            conditionFlags: [
                {
                    id: 'flag-01',
                    elevation: 'Front Elevation',
                    location: 'levels 3–4',
                    conditionType: 'GLASS_ETCHING',
                    photoRefs: ['04', '05', '06', '07', '08', '09'],
                    wording: flagWording
                }
            ],
            scopeOfWorks: 'Exterior full facade and glazing maintenance cleaning of Front Elevation at The Rockefeller, 12 Christiaan Barnard St, Foreshore, delivered by drone with no scaffolding, cradles, ladders or rope access and no obstruction of trading or parking.'
        }
    };

    console.log('Calling generateAeroWashQuotePdf...');
    const doc = await generateAeroWashQuotePdf({
        invoice: rockefellerInvoice,
        company: companyData,
        companySettings: settingsData
    });

    const totalPages = doc.getNumberOfPages();
    console.log(`PDF Generated successfully! Total pages: ${totalPages}`);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const pdfPath = path.join(ARTIFACT_DIR, 'aerowash_rockefeller_quote_aw_2026_008.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`Saved PDF: ${pdfPath}`);

    // Render screenshots of all pages using Puppeteer
    console.log('\nCapturing screenshots of all PDF pages...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        defaultViewport: { width: 1200, height: 1600 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const normalizedPdfPath = pdfPath.replace(/\\/g, '/');

    for (let p = 1; p <= totalPages; p++) {
        await page.goto(`file:///${normalizedPdfPath}#page=${p}`, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 2000));

        if (p > 1) {
            await page.evaluate((pageIndex) => {
                window.scrollBy(0, (pageIndex - 1) * 1400);
            }, p);
            await new Promise(r => setTimeout(r, 1000));
        }

        const outPng = path.join(ARTIFACT_DIR, `aerowash_rockefeller_pdf_page${p}.png`);
        await page.screenshot({ path: outPng, fullPage: false });
        console.log(`Saved Page ${p} screenshot: ${outPng}`);
    }

    await browser.close();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
