const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function check() {
    const url = new URL(directUrl);
    url.searchParams.set('schema', 'throwaway_copy');
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    const user = await prisma.user.findUnique({ where: { email: 'uthmaan@lrbuilders.co.za' } });
    console.log('LR User:', user?.id, user?.companyId);

    if (user) {
        const settings = await prisma.companySettings.findUnique({ where: { companyId: user.companyId } });
        console.log('LR Settings theme:', settings?.theme);
    }

    await prisma.$disconnect();
}
check();
