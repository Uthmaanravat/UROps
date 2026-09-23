import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, ArrowUpRight } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { InvoiceFilters } from "@/components/invoices/InvoiceFilters";
import { deleteInvoiceAction } from "./actions";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { ensureAuth } from "@/lib/auth-actions";
import { DraftResumeBanner } from "@/components/drafts/DraftResumeBanner";

export const dynamic = 'force-dynamic';

export default async function InvoicesPage({
    searchParams
}: {
    searchParams: { q?: string; status?: string; type?: string; clientId?: string; commercialStatus?: string; sort?: string }
}) {
    const companyId = await ensureAuth();
    const query = searchParams.q || "";
    const statusFilter = searchParams.status || "";
    const typeFilter = searchParams.type || "";
    const clientIdFilter = searchParams.clientId || "";
    const commercialStatusFilter = searchParams.commercialStatus || "";
    const sortParam = searchParams.sort || "date_desc";
    let invoices: any[] = [];
    let clients: { id: string; name: string }[] = [];

    try {
        // Fetch client list for filter options
        clients = await prisma.client.findMany({
            where: { companyId },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });

        const statusPrismaCondition = () => {
            if (statusFilter === 'UNINVOICED') {
                return { status: { notIn: ['INVOICED', 'CANCELLED'] as const } };
            }
            if (statusFilter === 'INVOICED') {
                return { status: 'INVOICED' as const };
            }
            if (statusFilter) {
                return { status: statusFilter as any };
            }
            return { status: { notIn: ['PAID', 'CANCELLED'] as const } };
        };

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
                    clientIdFilter ? { clientId: clientIdFilter } : {},
                    commercialStatusFilter ? { project: { commercialStatus: commercialStatusFilter as any } } : {},
                    statusPrismaCondition(),
                    typeFilter ? { type: typeFilter as 'INVOICE' | 'QUOTE' } : {}
                ]
            },
            include: { 
                client: true, 
                payments: true, 
                project: {
                    include: {
                        invoices: {
                            select: { id: true, number: true, quoteNumber: true, type: true, status: true, date: true }
                        }
                    }
                }
            } as any,
            take: 200
        });
    } catch (e) {
        console.error("Invoices DB Error:", e);
    }

    // Helper functions for quote invoice linkage
    const getLinkedInvoice = (invoice: any) => {
        if (invoice.type !== 'QUOTE') return null;
        return invoice.project?.invoices?.find((i: any) => i.type === 'INVOICE' && i.id !== invoice.id) || null;
    };

    const getIsInvoiced = (invoice: any) => {
        if (invoice.type !== 'QUOTE') return false;
        return invoice.status === 'INVOICED' || !!getLinkedInvoice(invoice);
    };

    // Client-side / in-memory filter refinement for UNINVOICED or INVOICED if needed
    if (statusFilter === 'UNINVOICED') {
        invoices = invoices.filter(inv => !getIsInvoiced(inv));
    } else if (statusFilter === 'INVOICED' && typeFilter === 'QUOTE') {
        invoices = invoices.filter(inv => getIsInvoiced(inv));
    }

    // Sort according to user preference
    invoices.sort((a, b) => {
        if (sortParam === 'uninvoiced_first') {
            const aInv = getIsInvoiced(a);
            const bInv = getIsInvoiced(b);
            if (aInv !== bInv) return aInv ? 1 : -1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortParam === 'invoiced_first') {
            const aInv = getIsInvoiced(a);
            const bInv = getIsInvoiced(b);
            if (aInv !== bInv) return aInv ? -1 : 1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortParam === 'date_asc') {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        if (sortParam === 'date_desc') {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortParam === 'total_desc') {
            return (b.total || 0) - (a.total || 0);
        }
        if (sortParam === 'total_asc') {
            return (a.total || 0) - (b.total || 0);
        }
        if (sortParam === 'number_desc') {
            return (b.number || 0) - (a.number || 0);
        }
        if (sortParam === 'number_asc') {
            return (a.number || 0) - (b.number || 0);
        }
        if (sortParam === 'client_asc') {
            return (a.client?.name || "").localeCompare(b.client?.name || "");
        }
        if (sortParam === 'client_desc') {
            return (b.client?.name || "").localeCompare(a.client?.name || "");
        }
        if (sortParam === 'status_asc') {
            return (a.status || "").localeCompare(b.status || "");
        }
        if (sortParam === 'status_desc') {
            return (b.status || "").localeCompare(a.status || "");
        }
        return 0;
    });

    const getSortUrl = (column: string) => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (statusFilter) params.set("status", statusFilter);
        if (typeFilter) params.set("type", typeFilter);
        if (clientIdFilter) params.set("clientId", clientIdFilter);
        if (commercialStatusFilter) params.set("commercialStatus", commercialStatusFilter);
        
        let targetSort = `${column}_desc`;
        if (sortParam === `${column}_desc`) {
            targetSort = `${column}_asc`;
        } else if (sortParam === `${column}_asc`) {
            targetSort = `${column}_desc`;
        } else if (column === 'status') {
            targetSort = sortParam === 'uninvoiced_first' ? 'invoiced_first' : 'uninvoiced_first';
        }
        params.set("sort", targetSort);
        return `?${params.toString()}`;
    };

    const renderSortIndicator = (column: string) => {
        const isAsc = sortParam === `${column}_asc`;
        const isDesc = sortParam === `${column}_desc`;
        if (column === 'status') {
            if (sortParam === 'uninvoiced_first') return <span className="text-primary text-[10px] font-black uppercase tracking-wider ml-1">⚡ Uninv</span>;
            if (sortParam === 'invoiced_first') return <span className="text-indigo-400 text-[10px] font-black uppercase tracking-wider ml-1">🧾 Inv</span>;
        }
        if (isAsc) return <ArrowUp className="inline-block h-3.5 w-3.5 ml-1 text-primary shrink-0" />;
        if (isDesc) return <ArrowDown className="inline-block h-3.5 w-3.5 ml-1 text-primary shrink-0" />;
        return <ArrowUpDown className="inline-block h-3 w-3 ml-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
    };

    const getQuickFilterUrl = (statusValue: string, sortValue?: string) => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (typeFilter) params.set("type", typeFilter);
        if (clientIdFilter) params.set("clientId", clientIdFilter);
        if (commercialStatusFilter) params.set("commercialStatus", commercialStatusFilter);
        if (statusValue) params.set("status", statusValue);
        if (sortValue) params.set("sort", sortValue);
        return `?${params.toString()}`;
    };

    return (
        <div className="space-y-6">
            <DraftResumeBanner filterType="INVOICE_OR_QUOTE" />

            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">
                        {typeFilter === 'QUOTE' ? 'Quotations' : typeFilter === 'INVOICE' ? 'Invoices' : 'Quotes & Invoices'}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        {typeFilter === 'QUOTE' 
                            ? 'Manage and track quotations, monitor invoiced jobs, and convert ready quotes.' 
                            : 'Manage billing, track commercial status, and record client payments.'}
                    </p>
                </div>
                <Link href={typeFilter === 'INVOICE' ? '/invoices/new?type=INVOICE' : '/invoices/new'}>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> {typeFilter === 'INVOICE' ? 'New Invoice' : 'New Quote'}
                    </Button>
                </Link>
            </div>

            {/* Quick Filter Bar for Quotes */}
            {typeFilter === 'QUOTE' && (
                <div className="flex items-center gap-2 border-b border-border/40 pb-3 flex-wrap">
                    <span className="text-xs font-bold text-muted-foreground mr-1 uppercase tracking-wider text-[10px]">Filter View:</span>
                    <Link
                        href={getQuickFilterUrl("")}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            !statusFilter && sortParam !== 'uninvoiced_first' && sortParam !== 'invoiced_first'
                                ? "bg-primary text-black shadow-sm"
                                : "text-muted-foreground hover:bg-muted/80 bg-muted/30"
                        )}
                    >
                        All Quotes
                    </Link>
                    <Link
                        href={getQuickFilterUrl("UNINVOICED", "uninvoiced_first")}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                            statusFilter === 'UNINVOICED' || sortParam === 'uninvoiced_first'
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                                : "text-muted-foreground hover:bg-muted/80 bg-muted/30"
                        )}
                    >
                        ⚡ Uninvoiced (Action Needed)
                    </Link>
                    <Link
                        href={getQuickFilterUrl("INVOICED", "invoiced_first")}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                            statusFilter === 'INVOICED' || sortParam === 'invoiced_first'
                                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                                : "text-muted-foreground hover:bg-muted/80 bg-muted/30"
                        )}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Invoiced Quotes
                    </Link>
                </div>
            )}

            <div className="flex items-center justify-between gap-4 flex-wrap">
                <SearchInput placeholder="Search by number or client..." />
                <InvoiceFilters clients={clients} />
            </div>

            <div className="rounded-md border bg-card shadow-sm">
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm text-left min-w-[800px]">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50">
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    <Link href={getSortUrl("number")} className="group flex items-center gap-1 hover:text-foreground">
                                        Number {renderSortIndicator("number")}
                                    </Link>
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    <Link href={getSortUrl("client")} className="group flex items-center gap-1 hover:text-foreground">
                                        Client {renderSortIndicator("client")}
                                    </Link>
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Project</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Type</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    <Link href={getSortUrl("status")} className="group flex items-center gap-1 hover:text-foreground">
                                        Status {renderSortIndicator("status")}
                                    </Link>
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground">
                                    <Link href={getSortUrl("date")} className="group flex items-center gap-1 hover:text-foreground">
                                        Date {renderSortIndicator("date")}
                                    </Link>
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">
                                    <Link href={getSortUrl("total")} className="group flex items-center justify-end gap-1 hover:text-foreground">
                                        Total {renderSortIndicator("total")}
                                    </Link>
                                </th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Paid</th>
                                <th className="h-12 px-4 align-middle font-medium text-muted-foreground"></th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="h-24 text-center text-muted-foreground">
                                        {query || statusFilter || typeFilter ? "No matching records found." : "No records yet."}
                                    </td>
                                </tr>
                            ) : invoices.map(invoice => {
                                const paid = invoice.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                                const isPaid = invoice.type === 'INVOICE'
                                    ? (invoice.total > 0 ? paid >= invoice.total : invoice.status === 'PAID')
                                    : invoice.status === 'PAID';
                                const linkedInvoice = getLinkedInvoice(invoice);
                                const isInvoiced = getIsInvoiced(invoice);

                                return (
                                    <tr key={invoice.id} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle font-black">
                                            <div className="flex flex-col">
                                                <span>{invoice.quoteNumber || (invoice.type === 'QUOTE' ? `Q-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}` : `INV-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`)}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle">{invoice.client?.name}</td>
                                        <td className="p-4 align-middle">
                                            {invoice.project ? (
                                                <div className="flex flex-col gap-1">
                                                    <Link href={`/projects/${invoice.projectId}`} className="text-blue-500 hover:underline font-semibold">
                                                        {invoice.project.name}
                                                    </Link>
                                                    {invoice.project.commercialStatus && (
                                                        <span className={cn(
                                                            "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold w-fit tracking-wide uppercase",
                                                            invoice.project.commercialStatus === 'AWAITING_PO' ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" :
                                                            invoice.project.commercialStatus === 'PO_RECEIVED' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                                                            invoice.project.commercialStatus === 'EMERGENCY_WORK' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse" :
                                                            "bg-sky-500/10 text-sky-500 border border-sky-500/20" // REACTIVE_WORK
                                                        )}>
                                                            {invoice.project.commercialStatus === 'AWAITING_PO' ? 'Awaiting PO' :
                                                             invoice.project.commercialStatus === 'PO_RECEIVED' ? 'PO Received' :
                                                             invoice.project.commercialStatus === 'EMERGENCY_WORK' ? 'Emergency' :
                                                             'Reactive Work'}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground italic">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                                invoice.type === 'QUOTE'
                                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                                    : "bg-green-500/10 text-green-400 border border-green-500/20"
                                            )}>
                                                {invoice.type}
                                            </span>
                                        </td>
                                        <td className="p-4 align-middle">
                                            {invoice.type === 'QUOTE' ? (
                                                isInvoiced ? (
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                                                            INVOICED
                                                        </span>
                                                        {linkedInvoice && (
                                                            <Link
                                                                href={`/invoices/${linkedInvoice.id}`}
                                                                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-400/90 hover:text-indigo-300 hover:underline pl-1 transition-colors"
                                                                title="Click to view linked Tax Invoice"
                                                            >
                                                                <ArrowUpRight className="w-3 h-3" />
                                                                {linkedInvoice.quoteNumber || `INV-${String(linkedInvoice.number).padStart(3, '0')}`}
                                                            </Link>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className={cn(
                                                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                                        invoice.status === 'SENT' ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                                                        invoice.status === 'ACCEPTED' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                                        invoice.status === 'REJECTED' ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                                                        invoice.status === 'DRAFT' ? "bg-gray-500/10 text-gray-400 border border-gray-500/20" :
                                                        "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                                                    )}>
                                                        {invoice.status}
                                                    </span>
                                                )
                                            ) : (
                                                <span className={cn(
                                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                                    isPaid ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                                                    invoice.status === 'CHECKED' ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                                                    invoice.status === 'DRAFT' ? "bg-gray-500/10 text-gray-400 border border-gray-500/20" :
                                                    "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                                                )}>
                                                    {isPaid ? "PAID" : (invoice.status === 'CHECKED' ? "VERIFIED" : invoice.status)}
                                                </span>
                                            )}
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
