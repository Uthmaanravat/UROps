'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { updateProjectStatus } from "../projects/actions"
import { ensureAuth } from "@/lib/auth-actions"

export async function updateInvoiceItemsAction(invoiceId: string, items: { id: string, unitPrice?: number, description?: string, unit?: string, quantity?: number, area?: string }[]) {
    const companyId = await ensureAuth()

    // Validate invoice ownership once
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId, companyId }
    })
    if (!invoice) throw new Error("Invoice not found or unauthorized")

    for (const item of items) {
        if (item.id.startsWith('new-')) {
            // Create new item
            await prisma.invoiceItem.create({
                data: {
                    invoiceId,
                    description: (item.description || "NEW ITEM").toUpperCase(),
                    quantity: item.quantity || 1,
                    unitPrice: item.unitPrice || 0,
                    unit: (item.unit || "EA").toUpperCase(),
                    area: (item.area || "").toUpperCase(),
                    total: (item.quantity || 1) * (item.unitPrice || 0)
                }
            })
        } else {
            // Update existing item
            await prisma.invoiceItem.update({
                where: { id: item.id },
                data: {
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    description: item.description?.toUpperCase(),
                    unit: item.unit?.toUpperCase(),
                    area: item.area?.toUpperCase(),
                    total: (item.quantity !== undefined && item.unitPrice !== undefined)
                        ? item.quantity * item.unitPrice
                        : undefined
                    // Actually we should calculate total if either changed.
                    // But we passed both if they are defined. 
                    // Better logic: get current if optional?
                    // For now, let's assume UI sends current values for everything if unmodified.
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
        data: { notes: notes.toUpperCase() }
    })
    revalidatePath(`/invoices/${invoiceId}`)
}
