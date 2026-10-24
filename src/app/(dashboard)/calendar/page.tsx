import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CalendarView } from "@/components/calendar/CalendarView"
import { ensureAuth } from "@/lib/auth-actions"

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
    const companyId = await ensureAuth()

    const [meetings, projects, clients, prospects] = await Promise.all([
        prisma.meeting.findMany({
            where: { companyId },
            include: { client: true, project: true }
        }),
        prisma.project.findMany({
            where: { endDate: { not: null }, companyId },
            include: { client: true }
        }),
        prisma.client.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
            select: { id: true, name: true }
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
            }
        })
    ])

    // Include pipeline follow-up dates on calendar
    const prospectFollowups = prospects
        .filter(p => !meetings.some(m => m.title?.includes(p.name)))
        .map(p => ({
            id: `prospect-${p.id}`,
            title: `Follow-up: ${p.name}`,
            date: p.nextFollowupDate!,
            duration: 30,
            location: p.location || "Site / Phone",
            notes: `Sales Pipeline Prospect: ${p.name}. Status: ${p.status.toUpperCase()}. Contact: ${p.propertyManagerName || 'N/A'} (${p.propertyManagerPhone || 'N/A'})`,
            client: { name: p.name },
            isProspect: true
        }))

    const combinedMeetings = [...meetings, ...prospectFollowups]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Calendar</h1>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-50">Monitor site visits, meetings and scheduled follow-ups.</p>
            </div>

            <CalendarView meetings={combinedMeetings} projects={projects} clients={clients} />
        </div>
    )
}
