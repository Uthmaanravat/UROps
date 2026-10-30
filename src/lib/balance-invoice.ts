import { prisma } from "@/lib/prisma"
import { calculateVatAndTotal, getVatRate, isVatEffective } from "@/lib/vat-utils"

export interface ApprovedExtraItem {
    id: string
    description: string
    amount: number
    unit?: string
    reason?: string
    approvedAt: string
}

export interface BalanceCalculationMetadata {
    quoteId: string
    quoteNumber: string
    quoteTotal: number
    extrasTotal: number
    extrasBreakdown: Array<{ id: string; description: string; amount: number }>
    finalJobTotal: number
    expectedDeposit: number
    paymentsReceived: number
    balanceDue: number
    depositNotReceived: boolean
    calculatedAt: string
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

/**
 * Records an approved Standby / Return Attendance or extra charge on the project's jobSpecs
 * so it is included in the project's final job total and Balance Invoice calculation.
 */
export async function recordApprovedProjectExtra(input: {
    projectId: string
    companyId: string
    description: string
    amount: number
    reason?: string
}): Promise<ApprovedExtraItem> {
    const project = await prisma.project.findFirst({
        where: { id: input.projectId, companyId: input.companyId },
        select: { id: true, jobSpecs: true }
    })
    if (!project) throw new Error("Project not found")

    const specs = ((project.jobSpecs as any) || {}) as Record<string, any>
    const prevExtras: ApprovedExtraItem[] = Array.isArray(specs.approvedExtras) ? specs.approvedExtras : []

    const newItem: ApprovedExtraItem = {
        id: `extra_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        description: input.description.trim(),
        amount: round2(input.amount),
        unit: "visit",
        reason: input.reason,
        approvedAt: new Date().toISOString()
    }

    await prisma.project.update({
        where: { id: project.id },
        data: {
            jobSpecs: ({
                ...specs,
                approvedExtras: [...prevExtras, newItem]
            } as any)
        }
    })

    return newItem
}

/**
 * Computes and creates/updates the DRAFT Balance Invoice for a completed AeroWash job:
 *   Final Job Total = Accepted Quote Total + Approved Standby / Extra Lines
 *   Balance Due     = Final Job Total - Payments Actually Received Against This Job
 *
 * - If deposit wasn't paid (paymentsReceived <= 0), flags `depositNotReceived = true`
 *   ("Deposit not received") and includes the full amount due.
 * - Stores the full calculation in `invoice.metadata.balanceCalculation` for internal view.
 * - Populates clean client-facing line items summing to Balance Due so the client sees
 *   only the lines and Balance Due.
 */
export async function upsertProjectBalanceInvoiceDraft(input: {
    projectId: string
    companyId: string
    completionReportId?: string | null
}): Promise<{
    invoiceId: string | null
    invoiceNumber: string | null
    calculation: BalanceCalculationMetadata | null
}> {
    const project = await prisma.project.findFirst({
        where: { id: input.projectId, companyId: input.companyId },
        include: {
            client: true,
            parentProject: {
                include: {
                    invoices: {
                        where: { type: "QUOTE" },
                        include: { items: { orderBy: { position: "asc" } } },
                        orderBy: { createdAt: "desc" }
                    }
                }
            },
            invoices: {
                include: {
                    items: { orderBy: { position: "asc" } },
                    payments: true
                },
                orderBy: { createdAt: "desc" }
            }
        }
    })

    if (!project) {
        return { invoiceId: null, invoiceNumber: null, calculation: null }
    }

    const isRecurringVisit = Boolean(project.parentProjectId)

    // 1. Locate Accepted Quote (or primary quote for project / parent contract)
    const acceptedQuote =
        project.invoices.find(
            i => i.type === "QUOTE" && ["ACCEPTED", "INVOICED", "PAID"].includes(i.status)
        ) ||
        project.invoices.find(i => i.type === "QUOTE") ||
        project.parentProject?.invoices?.find(i =>
            ["ACCEPTED", "INVOICED", "PAID"].includes(i.status)
        ) ||
        project.parentProject?.invoices?.[0] ||
        null

    const existingBalanceInv = project.invoices.find(
        inv =>
            inv.type === "INVOICE" &&
            Boolean((inv.metadata as any)?.isBalanceInvoice || (inv.metadata as any)?.isVisitInvoice)
    )

    // Never overwrite a locked/sent/paid balance invoice that already went out to the client
    if (existingBalanceInv && existingBalanceInv.status !== "DRAFT") {
        if (input.completionReportId && !(existingBalanceInv.metadata as any)?.completionReportId) {
            await prisma.invoice.update({
                where: { id: existingBalanceInv.id },
                data: {
                    metadata: {
                        ...((existingBalanceInv.metadata as any) || {}),
                        completionReportId: input.completionReportId
                    }
                }
            })
        }
        return {
            invoiceId: existingBalanceInv.id,
            invoiceNumber: existingBalanceInv.quoteNumber || `INV-${existingBalanceInv.number}`,
            calculation: ((existingBalanceInv.metadata as any)?.balanceCalculation as BalanceCalculationMetadata) || null
        }
    }

    // Collect approved extras from project.jobSpecs.approvedExtras + any standalone draft standby invoices + manual extra items
    const specs = ((project.jobSpecs as any) || {}) as Record<string, any>
    const extrasMap = new Map<string, ApprovedExtraItem>()

    if (Array.isArray(specs.approvedExtras)) {
        for (const ex of specs.approvedExtras) {
            if (ex && Number(ex.amount) > 0) {
                extrasMap.set(ex.id || `${ex.description}:${ex.amount}`, {
                    id: ex.id || `extra_${extrasMap.size + 1}`,
                    description: ex.description,
                    amount: round2(ex.amount),
                    unit: ex.unit || "visit",
                    reason: ex.reason,
                    approvedAt: ex.approvedAt || new Date().toISOString()
                })
            }
        }
    }

    // Merge any standalone DRAFT standby invoices created earlier so everything lives on the single Balance Invoice
    const standaloneStandbyDrafts = project.invoices.filter(
        inv =>
            inv.type === "INVOICE" &&
            inv.status === "DRAFT" &&
            inv.id !== existingBalanceInv?.id &&
            Boolean((inv.metadata as any)?.isStandbyInvoice) &&
            inv.payments.length === 0
    )
    for (const sInv of standaloneStandbyDrafts) {
        for (const item of sInv.items) {
            const key = (item.metadata as any)?.extraId || `${item.description}:${item.total}`
            if (!extrasMap.has(key) && Number(item.total) > 0) {
                extrasMap.set(key, {
                    id: key,
                    description: item.description,
                    amount: round2(item.total),
                    unit: item.unit || "visit",
                    approvedAt: sInv.createdAt.toISOString()
                })
            }
        }
    }

    // Preserve any manual extra lines added directly on an existing DRAFT balance invoice
    if (existingBalanceInv) {
        for (const item of existingBalanceInv.items) {
            const iMeta = (item.metadata as any) || {}
            if (iMeta.isGeneratedQuoteBalanceLine || iMeta.isGeneratedQuoteScopeLine) continue
            if (iMeta.isExtraLine) {
                const key = iMeta.extraId || `${item.description}:${item.total}`
                if (!extrasMap.has(key) && Number(item.total) > 0) {
                    extrasMap.set(key, {
                        id: key,
                        description: item.description,
                        amount: round2(item.total),
                        unit: item.unit || "sum",
                        approvedAt: new Date().toISOString()
                    })
                }
            }
        }
    }

    const approvedExtras = Array.from(extrasMap.values())
    const extrasSubtotal = round2(approvedExtras.reduce((sum, e) => sum + e.amount, 0))

    if (!acceptedQuote && approvedExtras.length === 0) {
        return { invoiceId: null, invoiceNumber: null, calculation: null }
    }

    const quoteSubtotal = acceptedQuote ? round2(acceptedQuote.subtotal) : 0
    const quoteRef = acceptedQuote ? (acceptedQuote.quoteNumber || `Quote #${acceptedQuote.number}`) : project.name
    const siteAddress = acceptedQuote?.site || project.client?.address || project.name

    // 2. Sum ALL payments actually received against this project (excluding this draft balance invoice itself)
    let paymentsReceived = 0
    let depositInvoiceTotal: number | null = null

    for (const inv of project.invoices) {
        if (existingBalanceInv && inv.id === existingBalanceInv.id) continue
        if (inv.status === "CANCELLED" || inv.status === "REJECTED") continue

        const invMeta = (inv.metadata as any) || {}
        const isDepositInv =
            inv.type === "INVOICE" &&
            (invMeta.isDepositInvoice || inv.firstPaymentPercentage === 60 || inv.paymentNotes?.toLowerCase().includes("deposit"))
        if (isDepositInv && depositInvoiceTotal === null) {
            depositInvoiceTotal = round2(inv.total)
        }

        if (inv.payments && inv.payments.length > 0) {
            const paidOnInv = inv.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
            paymentsReceived += paidOnInv
        } else if (inv.type === "INVOICE" && inv.status === "PAID") {
            // Supports invoices marked PAID via "Mark as Paid (Lock)" without separate Payment rows
            paymentsReceived += Number(inv.total) || 0
        }
    }
    paymentsReceived = round2(paymentsReceived)

    const expectedDeposit = isRecurringVisit
        ? 0
        : depositInvoiceTotal !== null
            ? depositInvoiceTotal
            : round2(quoteSubtotal * 0.6)

    const depositNotReceived = !isRecurringVisit && quoteSubtotal > 0 && paymentsReceived <= 0

    // 3. Final Job Total & Balance Due
    const finalJobSubtotal = round2(quoteSubtotal + extrasSubtotal)
    const balanceSubtotal = Math.max(0, round2(finalJobSubtotal - paymentsReceived))

    const now = new Date()
    const settings = await prisma.companySettings.findUnique({ where: { companyId: input.companyId } })
    const vatEffective = isVatEffective(now, settings)
    const vatRate = getVatRate(settings)
    const { taxRate, taxAmount, total: balanceTotal } = calculateVatAndTotal(balanceSubtotal, vatEffective, vatRate)

    const calculation: BalanceCalculationMetadata = {
        quoteId: acceptedQuote?.id || "",
        quoteNumber: quoteRef,
        quoteTotal: quoteSubtotal,
        extrasTotal: extrasSubtotal,
        extrasBreakdown: approvedExtras.map(e => ({
            id: e.id,
            description: e.description,
            amount: e.amount
        })),
        finalJobTotal: finalJobSubtotal,
        expectedDeposit,
        paymentsReceived,
        balanceDue: balanceTotal,
        depositNotReceived,
        calculatedAt: now.toISOString()
    }

    // 4. Build Client-Facing Line Items (client sees ONLY the lines and Balance Due)
    const clientItems: Array<{
        description: string
        quantity: number
        unit: string
        unitPrice: number
        total: number
        area: string
        position: number
        metadata: any
    }> = []

    if (paymentsReceived <= 0) {
        // Deposit unpaid (or recurring visit with 0 prepaid): show full accepted quote scope lines + any approved extra lines
        if (acceptedQuote && acceptedQuote.items && acceptedQuote.items.length > 0) {
            acceptedQuote.items.forEach((qItem) => {
                clientItems.push({
                    description: qItem.description,
                    quantity: qItem.quantity,
                    unit: qItem.unit || "sum",
                    unitPrice: qItem.unitPrice,
                    total: round2(qItem.total ?? qItem.quantity * qItem.unitPrice),
                    area: qItem.area || "",
                    position: clientItems.length,
                    metadata: {
                        ...((qItem.metadata as any) || {}),
                        isGeneratedQuoteScopeLine: true
                    }
                })
            })
        } else if (quoteSubtotal > 0) {
            clientItems.push({
                description: isRecurringVisit
                    ? `Completed Scheduled Facade Maintenance Visit – ${project.name}`
                    : `Exterior Facade Maintenance Works – ${quoteRef} (${siteAddress})`,
                quantity: 1,
                unit: "sum",
                unitPrice: quoteSubtotal,
                total: quoteSubtotal,
                area: "",
                position: clientItems.length,
                metadata: { isGeneratedQuoteScopeLine: true }
            })
        }

        for (const extra of approvedExtras) {
            clientItems.push({
                description: extra.description,
                quantity: 1,
                unit: extra.unit || "visit",
                unitPrice: extra.amount,
                total: extra.amount,
                area: "",
                position: clientItems.length,
                metadata: { isExtraLine: true, extraId: extra.id }
            })
        }
    } else if (paymentsReceived <= quoteSubtotal) {
        // Standard deposit / partial payment received against quote:
        // Line 1 = Remaining balance on accepted quote (quoteSubtotal - paymentsReceived)
        // Line 2+ = Approved standby / extra lines
        const quoteRemaining = round2(quoteSubtotal - paymentsReceived)
        if (quoteRemaining > 0) {
            clientItems.push({
                description: `Balance on Project Completion – ${quoteRef} (${siteAddress})`,
                quantity: 1,
                unit: "sum",
                unitPrice: quoteRemaining,
                total: quoteRemaining,
                area: "",
                position: 0,
                metadata: { isGeneratedQuoteBalanceLine: true }
            })
        }
        for (const extra of approvedExtras) {
            clientItems.push({
                description: extra.description,
                quantity: 1,
                unit: extra.unit || "visit",
                unitPrice: extra.amount,
                total: extra.amount,
                area: "",
                position: clientItems.length,
                metadata: { isExtraLine: true, extraId: extra.id }
            })
        }
    } else {
        // Edge case: prior payments exceeded original quote subtotal and partially cover extras
        clientItems.push({
            description: `Remaining Balance on Project Completion – ${quoteRef} (${siteAddress})`,
            quantity: 1,
            unit: "sum",
            unitPrice: balanceSubtotal,
            total: balanceSubtotal,
            area: "",
            position: 0,
            metadata: { isGeneratedQuoteBalanceLine: true }
        })
    }

    const reportIdToKeep =
        input.completionReportId ||
        ((existingBalanceInv?.metadata as any)?.completionReportId as string | undefined) ||
        null

    const nextMetadata: any = {
        ...((acceptedQuote?.metadata as any)?.scopeOfWorks ? {
            scopeOfWorks: (acceptedQuote?.metadata as any).scopeOfWorks
        } : {}),
        ...((existingBalanceInv?.metadata as any) || {}),
        isBalanceInvoice: !isRecurringVisit,
        isVisitInvoice: isRecurringVisit,
        originalQuoteId: acceptedQuote?.id || null,
        completionReportId: reportIdToKeep,
        depositNotReceived,
        balanceCalculation: calculation
    }

    const paymentNotesText = isRecurringVisit
        ? `Scheduled maintenance visit invoice for ${project.name}.`
        : `Balance invoice on project completion as per accepted quotation ${quoteRef}.`

    // Clean up any merged standalone DRAFT standby invoices so there are no duplicate drafts
    if (standaloneStandbyDrafts.length > 0) {
        const standbyIds = standaloneStandbyDrafts.map(s => s.id)
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: standbyIds } } })
        await prisma.invoice.deleteMany({ where: { id: { in: standbyIds } } })
    }

    if (existingBalanceInv) {
        await prisma.$transaction([
            prisma.invoiceItem.deleteMany({ where: { invoiceId: existingBalanceInv.id } }),
            prisma.invoice.update({
                where: { id: existingBalanceInv.id },
                data: {
                    subtotal: balanceSubtotal,
                    taxRate,
                    taxAmount,
                    total: balanceTotal,
                    site: siteAddress,
                    reference: quoteRef,
                    clientPoNumber: acceptedQuote?.clientPoNumber || existingBalanceInv.clientPoNumber,
                    paymentNotes: paymentNotesText,
                    metadata: nextMetadata,
                    items: {
                        create: clientItems
                    }
                }
            })
        ])

        return {
            invoiceId: existingBalanceInv.id,
            invoiceNumber: existingBalanceInv.quoteNumber || `INV-${existingBalanceInv.number}`,
            calculation
        }
    }

    // Allocate next sequential AeroWash invoice number
    const year = now.getFullYear()
    const lastInv = await prisma.invoice.findFirst({
        where: { companyId: input.companyId, type: "INVOICE" },
        orderBy: { number: "desc" }
    })
    const nextInvoiceNumber = Math.max(settings?.lastInvoiceNumber || 0, lastInv?.number || 0) + 1
    if (settings) {
        await prisma.companySettings.update({
            where: { companyId: input.companyId },
            data: { lastInvoiceNumber: nextInvoiceNumber }
        })
    }
    const formattedInvoiceNumber = `INV-${year}-${nextInvoiceNumber.toString().padStart(3, "0")}`

    const createdInv = await prisma.invoice.create({
        data: {
            companyId: input.companyId,
            clientId: project.clientId,
            projectId: project.id,
            contactId: acceptedQuote?.contactId || null,
            attentionTo: acceptedQuote?.attentionTo || project.client?.attentionTo || null,
            type: "INVOICE",
            status: "DRAFT",
            number: nextInvoiceNumber,
            quoteNumber: formattedInvoiceNumber,
            reference: quoteRef,
            clientPoNumber: acceptedQuote?.clientPoNumber || null,
            subtotal: balanceSubtotal,
            taxRate,
            taxAmount,
            total: balanceTotal,
            site: siteAddress,
            paymentNotes: paymentNotesText,
            date: now,
            metadata: nextMetadata,
            items: {
                create: clientItems
            }
        }
    })

    return {
        invoiceId: createdInv.id,
        invoiceNumber: formattedInvoiceNumber,
        calculation
    }
}
