'use server'
import { rejectQuoteAction } from "@/app/(dashboard)/invoices/pricing-actions"

export async function dashboardRejectAction(id: string) {
    await rejectQuoteAction(id)
}
