import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ProjectCalendarView } from "@/components/projects/ProjectCalendarView"
import { ensureAuth } from "@/lib/auth-actions"
import {
    enrichAeroWashProjectsWithWeather,
    checkAndNotifyTomorrowRedWeatherAlerts,
    isAeroWashCompany
} from "@/lib/weather-alerts"
import { ShieldAlert, Settings2 } from "lucide-react"
import { UNCONFIGURED_WEATHER_PROMPT } from "@/lib/weather"

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
    const companyId = await ensureAuth()

    const [company, rawProjects, quotes, prospects] = await Promise.all([
        prisma.company.findUnique({
            where: { id: companyId },
            include: { settings: true }
        }),
        prisma.project.findMany({
            where: { companyId },
            include: {
                client: true,
                invoices: {
                    select: {
                        id: true,
                        total: true,
                        site: true,
                        clientPoNumber: true,
                        reference: true
                    }
                }
            },
            orderBy: { startDate: 'asc' }
        }),
        prisma.invoice.findMany({
            where: { companyId, type: 'QUOTE' },
            select: {
                id: true,
                quoteNumber: true,
                total: true,
                date: true,
                client: { select: { name: true } }
            },
            orderBy: { date: 'asc' }
        }),
        prisma.prospect.findMany({
            where: { companyId, nextFollowupDate: { not: null } },
            select: {
                id: true,
                name: true,
                location: true,
                nextFollowupDate: true,
                status: true,
                propertyManagerName: true,
                propertyManagerPhone: true
            },
            orderBy: { nextFollowupDate: 'asc' }
        })
    ])

    const isAeroWash = Boolean(
        isAeroWashCompany(companyId, company?.settings) ||
        company?.name?.toLowerCase().includes('aerowash') ||
        (company?.settings as any)?.droneOperationsEnabled
    )

    const projects = isAeroWash
        ? await enrichAeroWashProjectsWithWeather(rawProjects, company?.settings as any, companyId)
        : rawProjects

    const tomorrowRedAlerts = isAeroWash
        ? await checkAndNotifyTomorrowRedWeatherAlerts(companyId)
        : []

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
                    {isAeroWash ? "Flight Operations Calendar" : "Operations Calendar"}
                </h1>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-60">
                    {isAeroWash
                        ? "Projected flight dates, recurring contract visits & sales follow-ups"
                        : "Projected site dates, recurring contract visits & sales follow-ups"}
                </p>
            </div>

            {isAeroWash && !company?.settings?.weatherLimitsConfigured && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                    <div className="flex items-center gap-2.5 font-semibold">
                        <Settings2 className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>{UNCONFIGURED_WEATHER_PROMPT}</span>
                    </div>
                    <Link
                        href="/settings"
                        className="rounded-lg bg-amber-500/20 px-3 py-1.5 font-black uppercase tracking-wider text-amber-200 hover:bg-amber-500/30 transition-colors"
                    >
                        Configure Limits →
                    </Link>
                </div>
            )}

            {tomorrowRedAlerts.length > 0 && (
                <div className="rounded-2xl border border-red-500/50 bg-red-950/40 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-300 font-black text-xs uppercase tracking-wider">
                        <ShieldAlert className="h-4 w-4 text-red-400" />
                        Day-Before NO-FLY Weather Alert ({tomorrowRedAlerts.length} job{tomorrowRedAlerts.length === 1 ? '' : 's'} tomorrow)
                    </div>
                    {tomorrowRedAlerts.map(a => (
                        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-red-100 bg-black/30 rounded-xl px-3 py-2">
                            <span>
                                <strong>{a.name}</strong> ({a.clientName}) — {a.reasons.join(' · ')}
                            </span>
                            <Link href={`/my-jobs/${a.id}`} className="font-bold text-primary underline">
                                Open Job Sheet / Reschedule →
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            <ProjectCalendarView
                projects={projects}
                quotes={quotes}
                prospects={prospects}
                company={company}
            />
        </div>
    )
}
