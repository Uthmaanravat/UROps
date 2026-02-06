'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"

export async function getCompanySettings() {
    try {
        const companyId = await ensureAuth()
        const settings = await prisma.companySettings.findUnique({
            where: { companyId }
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
        const companyId = await ensureAuth()
        const settings = await prisma.companySettings.upsert({
            where: { companyId },
            update: data,
            create: {
                ...data,
                companyId
            }
        })

        revalidatePath("/")
        return { success: true, data: settings }
    } catch (error) {
        console.error("Error updating company settings:", error)
        return { success: false, error: "Failed to update settings" }
    }
}
export async function resetAppDataAction() {
    try {
        const companyId = await ensureAuth()

        await prisma.$transaction([
            // Order matters for some relations if not cascaded, 
            // but prisma handles it well with deleteMany in transaction
            prisma.submissionLog.deleteMany({ where: { companyId } }),
            prisma.interaction.deleteMany({ where: { companyId } }),
            prisma.meeting.deleteMany({ where: { companyId } }),
            prisma.payment.deleteMany({ where: { companyId } }),
            prisma.invoiceItem.deleteMany({
                where: {
                    invoice: { companyId }
                }
            }),
            prisma.invoice.deleteMany({ where: { companyId } }),
            prisma.scopeItem.deleteMany({
                where: {
                    scope: { companyId }
                }
            }),
            prisma.scopeOfWork.deleteMany({ where: { companyId } }),
            prisma.workBreakdownPricingItem.deleteMany({
                where: {
                    wbp: { companyId }
                }
            }),
            prisma.workBreakdownPricing.deleteMany({ where: { companyId } }),
            prisma.project.deleteMany({ where: { companyId } }),
            prisma.pricingKnowledge.deleteMany({ where: { companyId } }),
            prisma.fixedPriceItem.deleteMany({ where: { companyId } }),
        ])

        revalidatePath("/")
        return { success: true }
    } catch (error) {
        console.error("Error resetting app data:", error)
        return { success: false, error: "Failed to reset app data" }
    }
}
