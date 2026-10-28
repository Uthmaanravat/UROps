const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function checkProduction() {
    const url = new URL(directUrl);
    url.searchParams.set('schema', 'public');
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    console.log('=== CHECKING PRODUCTION (PUBLIC SCHEMA) DATABASE ===\n');

    try {
        // 1. Check CatalogueItem table & row count
        const catTableExists = await prisma.$queryRaw`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'CatalogueItem';
        `;
        console.log('1. CatalogueItem table exists:', catTableExists.length > 0);

        if (catTableExists.length > 0) {
            const catRows = await prisma.$queryRaw`
                SELECT count(*)::int as count FROM "public"."CatalogueItem" 
                WHERE "companyId" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
            `;
            console.log('   AeroWash CatalogueItem count:', catRows[0].count);
        }

        // 2. Check Invoice columns (specifically metadata)
        const invoiceCols = await prisma.$queryRaw`
            SELECT column_name, data_type FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'Invoice';
        `;
        const invoiceColNames = invoiceCols.map(c => c.column_name);
        console.log('\n2. Invoice columns count:', invoiceCols.length);
        console.log('   Invoice.metadata exists:', invoiceColNames.includes('metadata'));

        // 3. Check InvoiceItem columns (specifically metadata)
        const itemCols = await prisma.$queryRaw`
            SELECT column_name, data_type FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'InvoiceItem';
        `;
        const itemColNames = itemCols.map(c => c.column_name);
        console.log('\n3. InvoiceItem columns count:', itemCols.length);
        console.log('   InvoiceItem.metadata exists:', itemColNames.includes('metadata'));

        // 4. Check CompanySettings columns
        const settingsCols = await prisma.$queryRaw`
            SELECT column_name, data_type FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'CompanySettings';
        `;
        const settingsColNames = settingsCols.map(c => c.column_name);
        console.log('\n4. CompanySettings columns:');
        console.log('   vatRegistrationDate exists:', settingsColNames.includes('vatRegistrationDate'));
        console.log('   vatRate exists:', settingsColNames.includes('vatRate'));
        console.log('   justificationEnabled exists:', settingsColNames.includes('justificationEnabled'));
        console.log('   surveyCameraEnabled exists:', settingsColNames.includes('surveyCameraEnabled'));
        console.log('   thermalCameraEnabled exists:', settingsColNames.includes('thermalCameraEnabled'));
        console.log('   validityDays exists:', settingsColNames.includes('validityDays'));

        // 5. Check if there are separate condition-flag, site-visit, or photo tables
        const allTables = await prisma.$queryRaw`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' ORDER BY table_name;
        `;
        console.log('\n5. All tables in public schema:', allTables.map(t => t.table_name));

        // 6. Check AeroWash company settings in public
        const awSettings = await prisma.$queryRaw`
            SELECT * FROM "public"."CompanySettings" 
            WHERE "companyId" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
        `;
        console.log('\n6. AeroWash CompanySettings:', awSettings[0]);

        // 7. Check Clients for AeroWash in public
        const awClients = await prisma.$queryRaw`
            SELECT id, name, "codePrefix" FROM "public"."Client" 
            WHERE "companyId" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
        `;
        console.log('\n7. AeroWash Clients in public:', awClients);

    } finally {
        await prisma.$disconnect();
    }
}

checkProduction().catch(console.error);
