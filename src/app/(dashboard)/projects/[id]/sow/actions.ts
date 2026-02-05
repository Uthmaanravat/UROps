'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { submitScopeOfWork, generateQuotationFromWBP } from "@/lib/workflow"
import { getPricingSuggestions } from "@/app/actions/ai"

export async function submitScopeAction(projectId: string, items: any[], site?: string) {
    const result = await submitScopeOfWork(projectId, items, site)
    return { wbpId: result.wbp.id }
}

export async function getSuggestedQuoteNumberAction() {
    const count = await prisma.invoice.count({
        where: { type: 'QUOTE' }
    })
    return `Q-${(count + 1).toString().padStart(3, '0')}`
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
