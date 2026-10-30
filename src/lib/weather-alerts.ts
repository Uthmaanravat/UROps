import { prisma } from "@/lib/prisma"
import {
    resolveSiteCoordinates,
    getOpenMeteoMultiDayForecast,
    evaluateFlightWeatherStatus,
    type FlightWeatherLimits,
    type EvaluatedFlightWeather
} from "@/lib/weather"
import { sendRealEmail } from "@/lib/email"

export function isAeroWashCompany(companyId?: string | null, settings?: any): boolean {
    if (!companyId) return false
    return (
        companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' ||
        settings?.theme === 'dark-orange' ||
        settings?.layoutPreferences?.dashboardView === 'drone'
    )
}

/**
 * Batch-enriches AeroWash projects with `flightWeather` (de-duplicated by lat/lon so N jobs make ~1-3 HTTP calls).
 */
export async function enrichAeroWashProjectsWithWeather<T extends Record<string, any>>(
    projects: T[],
    settings?: (FlightWeatherLimits & Record<string, any>) | null,
    companyId?: string | null
): Promise<Array<T & { flightWeather?: EvaluatedFlightWeather | null }>> {
    if (!projects || projects.length === 0) return []
    const effectiveCompanyId = companyId || settings?.companyId || projects[0]?.companyId
    if (!isAeroWashCompany(effectiveCompanyId, settings)) {
        return projects
    }

    const now = new Date()
    const minWindow = new Date(now.getTime() - 2 * 86400 * 1000)
    const maxWindow = new Date(now.getTime() + 16 * 86400 * 1000)

    // Group coordinate resolutions by site string
    const coordCache = new Map<string, { lat: number; lon: number; label: string }>()
    const forecastCache = new Map<string, Record<string, any>>()

    const enriched: Array<T & { flightWeather?: EvaluatedFlightWeather | null }> = []

    for (const p of projects) {
        if (!p.startDate || p.status === 'COMPLETED' || p.status === 'CANCELLED' || p.status === 'PAID') {
            enriched.push({ ...p, flightWeather: null })
            continue
        }
        const start = new Date(p.startDate)
        if (isNaN(start.getTime()) || start < minWindow || start > maxWindow) {
            enriched.push({ ...p, flightWeather: null })
            continue
        }

        const dateStr = start.toISOString().split('T')[0]
        const siteStr =
            p.invoices?.[0]?.site ||
            (p as any).site ||
            p.client?.address ||
            p.name ||
            'Cape Town'

        let coords = coordCache.get(siteStr)
        if (!coords) {
            coords = await resolveSiteCoordinates(siteStr, (p.jobSpecs as any)?.coordinates)
            coordCache.set(siteStr, coords)
        }

        const coordKey = `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`
        let multiDay = forecastCache.get(coordKey)
        if (!multiDay) {
            multiDay = await getOpenMeteoMultiDayForecast(coords.lat, coords.lon, coords.label)
            forecastCache.set(coordKey, multiDay)
        }

        const dayForecast = multiDay[dateStr] || null
        const evaluated = evaluateFlightWeatherStatus(dayForecast, settings)
        enriched.push({ ...p, flightWeather: evaluated })
    }

    return enriched
}

/**
 * Checks tomorrow's scheduled AeroWash jobs. If any job has a RED (NO_FLY) forecast,
 * sends a day-before notification email (once per job+date) and returns active red alerts.
 */
export async function checkAndNotifyTomorrowRedWeatherAlerts(companyId: string) {
    try {
        const settings = await prisma.companySettings.findUnique({ where: { companyId } })
        if (!isAeroWashCompany(companyId, settings)) return []
        if (!settings?.weatherLimitsConfigured) return []

        // Tomorrow in Africa/Johannesburg (UTC+2)
        const nowSast = new Date(Date.now() + 2 * 3600 * 1000)
        const tomorrowSast = new Date(nowSast)
        tomorrowSast.setUTCDate(tomorrowSast.getUTCDate() + 1)
        const tomorrowStr = tomorrowSast.toISOString().split('T')[0]

        const rangeStart = new Date(`${tomorrowStr}T00:00:00.000+02:00`)
        const rangeEnd = new Date(`${tomorrowStr}T23:59:59.999+02:00`)

        const tomorrowProjects = await prisma.project.findMany({
            where: {
                companyId,
                startDate: { gte: rangeStart, lte: rangeEnd },
                status: { in: ['SCHEDULED', 'PLANNING', 'IN_PROGRESS'] as any }
            },
            include: {
                client: true,
                invoices: {
                    select: { site: true, clientPoNumber: true, quoteNumber: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        })

        if (tomorrowProjects.length === 0) return []

        const enriched = await enrichAeroWashProjectsWithWeather(tomorrowProjects, settings, companyId)
        const redJobs = enriched.filter(p => p.flightWeather?.status === 'NO_FLY')

        if (redJobs.length === 0) return []

        // Resolve real owner/admin notification recipients (never invent admin@)
        const owners = await prisma.user.findMany({
            where: {
                companyId,
                OR: [{ isOwner: true }, { role: 'ADMIN' }]
            },
            select: { email: true, notificationEmail: true }
        })

        const recipients = Array.from(
            new Set([
                ...owners.map(u => (u.notificationEmail || u.email || '').trim()).filter(Boolean),
                ...(settings.copyNotificationsTo ? [settings.copyNotificationsTo.trim()] : [])
            ])
        )

        const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app'

        for (const job of redJobs) {
            const specs = ((job.jobSpecs as any) || {})
            if (specs.redAlertSentForDate === tomorrowStr) continue

            const fw = job.flightWeather!
            const f = fw.forecast!

            if (recipients.length > 0) {
                await sendRealEmail({
                    to: recipients,
                    from: 'AeroWash Flight Ops <info@aerowash.co.za>',
                    replyTo: 'info@aerowash.co.za',
                    subject: `NO-FLY Weather Alert for Tomorrow (${tomorrowStr}): ${job.name}`,
                    body:
                        `AeroWash Day-Before Weather Alert\n\n` +
                        `Job: ${job.name}\n` +
                        `Client: ${job.client?.name || 'Client'}\n` +
                        `Scheduled Date: ${tomorrowStr}\n` +
                        `Forecast (${f.locationLabel}): Wind ${f.windSpeedKmh} km/h, Gusts ${f.windGustsKmh} km/h, Rain ${f.rainMm} mm\n` +
                        `Triggered Limits: ${fw.reasons.join(' | ')}\n\n` +
                        `Open job sheet to reschedule at no charge (per weather term):\n` +
                        `${appUrl}/my-jobs/${job.id}\n`
                }).catch(err => console.warn("Weather alert email failed:", err))
            }

            await prisma.project.update({
                where: { id: job.id },
                data: {
                    jobSpecs: {
                        ...specs,
                        redAlertSentForDate: tomorrowStr
                    }
                }
            }).catch(() => null)
        }

        return redJobs.map(j => ({
            id: j.id,
            name: j.name,
            clientName: j.client?.name || 'Client',
            date: tomorrowStr,
            reasons: j.flightWeather?.reasons || [],
            windSpeedKmh: j.flightWeather?.forecast?.windSpeedKmh,
            windGustsKmh: j.flightWeather?.forecast?.windGustsKmh,
            rainMm: j.flightWeather?.forecast?.rainMm
        }))
    } catch (err) {
        console.warn("checkAndNotifyTomorrowRedWeatherAlerts error:", err)
        return []
    }
}
