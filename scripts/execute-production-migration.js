const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}

async function runMigration(targetSchema) {
    console.log(`\n======================================================`);
    console.log(`RUNNING MIGRATION ON SCHEMA: ${targetSchema}`);
    console.log(`======================================================\n`);

    const url = new URL(directUrl);
    url.searchParams.set('schema', targetSchema);
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    try {
        const sqlText = fs.readFileSync(path.resolve('scripts/production_migration.sql'), 'utf8');
        // Replace schema if testing on throwaway_copy
        const targetSql = targetSchema === 'public' 
            ? sqlText 
            : sqlText.replace(/"public"/g, `"${targetSchema}"`);

        // Parse statements
        const chunks = [];
        let current = '';
        let inDollar = false;

        for (const line of targetSql.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('--')) continue; // Skip comments
            if (line.includes('$$')) {
                inDollar = !inDollar;
            }
            current += line + '\n';
            if (!inDollar && trimmed.endsWith(';')) {
                const stmt = current.trim();
                if (stmt && stmt !== 'BEGIN;' && stmt !== 'COMMIT;') {
                    chunks.push(stmt.replace(/;$/, ''));
                }
                current = '';
            }
        }

        console.log(`Total statements to execute: ${chunks.length}`);

        // Execute in a single Prisma transaction with 2-minute timeout
        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < chunks.length; i++) {
                const stmt = chunks[i];
                const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
                console.log(`[${i + 1}/${chunks.length}] Executing: ${preview}...`);
                await tx.$executeRawUnsafe(stmt);
            }
        }, {
            maxWait: 15000,
            timeout: 120000
        });

        console.log(`\n>>> SUCCESS: All ${chunks.length} statements executed successfully on ${targetSchema}! <<<\n`);
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    const target = process.argv[2];
    if (target !== 'throwaway_copy' && target !== 'public') {
        console.error('Usage: node scripts/execute-production-migration.js <throwaway_copy|public>');
        process.exit(1);
    }
    await runMigration(target);
}

main().catch(err => {
    console.error('MIGRATION FAILED:', err);
    process.exit(1);
});
