"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ensureAuth } from "@/lib/auth-actions"

import { updateProjectStatus } from "../projects/actions"

export async function createInvoiceAction(data: {
    clientId: string
    projectId?: string
    date: string
    items: { description: string; quantity: number; unitPrice: number; area?: string; unit?: string }[]
    site?: string
    quoteNumber?: string
    reference?: string
    paymentNotes?: string
}) {
    const companyId = await ensureAuth()

    const year = new Date().getFullYear();
    let nextNumber: number;
    let formattedQuoteNumber = data.quoteNumber;

    if (data.quoteNumber) {
        // Parse manual number to sync sequence if it matches Q-YYYY-NNN or just has digits
        const match = data.quoteNumber.match(/(\d+)$/);
        if (match) {
            const manualSeq = parseInt(match[1]);
            const currentSettings = await prisma.companySettings.findUnique({ where: { companyId } });

            if (currentSettings && manualSeq > currentSettings.lastQuoteNumber) {
                // Sync sequence to manual number if it's higher
                const updatedSettings = await prisma.companySettings.update({
                    where: { companyId },
                    data: { lastQuoteNumber: manualSeq }
                });
                nextNumber = updatedSettings.lastQuoteNumber;
            } else {
                nextNumber = manualSeq;
            }
        } else {
            // Fallback for non-matching manual numbers
            const settings = await prisma.companySettings.update({
                where: { companyId },
                data: { lastQuoteNumber: { increment: 1 } }
            });
            nextNumber = settings.lastQuoteNumber;
        }
    } else {
        // Standard increment for auto-generated numbers
        const settings = await prisma.companySettings.update({
            where: { companyId },
            data: { lastQuoteNumber: { increment: 1 } }
        });
        nextNumber = settings.lastQuoteNumber;
        formattedQuoteNumber = `Q-${year}-${nextNumber.toString().padStart(3, '0')}`;
    }

    let effectiveProjectId = data.projectId;

    // Always create a project for new quotes if not already linked (which it won't be from the new UI)
    if (!effectiveProjectId) {
        const project = await prisma.project.create({
            data: {
                companyId,
                name: `${data.site || "New Quotation Project"} - ${new Date(data.date).toLocaleDateString()}`,
                clientId: data.clientId,
                status: 'SOW',
                workflowStage: 'SOW',
                description: `Created from Quotation ${formattedQuoteNumber} on ${data.date}`
            }
        });
        effectiveProjectId = project.id;
    }

    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const taxRate = 0.15
    const taxAmount = subtotal * taxRate
    const total = subtotal + taxAmount

    const invoice = await prisma.invoice.create({
        data: {
            companyId,
            clientId: data.clientId,
            projectId: effectiveProjectId,
            date: new Date(data.date),
            type: 'QUOTE', // Always start as Quote
            status: 'DRAFT',
            number: nextNumber,
            subtotal,
            taxRate,
            taxAmount,
            total,
            site: data.site?.toUpperCase(),
            quoteNumber: formattedQuoteNumber,
            reference: data.reference?.toUpperCase(),
            paymentNotes: data.paymentNotes?.toUpperCase(),
            items: {
                create: data.items.map(item => ({
                    description: item.description.toUpperCase(),
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    area: (item.area || "").toUpperCase(),
                    unit: (item.unit || "").toUpperCase(),
                    total: item.quantity * item.unitPrice
                }))
            }
        }
    })

    if (effectiveProjectId) {
        if (invoice.status === 'PENDING_SCOPE') {
            await updateProjectStatus(effectiveProjectId, 'SOW')
        } else {
            await updateProjectStatus(effectiveProjectId, 'QUOTATION')
        }
    }

    revalidatePath("/invoices");
    revalidatePath("/projects");
    return invoice.id;
}

export async function updateInvoiceStatus(id: string, status: any) { // Type check loose for brevity
    const companyId = await ensureAuth()
    await prisma.invoice.update({
        where: { id, companyId },
        data: { status }
    })
    revalidatePath(`/invoices/${id}`)
}

export async function getQuoteSequenceAction() {
    const companyId = await ensureAuth();
    const settings = await prisma.companySettings.findUnique({
        where: { companyId }
    });

    if (!settings) return null;

    const nextNumber = (settings.lastQuoteNumber || 0) + 1;
    const year = new Date().getFullYear();
    return `Q-${year}-${nextNumber.toString().padStart(3, '0')}`;
}

export async function convertToInvoiceAction(id: string, clientPoNumber?: string) {
    const companyId = await ensureAuth()

    // Get company settings to manage sequence numbers
    const settings = await prisma.companySettings.update({
        where: { companyId },
        data: { lastInvoiceNumber: { increment: 1 } }
    });

    const nextInvoiceNumber = settings.lastInvoiceNumber;
    const formattedInvoiceNumber = `INV-${nextInvoiceNumber.toString().padStart(4, '0')}`;

    // First, get the current invoice with its items
    const currentInvoice = await prisma.invoice.findUnique({
        where: { id, companyId },
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

    // Update the invoice type and status, and its numbers
    const invoice = await prisma.invoice.update({
        where: { id, companyId },
        data: {
            type: 'INVOICE',
            status: 'INVOICED',
            number: nextInvoiceNumber,
            quoteNumber: formattedInvoiceNumber, // Rename field conceptually or use it as document number
            clientPoNumber: clientPoNumber || null,
            notes: "", // Independent notes for invoice
            paymentNotes: "",
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
    const companyId = await ensureAuth()
    // Verify invoice belongs to company
    const currentInvoice = await prisma.invoice.findUnique({
        where: { id: data.invoiceId, companyId }
    })
    if (!currentInvoice) throw new Error("Invoice not found")

    const payment = await prisma.payment.create({
        data: {
            companyId,
            invoiceId: data.invoiceId,
            amount: data.amount,
            method: data.method,
            notes: data.notes,
            date: new Date(data.date)
        }
    })

    // Calculate totals
    const invoice = await prisma.invoice.findUnique({
        where: { id: data.invoiceId, companyId },
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
                where: { id: data.invoiceId, companyId },
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
    const companyId = await ensureAuth()
    // Verify invoice belongs to company
    const invoice = await prisma.invoice.findUnique({
        where: { id, companyId }
    })
    if (!invoice) throw new Error("Invoice not found")

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
        where: { id, companyId }
    })

    revalidatePath("/invoices")
    redirect("/invoices")
}
