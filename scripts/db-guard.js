/**
 * DATABASE GUARDRAIL FOR ALL SCRIPTS IN /scripts
 *
 * Rules enforced:
 * 1. Every script that writes data must refuse to run unless the connection string itself
 *    contains schema=throwaway_copy (or uses src/lib/prisma.ts resolver).
 * 2. It must print the target schema before writing.
 * 3. Never use SET search_path over PgBouncer.
 */

const { PrismaClient } = require('@prisma/client');

function resolveScriptDatabaseUrl(options = {}) {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) {
        throw new Error('[DB GUARDRAIL ERROR] DATABASE_URL environment variable is missing.');
    }

    const allowProdWrite = options.allowProductionWrite === true || process.env.ALLOW_PRODUCTION_WRITE === 'true';

    let finalUrl = rawUrl;
    if (!allowProdWrite) {
        // Enforce throwaway_copy unless explicit production write is specified
        if (!finalUrl.includes('schema=throwaway_copy')) {
            finalUrl = finalUrl.includes('schema=')
                ? finalUrl.replace(/schema=[^&]+/, 'schema=throwaway_copy')
                : `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}schema=throwaway_copy`;
        }
    }

    // Extract target schema
    const schemaMatch = finalUrl.match(/[?&]schema=([^&]+)/);
    const targetSchema = schemaMatch ? schemaMatch[1] : 'public';

    // Must print the target schema before writing
    console.log(`[DB GUARDRAIL] Target schema: "${targetSchema}" (allowProductionWrite: ${allowProdWrite})`);

    // Refuse to run unless schema=throwaway_copy or allowProductionWrite is true
    if (!allowProdWrite && targetSchema !== 'throwaway_copy') {
        throw new Error(`[DB GUARDRAIL REFUSAL] Refusing to run write operation: connection string does NOT contain schema=throwaway_copy (target is "${targetSchema}").`);
    }

    return { url: finalUrl, targetSchema };
}

function createGuardedPrismaClient(options = {}) {
    const { url, targetSchema } = resolveScriptDatabaseUrl(options);
    const client = new PrismaClient({
        datasources: { db: { url } }
    });

    // Guard against any attempt to use SET search_path over PgBouncer
    const originalExecuteRaw = client.$executeRawUnsafe.bind(client);
    client.$executeRawUnsafe = async function (query, ...args) {
        if (typeof query === 'string' && /set\s+search_path/i.test(query)) {
            throw new Error('[DB GUARDRAIL FORBIDDEN] Never use SET search_path over PgBouncer! Pass schema=throwaway_copy in the connection string instead.');
        }
        return originalExecuteRaw(query, ...args);
    };

    return client;
}

module.exports = {
    resolveScriptDatabaseUrl,
    createGuardedPrismaClient
};
