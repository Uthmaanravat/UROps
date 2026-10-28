const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['\"]|['\"]$/g, '');
}
const url = new URL(directUrl);
url.searchParams.set('schema', 'throwaway_copy');
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

async function main() {
    console.log('Testing production_migration.sql on throwaway_copy...');
    const prodSql = fs.readFileSync(path.resolve('scripts/production_migration.sql'), 'utf8');
    
    // Replace "public" with "throwaway_copy" for testing
    const testProdSql = prodSql.replace(/"public"/g, '"throwaway_copy"');
    
    await prisma.$executeRawUnsafe(testProdSql);
    console.log('Production SQL executed successfully on throwaway_copy!');

    const count = await prisma.catalogueItem.count();
    console.log(`Verified CatalogueItem count on throwaway_copy: ${count} items.`);

    const terms = await prisma.termsTemplate.findFirst({
        where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9', isDefault: true }
    });
    console.log('Verified AeroWash default terms:', terms.name, 'Length:', terms.body.length);
}

main().catch(err => {
    console.error('SQL Execution Error:', err);
    process.exit(1);
}).finally(() => prisma.$disconnect());
