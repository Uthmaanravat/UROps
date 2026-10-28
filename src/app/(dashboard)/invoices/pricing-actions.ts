'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { updateProjectStatus } from "../projects/actions"
import { ensureAuth } from "@/lib/auth-actions"
import { convertToInvoiceAction } from "./actions"
import { isVatEffective, getVatRate, calculateVatAndTotal } from "@/lib/vat-utils"

import { randomUUID } from "crypto"

export async function updateInvoiceItemsAction(invoiceId: string, items: { id: string, unitPrice?: number, description?: string, unit?: string, quantity?: number, area?: string, reason?: string, code?: string, isLocked?: boolean, rateYear?: number }[]) {
    const companyId = await ensureAuth()

    // Validate invoice ownership once
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId, companyId },
        select: { id: true }
    })
    if (!invoice) throw new Error("Invoice not found or unauthorized")

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // 1. Format incoming items with valid UUIDs, positions, and totals
    const formattedItems = items.map((item, idx) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unitPrice) || 0;
        const validId = item.id && uuidRegex.test(item.id) ? item.id : randomUUID();

        return {
            id: validId,
            invoiceId,
            description: item.description ?? "",
            area: item.area || "",
            quantity: qty,
            unit: item.unit || "ea",
            unitPrice: price,
            total: qty * price,
            reason: item.reason || null,
            code: item.code || null,
            isLocked: Boolean(item.isLocked),
            rateYear: item.rateYear || null,
            position: idx
        };
    });

    // 2. Compute updated subtotal and tax amounts
    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
    const invoiceRecord = await prisma.invoice.findUnique({ where: { id: invoiceId, companyId }, select: { date: true } });
    const vatEffective = isVatEffective(invoiceRecord?.date || new Date(), settings);
    const vatRate = getVatRate(settings);
    const newSubtotal = formattedItems.reduce((acc, item) => acc + item.total, 0);
    const { taxRate, taxAmount, total } = calculateVatAndTotal(newSubtotal, vatEffective, vatRate);

    // 3. Perform atomic batch replacement: clean removal, instant multi-row insert, and totals update
    const txOperations: any[] = [
        prisma.invoiceItem.deleteMany({
            where: { invoiceId }
        })
    ];

    if (formattedItems.length > 0) {
        txOperations.push(
            prisma.invoiceItem.createMany({
                data: formattedItems
            })
        );
    }

    txOperations.push(
        prisma.invoice.update({
            where: { id: invoiceId, companyId },
            data: {
                subtotal: newSubtotal,
                taxRate: taxRate,
                taxAmount: taxAmount,
                total: total
            }
        })
    );

    await prisma.$transaction(txOperations);

    // 4. Fetch and return persisted items ordered by position
    const finalItems = await prisma.invoiceItem.findMany({
        where: { invoiceId },
        orderBy: { position: 'asc' }
    });

    revalidatePath(`/invoices/${invoiceId}`);
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
