'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"

export async function getFixedPriceItemsAction() {
    const companyId = await ensureAuth()
    try {
        return await prisma.fixedPriceItem.findMany({
            where: { companyId },
            orderBy: { description: 'asc' }
        })
    } catch (error) {
        console.error("Error fetching fixed price items:", error)
        return []
    }
}

export async function saveFixedPriceItemAction(data: {
    id?: string,
    description: string,
    unitPrice: number,
    unit?: string,
    category?: string
}) {
    const companyId = await ensureAuth()
    try {
        console.log("Saving fixed price item:", data);

        if (data.id) {
            await prisma.fixedPriceItem.update({
                where: { id: data.id, companyId },
                data: {
                    description: data.description,
                    unitPrice: data.unitPrice,
                    unit: data.unit,
                    category: data.category
                }
            })
        } else {
            await prisma.fixedPriceItem.create({
                data: {
                    companyId,
                    description: data.description,
                    unitPrice: data.unitPrice,
                    unit: data.unit,
                    category: data.category
                }
            })
        }
        revalidatePath("/knowledge")
        return { success: true }
    } catch (error) {
        console.error("Error saving fixed price item:", error);
        return { success: false, error: String(error) }
    }
}

export async function deleteFixedPriceItemAction(id: string) {
    const companyId = await ensureAuth()
    try {
        console.log("Deleting fixed price item:", id);

        await prisma.fixedPriceItem.delete({
            where: { id, companyId }
        })
        revalidatePath("/knowledge")
        return { success: true }
    } catch (error) {
        console.error("Error deleting fixed price item:", error);
        return { success: false, error: String(error) }
    }
}
