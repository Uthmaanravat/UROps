const react = require('react');
react.cache = (fn) => fn;

// Mock next/headers
const nextHeaders = require('next/headers');
nextHeaders.cookies = () => ({
  get: () => ({ value: 'mocked' }),
  set: () => {},
  delete: () => {}
});

// Mock Supabase Server Client
const supabaseServer = require('../src/lib/supabase/server');
supabaseServer.createClient = () => ({
  auth: {
    getUser: async () => ({ data: { user: { id: 'mock-user-id', email: 'test@gmail.com' } } })
  }
});

// Mock Submission Logger in require cache to bypass read-only ES module getters
require.cache[require.resolve('../src/lib/submission-logger')] = {
  exports: {
    logSubmission: async () => {
      console.log("  [MOCK] logSubmission invoked");
    }
  }
};

// Mock next/cache revalidatePath
require.cache[require.resolve('next/cache')] = {
  exports: {
    revalidatePath: () => {
      console.log("  [MOCK] revalidatePath invoked");
    }
  }
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { submitScopeOfWork, generateQuotationFromWBP } = require('../src/lib/workflow');

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

  // Set the current sequence counter to 10
  console.log("Setting lastQuoteNumber counter to 10...");
  await prisma.companySettings.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id, lastQuoteNumber: 10 },
    update: { lastQuoteNumber: 10 }
  });

  // Create a test project
  console.log("Creating test project...");
  const project = await prisma.project.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      name: "TEST NUMBER SEQUENCE PROJECT",
      status: "SOW",
      workflowStage: "SOW"
    }
  });

  // 1. Submit SOW (this creates a provisional draft quote, Q-2026-011)
  console.log("1. Submitting SOW to generate first quote...");
  const sowResult = await submitScopeOfWork(
    project.id,
    [{ description: "Test Window Washing", quantity: 1, unit: "m²", area: "Facade" }],
    "Test Site"
  );
  
  const quote1 = await prisma.invoice.findFirst({
    where: { projectId: project.id }
  });
  console.log(`Generated first quote: ID=${quote1.id}, QuoteNumber=${quote1.quoteNumber}, Status=${quote1.status}`);
  
  // 2. Reject first quote
  console.log("2. Rejecting first quote...");
  await prisma.invoice.update({
    where: { id: quote1.id },
    data: { status: 'REJECTED' }
  });

  // 3. Approve WBP (this should generate a NEW quote Q-2026-012, instead of reusing Q-2026-011)
  console.log("3. Approving WBP to generate second quote...");
  await generateQuotationFromWBP(
    sowResult.wbp.id,
    [{ description: "Final Window Wash", quantity: 1, unitPrice: 100, area: "Facade" }]
  );

  const quote2 = await prisma.invoice.findFirst({
    where: { 
      projectId: project.id,
      status: 'DRAFT'
    }
  });

  console.log(`Generated second quote: ID=${quote2.id}, QuoteNumber=${quote2.quoteNumber}, Status=${quote2.status}`);

  if (quote1.quoteNumber === quote2.quoteNumber) {
    console.error("FAIL: Reused the rejected quotation number!");
  } else {
    console.log("SUCCESS: Correctly generated a new sequential quotation number!");
  }

  // 4. Test manual override forward-only safety check
  console.log("4. Testing manual override forward-only sequence check...");
  // Attempt to enter a manual quote number with sequence 5 (lower than 12)
  await generateQuotationFromWBP(
    sowResult.wbp.id,
    [{ description: "Final Window Wash", quantity: 1, unitPrice: 100, area: "Facade" }],
    { quoteNumber: "Q-2026-005" }
  );

  const settings = await prisma.companySettings.findUnique({
    where: { companyId: company.id }
  });

  console.log(`Company sequence counter is now: ${settings.lastQuoteNumber} (expected: 12, did not drop back to 5)`);
  if (settings.lastQuoteNumber === 5) {
    console.error("FAIL: Sequence counter was reset backwards!");
  } else {
    console.log("SUCCESS: Sequence counter stayed forward-only!");
  }

  // Clean up
  console.log("Cleaning up test project and invoices...");
  await prisma.invoiceItem.deleteMany({
    where: { invoiceId: { in: [quote1.id, quote2.id] } }
  });
  await prisma.invoice.deleteMany({
    where: { id: { in: [quote1.id, quote2.id] } }
  });
  await prisma.workBreakdownPricingItem.deleteMany({
    where: { wbpId: sowResult.wbp.id }
  });
  await prisma.workBreakdownPricing.deleteMany({
    where: { id: sowResult.wbp.id }
  });
  await prisma.scopeItem.deleteMany({
    where: { scopeId: sowResult.sow.id }
  });
  await prisma.scopeOfWork.deleteMany({
    where: { id: sowResult.sow.id }
  });
  await prisma.project.delete({
    where: { id: project.id }
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
