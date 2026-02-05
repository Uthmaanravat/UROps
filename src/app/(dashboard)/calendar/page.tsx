import { prisma } from "@/lib/prisma"
import { CalendarView } from "@/components/calendar/CalendarView"

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
    const [meetings, projects, clients] = await Promise.all([
        (prisma as any).meeting.findMany({
            include: { client: true, project: true }
        }),
        (prisma as any).project.findMany({
            where: { endDate: { not: null } },
            include: { client: true }
        }),
        prisma.client.findMany({
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
