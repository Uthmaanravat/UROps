import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ClientQuoteAcceptance } from "@/components/quotes/ClientQuoteAcceptance"

export const dynamic = 'force-dynamic'

export default async function PublicQuotePage({ params }: { params: { id: string } }) {
    let quote = await prisma.invoice.findFirst({
        where: {
            metadata: {
                path: ['shareToken'],
                equals: params.id
            }
        },
        include: {
            client: true,
            items: { orderBy: { position: 'asc' } },
            company: {
                include: { settings: true }
            }
        }
    })

    // Fallback: If not found by shareToken, check if params.id is a UUID matching quote id
    if (!quote && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
        quote = await prisma.invoice.findUnique({
            where: { id: params.id },
            include: {
                client: true,
                items: { orderBy: { position: 'asc' } },
                company: {
                    include: { settings: true }
                }
            }
        })
    }

    if (!quote) {
        notFound()
    }

    const settings = quote.company?.settings
    const validityDays = (quote as any).validityDays || (quote.metadata as any)?.validityDays || settings?.validityDays || 30
    const quoteDate = new Date(quote.date)
    const expiryDate = new Date(quoteDate.getTime() + validityDays * 24 * 60 * 60 * 1000)
    const isExpired = new Date() > expiryDate

    const threshold = settings?.approvalThreshold
    const meta = (quote.metadata as any) || {}
    const isLockedByApproval = Boolean(
        threshold && threshold > 0 && quote.total > threshold && meta.approvalStatus !== 'APPROVED'
    )

    return (
        <ClientQuoteAcceptance
            quote={quote}
            company={quote.company}
            companySettings={settings}
            isExpired={isExpired}
            isLockedByApproval={isLockedByApproval}
            expiryDate={expiryDate}
            validityDays={validityDays}
        />
    )
}
