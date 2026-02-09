'use server'

import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"

export async function getSidebarNotifications() {
    try {
        const companyId = await ensureAuth()
        if (!companyId) return { wbp: 0, quotations: 0, invoices: 0, projects: 0 }

        // 1. WB&P: Count items in DRAFT status
        const wbpCount = await (prisma as any).workBreakdownPricing?.count({
            where: { status: 'DRAFT', companyId }
        }) || 0

        // 2. Quotations: Count QUOTE type items that are DRAFT
        const quoteCount = await (prisma as any).invoice?.count({
            where: { type: 'QUOTE', status: 'DRAFT', companyId }
        }) || 0

        // 3. Invoices: Count INVOICE type items that are UNPAID
        const invoiceCount = await (prisma as any).invoice?.count({
            where: {
                type: 'INVOICE',
                status: { in: ['DRAFT', 'SENT'] },
                companyId
            }
        }) || 0

        // 4. Projects: Count projects in 'SOW' stage
        const projectCount = await (prisma as any).project?.count({
            where: { workflowStage: 'SOW', companyId }
        }) || 0

        return {
            wbp: wbpCount,
            quotations: quoteCount,
            invoices: invoiceCount,
            projects: projectCount
        }
    } catch (error) {
        console.error("Error fetching sidebar notifications:", error)
        return { wbp: 0, quotations: 0, invoices: 0, projects: 0 }
    }
}
