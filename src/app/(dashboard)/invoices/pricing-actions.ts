'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { updateProjectStatus } from "../projects/actions"
import { ensureAuth } from "@/lib/auth-actions"
import { convertToInvoiceAction } from "./actions"

export async function updateInvoiceItemsAction(invoiceId: string, items: { id: string, unitPrice?: number, description?: string, unit?: string, quantity?: number, area?: string }[]) {
    const companyId = await ensureAuth()

    // Validate invoice ownership once
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId, companyId }
    })
    if (!invoice) throw new Error("Invoice not found or unauthorized")

    // 1. Fetch all existing items from the database for this invoice
    const existingDbItems = await prisma.invoiceItem.findMany({
        where: { invoiceId },
        select: { id: true }
    });
    const existingDbItemIds = new Set(existingDbItems.map(item => item.id));

    // 2. Identify which incoming items actually exist in the DB
    const retainedDbIds = items.filter(i => existingDbItemIds.has(i.id)).map(i => i.id);

    // 3. Delete any DB items that were removed by the user, and update/create items atomically
    const operations: any[] = [
        prisma.invoiceItem.deleteMany({
            where: {
                invoiceId,
                id: { notIn: retainedDbIds }
            }
        })
    ];

    // 4. Update existing items, and create new/cloned items
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (existingDbItemIds.has(item.id)) {
            // Update existing item
            operations.push(
                prisma.invoiceItem.update({
                    where: { id: item.id },
                    data: {
                        unitPrice: item.unitPrice,
                        quantity: item.quantity,
                        description: item.description ?? "",
                        unit: item.unit,
                        area: item.area,
                        total: (item.quantity !== undefined && item.unitPrice !== undefined)
                            ? item.quantity * item.unitPrice
                            : undefined,
                        position: i
                    }
                })
            );
        } else {
            // Create new or cloned item
            operations.push(
                prisma.invoiceItem.create({
                    data: {
                        invoiceId,
                        description: item.description || "",
                        quantity: item.quantity || 1,
                        unitPrice: item.unitPrice || 0,
                        unit: item.unit || "ea",
                        area: item.area || "",
                        total: (item.quantity || 1) * (item.unitPrice || 0),
                        position: i
                    }
                })
            );
        }
    }

    if (operations.length > 0) {
        await prisma.$transaction(operations);
    }

    // Now update invoice totals
    const finalItems = await prisma.invoiceItem.findMany({
        where: { invoiceId },
        orderBy: { position: 'asc' }
    })
    const newSubtotal = finalItems.reduce((acc, item) => acc + item.total, 0)
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
    return finalItems;
}

export async function finalizeQuoteAction(quoteId: string) {
    const companyId = await ensureAuth()

    const quote = await prisma.invoice.findUnique({
        where: { id: quoteId, companyId },
        include: { items: true }
    })
    if (!quote) throw new Error("Quote not found")

    if (!quote.items || quote.items.length === 0) {
        throw new Error("Cannot mark quote ready to send: Quote has no line items.")
    }

    const invalidItems = quote.items.filter(item => !item.quantity || Number(item.quantity) <= 0 || !item.unitPrice || Number(item.unitPrice) <= 0);
    if (invalidItems.length > 0) {
        throw new Error(`Cannot mark quote ready to send: ${invalidItems.length} line item(s) have zero or blank prices/quantities. Please review and price all items first.`)
    }

    // 1. Mark Quote as SENT (Ready for client)
    await prisma.invoice.update({
        where: { id: quoteId, companyId },
        data: { status: 'SENT' }
    })

    // Update Project Status if needed
    if (quote?.projectId) {
        await prisma.project.update({
            where: { id: quote.projectId, companyId },
            data: {
                workflowStage: 'QUOTATION',
                status: 'SCHEDULED'
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
    // 1. Convert to Invoice using the centralized logic (creates separate record)
    const invoiceId = await convertToInvoiceAction(quoteId)

    revalidatePath(`/invoices/${quoteId}`)
    revalidatePath(`/invoices/${invoiceId}`)
    return invoiceId
}
export async function updateInvoiceNoteAction(invoiceId: string, notes: string) {
    const companyId = await ensureAuth()
    await prisma.invoice.update({
        where: { id: invoiceId, companyId },
        data: { notes }
    })
    revalidatePath(`/invoices/${invoiceId}`)
}

export async function getPricingSuggestionsAction(items: { description: string }[]) {
    const { getPricingSuggestions } = await import("@/app/actions/ai");
    return await getPricingSuggestions(items);
}
