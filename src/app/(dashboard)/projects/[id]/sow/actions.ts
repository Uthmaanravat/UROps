'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { submitScopeOfWork, generateQuotationFromWBP } from "@/lib/workflow"
import { getPricingSuggestions } from "@/app/actions/ai"
import { ensureAuth } from "@/lib/auth-actions"
import { getQuoteSequenceAction } from "@/app/(dashboard)/invoices/actions"

export async function submitScopeAction(projectId: string, items: any[], site?: string) {
    const result = await submitScopeOfWork(projectId, items, site)
    return { wbpId: result.wbp.id }
}

export async function saveWBPDraftAction(wbpId: string, items: any[], options?: { site?: string, quoteNumber?: string, reference?: string, notes?: string, contactId?: string | null, attentionTo?: string | null }) {
    const companyId = await ensureAuth()

    // Clear old items to avoid orphans and preserve reordered positions
    await prisma.workBreakdownPricingItem.deleteMany({
        where: { wbpId }
    })

    await prisma.workBreakdownPricingItem.createMany({
        data: items.map((item, idx) => ({
            wbpId,
            area: item.area || "",
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || "",
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            notes: item.notes || "",
            position: idx
        }))
    })

    await prisma.workBreakdownPricing.update({
        where: { id: wbpId, companyId },
        data: {
            site: options?.site,
            quoteNumber: options?.quoteNumber,
            notes: options?.notes,
            contactId: options?.contactId || null,
            attentionTo: options?.attentionTo || null
        }
    })

    revalidatePath(`/work-breakdown-pricing/${wbpId}`)
    return { success: true }
}

export async function getSuggestedQuoteNumberAction(projectId: string) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { clientId: true }
    })
    if (!project) return null
    return await getQuoteSequenceAction(project.clientId)
}

export async function generateQuotationAction(
    wbpId: string,
    items: any[],
    options?: { site?: string; quoteNumber?: string; reference?: string; notes?: string; contactId?: string | null; attentionTo?: string | null }
) {
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
                    create: items.map((i, idx) => ({
                        area: i.area,
                        description: i.description,
                        quantity: i.quantity,
                        unit: i.unit,
                        notes: i.notes,
                        position: idx
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
                    create: items.map((i, idx) => ({
                        area: i.area,
                        description: i.description,
                        quantity: i.quantity,
                        unit: i.unit,
                        notes: i.notes,
                        position: idx
                    }))
                }
            }
        })
    }

    revalidatePath(`/projects/${projectId}/sow`)
    return { success: true }
}

export async function unlockSOWAction(id: string, projectId: string) {
    const companyId = await ensureAuth()
    await prisma.scopeOfWork.update({
        where: { id, projectId, companyId },
        data: { status: 'DRAFT' }
    })
    revalidatePath(`/projects/${projectId}/sow`)
    revalidatePath("/projects")
}
