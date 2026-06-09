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
            paidCount,
            transactions
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
                select: { 
                    total: true, 
                    payments: { select: { amount: true } }, 
                    quoteNumber: true, 
                    date: true, 
                    id: true, 
                    number: true, 
                    firstPaymentPercentage: true,
                    client: { select: { id: true, name: true } }
                }
            }),
            (prisma as any).scopeOfWork?.count({ where: { companyId } }) || 0,
            prisma.invoice.count({ where: { companyId, type: 'QUOTE' } }),
            prisma.invoice.count({ where: { companyId, type: 'INVOICE', status: { notIn: ['DRAFT', 'CANCELLED'] } } }),
            prisma.invoice.count({ where: { companyId, status: 'PAID' } }),
            prisma.transaction.findMany({
                where: { companyId },
                orderBy: { date: 'desc' }
            })
        ]);

        let unpaidTotal = 0;
        let unpaidInvoices: any[] = [];
        const clientOutstandingMap: Record<string, { clientId: string, clientName: string, outstanding: number, invoiceCount: number }> = {};
        
        (allUnpaidInvoices || []).forEach(inv => {
            const paid = (inv.payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
            const totalVal = inv.total || 0;
            if (paid < totalVal) {
                let balance = totalVal - paid;
                if (inv.firstPaymentPercentage && inv.firstPaymentPercentage > 0 && inv.firstPaymentPercentage < 100) {
                    const firstPaymentAmount = totalVal * (inv.firstPaymentPercentage / 100);
                    if (paid < firstPaymentAmount) {
                        balance = firstPaymentAmount - paid;
                    }
                }
                unpaidTotal += balance;
                unpaidInvoices.push({ ...inv, balance });

                // Accumulate per client
                const cId = inv.client?.id || "unknown";
                const cName = inv.client?.name || "Unknown Client";
                if (!clientOutstandingMap[cId]) {
                    clientOutstandingMap[cId] = {
                        clientId: cId,
                        clientName: cName,
                        outstanding: 0,
                        invoiceCount: 0
                    };
                }
                clientOutstandingMap[cId].outstanding += balance;
                clientOutstandingMap[cId].invoiceCount += 1;
            }
        });

        const clientOutstanding = Object.values(clientOutstandingMap).sort((a, b) => b.outstanding - a.outstanding);

        // Calculate Trend Data (last 6 months)
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const trendData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const m = d.getMonth();
            const y = d.getFullYear();

            const mIncome = (transactions || []).filter((t: any) => {
                const td = new Date(t.date);
                return td.getMonth() === m && td.getFullYear() === y && t.type === 'INCOME';
            }).reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);

            const mExpense = (transactions || []).filter((t: any) => {
                const td = new Date(t.date);
                return td.getMonth() === m && td.getFullYear() === y && t.type === 'EXPENSE';
            }).reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);

            trendData.push({ month: months[m], Income: mIncome, Expenses: mExpense, Profit: mIncome - mExpense });
        }

        // Serialize data for client component
        const dashboardData = JSON.parse(JSON.stringify({
            clientCount,
            invoiceCount,
            unpaidCount: unpaidInvoices.length,
            unpaidTotal,
            clientOutstanding,
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
            },
            trendData
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
