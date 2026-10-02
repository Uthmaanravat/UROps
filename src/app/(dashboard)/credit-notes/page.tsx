import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"
import { CreditNotesClient } from "@/components/credit-notes/CreditNotesClient"

export const dynamic = 'force-dynamic'

export default async function CreditNotesPage() {
    const companyId = await ensureAuth()

    const [creditNotes, clients, invoices, tenders] = await Promise.all([
        prisma.creditNote.findMany({
            where: { companyId },
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
        }),
        prisma.client.findMany({
            where: { companyId },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        }),
        prisma.invoice.findMany({
            where: { companyId, type: 'INVOICE' },
            select: {
                id: true,
                number: true,
                quoteNumber: true,
                total: true,
                date: true,
                workType: true,
                tenderId: true,
                clientId: true,
                items: {
                    select: {
                        id: true,
                        code: true,
                        description: true,
                        quantity: true,
                        unit: true,
                        unitPrice: true,
                        total: true
                    },
                    orderBy: { position: 'asc' }
                }
            },
            orderBy: { date: 'desc' },
            take: 200
        }),
        prisma.tender.findMany({
            where: { companyId },
            select: { id: true, tenderNumber: true, name: true }
        })
    ])

    return (
        <CreditNotesClient
            creditNotes={creditNotes}
            clients={clients}
            invoices={invoices}
            tenders={tenders}
        />
    )
}
