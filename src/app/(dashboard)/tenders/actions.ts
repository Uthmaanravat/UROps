"use server"

import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function getTendersAction() {
    const companyId = await ensureAuth()
    return prisma.tender.findMany({
        where: { companyId },
        include: {
            client: {
                select: { id: true, name: true, codePrefix: true }
            },
            _count: {
                select: { fixedItems: true, invoices: true }
            }
        },
        orderBy: { createdAt: 'asc' }
    })
}

export async function getTenderByIdAction(id: string) {
    const companyId = await ensureAuth()
    return prisma.tender.findFirst({
        where: { id, companyId },
        include: {
            client: true,
            invoices: {
                include: {
                    client: true,
                    payments: true,
                    project: true
                },
                orderBy: { date: 'desc' }
            },
            fixedItems: {
                orderBy: { code: 'asc' }
            }
        }
    })
}

export async function getTenderSummaryAction(tenderId?: string) {
    const companyId = await ensureAuth()

    const tender = tenderId
        ? await prisma.tender.findFirst({ where: { id: tenderId, companyId }, include: { client: true } })
        : await prisma.tender.findFirst({ where: { companyId, status: "ACTIVE" }, include: { client: true } })

    if (!tender) return null

    const invoices = await prisma.invoice.findMany({
        where: {
            companyId,
            tenderId: tender.id
        },
        include: {
            client: true,
            payments: true,
            project: true
        },
        orderBy: { date: 'desc' }
    })

    const quotes = invoices.filter(i => i.type === 'QUOTE')
    const taxInvoices = invoices.filter(i => i.type === 'INVOICE')

    const totalQuoted = quotes.reduce((acc, q) => acc + (q.total || 0), 0)
    const totalInvoiced = taxInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0)
    const totalPaid = taxInvoices.reduce((acc, inv) => {
        const paid = inv.payments?.reduce((pAcc, p) => pAcc + p.amount, 0) || 0
        return acc + paid
    }, 0)

    return {
        tender,
        quotes,
        taxInvoices,
        totals: {
            totalQuoted,
            totalInvoiced,
            totalPaid,
            outstandingInvoiced: totalInvoiced - totalPaid
        }
    }
}

export async function logItemUnlockAction(data: {
    invoiceId: string
    itemId?: string
    itemCode?: string
    reason: string
}) {
    const companyId = await ensureAuth()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const dbUser = user ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true, role: true }
    }) : null

    const unlockedBy = dbUser?.name || dbUser?.email || "Admin"

    const unlockLog = await prisma.unlockLog.create({
        data: {
            companyId,
            invoiceId: data.invoiceId,
            itemId: data.itemId || null,
            itemCode: data.itemCode || null,
            unlockedBy: `${unlockedBy} (${dbUser?.role || 'ADMIN'})`,
            reason: data.reason
        }
    })

    // Also update item in DB if itemId provided
    if (data.itemId) {
        await prisma.invoiceItem.update({
            where: { id: data.itemId },
            data: { isLocked: false }
        }).catch(() => null)
    }

    revalidatePath(`/invoices/${data.invoiceId}`)
    return { success: true, unlockLog }
}

export async function importTenderRatesAction(
    tenderId: string,
    rows: Array<{
        code: string
        description: string
        unit: string
        y1: number
        y2?: number | null
        y3?: number | null
        category?: string
    }>
) {
    const companyId = await ensureAuth()
    const tender = await prisma.tender.findFirst({
        where: { id: tenderId, companyId }
    })
    if (!tender) throw new Error("Tender not found")

    let createdCount = 0
    let updatedCount = 0

    for (const row of rows) {
        if (!row.code || !row.description) continue

        const existing = await prisma.fixedPriceItem.findFirst({
            where: {
                companyId,
                clientId: tender.clientId,
                code: row.code.trim()
            }
        })

        if (existing) {
            await prisma.fixedPriceItem.update({
                where: { id: existing.id },
                data: {
                    description: row.description.trim(),
                    unit: row.unit?.trim() || existing.unit,
                    unitPrice: row.y1,
                    year1Price: row.y1,
                    year2Price: row.y2 !== undefined && row.y2 !== null ? row.y2 : existing.year2Price,
                    year3Price: row.y3 !== undefined && row.y3 !== null ? row.y3 : existing.year3Price,
                    tenderId: tender.id,
                    category: row.category?.trim() || existing.category
                }
            })
            updatedCount++
        } else {
            await prisma.fixedPriceItem.create({
                data: {
                    companyId,
                    clientId: tender.clientId,
                    tenderId: tender.id,
                    code: row.code.trim(),
                    description: row.description.trim(),
                    unit: row.unit?.trim() || "each",
                    unitPrice: row.y1,
                    year1Price: row.y1,
                    year2Price: row.y2 || null,
                    year3Price: row.y3 || null,
                    category: row.category?.trim() || "Tender 152G"
                }
            })
            createdCount++
        }
    }

    revalidatePath("/knowledge")
    revalidatePath("/tenders")
    return { success: true, createdCount, updatedCount }
}
