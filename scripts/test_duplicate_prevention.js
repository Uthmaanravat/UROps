const react = require('react');
react.cache = (fn) => fn;

// Mock next/cache revalidatePath
require.cache[require.resolve('next/cache')] = {
  exports: {
    revalidatePath: () => {
      console.log("  [MOCK] revalidatePath invoked");
    }
  }
};

// Mock next/headers
require.cache[require.resolve('next/headers')] = {
  exports: {
    cookies: () => ({
      get: () => ({ value: 'mocked' }),
      set: () => {},
      delete: () => {}
    })
  }
};

// Mock ensureAuth in require.cache to return the companyId directly
require.cache[require.resolve('../src/lib/auth-actions')] = {
  exports: {
    ensureAuth: async () => {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const company = await prisma.company.findFirst();
      return company.id;
    }
  }
};

// Mock Submission Logger in require cache to bypass read-only ES module getters
require.cache[require.resolve('../src/lib/submission-logger')] = {
  exports: {
    logSubmission: async () => {
      console.log("  [MOCK] logSubmission invoked");
    }
  }
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createInvoiceAction } = require('../src/app/(dashboard)/invoices/actions');
const { updateInvoiceDetailsAction } = require('../src/app/(dashboard)/invoices/project-actions');

async function main() {
  console.log("Setting up test database entries...");

  // Get or create a company
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: { name: "TEST COMPANY", domain: "testcompany.co.za" }
    });
  }

  // Get or create a client
  let client = await prisma.client.findFirst({
    where: { companyId: company.id }
  });
  if (!client) {
    client = await prisma.client.create({
      data: { name: "TEST CLIENT", companyId: company.id }
    });
  }

  // Set the current sequence counter to 20
  console.log("Setting lastQuoteNumber counter to 20...");
  await prisma.companySettings.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id, lastQuoteNumber: 20 },
    update: { lastQuoteNumber: 20 }
  });

  let createdInvoiceIds = [];

  try {
    // 1. Create a quote with manual quote number Q-2026-021
    console.log("1. Creating first quote Q-2026-021...");
    const id1 = await createInvoiceAction({
      clientId: client.id,
      date: new Date().toISOString(),
      quoteNumber: "Q-2026-021",
      type: "QUOTE",
      items: [{ description: "Test Item 1", quantity: 1, unitPrice: 100 }]
    });
    createdInvoiceIds.push(id1);
    console.log(`Created first quote: ID=${id1}`);

    // 2. Attempt to create another quote with the same quote number (Q-2026-021)
    console.log("2. Attempting to create duplicate quote Q-2026-021...");
    try {
      const id2 = await createInvoiceAction({
        clientId: client.id,
        date: new Date().toISOString(),
        quoteNumber: "Q-2026-021",
        type: "QUOTE",
        items: [{ description: "Test Item 2", quantity: 1, unitPrice: 200 }]
      });
      createdInvoiceIds.push(id2);
      console.error("FAIL: Created duplicate quotation!");
    } catch (err) {
      console.log(`SUCCESS: Blocked duplicate quote generation as expected! Error: ${err.message}`);
    }

    // 3. Verify manual override forward-only sequence counter logic
    console.log("3. Verifying sequence counter is forward-only...");
    const settingsBefore = await prisma.companySettings.findUnique({
      where: { companyId: company.id }
    });
    console.log(`Sequence counter before manual override: ${settingsBefore.lastQuoteNumber} (expected: 21)`);

    // Create a quote with a lower number, Q-2026-015
    const id3 = await createInvoiceAction({
      clientId: client.id,
      date: new Date().toISOString(),
      quoteNumber: "Q-2026-015",
      type: "QUOTE",
      items: [{ description: "Test Item 3", quantity: 1, unitPrice: 150 }]
    });
    createdInvoiceIds.push(id3);
    console.log(`Created manual quote Q-2026-015: ID=${id3}`);

    const settingsAfter = await prisma.companySettings.findUnique({
      where: { companyId: company.id }
    });
    console.log(`Sequence counter after manual override: ${settingsAfter.lastQuoteNumber} (expected: 21, did not drop to 15)`);
    if (settingsAfter.lastQuoteNumber === 15) {
      console.error("FAIL: Sequence counter was reset backwards!");
    } else {
      console.log("SUCCESS: Sequence counter did not reset backwards!");
    }

    // 4. Verify editing quote details to a duplicate number throws an error
    console.log("4. Attempting to edit quote Q-2026-015 to duplicate number Q-2026-021...");
    try {
      await updateInvoiceDetailsAction(id3, {
        quoteNumber: "Q-2026-021"
      });
      console.error("FAIL: Allowed edit to duplicate quotation number!");
    } catch (err) {
      console.log(`SUCCESS: Blocked edit to duplicate number as expected! Error: ${err.message}`);
    }

  } finally {
    console.log("Cleaning up database entries...");
    if (createdInvoiceIds.length > 0) {
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: { in: createdInvoiceIds } }
      });
      await prisma.invoice.deleteMany({
        where: { id: { in: createdInvoiceIds } }
      });
      // Delete the project automatically created by createInvoiceAction
      const projects = await prisma.project.findMany({
        where: { description: { startsWith: "Created from Quotation" } }
      });
      for (const proj of projects) {
        await prisma.project.delete({ where: { id: proj.id } });
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
