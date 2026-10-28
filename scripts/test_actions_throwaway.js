const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
const env = {};
for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, '');
            env[key] = val;
        }
    }
}

const throwawayUrl = new URL(env.DIRECT_URL);
throwawayUrl.searchParams.set('schema', 'throwaway_copy');
const throwawayPoolerUrl = new URL(env.DATABASE_URL);
throwawayPoolerUrl.searchParams.set('schema', 'throwaway_copy');

process.env.DATABASE_URL = throwawayPoolerUrl.toString();
process.env.DIRECT_URL = throwawayUrl.toString();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSave() {
  console.log('Testing createInvoiceAction logic on throwaway_copy...');
  const companyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
  
  // Find a client
  const client = await prisma.client.findFirst({ where: { companyId } });
  console.log('Client:', client?.id, client?.name);

  // Check what quote numbers exist
  const existingQuotes = await prisma.invoice.findMany({
    where: { companyId },
    select: { id: true, quoteNumber: true, number: true }
  });
  console.log('Existing quotes for AeroWash:', existingQuotes);

  // Test what happens with quoteNumber generation in createInvoiceAction
  const settings = await prisma.companySettings.findUnique({ where: { companyId } });
  console.log('Settings:', settings?.name, 'lastQuoteNumber:', settings?.lastQuoteNumber);
}

testSave().catch(console.error).finally(() => prisma.$disconnect());
