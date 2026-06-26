const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const projectId = "ba0e2f78-95fe-4db3-a003-e3b63fa4a686";
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      invoices: true,
      workBreakdowns: {
        include: { items: true }
      },
      scopes: {
        include: { items: true }
      }
    }
  });
  console.log(JSON.stringify(project, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
