'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getCompanySettings() {
    try {
        const settings = await prisma.companySettings.findUnique({
            where: { id: "default" }
        })
        return settings
    } catch (error) {
        console.error("Error fetching company settings:", error)
        return null
    }
}

export async function updateCompanySettings(data: {
    name: string
    address?: string
    phone?: string
    email?: string
    website?: string
    logoUrl?: string
    taxId?: string
    bankDetails?: string
    paymentTerms?: string
    currency?: string
    theme?: string
    aiEnabled?: boolean
    layoutPreferences?: any
}) {
    try {
        const settings = await prisma.companySettings.upsert({
            where: { id: "default" },
            update: data,
            create: {
                id: "default",
                ...data
            }
        })

        revalidatePath("/")
        return { success: true, data: settings }
    } catch (error) {
        console.error("Error updating company settings:", error)
        return { success: false, error: "Failed to update settings" }
    }
}
