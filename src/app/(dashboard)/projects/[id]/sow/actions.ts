'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { submitScopeOfWork, generateQuotationFromWBP } from "@/lib/workflow"
import { getPricingSuggestions } from "@/app/actions/ai"
import { ensureAuth } from "@/lib/auth-actions"

export async function submitScopeAction(projectId: string, items: any[], site?: string) {
    const result = await submitScopeOfWork(projectId, items, site)
    return { wbpId: result.wbp.id }
}

export async function saveWBPDraftAction(wbpId: string, items: any[], options?: { site?: string, quoteNumber?: string, reference?: string, notes?: string }) {
    const companyId = await ensureAuth()

    // Update WBP items without marking as APPROVED
    for (const item of items) {
        const isRealId = item.id && item.id.length > 20

        if (isRealId) {
            await prisma.workBreakdownPricingItem.update({
                where: { id: item.id },
                data: {
                    area: item.area,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitPrice: item.unitPrice,
                    total: item.quantity * item.unitPrice,
                    notes: item.notes
                }
            })
        } else {
            await prisma.workBreakdownPricingItem.create({
                data: {
                    wbpId,
                    area: item.area,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitPrice: item.unitPrice,
                    total: item.quantity * item.unitPrice,
                    notes: item.notes
                }
            })
        }
    }

    await prisma.workBreakdownPricing.update({
        where: { id: wbpId, companyId },
        data: {
            site: options?.site,
            quoteNumber: options?.quoteNumber,
            notes: options?.notes
        }
    })

    revalidatePath(`/work-breakdown-pricing/${wbpId}`)
    return { success: true }
}

export async function getSuggestedQuoteNumberAction() {
    const lastInvoice = await prisma.invoice.findFirst({
        orderBy: { number: 'desc' }
    })
    const year = new Date().getFullYear()
    const nextNumber = (lastInvoice?.number || 0) + 1
    return `Q-${year}-${nextNumber.toString().padStart(3, '0')}`
}

export async function generateQuotationAction(wbpId: string, items: any[], options?: { site?: string, quoteNumber?: string, reference?: string, notes?: string }) {
    return await generateQuotationFromWBP(wbpId, items, options)
}

export async function getPricingSuggestionsAction(items: { description: string }[]) {
    return await getPricingSuggestions(items)
}

export async function deleteSOWAction(id: string, projectId: string) {
    await prisma.scopeOfWork.delete({ where: { id } })
    revalidatePath(`/projects/${projectId}`)
}

export async function saveSOWDraftAction(projectId: string, items: any[], site?: string) {
    const companyId = await ensureAuth()

    // Check for existing draft
    const existingDraft = await prisma.scopeOfWork.findFirst({
        where: { projectId, status: 'DRAFT', companyId }
    })

    if (existingDraft) {
        // Update existing draft
        await prisma.scopeOfWork.update({
            where: { id: existingDraft.id },
            data: {
                site,
                items: {
                    deleteMany: {}, // Clear old items
                    create: items.map(i => ({
                        area: i.area,
                        description: i.description,
                        quantity: i.quantity,
                        unit: i.unit,
                        notes: i.notes
                    }))
                }
            }
        })
    } else {
        // Create new draft
        await prisma.scopeOfWork.create({
            data: {
                companyId,
                projectId,
                status: 'DRAFT',
                site,
                items: {
                    create: items.map(i => ({
                        area: i.area,
                        description: i.description,
                        quantity: i.quantity,
                        unit: i.unit,
                        notes: i.notes
                    }))
                }
            }
        })
    }

    revalidatePath(`/projects/${projectId}/sow`)
    return { success: true }
}
