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
    projectName?: string // New field
    type?: 'QUOTE' | 'INVOICE'
    paymentNotes?: string
    firstPaymentPercentage?: number
    contactId?: string | null
    attentionTo?: string | null
}) {
    const companyId = await ensureAuth()
    const year = new Date().getFullYear();
    let nextNumber: number;
    let formattedQuoteNumber = data.quoteNumber;
    const isInvoice = data.type === 'INVOICE';
    
    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
    if (!settings) throw new Error("Company settings not found");

    const clientObj = await prisma.client.findFirst({
        where: { id: data.clientId, companyId }
    });
    if (!clientObj) throw new Error("Client not found");

    const codePrefix = clientObj.codePrefix;

    if (codePrefix) {
        if (data.quoteNumber) {
            const manualNumber = data.quoteNumber;
            const match = manualNumber.match(/(\d+)$/);
            if (match) {
                const manualSeq = parseInt(match[1]);
                await prisma.client.update({
                    where: { id: data.clientId },
                    data: { [isInvoice ? 'lastInvoiceNumber' : 'lastQuoteNumber']: manualSeq }
                });
                nextNumber = manualSeq;
            } else {
                nextNumber = (isInvoice ? (clientObj.lastInvoiceNumber || 0) : (clientObj.lastQuoteNumber || 0)) + 1;
            }
        } else {
            const updatedClient = await prisma.client.update({
                where: { id: data.clientId },
                data: isInvoice
                    ? { lastInvoiceNumber: { increment: 1 } }
                    : { lastQuoteNumber: { increment: 1 } }
            });
            nextNumber = isInvoice ? updatedClient.lastInvoiceNumber : updatedClient.lastQuoteNumber;
            formattedQuoteNumber = isInvoice
                ? `${codePrefix}-INV-${year}-${nextNumber.toString().padStart(3, '0')}`
                : `${codePrefix}-Q-${year}-${nextNumber.toString().padStart(3, '0')}`;
        }
    } else {
        if (data.quoteNumber) {
            const manualNumber = data.quoteNumber;
            const match = manualNumber.match(/(\d+)$/);
            if (match) {
                const manualSeq = parseInt(match[1]);
                await prisma.companySettings.update({
                    where: { companyId },
                    data: { [isInvoice ? 'lastInvoiceNumber' : 'lastQuoteNumber']: manualSeq }
                });
                nextNumber = manualSeq;
            } else {
                nextNumber = (isInvoice ? (settings.lastInvoiceNumber || 0) : (settings.lastQuoteNumber || 0)) + 1;
            }
        } else {
            const updatedSettings = await prisma.companySettings.update({
                where: { companyId },
                data: isInvoice
                    ? { lastInvoiceNumber: { increment: 1 } }
                    : { lastQuoteNumber: { increment: 1 } }
            });
            nextNumber = isInvoice ? updatedSettings.lastInvoiceNumber : updatedSettings.lastQuoteNumber;
            formattedQuoteNumber = isInvoice
                ? `INV-${year}-${nextNumber.toString().padStart(3, '0')}`
                : `Q-${year}-${nextNumber.toString().padStart(3, '0')}`;
        }
    }

    let effectiveProjectId = data.projectId;

    // Always create a project for new quotes if not already linked
    if (!effectiveProjectId) {
        // Build default name: [Site] - [Reference] (No redundant dates)
        const defaultName = [data.site, data.reference].filter(Boolean).join(" - ") || "New Project";

        const project = await prisma.project.create({
            data: {
                companyId,
                name: data.projectName || defaultName,
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
            contactId: data.contactId || null,
            attentionTo: data.attentionTo || null,
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
            firstPaymentPercentage: data.firstPaymentPercentage,
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
            await prisma.project.update({
                where: { id: effectiveProjectId, companyId },
                data: {
                    status: 'SOW',
                    workflowStage: 'SOW'
                }
            });
        } else {
            await prisma.project.update({
                where: { id: effectiveProjectId, companyId },
                data: {
                    status: isInvoice ? 'INVOICED' : 'QUOTED',
                    workflowStage: isInvoice ? 'INVOICE' : 'QUOTATION'
                }
            });
        }
    }

    revalidatePath("/invoices");
    revalidatePath("/projects");
    revalidatePath("/clients");
    revalidatePath(`/clients/${data.clientId}`);
    if (effectiveProjectId) {
        revalidatePath(`/projects/${effectiveProjectId}`);
    }
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

export async function getQuoteSequenceAction(clientId?: string) {
    const companyId = await ensureAuth();
    const year = new Date().getFullYear();

    if (clientId) {
        const client = await prisma.client.findFirst({
            where: { id: clientId, companyId }
        });
        if (client && client.codePrefix) {
            const lastQuote = await prisma.invoice.findFirst({
                where: { companyId, clientId, type: 'QUOTE' },
                orderBy: { number: 'desc' }
            });
            const nextNumber = Math.max(client.lastQuoteNumber || 0, lastQuote?.number || 0) + 1;
            return `${client.codePrefix}-Q-${year}-${nextNumber.toString().padStart(3, '0')}`;
        }
    }

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
    return `Q-${year}-${nextNumber.toString().padStart(3, '0')}`;
}

export async function getInvoiceSequenceAction(clientId?: string) {
    const companyId = await ensureAuth();
    const year = new Date().getFullYear();

    if (clientId) {
        const client = await prisma.client.findFirst({
            where: { id: clientId, companyId }
        });
        if (client && client.codePrefix) {
            const lastInvoice = await prisma.invoice.findFirst({
                where: { companyId, clientId, type: 'INVOICE' },
                orderBy: { number: 'desc' }
            });
            const nextNumber = Math.max(client.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
            return `${client.codePrefix}-INV-${year}-${nextNumber.toString().padStart(3, '0')}`;
        }
    }

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
    return `INV-${year}-${nextNumber.toString().padStart(3, '0')}`;
}

export async function convertToInvoiceAction(id: string, clientPoNumber?: string, firstPaymentPercentage?: number) {
    const companyId = await ensureAuth()

    // 1. Get the original quote details
    const quote = await prisma.invoice.findUnique({
        where: { id, companyId },
        include: { items: true, client: true }
    });
    if (!quote) throw new Error("Quote not found");

    const client = quote.client;
    const codePrefix = client.codePrefix;
    let nextInvoiceNumber: number;

    // 2. Get the next invoice number based on client prefix or settings
    if (codePrefix) {
        const lastInvoice = await prisma.invoice.findFirst({
            where: { companyId, clientId: quote.clientId, type: 'INVOICE' },
            orderBy: { number: 'desc' }
        });
        nextInvoiceNumber = Math.max(client.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
        await prisma.client.update({
            where: { id: quote.clientId },
            data: { lastInvoiceNumber: nextInvoiceNumber }
        });
    } else {
        const lastInvoice = await prisma.invoice.findFirst({
            where: { companyId, type: 'INVOICE' },
            orderBy: { number: 'desc' }
        });
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        nextInvoiceNumber = Math.max(settings?.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
        await prisma.companySettings.update({
            where: { companyId },
            data: { lastInvoiceNumber: nextInvoiceNumber }
        });
    }

    const year = new Date().getFullYear();
    const formattedInvoiceNumber = codePrefix 
        ? `${codePrefix}-INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`
        : `INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`;

    // 4. Create the NEW separate Invoice record
    const invoice = await prisma.invoice.create({
        data: {
            companyId: quote.companyId,
            clientId: quote.clientId,
            projectId: quote.projectId,
            wbpId: quote.wbpId,
            contactId: quote.contactId || null,
            attentionTo: quote.attentionTo || null,
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
            firstPaymentPercentage: firstPaymentPercentage !== undefined ? firstPaymentPercentage : quote.firstPaymentPercentage,
            date: new Date(), // Current date for the invoice
            items: {
                create: [{
                    area: "GENERAL",
                    description: `As per quotation ${quote.quoteNumber}`,
                    quantity: 1,
                    unit: "UNIT",
                    unitPrice: quote.subtotal,
                    total: quote.subtotal,
                    notes: `Reference Quote: ${quote.quoteNumber}`
                }]
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
    revalidatePath("/clients")
    revalidatePath(`/clients/${invoice.clientId}`)
    if (invoice.projectId) {
        revalidatePath(`/projects/${invoice.projectId}`)
    }
    redirect("/invoices")
}

export async function createStatementAction(clientId: string, totalDue: number) {
    const companyId = await ensureAuth()
    
    const client = await prisma.client.findFirst({
        where: { id: clientId, companyId }
    });
    if (!client) throw new Error("Client not found");

    const codePrefix = client.codePrefix;
    let nextNumber: number;

    if (codePrefix) {
        const lastStatement = await prisma.statement.findFirst({
            where: { companyId, clientId },
            orderBy: { number: 'desc' }
        });
        nextNumber = Math.max(client.lastStatementNumber || 0, lastStatement?.number || 0) + 1;
        await prisma.client.update({
            where: { id: clientId },
            data: { lastStatementNumber: nextNumber }
        });
    } else {
        const lastStatement = await prisma.statement.findFirst({
            where: { companyId },
            orderBy: { number: 'desc' }
        });
        const settings = await prisma.companySettings.findUnique({
            where: { companyId }
        });
        if (!settings) throw new Error("Company settings not found");
        nextNumber = Math.max(settings.lastStatementNumber || 0, lastStatement?.number || 0) + 1;
        await prisma.companySettings.update({
            where: { companyId },
            data: { lastStatementNumber: nextNumber }
        });
    }

    const year = new Date().getFullYear();
    const statementNumber = codePrefix
        ? `${codePrefix}-STM-${year}-${nextNumber.toString().padStart(3, '0')}`
        : `STM-${year}-${nextNumber.toString().padStart(3, '0')}`;

    const statement = await prisma.statement.create({
        data: {
            companyId,
            clientId,
            number: nextNumber,
            statementNumber,
            totalDue,
            date: new Date()
        }
    });

    revalidatePath(`/clients/${clientId}`);
    return statementNumber;
}
