const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Fetching active leads from database...");
  const leads = await prisma.lead.findMany({
    where: { companyId: "b0eb011a-304b-4cf7-a73c-a04279698207" },
    take: 3
  });
  if (leads.length === 0) {
    console.log("No leads found for company!");
    return;
  }
  const leadIds = leads.map(l => l.id);
  console.log("Leads found:", leads.map(l => l.address), "IDs:", leadIds);
  console.log("Attempting bulk deletion of leads...");
  const deleteResult = await prisma.lead.deleteMany({
    where: { id: { in: leadIds } }
  });
  console.log("Delete result:", deleteResult);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
