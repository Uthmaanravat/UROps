import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, ArrowUpRight, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ClientStatementButton } from "@/components/clients/ClientStatementButton";
import { DeleteClientButton } from "@/components/clients/DeleteClientButton";
import { InteractionList } from "@/components/clients/InteractionList";
import { ActivityTimeline } from "@/components/clients/ActivityTimeline";
import { ClientContactsList } from "@/components/clients/ClientContactsList";
import { notFound } from "next/navigation";
import { ensureAuth } from "@/lib/auth-actions";

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: { id: string } }) {
    const companyId = await ensureAuth();
    const client = await prisma.client.findUnique({
        where: { id: params.id, companyId },
        include: {
            projects: {
                include: {
                    recurringVisits: {
                        orderBy: { startDate: 'asc' }
                    },
                    invoices: {
                        select: { total: true }
                    }
                },
                orderBy: { updatedAt: 'desc' }
            },
            invoices: {
                include: { payments: true, project: true },
                orderBy: { date: 'desc' }
            },
            interactions: {
                orderBy: { date: 'desc' }
            },
            statements: {
                orderBy: { date: 'desc' }
            },
            contacts: {
                orderBy: { name: 'asc' }
            }
        }
    });

    if (!client) notFound();

    const settings = await prisma.companySettings.findUnique({
        where: { companyId }
    });

    const totalInvoiced = client.invoices.filter((i: any) => i.type === 'INVOICE').reduce((acc: number, i: any) => acc + i.total, 0);
    const totalPaid = client.invoices.reduce((acc: number, i: any) => acc + i.payments.reduce((pAcc: number, p: any) => pAcc + p.amount, 0), 0);
    const outstanding = client.invoices
        .filter((i: any) => i.type === 'INVOICE' && i.status !== 'CANCELLED')
        .reduce((acc: number, i: any) => {
            const paid = i.payments.reduce((pAcc: number, p: any) => pAcc + p.amount, 0);
            let balance = i.total - paid;
            if (i.firstPaymentPercentage && i.firstPaymentPercentage > 0 && i.firstPaymentPercentage < 100) {
                const firstPaymentAmount = i.total * (i.firstPaymentPercentage / 100);
                if (paid < firstPaymentAmount) {
                    balance = firstPaymentAmount - paid;
                }
            }
            return acc + balance;
        }, 0);

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
            title: `${i.type} ${i.quoteNumber || (i.type === 'QUOTE' ? `Q-${new Date(i.date).getFullYear()}-${String(i.number).padStart(3, '0')}` : `INV-${new Date(i.date).getFullYear()}-${String(i.number).padStart(3, '0')}`)}`,
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
        })),
        ...client.statements.map((s: any) => ({
            id: s.id,
            type: 'STATEMENT',
            date: new Date(s.date),
            title: s.statementNumber || `Statement #${s.number}`,
            amount: s.totalDue,
            status: "SENT"
        }))
    ].sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

    // Also flatten payments
    client.invoices.forEach((inv: any) => {
        inv.payments.forEach((pay: any) => {
            activities.push({
                id: pay.id,
                type: 'PAYMENT',
                date: new Date(pay.date),
                title: `Payment for ${inv.quoteNumber || `INV-${new Date(inv.date).getFullYear()}-${String(inv.number).padStart(3, '0')}`}`,
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

            {/* Active Service Contracts Section */}
            <div className="rounded-2xl border border-white/10 bg-[#14141E] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Repeat className="h-5 w-5 text-teal-400" />
                        <h2 className="text-base font-black uppercase text-white tracking-tight">Active Service Contracts</h2>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {client.projects.filter((p: any) => p.isRecurring || p.parentProjectId).length} contracts on file
                    </span>
                </div>

                {client.projects.filter((p: any) => p.isRecurring).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">
                        No recurring contracts active for this client.
                    </p>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {client.projects.filter((p: any) => p.isRecurring).map((contract: any) => {
                            const rule = (contract.recurrenceRule as any) || {}
                            const freqLabel = rule.frequency ? rule.frequency.replace(/_/g, " ") : "Recurring"
                            const nextVisit = contract.recurringVisits?.find((v: any) => v.startDate && new Date(v.startDate) >= new Date())?.startDate
                            const visitValue = contract.invoices?.[0]?.total || 0
                            const yearlyMultiplier = 
                                rule.frequency === 'MONTHLY' ? 12 :
                                rule.frequency === 'EVERY_2_MONTHS' ? 6 :
                                rule.frequency === 'QUARTERLY' ? 4 :
                                rule.frequency === 'TWICE_A_YEAR' ? 2 :
                                rule.frequency === 'YEARLY' ? 1 :
                                rule.frequency === 'EVERY_2_YEARS' ? 0.5 : 1
                            const yearlyValue = visitValue * yearlyMultiplier

                            return (
                                <div key={contract.id} className="p-4 rounded-xl border border-teal-500/30 bg-teal-500/5 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-white truncate">{contract.name}</span>
                                        <Badge className="bg-teal-950 text-teal-300 border-teal-800 text-[10px] uppercase font-bold">
                                            {freqLabel}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-zinc-400">
                                        Next Visit: <strong className="text-white">{nextVisit ? new Date(nextVisit).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "Scheduled"}</strong>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                                        <span className="text-zinc-500">Value / Year:</span>
                                        <span className="font-mono font-bold text-emerald-400">
                                            {yearlyValue > 0 ? formatCurrency(yearlyValue) : "—"}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <ClientContactsList clientId={client.id} initialContacts={client.contacts as any} />

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
                                        <td className="p-4 align-middle">{invoice.quoteNumber || (invoice.type === 'QUOTE' ? `Q-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}` : `INV-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`)} <br /><span className="text-xs text-muted-foreground">{invoice.type}</span></td>
                                        <td className="p-4 align-middle font-medium">{formatCurrency(invoice.total)}</td>
                                        <td className="p-4 align-middle text-right">
                                            <Link href={`/invoices/${invoice.id}`}>
                                                <Button variant="ghost" size="sm">View</Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {client.statements.map((statement: any) => (
                                    <tr key={statement.id} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle">{new Date(statement.date).toLocaleDateString()}</td>
                                        <td className="p-4 align-middle">{statement.statementNumber || `STM-${new Date(statement.date).getFullYear()}-${String(statement.number).padStart(3, '0')}`} <br /><span className="text-xs text-muted-foreground">STATEMENT</span></td>
                                        <td className="p-4 align-middle font-medium">{formatCurrency(statement.totalDue)}</td>
                                        <td className="p-4 align-middle text-right">
                                            {/* Could add a view button for statement if we have a viewer, else just list it */}
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
