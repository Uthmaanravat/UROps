import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
    let payments: any[] = [];
    try {
        payments = await prisma.payment.findMany({
            include: {
                invoice: {
                    include: { client: true }
                }
            },
            orderBy: { date: 'desc' }
        });
    } catch (e) {
        console.error("Payments DB Error:", e);
    }

    const totalRevenue = payments.reduce((acc, p) => acc + p.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Payments History</h1>
                <div className="text-lg font-medium">
                    Total Revenue: <span className="text-green-600">{formatCurrency(totalRevenue)}</span>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <div className="w-full overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50">
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Date</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Client</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Invoice</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Method</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="h-24 text-center">No payments recorded.</td>
                                </tr>
                            ) : payments.map(payment => (
                                <tr key={payment.id} className="border-b transition-colors hover:bg-muted/50">
                                    <td className="p-4 align-middle">{new Date(payment.date).toLocaleDateString()}</td>
                                    <td className="p-4 align-middle">{payment.invoice.client.name}</td>
                                    <td className="p-4 align-middle">{payment.invoice.quoteNumber || `INV-${new Date(payment.invoice.date).getFullYear()}-${String(payment.invoice.number).padStart(3, '0')}`}</td>
                                    <td className="p-4 align-middle">{payment.method || 'Unknown'}</td>
                                    <td className="p-4 align-middle text-right font-medium">{formatCurrency(payment.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
