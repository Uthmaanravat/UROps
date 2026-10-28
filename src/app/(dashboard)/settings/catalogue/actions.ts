"use server"

import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { revalidatePath } from "next/cache"
import { ensureAeroWashCatalogueAndTerms } from "@/lib/aerowash-catalogue-seed"

export async function getAeroWashCatalogueAction() {
    const companyId = await ensureAuth()
    await ensureAeroWashCatalogueAndTerms(companyId)

    const items = await (prisma as any).catalogueItem.findMany({
        where: { companyId },
        orderBy: { itemNumber: 'asc' }
    })

    return items
}

export async function updateCatalogueItemAction(data: {
    id: string
    name?: string
    clientDescription?: string
    internalNotes?: string | null
    pricingMethod?: string
    category?: string
    metadata?: any
    isActive?: boolean
}) {
    const companyId = await ensureAuth()

    const updated = await (prisma as any).catalogueItem.update({
        where: { id: data.id, companyId },
        data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.clientDescription !== undefined ? { clientDescription: data.clientDescription } : {}),
            ...(data.internalNotes !== undefined ? { internalNotes: data.internalNotes } : {}),
            ...(data.pricingMethod !== undefined ? { pricingMethod: data.pricingMethod } : {}),
            ...(data.category !== undefined ? { category: data.category } : {}),
            ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            updatedAt: new Date()
        }
    })

    revalidatePath("/settings/catalogue")
    revalidatePath("/invoices/new")
    return updated
}

export async function toggleCatalogueItemActiveAction(id: string, isActive: boolean) {
    const companyId = await ensureAuth()

    const updated = await (prisma as any).catalogueItem.update({
        where: { id, companyId },
        data: {
            isActive,
            updatedAt: new Date()
        }
    })

    revalidatePath("/settings/catalogue")
    revalidatePath("/invoices/new")
    return updated
}

export async function createCatalogueItemAction(data: {
    name: string
    clientDescription: string
    category: string
    pricingMethod: string
    internalNotes?: string
    metadata?: any
}) {
    const companyId = await ensureAuth()

    // Find the next available itemNumber
    const maxItem = await (prisma as any).catalogueItem.findFirst({
        where: { companyId },
        orderBy: { itemNumber: 'desc' },
        select: { itemNumber: true }
    })

    const nextItemNumber = (maxItem?.itemNumber || 23) + 1

    const created = await (prisma as any).catalogueItem.create({
        data: {
            companyId,
            itemNumber: nextItemNumber,
            name: data.name,
            clientDescription: data.clientDescription,
            category: data.category,
            pricingMethod: data.pricingMethod,
            internalNotes: data.internalNotes || null,
            isActive: true,
            metadata: data.metadata || null
        }
    })

    revalidatePath("/settings/catalogue")
    revalidatePath("/invoices/new")
    return created
}
