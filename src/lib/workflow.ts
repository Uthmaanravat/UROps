import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logSubmission } from "@/lib/submission-logger"
import { ensureAuth, getAuthCompanyId } from "@/lib/auth-actions"

export async function submitScopeOfWork(projectId: string, items: { description: string, quantity: number, unit?: string, notes?: string, area?: string }[], site?: string) {
    const companyId = await ensureAuth()

    // Get project details for logging and verify tenant isolation
    const project = await prisma.project.findFirst({
        where: { id: projectId, companyId },
        include: { client: true }
    })
    if (!project) {
        throw new Error("Project not found or unauthorized")
    }

    // 1. Create DRAFT Invoice Record to reserve the Number immediately
    const year = new Date().getFullYear()
    let nextNumber = 0
    let suggestedQuoteNumber = ""
    const client = project.client
    const codePrefix = client.codePrefix

    let isUnique = false
    while (!isUnique) {
        if (codePrefix) {
            const updatedClient = await prisma.client.update({
                where: { id: client.id, companyId },
                data: { lastQuoteNumber: { increment: 1 } }
            })
            nextNumber = updatedClient.lastQuoteNumber
            suggestedQuoteNumber = `${codePrefix}-Q-${year}-${nextNumber.toString().padStart(3, '0')}`
        } else {
            const settings = await prisma.companySettings.update({
                where: { companyId },
                data: { lastQuoteNumber: { increment: 1 } }
            })
            nextNumber = settings.lastQuoteNumber
            suggestedQuoteNumber = `Q-${year}-${nextNumber.toString().padStart(3, '0')}`
        }

        const existing = await prisma.invoice.findFirst({
            where: {
                companyId,
                quoteNumber: suggestedQuoteNumber,
                type: 'QUOTE'
            }
        })
        if (!existing) {
            isUnique = true
        }
    }


    const invoice = await prisma.invoice.create({
        data: {
            companyId,
            projectId: projectId,
            clientId: project.clientId,
            type: 'QUOTE',
            status: 'PENDING_SCOPE',
            number: nextNumber,
            quoteNumber: suggestedQuoteNumber,
            date: new Date(),
            site: site || null,
            subtotal: 0,
            taxRate: 0.15,
            taxAmount: 0,
            total: 0,
            items: {
                create: items.map((i, idx) => ({
                    area: i.area,
                    description: i.description,
                    quantity: i.quantity,
                    unit: i.unit,
                    unitPrice: 0,
                    total: 0,
                    notes: i.notes,
                    position: idx
                }))
            }
        }
    })

    // 2. Create Scope of Work
    const sow = await prisma.scopeOfWork.create({
        data: {
            companyId,
            projectId: projectId,
            site: site,
            status: 'SUBMITTED',
            items: {
                create: items.map((i, idx) => ({
                    area: i.area,
                    description: i.description,
                    quantity: i.quantity,
                    unit: i.unit,
                    notes: i.notes,
                    position: idx
                }))
            }
        }
    })

    // 3. Create initial WB&P with draft items (Unit Price 0) and reserved quoteNumber
    const wbp = await prisma.workBreakdownPricing.create({
        data: {
            companyId,
            projectId: projectId,
            site: site,
            status: 'DRAFT',
            quoteNumber: suggestedQuoteNumber,
            items: {
                create: items.map((i, idx) => ({
                    area: i.area,
                    description: i.description,
                    quantity: i.quantity,
                    unit: i.unit,
                    notes: i.notes,
                    unitPrice: 0,
                    total: 0,
                    position: idx
                }))
            }
        }
    })

    // 3a. Link the Invoice to this WBP (Critical for Unified Numbering)
    await prisma.invoice.update({
        where: { id: invoice.id, companyId },
        data: { wbpId: wbp.id }
    })

    // 4. Update Project Stage
    await prisma.project.update({
        where: { id: projectId, companyId },
        data: {
            workflowStage: 'SOW',
            status: 'SOW_SUBMITTED'
        }
    })

    // 5. Log the submission
    await logSubmission({
        type: 'SOW',
        documentId: sow.id,
        documentRef: site || undefined,
        projectId: projectId,
        clientId: project?.clientId,
        submittedBy: 'MANAGER', // Assuming PM/Manager submits SOW
        message: 'SOW submitted – WB&P site auto-generated',
        metadata: {
            site,
            wbpId: wbp.id,
            itemCount: items.length
        }
    })

    revalidatePath(`/projects/${projectId}`)
    return { sow, wbp }
}

export async function generateQuotationFromWBP(
    wbpId: string,
    items: { id?: string, description: string, quantity: number, unit?: string, unitPrice: number, notes?: string, area?: string }[],
    options?: { site?: string, quoteNumber?: string, reference?: string, notes?: string, contactId?: string | null, attentionTo?: string | null }
) {
    const companyId = await ensureAuth()

    const wbp = await prisma.workBreakdownPricing.findFirst({
        where: { id: wbpId, companyId },
        include: { project: { include: { client: true } } }
    })
    if (!wbp) {
        throw new Error("Work breakdown pricing record not found or unauthorized")
    }

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const taxRate = 0.15
    const taxAmount = subtotal * taxRate
    const total = subtotal + taxAmount

    // 1. Clear old WB&P items and recreate them in the new order with positions
    await prisma.workBreakdownPricingItem.deleteMany({
        where: { wbpId }
    })

    await prisma.workBreakdownPricingItem.createMany({
        data: items.map((item, idx) => ({
            wbpId,
            area: item.area || "",
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || "",
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            notes: item.notes || "",
            position: idx
        }))
    })

    // 2. Mark WB&P as APPROVED and save notes
    await prisma.workBreakdownPricing.update({
        where: { id: wbpId, companyId },
        data: {
            status: 'APPROVED',
            notes: options?.notes,
            contactId: options?.contactId || null,
            attentionTo: options?.attentionTo || null
        }
    })

    // 3. Update Existing Draft Invoice to Official Quote (SENT)
    let quote = await prisma.invoice.findFirst({
        where: { 
            wbpId: wbpId,
            companyId,
            status: { notIn: ['REJECTED', 'CANCELLED', 'ACCEPTED', 'INVOICED'] }
        }
    })
    let finalNumber = quote?.number || 0;
    let suggestedQuoteNumber = quote?.quoteNumber || "";

    if (!quote) {
        // Generate new sequential number as the previous one was rejected/cancelled/accepted
        const year = new Date().getFullYear()
        const client = wbp.project.client
        const codePrefix = client.codePrefix

        let isUnique = false
        while (!isUnique) {
            if (codePrefix) {
                const updatedClient = await prisma.client.update({
                    where: { id: client.id, companyId },
                    data: { lastQuoteNumber: { increment: 1 } }
                })
                finalNumber = updatedClient.lastQuoteNumber
                suggestedQuoteNumber = `${codePrefix}-Q-${year}-${finalNumber.toString().padStart(3, '0')}`
            } else {
                const settings = await prisma.companySettings.update({
                    where: { companyId },
                    data: { lastQuoteNumber: { increment: 1 } }
                })
                finalNumber = settings.lastQuoteNumber
                suggestedQuoteNumber = `Q-${year}-${finalNumber.toString().padStart(3, '0')}`
            }

            const existing = await prisma.invoice.findFirst({
                where: {
                    companyId,
                    quoteNumber: suggestedQuoteNumber,
                    type: 'QUOTE'
                }
            })
            if (!existing) {
                isUnique = true
            }
        }
    }

    const manualQuoteNumber = options?.quoteNumber;

    if (manualQuoteNumber) {
        // Check uniqueness of manual number
        const existing = await prisma.invoice.findFirst({
            where: {
                companyId,
                quoteNumber: manualQuoteNumber,
                id: quote ? { not: quote.id } : undefined,
                type: 'QUOTE'
            }
        })
        if (existing) {
            throw new Error(`Quotation number ${manualQuoteNumber} has already been used. Please use a new number.`)
        }

        // Parse numeric suffix to sync system sequence if manually entered
        const match = manualQuoteNumber.match(/(\d+)$/);
        if (match) {
            const manualSeq = parseInt(match[1]);
            finalNumber = manualSeq;

            // Only sync lastQuoteNumber forward; never allow it to go backward to prevent duplicate numbers
            if (wbp.project.client.codePrefix) {
                const currentClient = await prisma.client.findFirst({
                    where: { id: wbp.project.clientId, companyId },
                    select: { lastQuoteNumber: true }
                });
                if (!currentClient || manualSeq > currentClient.lastQuoteNumber) {
                    await prisma.client.update({
                        where: { id: wbp.project.clientId, companyId },
                        data: { lastQuoteNumber: manualSeq }
                    });
                }
            } else {
                const currentSettings = await prisma.companySettings.findUnique({
                    where: { companyId },
                    select: { lastQuoteNumber: true }
                });
                if (!currentSettings || manualSeq > currentSettings.lastQuoteNumber) {
                    await prisma.companySettings.update({
                        where: { companyId },
                        data: { lastQuoteNumber: manualSeq }
                    });
                }
            }
        }
    }

    const provisionalNumber = options?.quoteNumber || suggestedQuoteNumber || wbp.quoteNumber;

    if (quote) {
        // Update the existing reservation
        quote = await prisma.invoice.update({
            where: { id: quote.id, companyId },
            data: {
                status: 'DRAFT',
                wbpId: wbp.id,
                subtotal,
                taxRate,
                taxAmount,
                total,
                number: finalNumber || quote.number,
                site: options?.site || wbp.site,
                quoteNumber: options?.quoteNumber || provisionalNumber,
                reference: options?.reference,
                notes: options?.notes,
                contactId: options?.contactId || null,
                attentionTo: options?.attentionTo || null,
                items: {
                    deleteMany: {},
                    create: items.map((i, idx) => ({
                        area: i.area,
                        description: i.description,
                        quantity: i.quantity,
                        unit: i.unit,
                        unitPrice: i.unitPrice,
                        total: i.quantity * i.unitPrice,
                        notes: i.notes,
                        position: idx
                    }))
                }
            }
        })
    } else {
        quote = await prisma.invoice.create({
            data: {
                companyId,
                projectId: wbp.projectId,
                clientId: wbp.project.clientId,
                type: 'QUOTE',
                status: 'DRAFT',
                wbpId: wbp.id,
                subtotal,
                taxRate,
                taxAmount,
                total,
                number: finalNumber,
                site: options?.site || wbp.site,
                quoteNumber: options?.quoteNumber || suggestedQuoteNumber,
                reference: options?.reference,
                notes: options?.notes,
                contactId: options?.contactId || null,
                attentionTo: options?.attentionTo || null,
                items: {
                    create: items.map((i, idx) => ({
                        area: i.area,
                        description: i.description,
                        quantity: i.quantity,
                        unit: i.unit,
                        unitPrice: i.unitPrice,
                        total: i.quantity * i.unitPrice,
                        notes: i.notes,
                        position: idx
                    }))
                }
            }
        })
    }

    // Sync back to WBP
    if (options?.quoteNumber || suggestedQuoteNumber) {
        await prisma.workBreakdownPricing.update({
            where: { id: wbpId, companyId },
            data: { quoteNumber: options?.quoteNumber || suggestedQuoteNumber }
        })
    }

    // 4. Update Project Stage
    await prisma.project.update({
        where: { id: wbp.projectId, companyId },
        data: {
            workflowStage: 'QUOTATION',
            status: 'SCHEDULED'
        }
    })

    // 5. Log the submission
    await logSubmission({
        type: 'QUOTATION',
        documentId: quote.id,
        documentRef: options?.quoteNumber || `Quote #${quote.number}`,
        projectId: wbp.projectId,
        clientId: wbp.project.clientId,
        submittedBy: 'ADMIN',
        message: 'Quotation submitted',
        metadata: {
            quoteId: quote.id,
            total,
            itemCount: items.length
        }
    })

    revalidatePath(`/projects/${wbp.projectId}`)
    revalidatePath(`/invoices/${quote.id}`)
    revalidatePath(`/work-breakdown-pricing/${wbpId}`)
    revalidatePath(`/quotation-submissions`)

    return quote
}

export async function approveQuote(quoteId: string) {
    const companyId = await ensureAuth()

    const quote = await prisma.invoice.findFirst({
        where: { id: quoteId, companyId },
        include: {
            items: {
                orderBy: { position: 'asc' }
            },
            client: true
        }
    })
    if (!quote) {
        throw new Error("Quote not found or unauthorized")
    }

    const client = quote.client;
    const codePrefix = client.codePrefix;
    let nextInvoiceNumber = 0;
    const year = new Date().getFullYear();
    let formattedInvoiceNumber = "";

    // 1. Get the next invoice number based on client prefix or settings
    let isUnique = false;
    while (!isUnique) {
        if (codePrefix) {
            const lastInvoice = await prisma.invoice.findFirst({
                where: { companyId, clientId: quote.clientId, type: 'INVOICE' },
                orderBy: { number: 'desc' }
            });
            nextInvoiceNumber = Math.max(client.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
            await prisma.client.update({
                where: { id: quote.clientId, companyId },
                data: { lastInvoiceNumber: nextInvoiceNumber }
            });
            formattedInvoiceNumber = `${codePrefix}-INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
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
            formattedInvoiceNumber = `INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
        }

        const existing = await prisma.invoice.findFirst({
            where: {
                companyId,
                quoteNumber: formattedInvoiceNumber,
                type: 'INVOICE'
            }
        });
        if (!existing) {
            isUnique = true;
        }
    }

    // 3. Create NEW separate Invoice record
    const invoice = await prisma.invoice.create({
        data: {
            companyId,
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
            quoteNumber: formattedInvoiceNumber,
            reference: quote.reference,
            date: new Date(),
            items: {
                create: [{
                    area: "GENERAL",
                    description: `As per quotation ${quote.quoteNumber}`,
                    quantity: 1,
                    unit: "UNIT",
                    unitPrice: quote.subtotal,
                    total: quote.subtotal,
                    notes: null
                }]
            }
        }
    })

    // 4. Mark original Quote as INVOICED
    await prisma.invoice.update({
        where: { id: quoteId, companyId },
        data: { status: 'INVOICED' }
    })

    // 5. Update Project Stage
    if (quote.projectId) {
        await prisma.project.update({
            where: { id: quote.projectId, companyId },
            data: { workflowStage: 'INVOICE', status: 'INVOICED' }
        })
    }

    revalidatePath(`/projects/${quote.projectId}`)
    return invoice;
}

export async function checkProjectCompletion(projectId: string) {
    const companyId = await getAuthCompanyId()

    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            ...(companyId ? { companyId } : {})
        },
        include: { invoices: { include: { payments: true } } }
    })

    if (!project) return

    // Check if all invoices are paid
    const invoices = project.invoices.filter(i => i.type === 'INVOICE' && i.status !== 'CANCELLED')
    if (invoices.length === 0) return

    const allPaid = invoices.every(inv => {
        const paid = inv.payments.reduce((acc, p) => acc + p.amount, 0)
        return paid >= inv.total - 0.01 // Tolerance
    })

    if (allPaid) {
        await prisma.project.update({
            where: { id: projectId },
            data: {
                workflowStage: 'COMPLETED',
                status: 'COMPLETED'
            }
        })
    } else {
        const anyPayment = invoices.some(inv => inv.payments.length > 0)
        if (anyPayment && project.workflowStage !== 'COMPLETED') {
            await prisma.project.update({
                where: { id: projectId },
                data: { workflowStage: 'PAYMENT' }
            })
        }
    }
}
