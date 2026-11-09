import { prisma } from "@/lib/prisma"
import { generateAeroWashQuotePdf } from "@/lib/aerowash-quote-pdf"
import { isAeroWashCompany } from "@/lib/email-templates"

/**
 * Server-side PDF for AeroWash documents (used by emails that are sent without the browser, e.g. the
 * automatic deposit invoice and overdue reminders). Uses the same generator as the PDF download.
 * Returns null for other companies or on any failure, so the email still goes out without the attachment
 * (and without claiming it is attached).
 */
export async function buildAeroWashDocumentPdf(
    invoiceId: string
): Promise<{ filename: string; buffer: Buffer } | null> {
    try {
        const inv = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                client: true,
                items: { orderBy: { position: 'asc' } },
                company: { include: { settings: true } },
            },
        })
        if (!inv) return null
        const settings = inv.company?.settings as any
        if (!isAeroWashCompany(inv.companyId, settings)) return null

        const isInvoice = inv.type === 'INVOICE'
        const number =
            inv.quoteNumber ||
            `${isInvoice ? 'INV' : 'AW'}-${new Date(inv.date).getFullYear()}-${String(inv.number).padStart(3, '0')}`

        const doc = await generateAeroWashQuotePdf({
            invoice: {
                ...(inv as any),
                quoteNumber: number,
                notes: inv.notes,
                items: inv.items.map((i: any) => ({
                    ...i,
                    total: i.total !== undefined ? i.total : (i.quantity || 1) * (i.unitPrice || 0),
                })),
                client: {
                    name: inv.client?.name || '',
                    companyName: inv.client?.companyName || inv.client?.name || '',
                    address: inv.client?.address || '',
                    attentionTo: inv.attentionTo || inv.client?.attentionTo,
                    email: inv.client?.email,
                    phone: inv.client?.phone,
                    vatNumber: inv.client?.vatNumber,
                },
                metadata: inv.metadata,
            },
            company: {
                name: settings?.name || 'AeroWash (Pty) Ltd',
                address: settings?.address || '',
                phone: settings?.phone || '',
                email: settings?.email || '',
                website: settings?.website,
                logoUrl: settings?.logoUrl,
                vatNumber: settings?.taxId || null,
                registrationNumber: settings?.registrationNumber || null,
                vatRegistrationDate: settings?.vatRegistrationDate,
                vatRate: settings?.vatRate,
                bankDetails: settings?.bankDetails,
            },
            companySettings: {
                theme: settings?.theme,
                currency: settings?.currency || 'R',
                taxId: settings?.taxId,
                layoutPreferences: settings?.layoutPreferences,
                validityDays: settings?.validityDays,
            } as any,
            isInvoice,
        })

        const buffer = Buffer.from(doc.output('arraybuffer'))
        return { filename: `${number}.pdf`, buffer }
    } catch (e) {
        console.warn('[Email] Server-side PDF generation failed; sending without attachment:', e)
        return null
    }
}
