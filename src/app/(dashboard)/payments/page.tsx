import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { ensureAuth } from "@/lib/auth-actions";
import { WhoOwesMe } from "@/components/payments/WhoOwesMe";

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
    const companyId = await ensureAuth();
    let payments: any[] = [];
    let openInvoices: any[] = [];
    let companySettings: any = null;

    try {
        const [payRes, invRes, setRes] = await Promise.all([
            prisma.payment.findMany({
                where: { companyId },
                include: {
                    invoice: {
                        include: { client: true }
                    }
                },
                orderBy: { date: 'desc' }
            }),
            prisma.invoice.findMany({
                where: {
                    companyId,
                    type: 'INVOICE',
                    status: { in: ['SENT', 'PARTIAL', 'DRAFT'] }
                },
                include: {
                    client: true,
                    payments: true
                },
                orderBy: { date: 'asc' }
            }),
            prisma.companySettings.findUnique({
                where: { companyId }
            })
        ]);
        payments = payRes;
        openInvoices = invRes;
        companySettings = setRes;
    } catch (e) {
        console.error("Payments DB Error:", e);
    }

    const now = new Date();
    const debtors = openInvoices.map(inv => {
        const totalPaid = inv.payments.reduce((s: number, p: any) => s + p.amount, 0);
        const balanceDue = Math.max(0, inv.total - totalPaid);
        const dueDate = inv.dueDate || new Date(new Date(inv.date).getTime() + 30 * 24 * 60 * 60 * 1000);
        const diffMs = now.getTime() - new Date(dueDate).getTime();
        const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        return {
            id: inv.id,
            quoteNumber: inv.quoteNumber,
            number: inv.number,
            date: inv.date,
            dueDate: inv.dueDate,
            total: inv.total,
            balanceDue,
            daysOverdue,
            client: inv.client,
            lastReminderSentAt: (inv.metadata as any)?.lastReminderSentAt || null
        };
    }).filter(inv => inv.balanceDue > 0);

    const totalRevenue = payments.reduce((acc, p) => acc + p.amount, 0);
    const currency = companySettings?.currency || "R";

    return (
        <div className="space-y-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">Payments &amp; Collections</h1>
                    <p className="text-muted-foreground text-sm">
                        Track customer outstanding balances, send automated overdue reminders, and record payments.
                    </p>
                </div>
                <div className="text-sm font-semibold bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                    Total Revenue Collected: <span className="text-emerald-400 font-bold font-mono">{formatCurrency(totalRevenue, currency)}</span>
                </div>
            </div>

            {/* Who Owes Me Outstanding Collections */}
            <WhoOwesMe invoices={debtors} currencySymbol={currency} />

            {/* Historical Payments Ledger */}
            <div className="space-y-4">
                <h3 className="text-base font-extrabold text-white tracking-wide uppercase text-xs text-gray-400">
                    Payment Receipts History
                </h3>
                <div className="rounded-2xl border border-white/10 bg-[#0F172A] overflow-hidden shadow-xl">
                    <div className="w-full overflow-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="border-b border-white/10 bg-white/[0.02]">
                                <tr>
                                    <th className="h-10 px-4 font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="h-10 px-4 font-bold text-gray-400 uppercase tracking-wider">Client</th>
                                    <th className="h-10 px-4 font-bold text-gray-400 uppercase tracking-wider">Invoice</th>
                                    <th className="h-10 px-4 font-bold text-gray-400 uppercase tracking-wider">Method</th>
                                    <th className="h-10 px-4 font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {payments.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="h-24 text-center text-gray-500">No payment transactions recorded yet.</td>
                                    </tr>
                                ) : payments.map(payment => (
                                    <tr key={payment.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 text-gray-300">{new Date(payment.date).toLocaleDateString()}</td>
                                        <td className="p-4 font-bold text-white">{payment.invoice.client.name}</td>
                                        <td className="p-4 font-mono text-primary">{payment.invoice.quoteNumber || `INV-${payment.invoice.number}`}</td>
                                        <td className="p-4 text-gray-400">{payment.method || 'EFT'}</td>
                                        <td className="p-4 text-right font-mono font-bold text-emerald-400">{formatCurrency(payment.amount, currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
