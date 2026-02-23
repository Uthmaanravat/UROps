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
    // All documents (Quotes, Invoices) share the same sequential ID from the Invoice table
    const invoice = await prisma.invoice.create({
        data: {
            companyId: project!.companyId,
            projectId,
            clientId: project?.clientId || "", // Fallback to empty string if undefined, though schema usually requires it for invoices
            type: 'QUOTE',
            status: 'DRAFT',
            subtotal: 0,
            taxAmount: 0,
            total: 0,
            items: {
                create: [] // Empty initially
            }
        }
    })

    const year = new Date().getFullYear()
    const suggestedQuoteNumber = `Q-${year}-${invoice.number.toString().padStart(3, '0')}`

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
            quoteNumber: suggestedQuoteNumber, // Stores "Q-100" but backed by Invoice #100
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

    // 3. Update Existing Draft Invoice to Official Quote (SENT)
    // We find the invoice by matching the quoteNumber string or we should probably store wbpId on invoice earlier.
    // However, since we stored "Q-123" in wbp.quoteNumber, we can extract the ID 123.
    // A better way is to find the Invoice where quoteNumber matches or just search by logic.
    // For now, let's find the DRAFT quote for this project/client or parse the number.

    // Robustness: Try to find the existing PROVISIONAL invoice created at SOW stage
    // Method A: Direct link via wbpId (Most robust if Step 3a in submitScopeOfWork succeeded)
    let quote = await prisma.invoice.findFirst({
        where: { wbpId: wbpId }
    })

    const provisionalNumber = wbp.quoteNumber; // e.g. Q-123

    // Method B: Fallback to Number parsing if link missing
    if (!quote && provisionalNumber) {
        // Try to find by the auto-increment number hidden in the string
        const numberMatch = provisionalNumber.match(/\d+/)
        if (numberMatch) {
            const invoiceId = parseInt(numberMatch[0])
            quote = await prisma.invoice.findFirst({
                where: { number: invoiceId, companyId: wbp.project.companyId }
            })
        }
    }

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
                site: options?.site || wbp.site,
                quoteNumber: options?.quoteNumber || provisionalNumber, // Keep consistent
                reference: options?.reference,
                notes: options?.notes,
                items: {
                    deleteMany: {}, // Clear placeholder/old items
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
    const quote = await prisma.invoice.findUniqueOrThrow({ where: { id: quoteId } })

    // 1. Mark Quote as ACCEPTED (Sent -> Accepted)
    // Actually user said "Approving quotation... Move project to Invoice stage"
    await prisma.invoice.update({
        where: { id: quoteId },
        data: { status: 'ACCEPTED' }
    })

    // 2. Convert Quote to Invoice (Preserve ID)
    await prisma.invoice.update({
        where: { id: quoteId },
        data: {
            type: 'INVOICE',
            status: 'DRAFT', // Or SENT if preferred immediately
            quoteNumber: `INV-${quote.number.toString().padStart(4, '0')}`, // Update label to INV-XXX
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
