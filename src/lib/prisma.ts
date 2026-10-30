import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// Route Vercel Preview & local throwaway preview sessions strictly to throwaway_copy schema
function resolveDatabaseUrl(): string {
    const rawUrl = process.env.DATABASE_URL || 'file:./dev.db'
    if (
        (process.env.VERCEL_ENV === 'preview' || process.env.USE_THROWAWAY_SCHEMA === 'true') &&
        rawUrl.startsWith('postgres')
    ) {
        return rawUrl.includes('schema=')
            ? rawUrl.replace(/schema=[^&]+/, 'schema=throwaway_copy')
            : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}schema=throwaway_copy`
    }
    return rawUrl
}

const databaseUrl = resolveDatabaseUrl()

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    datasources: { db: { url: databaseUrl } }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

if (!process.env.DATABASE_URL) {
    console.warn("⚠️  WARNING: DATABASE_URL is missing. Using local SQLite database at ./dev.db for development.");
}
