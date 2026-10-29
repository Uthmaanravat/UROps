'use server'

import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { revalidatePath } from "next/cache"
import { getQuoteSequenceAction } from "./actions"

export async function reissueQuoteAction(quoteId: string) {
    try {
        const companyId = await ensureAuth()

        const quote = await prisma.invoice.findUnique({
            where: { id: quoteId, companyId },
            include: {
                items: { orderBy: { position: 'asc' } },
                terms: true
            }
        })

        if (!quote) throw new Error("Quote not found")

        const seq = await getQuoteSequenceAction(quote.clientId, quote.workType as any, quote.tenderId || undefined)
        const nextQuoteNumber = seq || `AW-${new Date().getFullYear()}-${String(quote.number + 1).padStart(3, '0')}`
        const match = nextQuoteNumber.match(/(\d+)$/)
        const nextNumber = match ? parseInt(match[1]) : quote.number + 1

        const now = new Date()

        const clonedMetadata = {
            ...((quote.metadata as any) || {}),
            reissuedFromQuoteId: quote.id,
            reissuedAt: now.toISOString(),
            acceptance: undefined,
            clientRequestedChanges: undefined,
            approvalStatus: 'DRAFT'
        }

        const reissuedQuote = await prisma.invoice.create({
            data: {
                companyId,
                clientId: quote.clientId,
                projectId: quote.projectId,
                contactId: quote.contactId,
                attentionTo: quote.attentionTo,
                type: 'QUOTE',
                status: 'DRAFT',
                number: nextNumber,
                quoteNumber: nextQuoteNumber,
                reference: quote.reference,
                site: quote.site,
                subtotal: quote.subtotal,
                taxRate: quote.taxRate,
                taxAmount: quote.taxAmount,
                total: quote.total,
                firstPaymentPercentage: quote.firstPaymentPercentage,
                workType: quote.workType,
                rateYear: quote.rateYear,
                tenderId: quote.tenderId,
                notes: quote.notes,
                date: now,
                metadata: clonedMetadata,
                items: {
                    create: quote.items.map((item, idx) => ({
                        description: item.description,
                        area: item.area,
                        quantity: item.quantity,
                        unit: item.unit,
                        unitPrice: item.unitPrice,
                        total: item.total,
                        position: idx,
                        code: item.code,
                        reason: item.reason,
                        isLocked: item.isLocked,
                        rateYear: item.rateYear
                    }))
                }
            }
        })

        revalidatePath(`/invoices`)
        revalidatePath(`/invoices/${reissuedQuote.id}`)

        return { success: true, newQuoteId: reissuedQuote.id, newQuoteNumber: nextQuoteNumber }
    } catch (e: any) {
        console.error("reissueQuoteAction error:", e)
        return { success: false, error: e.message || "Failed to reissue quotation" }
    }
}
