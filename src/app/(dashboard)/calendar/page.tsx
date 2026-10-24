import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ProjectCalendarView } from "@/components/projects/ProjectCalendarView"
import { ensureAuth } from "@/lib/auth-actions"

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
    const companyId = await ensureAuth()

    const [company, projects, quotes, prospects] = await Promise.all([
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
                        clientPoNumber: true,
                        reference: true
                    }
                }
            },
            orderBy: { startDate: 'asc' }
        }).catch(() => prisma.project.findMany({
            where: { companyId },
            include: {
                client: true,
                invoices: {
                    select: {
                        id: true,
                        total: true,
                        clientPoNumber: true,
                        reference: true
                    }
                }
            },
            orderBy: { startDate: 'asc' }
        })),
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

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
                    Flight Operations Calendar
                </h1>
                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-60">
                    Projected flight dates, recurring contract visits & sales follow-ups
                </p>
            </div>

            <ProjectCalendarView
                projects={projects}
                quotes={quotes}
                prospects={prospects}
                company={company}
            />
        </div>
    )
}
