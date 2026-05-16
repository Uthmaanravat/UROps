import { prisma } from "@/lib/prisma";
import { ensureAuth } from "@/lib/auth-actions";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    try {
        const companyId = await ensureAuth();
        
        const [
            clientCount,
            invoiceCount,
            activeProjects,
            recentInvoices,
            upcomingMeetings,
            recentInteractions,
            pendingScopes,
            allUnpaidInvoices,
            sowCount,
            quoteCount,
            invoicedCount,
            paidCount
        ] = await Promise.all([
            prisma.client.count({ where: { companyId } }),
            prisma.invoice.count({ where: { companyId } }),
            prisma.project.findMany({
                where: {
                    companyId,
                    status: {
                        in: ['IN_PROGRESS', 'PLANNING', 'SCHEDULED', 'QUOTED', 'INVOICED', 'SOW_SUBMITTED']
                    }
                },
                include: { client: true },
                orderBy: { updatedAt: 'desc' },
                take: 5
            }),
            prisma.invoice.findMany({
                where: { companyId },
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { client: true }
            }),
            (prisma as any).meeting ? (prisma as any).meeting.findMany({
                where: { companyId, date: { gte: new Date() } },
                orderBy: { date: 'asc' },
                take: 5,
                include: { client: true }
            }) : Promise.resolve([]),
            (prisma as any).interaction ? (prisma as any).interaction.findMany({
                where: { companyId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { client: true }
            }) : Promise.resolve([]),
            prisma.invoice.findMany({
                where: { companyId, type: 'QUOTE', status: 'DRAFT' },
                include: { client: true, project: true },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.invoice.findMany({
                where: { companyId, type: 'INVOICE', status: { notIn: ['PAID', 'CANCELLED'] } },
                select: { total: true, payments: { select: { amount: true } }, quoteNumber: true, date: true, id: true, number: true }
            }),
            (prisma as any).scopeOfWork?.count({ where: { companyId } }) || 0,
            prisma.invoice.count({ where: { companyId, type: 'QUOTE' } }),
            prisma.invoice.count({ where: { companyId, type: 'INVOICE', status: { notIn: ['DRAFT', 'CANCELLED'] } } }),
            prisma.invoice.count({ where: { companyId, status: 'PAID' } })
        ]);

        let unpaidTotal = 0;
        let unpaidInvoices: any[] = [];
        
        (allUnpaidInvoices || []).forEach(inv => {
            const paid = (inv.payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
            if (paid < (inv.total || 0)) {
                const balance = (inv.total || 0) - paid;
                unpaidTotal += balance;
                unpaidInvoices.push({ ...inv, balance });
            }
        });

        // Serialize data for client component
        const dashboardData = JSON.parse(JSON.stringify({
            clientCount,
            invoiceCount,
            unpaidCount: unpaidInvoices.length,
            unpaidTotal,
            projectCount: activeProjects.length,
            activeProjects,
            recentInvoices,
            upcomingMeetings,
            recentInteractions,
            pendingScopes,
            unpaidInvoices: unpaidInvoices.slice(0, 5),
            trackingCounts: {
                sow: sowCount,
                quotation: quoteCount,
                invoice: invoicedCount,
                payment: paidCount
            }
        }));

        return <DashboardClient data={dashboardData} />;

    } catch (criticalError) {
        console.error("CRITICAL Dashboard Error:", criticalError);
        return (
            <div className="p-8 text-center bg-[#14141E] rounded-3xl border border-red-500/20 shadow-2xl">
                <h1 className="text-2xl font-black text-red-500 mb-2 uppercase tracking-tight">System Initialization Error</h1>
                <p className="text-muted-foreground mb-6 font-medium">Failed to establish connection with the Command Center.</p>
                <div className="text-[10px] text-red-500/30 mb-6 font-mono break-all line-clamp-2">
                    {String(criticalError)}
                </div>
                <a href="/dashboard" className="inline-flex items-center px-6 py-3 bg-white text-black font-black uppercase text-xs rounded-xl hover:bg-gray-200 transition-all">
                    Retry Synchronization
                </a>
            </div>
        );
    }
}
