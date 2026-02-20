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

export async function updateInvoiceDetailsAction(invoiceId: string, data: { site?: string, reference?: string, date?: string }) {
    const companyId = await ensureAuth()

    await prisma.invoice.update({
        where: { id: invoiceId, companyId },
        data: {
            site: data.site,
            reference: data.reference,
            date: data.date ? new Date(data.date) : undefined
        }
    })

    revalidatePath(`/invoices/${invoiceId}`)
}

export async function updateProjectCommercialStatusAction(projectId: string, status: 'AWAITING_PO' | 'PO_RECEIVED' | 'EMERGENCY_WORK') {
    const companyId = await ensureAuth()

    await prisma.project.update({
        where: { id: projectId, companyId },
        data: { commercialStatus: status }
    })

    revalidatePath("/projects")
}
