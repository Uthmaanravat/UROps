"use server"

import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { revalidatePath } from "next/cache"

export interface CreateCreditNoteInput {
    clientId: string
    invoiceId?: string | null
    projectId?: string | null
    tenderId?: string | null
    workType?: string
    reason?: string | null
    notes?: string | null
    date?: string
    items: {
        code?: string | null
        description: string
        quantity: number
        unit?: string | null
        unitPrice: number
    }[]
}

export async function getCreditNotesAction(filters?: {
    query?: string
    status?: string
    workType?: string
    clientId?: string
}) {
    const companyId = await ensureAuth()

    const where: any = { companyId }

    if (filters?.clientId) {
        where.clientId = filters.clientId
    }

    if (filters?.workType === 'TENDER') {
        where.workType = 'TENDER'
    } else if (filters?.workType === 'GENERAL') {
        where.workType = { not: 'TENDER' }
    }

    if (filters?.status) {
        where.status = filters.status
    }

    if (filters?.query) {
        const q = filters.query.trim()
        where.OR = [
            { creditNoteNumber: { contains: q, mode: 'insensitive' } },
            { reason: { contains: q, mode: 'insensitive' } },
            { client: { name: { contains: q, mode: 'insensitive' } } },
            { invoice: { quoteNumber: { contains: q, mode: 'insensitive' } } }
        ]
    }

    const creditNotes = await prisma.creditNote.findMany({
        where,
        include: {
            client: true,
            invoice: {
                select: { id: true, number: true, quoteNumber: true, total: true, date: true }
            },
            tender: {
                select: { id: true, name: true, tenderNumber: true }
            },
            items: {
                orderBy: { position: 'asc' }
            }
        },
        orderBy: { date: 'desc' }
    })

    return creditNotes
}

export async function getCreditNoteByIdAction(id: string) {
    const companyId = await ensureAuth()

    return await prisma.creditNote.findFirst({
        where: { id, companyId },
        include: {
            client: {
                include: { contacts: true }
            },
            invoice: {
                select: { id: true, number: true, quoteNumber: true, total: true, date: true, site: true, reference: true }
            },
            tender: true,
            project: {
                select: { id: true, name: true }
            },
            items: {
                orderBy: { position: 'asc' }
            }
        }
    })
}

export async function createCreditNoteAction(data: CreateCreditNoteInput) {
    const companyId = await ensureAuth()

    if (!data.clientId) throw new Error("Client is required to create a credit note")
    if (!data.items || data.items.length === 0) throw new Error("At least one line item is required")

    const client = await prisma.client.findFirst({
        where: { id: data.clientId, companyId }
    })
    if (!client) throw new Error("Client not found")

    const isTender = data.workType === 'TENDER'
    const tender = isTender
        ? (data.tenderId
            ? await prisma.tender.findFirst({ where: { id: data.tenderId, companyId } })
            : await prisma.tender.findFirst({ where: { companyId, status: "ACTIVE" } }))
        : null

    const year = new Date(data.date || Date.now()).getFullYear()

    // Determine sequential credit note number
    let nextNum = 0
    let formattedNumber = ""
    let isUnique = false

    while (!isUnique) {
        if (isTender && tender) {
            const tenderPrefix = tender.creditNotePrefix || "CCT-CN"
            const lastCN = await prisma.creditNote.findFirst({
                where: { companyId, workType: 'TENDER' },
                orderBy: { number: 'desc' }
            })
            nextNum = Math.max(client.lastCreditNoteNumber || 0, lastCN?.number || 0) + 1
            await prisma.client.update({
                where: { id: client.id },
                data: { lastCreditNoteNumber: nextNum }
            })
            formattedNumber = `${tenderPrefix}-${year}-${nextNum.toString().padStart(3, '0')}`
        } else if (client.codePrefix) {
            const lastCN = await prisma.creditNote.findFirst({
                where: { companyId, clientId: client.id },
                orderBy: { number: 'desc' }
            })
            nextNum = Math.max(client.lastCreditNoteNumber || 0, lastCN?.number || 0) + 1
            await prisma.client.update({
                where: { id: client.id },
                data: { lastCreditNoteNumber: nextNum }
            })
            formattedNumber = `${client.codePrefix}-CN-${year}-${nextNum.toString().padStart(3, '0')}`
        } else {
            const lastCN = await prisma.creditNote.findFirst({
                where: { companyId },
                orderBy: { number: 'desc' }
            })
            const settings = await prisma.companySettings.findUnique({ where: { companyId } })
            nextNum = Math.max(settings?.lastCreditNoteNumber || 0, lastCN?.number || 0) + 1
            if (settings) {
                await prisma.companySettings.update({
                    where: { companyId },
                    data: { lastCreditNoteNumber: nextNum }
                })
            }
            formattedNumber = `CN-${year}-${nextNum.toString().padStart(3, '0')}`
        }

        const existing = await prisma.creditNote.findFirst({
            where: { companyId, creditNoteNumber: formattedNumber }
        })
        if (!existing) {
            isUnique = true
        }
    }

    // Calculate totals
    const calculatedItems = data.items.map((item, idx) => {
        const qty = Number(item.quantity) || 1
        const price = Number(item.unitPrice) || 0
        const total = qty * price
        return {
            code: item.code || null,
            description: item.description,
            quantity: qty,
            unit: item.unit || "each",
            unitPrice: price,
            total,
            position: idx
        }
    })

    const subtotal = calculatedItems.reduce((acc, i) => acc + i.total, 0)
    const taxRate = 0.15
    const taxAmount = subtotal * taxRate
    const total = subtotal + taxAmount

    const creditNote = await prisma.creditNote.create({
        data: {
            companyId,
            clientId: data.clientId,
            invoiceId: data.invoiceId || null,
            projectId: data.projectId || null,
            tenderId: isTender ? (tender?.id || null) : null,
            workType: isTender ? 'TENDER' : 'GENERAL',
            creditNoteNumber: formattedNumber,
            number: nextNum,
            status: 'ISSUED',
            reason: data.reason || "Credit adjustment",
            notes: data.notes || null,
            date: data.date ? new Date(data.date) : new Date(),
            subtotal,
            taxRate,
            taxAmount,
            total,
            items: {
                create: calculatedItems
            }
        }
    })

    revalidatePath('/credit-notes')
    revalidatePath('/invoices')
    return creditNote.id
}

export async function updateCreditNoteStatusAction(id: string, status: string) {
    const companyId = await ensureAuth()

    await prisma.creditNote.update({
        where: { id, companyId },
        data: { status }
    })

    revalidatePath('/credit-notes')
    revalidatePath(`/credit-notes/${id}`)
    return { success: true }
}

export async function deleteCreditNoteAction(id: string) {
    const companyId = await ensureAuth()

    await prisma.creditNote.delete({
        where: { id, companyId }
    })

    revalidatePath('/credit-notes')
    return { success: true }
}
