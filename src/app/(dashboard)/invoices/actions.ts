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
    type?: 'QUOTE' | 'INVOICE'
    paymentNotes?: string
}) {
    const companyId = await ensureAuth()

    const year = new Date().getFullYear();
    let nextNumber: number;
    let formattedQuoteNumber = data.quoteNumber;
    const isInvoice = data.type === 'INVOICE';
    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
    if (!settings) throw new Error("Company settings not found");

    if (data.quoteNumber) {
        // Parse manual number to sync sequence
        const match = data.quoteNumber.match(/(\d+)$/);
        if (match) {
            const manualSeq = parseInt(match[1]);
            await prisma.companySettings.update({
                where: { companyId },
                data: isInvoice ? { lastInvoiceNumber: manualSeq } : { lastQuoteNumber: manualSeq }
            });
            nextNumber = manualSeq;
        } else {
            nextNumber = (isInvoice ? (settings.lastInvoiceNumber || 0) : (settings.lastQuoteNumber || 0)) + 1;
        }
    } else {
        // Auto-increment
        const updatedSettings = await prisma.companySettings.update({
            where: { companyId },
            data: isInvoice
                ? { lastInvoiceNumber: { increment: 1 } }
                : { lastQuoteNumber: { increment: 1 } }
        });
        nextNumber = isInvoice ? updatedSettings.lastInvoiceNumber : updatedSettings.lastQuoteNumber;
        formattedQuoteNumber = isInvoice
            ? `INV-${year}-${nextNumber.toString().padStart(3, '0')}`
            : `Quotation-${year}-${nextNumber.toString().padStart(3, '0')}`;
    }

    let effectiveProjectId = data.projectId;

    // Always create a project for new quotes if not already linked (which it won't be from the new UI)
    if (!effectiveProjectId) {
        const project = await prisma.project.create({
            data: {
                companyId,
                name: data.reference || `${data.site || "New Quotation Project"} - ${new Date(data.date).toLocaleDateString()}`,
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
            type: data.type || 'QUOTE', // Use provided type or default to Quote
            status: 'DRAFT',
            number: nextNumber,
            subtotal,
            taxRate,
            taxAmount,
            total,
            site: data.site,
            quoteNumber: formattedQuoteNumber,
            reference: data.reference,
            paymentNotes: data.paymentNotes,
            items: {
                create: data.items.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    area: (item.area || ""),
                    unit: (item.unit || ""),
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

    // Find the highest number used in existing quotes
    const lastQuote = await prisma.invoice.findFirst({
        where: { companyId, type: 'QUOTE' },
        orderBy: { number: 'desc' }
    });

    const settings = await prisma.companySettings.findUnique({
        where: { companyId }
    });

    if (!settings) return null;

    // Use whichever is higher: the DB counter or the highest actual number found
    const nextNumber = Math.max(settings.lastQuoteNumber || 0, lastQuote?.number || 0) + 1;
    const year = new Date().getFullYear();
    return `Quotation-${year}-${nextNumber.toString().padStart(3, '0')}`;
}

export async function getInvoiceSequenceAction() {
    const companyId = await ensureAuth();

    // Find the highest number used in existing invoices
    const lastInvoice = await prisma.invoice.findFirst({
        where: { companyId, type: 'INVOICE' },
        orderBy: { number: 'desc' }
    });

    const settings = await prisma.companySettings.findUnique({
        where: { companyId }
    });

    if (!settings) return null;

    const nextNumber = Math.max(settings.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
    const year = new Date().getFullYear();
    return `INV-${year}-${nextNumber.toString().padStart(3, '0')}`;
}

export async function convertToInvoiceAction(id: string, clientPoNumber?: string) {
    const companyId = await ensureAuth()

    // 1. Get the original quote details
    const quote = await prisma.invoice.findUnique({
        where: { id, companyId },
        include: { items: true }
    });
    if (!quote) throw new Error("Quote not found");

    // 2. Get the next invoice number based on actual data/settings
    const lastInvoice = await prisma.invoice.findFirst({
        where: { companyId, type: 'INVOICE' },
        orderBy: { number: 'desc' }
    });

    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
    const nextInvoiceNumber = Math.max(settings?.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;

    // 3. Update company settings to reserve the next number
    await prisma.companySettings.update({
        where: { companyId },
        data: { lastInvoiceNumber: nextInvoiceNumber }
    });

    const year = new Date().getFullYear();
    const formattedInvoiceNumber = `INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`;

    // 4. Create the NEW separate Invoice record
    const invoice = await prisma.invoice.create({
        data: {
            companyId: quote.companyId,
            clientId: quote.clientId,
            projectId: quote.projectId,
            wbpId: quote.wbpId,
            type: 'INVOICE',
            status: 'DRAFT',
            number: nextInvoiceNumber,
            subtotal: quote.subtotal,
            taxRate: quote.taxRate,
            taxAmount: quote.taxAmount,
            total: quote.total,
            site: quote.site,
            quoteNumber: formattedInvoiceNumber, // This is the label for the NEW invoice
            reference: quote.reference,
            clientPoNumber: clientPoNumber || null,
            date: new Date(), // Current date for the invoice
            items: {
                create: quote.items.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total,
                    unit: item.unit,
                    area: item.area,
                    notes: item.notes
                }))
            }
        }
    })

    // 5. Update the original Quote status to reflect it's been converted, but keep as QUOTE
    await prisma.invoice.update({
        where: { id: quote.id },
        data: { status: 'ACCEPTED' }
    })

    // 6. Update Project Stage
    if (invoice.projectId) {
        await prisma.project.update({
            where: { id: invoice.projectId },
            data: {
                status: 'INVOICED',
                workflowStage: 'INVOICE'
            }
        })
    }

    revalidatePath(`/invoices/${invoice.id}`)
    revalidatePath(`/invoices`)
    return invoice.id;
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

            // IF FULLY PAID, also mark the associated quote as PAID so it leaves the quote folder
            if (newStatus === 'PAID' && invoice.wbpId) {
                await prisma.invoice.updateMany({
                    where: {
                        wbpId: invoice.wbpId,
                        type: 'QUOTE',
                        status: { not: 'PAID' }
                    },
                    data: { status: 'PAID' }
                })
            }
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
