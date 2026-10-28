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
    const user = await prisma.user.findFirst({ where: { email: 'uthmaan@lrbuilders.co.za' } });
    console.log('USER:', user);
    
    // Check what layout middleware checks:
    // usually user.companyId or onboardingCompleted
    const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
            hasCompletedOnboarding: true
        }
    });
    console.log('UPDATED hasCompletedOnboarding to TRUE:', updated.hasCompletedOnboarding);
}
main().finally(() => prisma.$disconnect());
