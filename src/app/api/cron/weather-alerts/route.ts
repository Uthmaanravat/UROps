import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAndNotifyTomorrowRedWeatherAlerts } from "@/lib/weather-alerts"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const companies = await prisma.company.findMany({
            select: { id: true }
        })
        const results: Record<string, any> = {}
        for (const c of companies) {
            const alerts = await checkAndNotifyTomorrowRedWeatherAlerts(c.id)
            if (alerts.length > 0) {
                results[c.id] = alerts
            }
        }
        return NextResponse.json({ ok: true, alertsSent: results })
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
    }
}
