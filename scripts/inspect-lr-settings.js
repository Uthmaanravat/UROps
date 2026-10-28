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
    const s = await prisma.companySettings.findUnique({ where: { companyId: '299c43ec-9578-4c45-91cb-a881a539e25d' } });
    console.log('LR BUILDERS COMPANY SETTINGS:', JSON.stringify(s, null, 2));
}
main().finally(() => prisma.$disconnect());
