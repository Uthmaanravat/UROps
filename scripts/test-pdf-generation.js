const { PrismaClient } = require('@prisma/client');
const { generateAeroWashQuotePdf } = require('../src/lib/aerowash-quote-pdf.ts');
const fs = require('fs');
const path = require('path');

const AEROWASH_COMPANY_ID = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres.glrehlawzscioyqlcqlk:Uthmaanravat09@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=throwaway_copy' } }
});

async function main() {
  // 1. Get or create Lemco client in throwaway_copy
  let lemco = await p.client.findFirst({
    where: { companyId: AEROWASH_COMPANY_ID, name: { contains: 'Lemco', mode: 'insensitive' } }
  });

  if (!lemco) {
    lemco = await p.client.create({
      data: {
        companyId: AEROWASH_COMPANY_ID,
        name: 'Lemco',
        companyName: 'Patriot — Gun Shop & Indoor Airgun Shooting Range',
        attentionTo: 'Brayden Siebert',
        email: 'brayden.siebert@lemco.co.za',
        address: 'Unit 6, Buchan Street, Baruch Park, Stikland Industrial, Cape Town, 7530',
        phone: '021 981 0000'
      }
    });
    console.log('Created Lemco client in throwaway_copy:', lemco.id);
  }

  // 2. Get Rockefeller client in throwaway_copy
  const rockefeller = await p.client.findFirst({
    where: { companyId: AEROWASH_COMPANY_ID, name: { contains: 'Newmark', mode: 'insensitive' } }
  });

  // 3. Get AeroWash company details & settings
  const company = await p.company.findUnique({
    where: { id: AEROWASH_COMPANY_ID },
    include: { settings: true }
  });

  const companyData = {
    name: 'AeroWash (Pty) Ltd',
    address: '15 Culemborg Street, Parow, Cape Town, 7500',
    phone: '067 829 3350',
    email: 'info@aerowash.co.za',
    website: 'www.aerowash.co.za',
    registrationNumber: '2026/475172/07',
    vatNumber: company.settings?.taxId || null,
    vatRegistrationDate: company.settings?.vatRegistrationDate || null,
    vatRate: company.settings?.vatRate || 15
  };

  const settingsData = {
    theme: 'dark-orange',
    currency: 'R',
    validityDays: 30,
    preparedByName: 'Uthmaan Ravat',
    preparedByPhone: '067 829 3350'
  };

  // 4. Generate Patriot Quote PDF
  const patriotInvoice = {
    number: 7,
    quoteNumber: 'AW-2026-007',
    date: '2026-09-07',
    type: 'QUOTE',
    site: 'Patriot — Gun Shop & Indoor Airgun Shooting Range, Unit 6, Buchan Street, Baruch Park, Stikland Industrial, Cape Town, 7530',
    reference: 'Patriot Airgun Range Facade Clean',
    subtotal: 18750,
    taxAmount: 0,
    total: 18750,
    client: {
      name: 'Lemco',
      companyName: 'Patriot — Gun Shop & Indoor Airgun Shooting Range',
      attentionTo: 'Brayden Siebert',
      email: 'brayden.siebert@lemco.co.za',
      phone: '021 981 0000',
      address: 'Unit 6, Buchan Street, Baruch Park, Stikland Industrial, Cape Town, 7530'
    },
    items: [
      {
        id: '1',
        description: 'Wall elevations — soft wash\nAll exposed exterior wall elevations of Unit 6. Removal of atmospheric soiling and organic staining from painted wall surfaces and brickwork. Includes glazing and roller-shutter doors within those elevations. Walls shared with adjoining units are excluded.',
        quantity: 1,
        unitPrice: 18750,
        total: 18750
      },
      {
        id: '2',
        description: 'Signage detail\nPatriot wordmark and star, FX Airguns and Element. Detail cleaning to lift soiling from around the raised lettering and fixings.',
        quantity: 1,
        unitPrice: 0,
        total: 0,
        originalPrice: 3125,
        isIncluded: true
      },
      {
        id: '3',
        description: 'Entrance canopy roofs — red tile\nPitched tile canopy roofs over the office frontage. Soft wash moss and organic growth removal.',
        quantity: 1,
        unitPrice: 0,
        total: 0,
        originalPrice: 3125,
        isIncluded: true
      }
    ],
    metadata: {
      allowanceAmount: 6250,
      allowanceName: 'Introductory allowance — signage & canopy roofs',
      siteVisitRequired: true,
      scopeOfWorks: 'Exterior maintenance cleaning of the exposed wall elevations at Patriot — Gun Shop & Indoor Airgun Shooting Range, Unit 6, Buchan Street, delivered by drone with no scaffolding, cradles, ladders or rope access and no obstruction of trading or parking. Includes cleaning of building signage, entrance features and canopies. Includes soft wash treatment of roof surfaces to remove organic growth and accumulated debris.'
    }
  };

  const patriotDoc = await generateAeroWashQuotePdf({
    invoice: patriotInvoice,
    company: companyData,
    companySettings: settingsData
  });

  const artifactDir = 'C:/Users/uthma/.gemini/antigravity/brain/5f53d62e-19db-40c8-8193-7eef56e18105';
  const patriotPdfBuffer = Buffer.from(patriotDoc.output('arraybuffer'));
  fs.writeFileSync(path.join(artifactDir, 'aerowash_patriot_quote_aw_2026_007.pdf'), patriotPdfBuffer);
  console.log('Saved aerowash_patriot_quote_aw_2026_007.pdf');

  // 5. Generate Rockefeller Quote PDF
  const rockefellerInvoice = {
    number: 8,
    quoteNumber: 'AW-2026-008',
    date: '2026-10-27',
    type: 'QUOTE',
    site: 'The Rockefeller, 12 Christiaan Barnard St, Foreshore, Cape Town',
    reference: 'The Rockefeller Facade Maintenance Clean',
    subtotal: 65550,
    taxAmount: 0,
    total: 65550,
    client: {
      name: 'Newmark Hotels',
      companyName: 'The Rockefeller Hotel (Pty) Ltd',
      attentionTo: 'Operations Manager',
      email: 'ops@rockefeller.co.za',
      phone: '021 418 0000',
      address: '12 Christiaan Barnard St, Foreshore, Cape Town, 8001'
    },
    items: [
      {
        id: '1',
        area: 'Front Elevation',
        description: 'Exterior Glazing Maintenance Clean – Front Elevation\nDrone cleaning of all windows, glazing and frames across this face of the building, excluding balcony areas (see Balcony & Detail Areas). Removes dirt, pollution, salt and light grime, leaving the glazing visibly clean across the elevation.',
        quantity: 1,
        unitPrice: 51750,
        total: 51750
      },
      {
        id: '2',
        area: 'Front Elevation',
        description: 'Full Facade Maintenance Clean – Front Elevation\nDrone cleaning of the full face of the building: windows, frames, walls, cladding and concrete surfaces, excluding balcony areas (see Balcony & Detail Areas). Completed in a single visit.',
        quantity: 1,
        unitPrice: 59550,
        total: 59550
      },
      {
        id: '3',
        area: 'Site Conditions',
        description: 'Occupied Building Provision\nProvision for working around building occupancy: advance tenant notification, restricted working windows, and interrupted access to elevations in use.',
        quantity: 1,
        unitPrice: 6000,
        total: 6000
      }
    ],
    metadata: {
      siteVisitRequired: true,
      scopeOfWorks: 'Exterior full facade and window maintenance cleaning of Front Elevation at The Rockefeller, 12 Christiaan Barnard St, Foreshore, delivered by drone with no scaffolding, cradles, ladders or rope access and no obstruction of trading or parking.'
    }
  };

  const rockefellerDoc = await generateAeroWashQuotePdf({
    invoice: rockefellerInvoice,
    company: companyData,
    companySettings: settingsData
  });

  const rockefellerPdfBuffer = Buffer.from(rockefellerDoc.output('arraybuffer'));
  fs.writeFileSync(path.join(artifactDir, 'aerowash_rockefeller_quote_aw_2026_008.pdf'), rockefellerPdfBuffer);
  console.log('Saved aerowash_rockefeller_quote_aw_2026_008.pdf');

  // 6. Generate AeroWash Invoice PDF with Banking Details
  const invoiceDoc = await generateAeroWashQuotePdf({
    invoice: {
      ...patriotInvoice,
      number: 7,
      quoteNumber: 'INV-2026-007',
      date: '2026-09-15',
      type: 'INVOICE'
    },
    company: companyData,
    companySettings: settingsData
  });

  const invoicePdfBuffer = Buffer.from(invoiceDoc.output('arraybuffer'));
  fs.writeFileSync(path.join(artifactDir, 'aerowash_patriot_invoice_inv_2026_007.pdf'), invoicePdfBuffer);
  console.log('Saved aerowash_patriot_invoice_inv_2026_007.pdf');
}

main().finally(() => p.$disconnect());
