const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function verify() {
    console.log('=== VERIFYING PRODUCTION (PUBLIC SCHEMA) STATE ===\n');

    // 1. CompanySettings verification
    const settings = await prisma.$queryRawUnsafe(`
        SELECT cs."companyId", c."name" as "companyName", cs."justificationEnabled", cs."taxId", cs."vatRegistrationDate", cs."vatRate", cs."surveyCameraEnabled", cs."thermalCameraEnabled"
        FROM public."CompanySettings" cs
        JOIN public."Company" c ON c."id" = cs."companyId"
        ORDER BY c."name" ASC
    `);
    console.log('1. CompanySettings in public:');
    console.table(settings);

    // 2. CatalogueItem table count and items in public
    const catCount = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as count FROM public."CatalogueItem"
    `);
    console.log(`\n2. CatalogueItem total count in public: ${catCount[0].count}`);

    const catItems = await prisma.$queryRawUnsafe(`
        SELECT "itemNumber", "name", "category", "pricingMethod", "internalNotes"
        FROM public."CatalogueItem"
        WHERE "companyId" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9'
        ORDER BY "itemNumber" ASC
    `);
    console.log(`\nAeroWash Catalogue Items seeded (${catItems.length} items):`);
    console.table(catItems);

    // 3. Terms Template in public
    const template = await prisma.$queryRawUnsafe(`
        SELECT "id", "business_id", "name", "version", "is_default", "updated_at"
        FROM public."terms_templates"
        WHERE "business_id" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9'
    `);
    console.log('\n3. AeroWash Terms Template in public:');
    console.table(template);

    // 4. Terms Template Versions in public
    const versions = await prisma.$queryRawUnsafe(`
        SELECT "id", "template_id", "version", "name", "created_at"
        FROM public."terms_template_versions"
        WHERE "template_id" = '${template[0].id}'
        ORDER BY "version" ASC
    `);
    console.log('\n4. AeroWash Terms Template Versions in public:');
    console.table(versions);

    // 5. Check template body in public
    const fullTemplate = await prisma.$queryRawUnsafe(`
        SELECT "body"
        FROM public."terms_templates"
        WHERE "id" = '${template[0].id}'
    `);
    console.log('\n5. Current Terms Body in public:\n', fullTemplate[0].body);

    console.log('\n=== VERIFICATION COMPLETE ===');
}

verify().finally(() => prisma.$disconnect());
