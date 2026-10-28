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
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, companyId: true } });
    console.log('USERS:', JSON.stringify(users, null, 2));
    const companies = await prisma.company.findMany({ select: { id: true, name: true } });
    console.log('COMPANIES:', JSON.stringify(companies, null, 2));
}
main().finally(() => prisma.$disconnect());
