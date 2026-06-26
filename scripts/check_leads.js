const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Fetching all leads...");
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      address: true,
      companyId: true,
      company: {
        select: {
          name: true
        }
      }
    }
  });
  console.log(`Found ${leads.length} leads:`);
  console.log(JSON.stringify(leads, null, 2));

  console.log("\nFetching all companies...");
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      users: {
        select: {
          id: true,
          email: true,
          role: true
        }
      }
    }
  });
  console.log(JSON.stringify(companies, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
