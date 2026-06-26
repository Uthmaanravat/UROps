"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"

export async function updateInvoiceProjectAction(invoiceId: string, projectId: string | null) {
    const companyId = await ensureAuth()

    await prisma.invoice.update({
        where: { id: invoiceId, companyId },
        data: { projectId }
    })

    if (projectId) {
        // Automatically set project status to QUOTATION if a quote is linked
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId, companyId }
        })
        if (invoice?.type === 'QUOTE') {
            await prisma.project.update({
                where: { id: projectId, companyId },
                data: {
                    status: 'QUOTED',
                    workflowStage: 'QUOTATION'
                }
            })
        }
    }

    revalidatePath(`/invoices/${invoiceId}`)
    revalidatePath("/projects")
}
export async function updateInvoiceDetailsAction(invoiceId: string, data: { site?: string, reference?: string, quoteNumber?: string, date?: string, firstPaymentPercentage?: number | null, contactId?: string | null, attentionTo?: string | null }) {
    const companyId = await ensureAuth()

    const invoiceRecord = await prisma.invoice.findUnique({
        where: { id: invoiceId, companyId },
        include: { client: true }
    });
    if (!invoiceRecord) throw new Error("Invoice not found");

    const codePrefix = invoiceRecord.client.codePrefix;
    let nextNumber: number | undefined;

    if (data.quoteNumber && data.quoteNumber !== invoiceRecord.quoteNumber) {
        // First check uniqueness: make sure the new number is not used by ANOTHER invoice/quote!
        const existing = await prisma.invoice.findFirst({
            where: {
                companyId,
                quoteNumber: data.quoteNumber,
                id: { not: invoiceId },
                type: invoiceRecord.type
            }
        });
        if (existing) {
            throw new Error(`${invoiceRecord.type} number ${data.quoteNumber} has already been used. Please use a new number.`);
        }

        const match = data.quoteNumber.match(/(\d+)$/);
        if (match) {
            nextNumber = parseInt(match[1]);
            const isInvoice = invoiceRecord.type === 'INVOICE' || data.quoteNumber.includes('-INV-') || data.quoteNumber.startsWith('INV-');
            if (codePrefix) {
                const currentClient = await prisma.client.findUnique({
                    where: { id: invoiceRecord.clientId },
                    select: { lastQuoteNumber: true, lastInvoiceNumber: true }
                });
                const currentSeq = isInvoice ? (currentClient?.lastInvoiceNumber || 0) : (currentClient?.lastQuoteNumber || 0);
                if (nextNumber > currentSeq) {
                    await prisma.client.update({
                        where: { id: invoiceRecord.clientId },
                        data: { [isInvoice ? 'lastInvoiceNumber' : 'lastQuoteNumber']: nextNumber }
                    });
                }
            } else {
                const currentSettings = await prisma.companySettings.findUnique({
                    where: { companyId },
                    select: { lastQuoteNumber: true, lastInvoiceNumber: true }
                });
                const currentSeq = isInvoice ? (currentSettings?.lastInvoiceNumber || 0) : (currentSettings?.lastQuoteNumber || 0);
                if (nextNumber > currentSeq) {
                    await prisma.companySettings.update({
                        where: { companyId },
                        data: { [isInvoice ? 'lastInvoiceNumber' : 'lastQuoteNumber']: nextNumber }
                    });
                }
            }
        }
    }

    const invoice = await prisma.invoice.update({
        where: { id: invoiceId, companyId },
        data: {
            site: data.site,
            reference: data.reference,
            quoteNumber: data.quoteNumber,
            number: nextNumber !== undefined ? nextNumber : undefined,
            date: data.date ? new Date(data.date) : undefined,
            firstPaymentPercentage: data.firstPaymentPercentage !== undefined ? data.firstPaymentPercentage : undefined,
            contactId: data.contactId !== undefined ? data.contactId : undefined,
            attentionTo: data.attentionTo !== undefined ? data.attentionTo : undefined
        },
        include: { project: true }
    })

    if (invoice.project && data.reference) {
        await prisma.project.update({
            where: { id: invoice.projectId!, companyId },
            data: { name: data.reference }
        })
    }

    revalidatePath(`/invoices/${invoiceId}`)
    revalidatePath("/projects")
}

export async function updateProjectCommercialStatusAction(projectId: string, status: 'AWAITING_PO' | 'PO_RECEIVED' | 'EMERGENCY_WORK' | 'REACTIVE_WORK') {
    const companyId = await ensureAuth()

    await prisma.project.update({
        where: { id: projectId, companyId },
        data: { commercialStatus: status }
    })

    revalidatePath("/projects")
}
