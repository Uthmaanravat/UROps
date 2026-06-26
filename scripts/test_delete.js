const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companyId = "b0eb011a-304b-4cf7-a73c-a04279698207"; // GMAIL company id
  console.log("Fetching leads for company:", companyId);
  const leads = await prisma.lead.findMany({
    where: { companyId },
    select: { id: true }
  });
  
  const leadIds = leads.map(l => l.id);
  console.log(`Found ${leadIds.length} leads. Attempting dry-run transaction delete...`);

  // Let's run a transaction but roll it back or just try deleting one/all and catching errors
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find valid leads
      const validLeads = await tx.lead.findMany({
        where: {
          id: { in: leadIds },
          companyId: companyId
        },
        select: { id: true }
      });
      const validIds = validLeads.map(l => l.id);
      console.log(`Validating ${validIds.length} leads for deletion...`);

      const deleteResult = await tx.lead.deleteMany({
        where: {
          id: { in: validIds }
        }
      });
      console.log(`Prisma reports deleted count: ${deleteResult.count}`);
      
      // Rollback so we don't actually delete them yet
      throw new Error("ROLLBACK_FOR_TESTING");
    });
  } catch (err) {
    if (err.message === "ROLLBACK_FOR_TESTING") {
      console.log("Dry run success! Transaction was successful and rolled back without errors.");
    } else {
      console.error("Dry run failed with error:", err);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
