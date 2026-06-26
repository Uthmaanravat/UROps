const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock react.cache which is used in auth-actions.ts
const react = require('react');
react.cache = (fn) => fn;

// Mock getAuthCompanyId and ensureAuth from auth-actions
const authActions = require('../src/lib/auth-actions');
authActions.ensureAuth = async () => "b0eb011a-304b-4cf7-a73c-a04279698207"; // GMAIL company id
authActions.getAuthCompanyId = async () => "b0eb011a-304b-4cf7-a73c-a04279698207";

async function main() {
  console.log("Mocking authentication: companyId = b0eb011a-304b-4cf7-a73c-a04279698207");

  // Fetch some GMAIL lead IDs to test with
  const leads = await prisma.lead.findMany({
    where: { companyId: "b0eb011a-304b-4cf7-a73c-a04279698207" },
    take: 5,
    select: { id: true, address: true }
  });

  if (leads.length === 0) {
    console.log("No leads found to delete.");
    return;
  }

  const leadIds = leads.map(l => l.id);
  console.log("Found leads to delete:", leads.map(l => l.address));

  // Require actions.ts after mocking ensureAuth
  const { deleteLeadsBulkAction } = require('../src/app/(dashboard)/dashboard/actions');

  console.log("Calling deleteLeadsBulkAction...");
  const result = await deleteLeadsBulkAction(leadIds);
  console.log("Result:", result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
