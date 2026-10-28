const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve('.env'), 'utf8');
let directUrl = '';
for (const line of envText.split('\n')) {
    if (line.startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
}
const url = new URL(directUrl);
url.searchParams.set('schema', 'throwaway_copy');
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

async function main() {
    console.log('Testing ROLLBACK SQL statements on throwaway_copy...');
    const rollbackSql = fs.readFileSync(path.resolve('scripts/rollback_migration.sql'), 'utf8');
    const testSql = rollbackSql.replace(/"public"/g, '"throwaway_copy"');

    // Split by semicolons, preserving DO $$ blocks
    const chunks = [];
    let current = '';
    let inDollar = false;

    for (const line of testSql.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('--')) continue; // Skip comment lines
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

    console.log(`Executing ${chunks.length} rollback statements...`);
    for (let i = 0; i < chunks.length; i++) {
        const stmt = chunks[i];
        try {
            await prisma.$executeRawUnsafe(stmt);
        } catch (err) {
            console.error(`Error executing statement #${i + 1}:\n${stmt.slice(0, 150)}...\n`, err.message);
            throw err;
        }
    }

    console.log('All rollback statements executed successfully on throwaway_copy!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
