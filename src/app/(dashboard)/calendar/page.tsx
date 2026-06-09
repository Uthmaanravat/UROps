import { prisma } from "@/lib/prisma"
import { CalendarView } from "@/components/calendar/CalendarView"
import { ensureAuth } from "@/lib/auth-actions"

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
    const companyId = await ensureAuth()

    const [meetings, projects, clients] = await Promise.all([
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
        })
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
                <p className="text-muted-foreground">Monitor meetings and project timelines.</p>
            </div>

            <CalendarView meetings={meetings} projects={projects} clients={clients} />
        </div>
    )
}

