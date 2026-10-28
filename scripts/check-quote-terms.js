const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function checkQuoteTerms() {
    const url = new URL(directUrl);
    url.searchParams.set('schema', 'public');
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    try {
        const cols = await prisma.$queryRaw`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'quote_terms';
        `;
        console.log('quote_terms columns in public:');
        console.dir(cols, { depth: null });

        const constraints = await prisma.$queryRaw`
            SELECT conname, contype, pg_get_constraintdef(c.oid) 
            FROM pg_constraint c 
            JOIN pg_namespace n ON n.oid = c.connamespace 
            WHERE n.nspname = 'public' AND conrelid = 'public."quote_terms"'::regclass;
        `;
        console.log('quote_terms constraints in public:');
        console.dir(constraints, { depth: null });
    } finally {
        await prisma.$disconnect();
    }
}

checkQuoteTerms().catch(console.error);
