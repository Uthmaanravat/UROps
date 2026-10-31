import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAndNotifyCompanyComplianceAlerts } from "@/lib/compliance-alerts"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    try {
        const cronSecret = process.env.CRON_SECRET
        if (cronSecret) {
            const authHeader = request.headers.get("authorization")
            if (authHeader !== `Bearer ${cronSecret}`) {
                return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
            }
        }

        const companies = await prisma.company.findMany({
            select: { id: true },
        })

        const results: Record<string, any> = {}
        for (const c of companies) {
            const res = await checkAndNotifyCompanyComplianceAlerts(c.id)
            if (res && (res.documentAlertsTriggered > 0 || res.emailsDispatchedTo.length > 0)) {
                results[c.id] = res
            }
        }

        return NextResponse.json({ ok: true, results })
    } catch (e: any) {
        console.error("[Cron Compliance Alerts] Error:", e)
        return NextResponse.json({ ok: false, error: e.message || "Cron failed" }, { status: 500 })
    }
}
