const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const reports = await prisma.report.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, number: true, type: true }
  })
  console.log(JSON.stringify(reports, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
