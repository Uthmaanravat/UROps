import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logSubmission } from "@/lib/submission-logger"

export async function submitScopeOfWork(projectId: string, items: { description: string, quantity: number, unit?: string, notes?: string, area?: string }[], site?: string) {
    // Get project details for logging
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { client: true }
    })

    // 1. Create DRAFT Invoice Record to reserve the Number immediately
    const year = new Date().getFullYear()
    let nextNumber = 0
    let suggestedQuoteNumber = ""
    const client = project!.client
    const codePrefix = client.codePrefix

    let isUnique = false
    while (!isUnique) {
        if (codePrefix) {
            const updatedClient = await prisma.client.update({
                where: { id: client.id },
                data: { lastQuoteNumber: { increment: 1 } }
            })
            nextNumber = updatedClient.lastQuoteNumber
            suggestedQuoteNumber = `${codePrefix}-Q-${year}-${nextNumber.toString().padStart(3, '0')}`
        } else {
            const settings = await prisma.companySettings.update({
                where: { companyId: project!.companyId },
                data: { lastQuoteNumber: { increment: 1 } }
            })
            nextNumber = settings.lastQuoteNumber
            suggestedQuoteNumber = `Q-${year}-${nextNumber.toString().padStart(3, '0')}`
        }

        const existing = await prisma.invoice.findFirst({
            where: {
                companyId: project!.companyId,
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
            companyId: project!.companyId,
            projectId,
            clientId: project?.clientId || "",
            type: 'QUOTE',
            status: 'DRAFT',
            number: nextNumber, // Save the sequential number
            subtotal: 0,
            taxAmount: 0,
            taxRate: 0.15,
            total: 0,
            quoteNumber: suggestedQuoteNumber,
            items: {
                create: []
            }
        }
    })

    // 2. Create SOW Record (Frozen snapshot)
    const sow = await prisma.scopeOfWork.create({
        data: {
            companyId: project!.companyId,
            projectId,
            status: 'SUBMITTED',
            version: 1,
            site,
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

    // 3. Create the Work Breakdown & Pricing (WB&P) record for Admin
    const wbp = await prisma.workBreakdownPricing.create({
        data: {
            companyId: project!.companyId,
            projectId,
            status: 'DRAFT',
            version: 1,
            site,
            quoteNumber: suggestedQuoteNumber, // Stores "Q-2026-100" but backed by Invoice #100
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
        where: { id: invoice.id },
        data: { wbpId: wbp.id }
    })

    // 4. Update Project Stage
    await prisma.project.update({
        where: { id: projectId },
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
    revalidatePath(`/work-breakdown-pricing/${wbp.id}`)
    revalidatePath(`/sow-submissions`)

    return { sow, wbp }
}

export async function generateQuotationFromWBP(
    wbpId: string,
    items: { id?: string, description: string, quantity: number, unit?: string, unitPrice: number, notes?: string, area?: string }[],
    options?: { site?: string, quoteNumber?: string, reference?: string, notes?: string, contactId?: string | null, attentionTo?: string | null }
) {
    const wbp = await prisma.workBreakdownPricing.findUniqueOrThrow({
        where: { id: wbpId },
        include: { project: { include: { client: true } } }
    })

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
        where: { id: wbpId },
        data: {
            status: 'APPROVED',
            notes: options?.notes,
            contactId: options?.contactId || null,
            attentionTo: options?.attentionTo || null
        }
    })

    // 3. Update Existing Draft Invoice to Official Quote (SENT)
    // Robustness: Try to find the existing PROVISIONAL invoice created at SOW stage.
    // Exclude REJECTED, CANCELLED, or ACCEPTED quotes so we do not reuse or overwrite them.
    let quote = await prisma.invoice.findFirst({
        where: { 
            wbpId: wbpId,
            status: { notIn: ['REJECTED', 'CANCELLED', 'ACCEPTED'] }
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
                    where: { id: client.id },
                    data: { lastQuoteNumber: { increment: 1 } }
                })
                finalNumber = updatedClient.lastQuoteNumber
                suggestedQuoteNumber = `${codePrefix}-Q-${year}-${finalNumber.toString().padStart(3, '0')}`
            } else {
                const settings = await prisma.companySettings.update({
                    where: { companyId: wbp.project.companyId },
                    data: { lastQuoteNumber: { increment: 1 } }
                })
                finalNumber = settings.lastQuoteNumber
                suggestedQuoteNumber = `Q-${year}-${finalNumber.toString().padStart(3, '0')}`
            }

            const existing = await prisma.invoice.findFirst({
                where: {
                    companyId: wbp.project.companyId,
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
                companyId: wbp.project.companyId,
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
                const currentClient = await prisma.client.findUnique({
                    where: { id: wbp.project.clientId },
                    select: { lastQuoteNumber: true }
                });
                if (!currentClient || manualSeq > currentClient.lastQuoteNumber) {
                    await prisma.client.update({
                        where: { id: wbp.project.clientId },
                        data: { lastQuoteNumber: manualSeq }
                    });
                }
            } else {
                const currentSettings = await prisma.companySettings.findUnique({
                    where: { companyId: wbp.project.companyId },
                    select: { lastQuoteNumber: true }
                });
                if (!currentSettings || manualSeq > currentSettings.lastQuoteNumber) {
                    await prisma.companySettings.update({
                        where: { companyId: wbp.project.companyId },
                        data: { lastQuoteNumber: manualSeq }
                    });
                }
            }
        }
    }

    const provisionalNumber = options?.quoteNumber || suggestedQuoteNumber || wbp.quoteNumber; // e.g. Q-123

    if (quote) {
        // Update the existing reservation
        quote = await prisma.invoice.update({
            where: { id: quote.id },
            data: {
                status: 'DRAFT',
                wbpId: wbp.id,
                subtotal,
                taxRate,
                taxAmount,
                total,
                number: finalNumber || quote.number, // Update numeric ID if manual override provided
                site: options?.site || wbp.site,
                quoteNumber: options?.quoteNumber || provisionalNumber, // Keep consistent
                reference: options?.reference,
                notes: options?.notes,
                contactId: options?.contactId || null,
                attentionTo: options?.attentionTo || null,
                items: {
                    deleteMany: {}, // Clear placeholder/old items
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
        // Fallback (Should rarely happen if flow is followed): Create new
        quote = await prisma.invoice.create({
            data: {
                companyId: wbp.project.companyId,
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

    // Sync back to WBP so the projects page (which might list WBP records) stays accurate
    if (options?.quoteNumber || suggestedQuoteNumber) {
        await prisma.workBreakdownPricing.update({
            where: { id: wbpId },
            data: { quoteNumber: options?.quoteNumber || suggestedQuoteNumber }
        })
    }

    // 4. Update Project Stage
    await prisma.project.update({
        where: { id: wbp.projectId },
        data: {
            workflowStage: 'QUOTATION',
            status: 'QUOTED'
        }
    })

    // 5. Log the submission
    await logSubmission({
        type: 'QUOTATION',
        documentId: quote.id,
        documentRef: options?.quoteNumber || `Quote #${quote.number}`,
        projectId: wbp.projectId,
        clientId: wbp.project.clientId,
        submittedBy: 'ADMIN', // Admin generates quotations
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
    const quote = await prisma.invoice.findUniqueOrThrow({
        where: { id: quoteId },
        include: {
            items: {
                orderBy: { position: 'asc' }
            },
            client: true
        }
    })

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
                where: { companyId: quote.companyId, clientId: quote.clientId, type: 'INVOICE' },
                orderBy: { number: 'desc' }
            });
            nextInvoiceNumber = Math.max(client.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
            await prisma.client.update({
                where: { id: quote.clientId },
                data: { lastInvoiceNumber: nextInvoiceNumber }
            });
            formattedInvoiceNumber = `${codePrefix}-INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
        } else {
            const lastInvoice = await prisma.invoice.findFirst({
                where: { companyId: quote.companyId, type: 'INVOICE' },
                orderBy: { number: 'desc' }
            });
            const settings = await prisma.companySettings.findUnique({ where: { companyId: quote.companyId } });
            nextInvoiceNumber = Math.max(settings?.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
            await prisma.companySettings.update({
                where: { companyId: quote.companyId },
                data: { lastInvoiceNumber: nextInvoiceNumber }
            });
            formattedInvoiceNumber = `INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
        }

        const existing = await prisma.invoice.findFirst({
            where: {
                companyId: quote.companyId,
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

    // 4. Mark original Quote as ACCEPTED (Sent -> Accepted)
    await prisma.invoice.update({
        where: { id: quoteId },
        data: { status: 'ACCEPTED' }
    })

    // 5. Update Project Stage
    if (quote.projectId) {
        await prisma.project.update({
            where: { id: quote.projectId },
            data: { workflowStage: 'INVOICE', status: 'INVOICED' }
        })
    }

    revalidatePath(`/projects/${quote.projectId}`)
    return invoice;
}

export async function checkProjectCompletion(projectId: string) {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
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
        // Ensure it's at least in PAYMENT/INVOICE stage
        // If some valid payment exists, maybe PAYMENT stage?
        const anyPayment = invoices.some(inv => inv.payments.length > 0)
        if (anyPayment && project.workflowStage !== 'COMPLETED') {
            await prisma.project.update({
                where: { id: projectId },
                data: { workflowStage: 'PAYMENT' }
            })
        }
    }
}
