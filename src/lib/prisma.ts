import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

if (!process.env.DATABASE_URL) {
    console.warn("⚠️  WARNING: DATABASE_URL is missing. The app will crash if it tries to connect to the DB.");
}
