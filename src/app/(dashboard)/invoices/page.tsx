import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { InvoiceFilters } from "@/components/invoices/InvoiceFilters";
import { deleteInvoiceAction } from "./actions";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { ensureAuth } from "@/lib/auth-actions";

export const dynamic = 'force-dynamic';

export default async function InvoicesPage({
    searchParams
}: {
    searchParams: { q?: string; status?: string; type?: string }
}) {
    const companyId = await ensureAuth();
    const query = searchParams.q || "";
    const statusFilter = searchParams.status || "";
    const typeFilter = searchParams.type || "";
    let invoices: any[] = [];

    try {
        const statusExcludedByDefault = !statusFilter;

        invoices = await prisma.invoice.findMany({
            where: {
                companyId,
                AND: [
                    query ? {
                        OR: [
                            // If query is a number, search by invoice number
                            ...(isNaN(parseInt(query)) ? [] : [{ number: parseInt(query) }]),
                            { client: { name: { contains: query, mode: 'insensitive' as const } } }
                        ]
                    } : {},
                    statusFilter
                        ? { status: statusFilter as 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'INVOICED' | 'PAID' | 'PARTIAL' | 'CANCELLED' }
                        : { status: { notIn: ['PAID', 'CANCELLED'] as const } },
                    typeFilter ? { type: typeFilter as 'INVOICE' | 'QUOTE' } : {}
                ]
            },
            orderBy: { date: 'desc' },
            include: { client: true, payments: true, project: true } as any,
            take: 50
        });
    } catch (e) {
        console.error("Invoices DB Error:", e);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">
                    {typeFilter === 'QUOTE' ? 'Quotations' : typeFilter === 'INVOICE' ? 'Invoices' : 'Quotes & Invoices'}
                </h1>
                <Link href={typeFilter === 'INVOICE' ? '/invoices/new?type=INVOICE' : '/invoices/new'}>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> {typeFilter === 'INVOICE' ? 'New Invoice' : 'New Quote'}
                    </Button>
                </Link>
            </div>

            <div className="flex items-center justify-between gap-4">
                <SearchInput placeholder="Search by number or client..." />
                <InvoiceFilters />
            </div>

            <div className="rounded-md border bg-card">
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left min-w-[800px]">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50">
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Number</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Client</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Project</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Type</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Date</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Total</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Paid</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground"></th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="h-24 text-center text-muted-foreground">
                                        {query || statusFilter || typeFilter ? "No matching invoices found." : "No invoices yet."}
                                    </td>
                                </tr>
                            ) : invoices.map(invoice => {
                                const paid = invoice.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                                const isPaid = paid >= invoice.total;

                                return (
                                    <tr key={invoice.id} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle font-black">
                                            <div className="flex flex-col">
                                                <span>{invoice.quoteNumber || `#${invoice.number}`}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle">{invoice.client?.name}</td>
                                        <td className="p-4 align-middle">
                                            {invoice.project ? (
                                                <Link href={`/projects/${invoice.projectId}`} className="text-blue-600 hover:underline">
                                                    {invoice.project.name}
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground italic">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                                invoice.type === 'QUOTE'
                                                    ? "bg-blue-500/10 text-blue-500"
                                                    : "bg-green-500/10 text-green-500"
                                            )}>
                                                {invoice.type}
                                            </span>
                                        </td>
                                        <td className="p-4 align-middle">
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                                isPaid ? "bg-green-500/10 text-green-500" :
                                                    invoice.status === 'DRAFT' ? "bg-gray-500/10 text-gray-500" :
                                                        "bg-yellow-500/10 text-yellow-500"
                                            )}>
                                                {isPaid ? "PAID" : invoice.status}
                                            </span>
                                        </td>
                                        <td className="p-4 align-middle">{new Date(invoice.date).toLocaleDateString()}</td>
                                        <td className="p-4 align-middle text-right font-medium">{formatCurrency(invoice.total)}</td>
                                        <td className="p-4 align-middle text-right text-green-500">{formatCurrency(paid)}</td>
                                        <td className="p-4 align-middle text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/invoices/${invoice.id}`}>
                                                    <Button variant="ghost" size="sm">View</Button>
                                                </Link>
                                                <DeleteButton
                                                    id={invoice.id}
                                                    action={deleteInvoiceAction}
                                                    confirmText={`Are you sure you want to delete this ${invoice.type.toLowerCase()}?`}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
