'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getFixedPriceItemsAction() {
    try {
        return await prisma.fixedPriceItem.findMany({
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
    try {
        console.log("Saving fixed price item:", data);

        if (data.id) {
            await prisma.fixedPriceItem.update({
                where: { id: data.id },
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
    try {
        console.log("Deleting fixed price item:", id);

        await prisma.fixedPriceItem.delete({
            where: { id }
        })
        revalidatePath("/knowledge")
        return { success: true }
    } catch (error) {
        console.error("Error deleting fixed price item:", error);
        return { success: false, error: String(error) }
    }
}
