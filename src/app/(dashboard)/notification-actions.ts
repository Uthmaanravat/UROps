'use server'

import { prisma } from "@/lib/prisma"
import { ensureAuth } from "@/lib/auth-actions"

export async function getSidebarNotifications() {
    try {
        const companyId = await ensureAuth()
        if (!companyId) return { wbp: 0, quotations: 0, invoices: 0, projects: 0 }

        // 1. WB&P: Count items in DRAFT status
        let wbpCount = 0;
        try {
            wbpCount = await (prisma as any).workBreakdownPricing?.count({
                where: { status: 'DRAFT', companyId }
            }) || 0
        } catch (e) {
            console.error("Sidebar count error (WBP):", e);
        }

        // 2. Quotations: Count QUOTE type items that are DRAFT
        let quoteCount = 0;
        try {
            quoteCount = await (prisma as any).invoice?.count({
                where: { type: 'QUOTE', status: 'DRAFT', companyId }
            }) || 0
        } catch (e) {
            console.error("Sidebar count error (Quotes):", e);
        }

        // 3. Invoices: Count INVOICE type items that are UNPAID
        let invoiceCount = 0;
        try {
            invoiceCount = await (prisma as any).invoice?.count({
                where: {
                    type: 'INVOICE',
                    status: { in: ['DRAFT', 'SENT'] },
                    companyId
                }
            }) || 0
        } catch (e) {
            console.error("Sidebar count error (Invoices):", e);
        }

        // 4. Projects: Count projects in 'SOW' stage
        let projectCount = 0;
        try {
            projectCount = await (prisma as any).project?.count({
                where: { workflowStage: 'SOW', companyId }
            }) || 0
        } catch (e) {
            console.error("Sidebar count error (Projects):", e);
        }

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
