'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ensureAuth } from "@/lib/auth-actions"

export async function deleteWBPAction(id: string) {
    const companyId = await ensureAuth()
    await prisma.workBreakdownPricing.delete({
        where: { id, companyId }
    })
    revalidatePath("/work-breakdown-pricing")
    revalidatePath("/projects")
}
