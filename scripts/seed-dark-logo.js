const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function updateAeroWashPrefs() {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' }
  });
  
  const currentPrefs = settings?.layoutPreferences || {};
  const updatedPrefs = {
    ...currentPrefs,
    darkHeaderLogoUrl: '/aerowash_header_logo.png'
  };

  await prisma.companySettings.update({
    where: { companyId: '70af7281-072d-4ed5-9f2e-af4d93e99ea9' },
    data: {
      layoutPreferences: updatedPrefs
    }
  });

  console.log('Updated AeroWash layoutPreferences with darkHeaderLogoUrl');
}

updateAeroWashPrefs().catch(console.error).finally(() => prisma.$disconnect());
