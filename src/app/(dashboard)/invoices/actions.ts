"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { updateProjectStatus } from "../projects/actions"

export async function createInvoiceAction(data: {
    clientId: string
    projectId?: string
    date: string
    items: { description: string; quantity: number; unitPrice: number }[]
    site?: string
    quoteNumber?: string
    reference?: string
    paymentNotes?: string
}) {
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const taxRate = 0.15
    const taxAmount = subtotal * taxRate
    const total = subtotal + taxAmount

    const invoice = await prisma.invoice.create({
        data: {
            clientId: data.clientId,
            projectId: data.projectId,
            date: new Date(data.date),
            type: 'QUOTE', // Always start as Quote
            status: 'DRAFT',
            subtotal,
            taxRate,
            taxAmount,
            total,
            site: data.site,
            quoteNumber: data.quoteNumber,
            reference: data.reference,
            paymentNotes: data.paymentNotes,
            items: {
                create: data.items.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.quantity * item.unitPrice
                }))
            }
        }
    })

    if (data.projectId) {
        if (invoice.status === 'PENDING_SCOPE') {
            await updateProjectStatus(data.projectId, 'SOW')
        } else {
            await updateProjectStatus(data.projectId, 'QUOTATION')
        }
    }

    revalidatePath("/invoices");
    return invoice.id;
}

export async function updateInvoiceStatus(id: string, status: any) { // Type check loose for brevity
    await prisma.invoice.update({
        where: { id },
        data: { status }
    })
    revalidatePath(`/invoices/${id}`)
}

export async function convertToInvoiceAction(id: string, clientPoNumber?: string) {
    // First, get the current invoice with its items
    const currentInvoice = await prisma.invoice.findUnique({
        where: { id },
        include: { items: true }
    });

    if (!currentInvoice) {
        throw new Error("Invoice not found");
    }

    // Delete all existing line items
    await prisma.invoiceItem.deleteMany({
        where: { invoiceId: id }
    });

    // Create a single reference line item
    const referenceText = currentInvoice.quoteNumber
        ? `As Per Quotation ${currentInvoice.quoteNumber}`
        : `As Per Quotation #${currentInvoice.number}`;

    await prisma.invoiceItem.create({
        data: {
            invoiceId: id,
            description: referenceText,
            quantity: 1,
            unit: "",
            unitPrice: currentInvoice.subtotal,
            total: currentInvoice.subtotal
        }
    });

    // Update the invoice type and status, and clear notes for a fresh invoice
    const invoice = await prisma.invoice.update({
        where: { id },
        data: {
            type: 'INVOICE',
            status: 'INVOICED',
            clientPoNumber: clientPoNumber || null,
            notes: "", // Independent notes for invoice
        }
    })

    if (invoice.projectId) {
        await updateProjectStatus(invoice.projectId, 'INVOICED')
    }

    revalidatePath(`/invoices/${id}`)
}

export async function recordPaymentAction(data: {
    invoiceId: string
    amount: number
    method: string
    notes?: string
    date: string
}) {
    const payment = await prisma.payment.create({
        data: {
            invoiceId: data.invoiceId,
            amount: data.amount,
            method: data.method,
            notes: data.notes,
            date: new Date(data.date)
        }
    })

    // Calculate totals
    const invoice = await prisma.invoice.findUnique({
        where: { id: data.invoiceId },
        include: { payments: true }
    })

    if (invoice) {
        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
        let newStatus = invoice.status

        if (totalPaid >= invoice.total) {
            newStatus = 'PAID'
        } else if (totalPaid > 0) {
            newStatus = 'PARTIAL'
        }

        if (newStatus !== invoice.status) {
            await prisma.invoice.update({
                where: { id: data.invoiceId },
                data: { status: newStatus }
            })
        }

        if (invoice.projectId) {
            if (newStatus === 'PAID') {
                await updateProjectStatus(invoice.projectId, 'COMPLETED')
            } else {
                await updateProjectStatus(invoice.projectId, 'PAID')
            }
        }
    }

    revalidatePath(`/invoices/${data.invoiceId}`)
}

export async function deleteInvoiceAction(id: string) {
    // Delete related payments first
    await prisma.payment.deleteMany({
        where: { invoiceId: id }
    })

    // Delete invoice items
    await prisma.invoiceItem.deleteMany({
        where: { invoiceId: id }
    })

    // Delete the invoice
    await prisma.invoice.delete({
        where: { id }
    })

    revalidatePath("/invoices")
    redirect("/invoices")
}
