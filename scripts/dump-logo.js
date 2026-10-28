const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
  const s = await prisma.companySettings.findUnique({
    where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' }
  });
  if (s?.logoUrl) {
    const b64 = s.logoUrl.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync('scripts/aerowash-current-logo.png', Buffer.from(b64, 'base64'));
    console.log('Saved aerowash-current-logo.png');
  }
}

run().finally(() => prisma.$disconnect());
