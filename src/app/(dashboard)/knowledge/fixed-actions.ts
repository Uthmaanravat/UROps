'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"

export async function getFixedPriceItemsAction() {
    const companyId = await ensureAuth()
    try {
        return await prisma.fixedPriceItem.findMany({
            where: { companyId },
            include: { 
                client: { select: { id: true, name: true } },
                tender: { select: { id: true, name: true, tenderNumber: true } }
            },
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
    category?: string,
    clientId?: string | null,
    code?: string | null,
    tenderId?: string | null,
    year1Price?: number | null,
    year2Price?: number | null,
    year3Price?: number | null
}) {
    const companyId = await ensureAuth()
    try {
        console.log("Saving fixed price item:", data);

        const y1 = data.year1Price !== undefined && data.year1Price !== null ? data.year1Price : data.unitPrice;
        const effectiveUnitPrice = y1 ?? data.unitPrice;

        if (data.id) {
            await prisma.fixedPriceItem.update({
                where: { id: data.id, companyId },
                data: {
                    description: data.description,
                    unitPrice: effectiveUnitPrice,
                    unit: data.unit,
                    category: data.category,
                    clientId: data.clientId || null,
                    code: data.code || null,
                    tenderId: data.tenderId || null,
                    year1Price: y1,
                    year2Price: data.year2Price || null,
                    year3Price: data.year3Price || null
                }
            })
        } else {
            await prisma.fixedPriceItem.create({
                data: {
                    companyId,
                    description: data.description,
                    unitPrice: effectiveUnitPrice,
                    unit: data.unit,
                    category: data.category,
                    clientId: data.clientId || null,
                    code: data.code || null,
                    tenderId: data.tenderId || null,
                    year1Price: y1,
                    year2Price: data.year2Price || null,
                    year3Price: data.year3Price || null
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
