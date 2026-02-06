'use server'

import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"

export async function getSidebarNotifications() {
    const companyId = await ensureAuth()
    // 1. WB&P: Count items in DRAFT status (Work breakdowns that need pricing)
    const wbpCount = await (prisma as any).workBreakdownPricing.count({
        where: { status: 'DRAFT', companyId }
    })

    // 2. Quotations: Count QUOTE type items that are SENT (or maybe DRAFT if we want to alert Admin to finish them)
    // For now, let's say "DRAFT" quotes need attention
    const quoteCount = await (prisma as any).invoice.count({
        where: { type: 'QUOTE', status: 'DRAFT', companyId }
    })

    // 3. Invoices: Count INVOICE type items that are UNPAID (DRAFT or SENT)
    const invoiceCount = await (prisma as any).invoice.count({
        where: {
            type: 'INVOICE',
            status: { in: ['DRAFT', 'SENT'] },
            companyId
        }
    })

    // 4. Projects: New SOWs that haven't been processed into WB&P? 
    // Actually the workflow creates WB&P immediately. 
    // Maybe count projects in 'SOW' stage?
    const projectCount = await (prisma as any).project.count({
        where: { workflowStage: 'SOW', companyId }
    })

    return {
        wbp: wbpCount,
        quotations: quoteCount,
        invoices: invoiceCount,
        projects: projectCount
    }
}
