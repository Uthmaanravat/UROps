import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// Use SQLite file for local development if DATABASE_URL is not set
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    datasources: { db: { url: databaseUrl } }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

if (!process.env.DATABASE_URL) {
    console.warn("⚠️  WARNING: DATABASE_URL is missing. Using local SQLite database at ./dev.db for development.");
}
