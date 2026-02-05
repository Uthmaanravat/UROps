'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function deleteWBPAction(id: string) {
    await prisma.workBreakdownPricing.delete({
        where: { id }
    })
    revalidatePath("/work-breakdown-pricing")
    revalidatePath("/projects")
}
