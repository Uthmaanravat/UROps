const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      companyId: true,
      company: {
        select: {
          name: true
        }
      }
    }
  });

  const breakdown = {};
  leads.forEach(l => {
    const compName = l.company ? l.company.name : "UNKNOWN";
    const compId = l.companyId;
    const key = `${compName} (${compId})`;
    breakdown[key] = (breakdown[key] || 0) + 1;
  });

  console.log("Leads breakdown by company:");
  console.log(JSON.stringify(breakdown, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
