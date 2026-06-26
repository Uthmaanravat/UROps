const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Fetching all quotes/invoices from the database...");
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      quoteNumber: true,
      type: true,
      status: true,
      projectId: true,
      number: true,
      project: {
        select: {
          name: true
        }
      }
    }
  });

  const counts = {};
  invoices.forEach(inv => {
    if (inv.quoteNumber) {
      counts[inv.quoteNumber] = counts[inv.quoteNumber] || [];
      counts[inv.quoteNumber].push({
        id: inv.id,
        type: inv.type,
        status: inv.status,
        number: inv.number,
        projectName: inv.project ? inv.project.name : "UNKNOWN"
      });
    }
  });

  console.log("Duplicate quoteNumber groups:");
  let foundDuplicates = false;
  for (const [quoteNum, items] of Object.entries(counts)) {
    if (items.length > 1) {
      console.log(`\nQuote Number: ${quoteNum} (Count: ${items.length})`);
      console.log(JSON.stringify(items, null, 2));
      foundDuplicates = true;
    }
  }

  if (!foundDuplicates) {
    console.log("No duplicate quoteNumber values found in the database.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
