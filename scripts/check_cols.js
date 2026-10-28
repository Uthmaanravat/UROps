const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const pubInvoiceCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'Invoice'
  `);
  console.log('PUBLIC Invoice columns:', pubInvoiceCols.map(c => c.column_name));

  const pubItemCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'InvoiceItem'
  `);
  console.log('PUBLIC InvoiceItem columns:', pubItemCols.map(c => c.column_name));

  const previewInvoiceCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'throwaway_copy' AND table_name = 'Invoice'
  `);
  console.log('THROWAWAY_COPY Invoice columns:', previewInvoiceCols.map(c => c.column_name));

  const previewItemCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'throwaway_copy' AND table_name = 'InvoiceItem'
  `);
  console.log('THROWAWAY_COPY InvoiceItem columns:', previewItemCols.map(c => c.column_name));
}

check().catch(console.error).finally(() => prisma.$disconnect());
