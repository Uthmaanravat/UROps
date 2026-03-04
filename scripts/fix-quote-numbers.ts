import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting migration to fix quote numbers...')

    // 1. Update Invoice table
    const invoices = await prisma.invoice.findMany({
        where: {
            quoteNumber: {
                startsWith: 'Quotation-'
            }
        }
    })

    console.log(`Found ${invoices.length} invoices with "Quotation-" prefix.`)

    for (const invoice of invoices) {
        const newQuoteNumber = invoice.quoteNumber!.replace('Quotation-', 'Q-')
        await prisma.invoice.update({
            where: { id: invoice.id },
            data: { quoteNumber: newQuoteNumber }
        })
        console.log(`Updated Invoice ${invoice.id}: ${invoice.quoteNumber} -> ${newQuoteNumber}`)
    }

    // 2. Update WorkBreakdownPricing table
    const wbps = await prisma.workBreakdownPricing.findMany({
        where: {
            quoteNumber: {
                startsWith: 'Quotation-'
            }
        }
    })

    console.log(`Found ${wbps.length} WB&Ps with "Quotation-" prefix.`)

    for (const wbp of wbps) {
        const newQuoteNumber = wbp.quoteNumber!.replace('Quotation-', 'Q-')
        await prisma.workBreakdownPricing.update({
            where: { id: wbp.id },
            data: { quoteNumber: newQuoteNumber }
        })
        console.log(`Updated WB&P ${wbp.id}: ${wbp.quoteNumber} -> ${newQuoteNumber}`)
    }

    console.log('Migration complete.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
