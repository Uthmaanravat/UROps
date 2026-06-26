const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Fetching recent submission logs...");
  const logs = await prisma.submissionLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      company: {
        select: {
          name: true
        }
      }
    }
  });
  console.log("Recent submission logs:");
  console.log(JSON.stringify(logs, null, 2));

  console.log("\nFetching recent projects...");
  const projects = await prisma.project.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      company: {
        select: {
          name: true
        }
      }
    }
  });
  console.log("Recent projects:");
  console.log(JSON.stringify(projects, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
