'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { updateProjectStatus } from "../projects/actions"
import { ensureAuth } from "@/lib/auth-actions"

export async function updateInvoiceItemsAction(invoiceId: string, items: { id: string, unitPrice?: number, description?: string, unit?: string, quantity?: number }[]) {
    const companyId = await ensureAuth()
    // Loop updates since Prisma doesn't support bulk update with different values easily
    for (const item of items) {
        const dbItem = await prisma.invoiceItem.findUnique({
            where: { id: item.id },
            include: { invoice: true }
        })
        if (dbItem && dbItem.invoice.companyId === companyId) {
            const price = item.unitPrice !== undefined ? item.unitPrice : dbItem.unitPrice
            const qty = item.quantity !== undefined ? item.quantity : dbItem.quantity
            await prisma.invoiceItem.update({
                where: { id: item.id },
                data: {
                    unitPrice: price,
                    quantity: qty,
                    description: item.description ?? dbItem.description,
                    unit: item.unit ?? dbItem.unit, // Keep existing if undefined
                    total: qty * price
                }
            })
        }
    }

    // Now update invoice totals
    const updatedItems = await prisma.invoiceItem.findMany({ where: { invoiceId } })
    const newSubtotal = updatedItems.reduce((acc, item) => acc + item.total, 0)
    const tax = newSubtotal * 0.15
    const total = newSubtotal + tax

    await prisma.invoice.update({
        where: { id: invoiceId, companyId },
        data: {
            subtotal: newSubtotal,
            taxAmount: tax,
            total: total
        }
    })

    revalidatePath(`/invoices/${invoiceId}`)
}

export async function finalizeQuoteAction(quoteId: string) {
    const companyId = await ensureAuth()
    // 1. Mark Quote as SENT (Ready for client)
    await prisma.invoice.update({
        where: { id: quoteId, companyId },
        data: { status: 'SENT' }
    })

    // Update Project Status if needed
    const quote = await prisma.invoice.findUnique({ where: { id: quoteId, companyId } })
    if (quote?.projectId) {
        await prisma.project.update({
            where: { id: quote.projectId, companyId },
            data: {
                workflowStage: 'QUOTATION',
                status: 'QUOTED'
            }
        })
    }

    revalidatePath(`/invoices/${quoteId}`)
}

export async function rejectQuoteAction(quoteId: string) {
    const companyId = await ensureAuth()
    await prisma.invoice.update({
        where: { id: quoteId, companyId },
        data: { status: 'REJECTED' }
    })
    revalidatePath(`/invoices/${quoteId}`)
    revalidatePath(`/dashboard`)
}

export async function approveQuoteAction(quoteId: string) {
    const companyId = await ensureAuth()
    // Approve Quote -> Convert to Invoice (Draft)
    await prisma.invoice.update({
        where: { id: quoteId, companyId },
        data: {
            type: 'INVOICE',
            status: 'DRAFT'
        }
    })

    // Update project status if associated
    const quote = await prisma.invoice.findUnique({ where: { id: quoteId } })
    if (quote?.projectId) {
        // Maybe update project status to something indicating invoice creation phase
        // For now, keep it simple or use generic status
    }

    revalidatePath(`/invoices/${quoteId}`)
}
export async function updateInvoiceNoteAction(invoiceId: string, notes: string) {
    const companyId = await ensureAuth()
    await prisma.invoice.update({
        where: { id: invoiceId, companyId },
        data: { notes }
    })
    revalidatePath(`/invoices/${invoiceId}`)
}
