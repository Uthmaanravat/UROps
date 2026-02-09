import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ClientStatementButton } from "@/components/clients/ClientStatementButton";
import { DeleteClientButton } from "@/components/clients/DeleteClientButton";
import { InteractionList } from "@/components/clients/InteractionList";
import { ActivityTimeline } from "@/components/clients/ActivityTimeline";
import { notFound } from "next/navigation";
import { ensureAuth } from "@/lib/auth-actions";

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: { id: string } }) {
    const companyId = await ensureAuth();
    const client = await prisma.client.findUnique({
        where: { id: params.id, companyId },
        include: {
            projects: {
                orderBy: { updatedAt: 'desc' }
            },
            invoices: {
                include: { payments: true, project: true },
                orderBy: { date: 'desc' }
            },
            interactions: {
                orderBy: { date: 'desc' }
            }
        }
    });

    if (!client) notFound();

    const settings = await prisma.companySettings.findUnique({
        where: { companyId }
    });

    const totalInvoiced = client.invoices.filter((i: any) => i.type === 'INVOICE').reduce((acc: number, i: any) => acc + i.total, 0);
    const totalPaid = client.invoices.reduce((acc: number, i: any) => acc + i.payments.reduce((pAcc: number, p: any) => pAcc + p.amount, 0), 0);
    const outstanding = totalInvoiced - totalPaid;

    // Combine activities
    const activities = [
        ...client.projects.map((p: any) => ({
            id: p.id,
            type: 'PROJECT',
            date: new Date(p.updatedAt),
            title: p.name,
            status: p.status,
            description: p.description
        })),
        ...client.invoices.map((i: any) => ({
            id: i.id,
            type: 'INVOICE',
            date: new Date(i.date),
            title: `${i.type} #${i.number}`,
            status: i.status,
            amount: i.total
        })),
        ...client.interactions.map((i: any) => ({
            id: i.id,
            type: 'INTERACTION',
            date: new Date(i.date),
            title: i.type,
            description: i.content,
            read: i.read
        }))
    ].sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

    // Also flatten payments
    client.invoices.forEach((inv: any) => {
        inv.payments.forEach((pay: any) => {
            activities.push({
                id: pay.id,
                type: 'PAYMENT',
                date: new Date(pay.date),
                title: `Payment for #${inv.number}`,
                amount: pay.amount,
                description: pay.method,
                read: true, // Auto-read for payments
                status: "COMPLETED"
            })
        })
    })

    // Re-sort after adding payments
    activities.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/clients">
                        <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {client.companyName || client.name}
                        </h1>
                        <div className="text-muted-foreground text-sm flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            {client.attentionTo && <span>Attn: {client.attentionTo}</span>}
                            {client.email && <span>{client.email}</span>}
                            {client.phone && <span>• {client.phone}</span>}
                            {client.vatNumber && <span>• VAT: {client.vatNumber}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <ClientStatementButton client={client} settings={settings} />
                    <Link href={`/clients/${client.id}/edit`}>
                        <Button variant="outline">
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                        </Button>
                    </Link>
                    <DeleteClientButton clientId={client.id} clientName={client.name} />
                    <Link href={`/invoices/new?clientId=${client.id}`}>
                        <Button>Create Quote</Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-card p-6">
                    <div className="text-sm font-medium text-muted-foreground">Total Invoiced</div>
                    <div className="text-2xl font-bold">{formatCurrency(totalInvoiced)}</div>
                </div>
                <div className="rounded-lg border bg-card p-6">
                    <div className="text-sm font-medium text-muted-foreground">Total Paid</div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                </div>
                <div className="rounded-lg border bg-card p-6">
                    <div className="text-sm font-medium text-muted-foreground">Outstanding Balance</div>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(outstanding)}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-md border bg-card">
                    <div className="p-4 font-semibold border-b">History</div>
                    {/* Re-using existing table structure or could simplify */}
                    <div className="relative w-full overflow-auto max-h-[500px]">
                        <table className="w-full text-sm text-left">
                            <thead className="[&_tr]:border-b sticky top-0 bg-card z-10">
                                <tr className="border-b transition-colors hover:bg-muted/50">
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Date</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Number</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Total</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {client.invoices.map((invoice: any) => (
                                    <tr key={invoice.id} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle">{new Date(invoice.date).toLocaleDateString()}</td>
                                        <td className="p-4 align-middle">#{invoice.number} <br /><span className="text-xs text-muted-foreground">{invoice.type}</span></td>
                                        <td className="p-4 align-middle font-medium">{formatCurrency(invoice.total)}</td>
                                        <td className="p-4 align-middle text-right">
                                            <Link href={`/invoices/${invoice.id}`}>
                                                <Button variant="ghost" size="sm">View</Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* CRM Section: Updated to Activity Timeline */}
                <div>
                    {/* @ts-ignore */}
                    <ActivityTimeline activities={activities as any} />
                </div>
            </div>
        </div>
    )
}
