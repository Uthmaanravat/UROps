import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logSubmission } from "@/lib/submission-logger"

export async function submitScopeOfWork(projectId: string, items: { description: string, quantity: number, unit?: string, notes?: string, area?: string }[], site?: string) {
    // Get project details for logging
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { client: true }
    })

    // 1. Calculate next Quote Number (Q-001 format)
    const quoteCount = await prisma.invoice.count({
        where: { type: 'QUOTE', companyId: project!.companyId }
    })
    const suggestedQuoteNumber = `Q-${(quoteCount + 1).toString().padStart(3, '0')}`

    // 2. Create SOW Record (Frozen snapshot)
    const sow = await prisma.scopeOfWork.create({
        data: {
            companyId: project!.companyId,
            projectId,
            status: 'SUBMITTED',
            version: 1,
            site,
            items: {
                create: items.map(i => ({
                    area: i.area,
                    description: i.description,
                    quantity: i.quantity,
                    unit: i.unit,
                    notes: i.notes
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
            quoteNumber: suggestedQuoteNumber,
            items: {
                create: items.map(i => ({
                    area: i.area,
                    description: i.description,
                    quantity: i.quantity,
                    unit: i.unit,
                    notes: i.notes,
                    unitPrice: 0,
                    total: 0
                }))
            }
        }
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
    options?: { site?: string, quoteNumber?: string, reference?: string, notes?: string }
) {
    const wbp = await prisma.workBreakdownPricing.findUniqueOrThrow({
        where: { id: wbpId },
        include: { project: { include: { client: true } } }
    })

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const taxRate = 0.15
    const taxAmount = subtotal * taxRate
    const total = subtotal + taxAmount

    // 1. Update or Create the WB&P items with final prices
    for (const item of items) {
        // Only try to update if it looks like a real UUID and not a temporary client ID
        const isRealId = item.id && item.id.length > 20; // Basic check for UUID vs temporary ID

        let existingItem = null;
        if (isRealId) {
            existingItem = await prisma.workBreakdownPricingItem.findUnique({
                where: { id: item.id }
            });
        }

        if (existingItem) {
            await prisma.workBreakdownPricingItem.update({
                where: { id: item.id },
                data: {
                    area: item.area,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitPrice: item.unitPrice,
                    total: item.quantity * item.unitPrice,
                    notes: item.notes
                }
            })
        } else {
            // Logic for new items added during WB&P session or items with temporary IDs
            await prisma.workBreakdownPricingItem.create({
                data: {
                    wbpId,
                    area: item.area,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitPrice: item.unitPrice,
                    total: item.quantity * item.unitPrice,
                    notes: item.notes
                }
            })
        }
    }

    // 2. Mark WB&P as APPROVED and save notes
    await prisma.workBreakdownPricing.update({
        where: { id: wbpId },
        data: {
            status: 'APPROVED',
            notes: options?.notes
        }
    })

    // 3. Create Official Quote
    const quote = await prisma.invoice.create({
        data: {
            companyId: wbp.project.companyId,
            projectId: wbp.projectId,
            clientId: wbp.project.clientId,
            type: 'QUOTE',
            status: 'SENT',
            wbpId: wbp.id,
            subtotal,
            taxRate,
            taxAmount,
            total,
            site: options?.site || wbp.site,
            quoteNumber: options?.quoteNumber,
            reference: options?.reference,
            notes: options?.notes,
            items: {
                create: items.map(i => ({
                    area: i.area,
                    description: i.description,
                    quantity: i.quantity,
                    unit: i.unit,
                    unitPrice: i.unitPrice,
                    total: i.quantity * i.unitPrice,
                    notes: i.notes
                }))
            }
        }
    })

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
    const quote = await prisma.invoice.findUniqueOrThrow({ where: { id: quoteId } })

    // 1. Mark Quote as ACCEPTED (Sent -> Accepted)
    // Actually user said "Approving quotation... Move project to Invoice stage"
    await prisma.invoice.update({
        where: { id: quoteId },
        data: { status: 'ACCEPTED' }
    })

    // 2. Create Draft Invoice from Quote
    const invoiceCount = await prisma.invoice.count({
        where: { type: 'INVOICE', companyId: quote.companyId }
    })
    const invoiceNumberLabel = `INV-${(invoiceCount + 1).toString().padStart(3, '0')}`

    await prisma.invoice.create({
        data: {
            companyId: quote.companyId,
            projectId: quote.projectId,
            clientId: quote.clientId,
            type: 'INVOICE',
            status: 'DRAFT',
            wbpId: quote.wbpId,
            quoteNumber: invoiceNumberLabel, // Using this field for the independent invoice sequence label
            items: {
                createMany: {
                    data: (await prisma.invoiceItem.findMany({ where: { invoiceId: quoteId } })).map(item => ({
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.total
                    }))
                }
            },
            subtotal: quote.subtotal,
            taxAmount: quote.taxAmount,
            total: quote.total,
            site: quote.site,
            reference: quote.reference,
            notes: quote.notes
        }
    })

    // 3. Update Project Stage
    if (quote.projectId) {
        await prisma.project.update({
            where: { id: quote.projectId },
            data: { workflowStage: 'INVOICE', status: 'INVOICED' }
        })
    }

    revalidatePath(`/projects/${quote.projectId}`)
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
