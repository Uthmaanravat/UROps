const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      address: true,
      projectId: true,
      project: {
        select: {
          name: true
        }
      }
    }
  });
  
  const linked = leads.filter(l => l.projectId);
  console.log(`Total leads: ${leads.length}`);
  console.log(`Leads linked to a project: ${linked.length}`);
  if (linked.length > 0) {
    console.log(JSON.stringify(linked, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
