import React from "react"
import Link from "next/link"
import { getTenderSummaryAction } from "@/app/(dashboard)/tenders/actions"
import { formatCurrency, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, FileCheck, DollarSign, Calendar, Plus, Book, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react"
import { ensureAuth } from "@/lib/auth-actions"

export const dynamic = 'force-dynamic'

export default async function TendersPage() {
    await ensureAuth()
    const summary = await getTenderSummaryAction()

    if (!summary || !summary.tender) {
        return (
            <div className="space-y-6">
                <div className="p-8 rounded-2xl bg-[#14141E] border border-white/10 text-center space-y-4">
                    <AlertCircle className="h-12 w-12 text-amber-400 mx-auto" />
                    <h2 className="text-xl font-bold">No Active Tender Found</h2>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        There is currently no active tender registered. Run the tender setup migration to activate Tender 152G/2025/26.
                    </p>
                </div>
            </div>
        )
    }

    const { tender, quotes, taxInvoices, totals } = summary
    const paidPercentage = totals.totalInvoiced > 0 ? (totals.totalPaid / totals.totalInvoiced) * 100 : 0

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black px-2.5 py-0.5 rounded-full text-xs uppercase tracking-widest flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            TENDER {tender.tenderNumber}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono font-bold">
                            {tender.client?.name || "City Of Cape Town"}
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                        {tender.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-medium pt-1">
                        <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            3-Year Contract: {new Date(tender.startDate).toLocaleDateString('en-GB')} – {new Date(tender.endDate).toLocaleDateString('en-GB')}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase text-[10px]">
                            {tender.status}
                        </span>
                        <span className="font-mono text-zinc-400">
                            Prefix: {tender.quotePrefix || "CCT-T"}-* / {tender.invoicePrefix || "CCT-TI"}-*
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <Link href="/knowledge?filter=tender">
                        <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold gap-2">
                            <Book className="h-4 w-4 text-amber-400" />
                            Tender Catalog (115 items)
                        </Button>
                    </Link>
                    <Link href={`/invoices/new?type=QUOTE&workType=TENDER&tenderId=${tender.id}`}>
                        <Button className="bg-primary text-black font-black text-xs gap-2">
                            <Plus className="h-4 w-4" />
                            New Tender Quote
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Financial Overview KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-[#14141E] border-white/10 shadow-lg">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Total Quoted</span>
                            <FileText className="h-4 w-4 text-amber-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="text-2xl font-black text-white">
                            {formatCurrency(totals.totalQuoted)}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            {quotes.length} {quotes.length === 1 ? 'quote' : 'quotes'} issued
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E] border-white/10 shadow-lg">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Total Invoiced</span>
                            <FileCheck className="h-4 w-4 text-blue-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="text-2xl font-black text-white">
                            {formatCurrency(totals.totalInvoiced)}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            {taxInvoices.length} {taxInvoices.length === 1 ? 'invoice' : 'invoices'} billed
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E] border-white/10 shadow-lg">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Total Paid</span>
                            <DollarSign className="h-4 w-4 text-emerald-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="text-2xl font-black text-emerald-400">
                            {formatCurrency(totals.totalPaid)}
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                            <div
                                className="bg-emerald-400 h-1.5 rounded-full transition-all"
                                style={{ width: `${Math.min(100, paidPercentage)}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground pt-1">
                            {paidPercentage.toFixed(1)}% of billed amount
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E] border-white/10 shadow-lg">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Outstanding</span>
                            <AlertCircle className="h-4 w-4 text-rose-400" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        <div className="text-2xl font-black text-rose-400">
                            {formatCurrency(totals.outstandingInvoiced)}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Pending collection
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Document Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Tender Quotes */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <FileText className="h-4 w-4 text-amber-400" />
                            Tender Quotes ({quotes.length})
                        </h2>
                        <Link href="/invoices?type=QUOTE&workType=TENDER" className="text-xs text-primary hover:underline font-bold flex items-center gap-1">
                            View All <ArrowUpRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#14141E] overflow-hidden">
                        {quotes.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-xs">
                                No tender quotes created yet.
                            </div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="bg-white/5 border-b border-white/10 text-muted-foreground font-black uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="py-2.5 px-3 text-left">Quote #</th>
                                        <th className="py-2.5 px-3 text-left">Rate</th>
                                        <th className="py-2.5 px-3 text-left">Date</th>
                                        <th className="py-2.5 px-3 text-right">Total</th>
                                        <th className="py-2.5 px-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-medium">
                                    {quotes.map(q => (
                                        <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-2.5 px-3 font-mono font-bold">
                                                <Link href={`/invoices/${q.id}`} className="text-primary hover:underline">
                                                    {q.quoteNumber || `Q-${String(q.number).padStart(3, '0')}`}
                                                </Link>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-bold text-amber-300">
                                                    Y{q.rateYear || 1}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-muted-foreground">
                                                {new Date(q.date).toLocaleDateString('en-GB')}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold text-white">
                                                {formatCurrency(q.total)}
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-white/5 text-gray-300">
                                                    {q.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Tender Tax Invoices */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-blue-400" />
                            Tender Invoices ({taxInvoices.length})
                        </h2>
                        <Link href="/invoices?type=INVOICE&workType=TENDER" className="text-xs text-primary hover:underline font-bold flex items-center gap-1">
                            View All <ArrowUpRight className="h-3 w-3" />
                        </Link>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#14141E] overflow-hidden">
                        {taxInvoices.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-xs">
                                No tender invoices generated yet.
                            </div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="bg-white/5 border-b border-white/10 text-muted-foreground font-black uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="py-2.5 px-3 text-left">Invoice #</th>
                                        <th className="py-2.5 px-3 text-left">Rate</th>
                                        <th className="py-2.5 px-3 text-left">Date</th>
                                        <th className="py-2.5 px-3 text-right">Total</th>
                                        <th className="py-2.5 px-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-medium">
                                    {taxInvoices.map(inv => {
                                        const paid = inv.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0
                                        const isFullyPaid = paid >= (inv.total - 0.01)
                                        return (
                                            <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-2.5 px-3 font-mono font-bold">
                                                    <Link href={`/invoices/${inv.id}`} className="text-blue-400 hover:underline">
                                                        {inv.quoteNumber || `INV-${String(inv.number).padStart(3, '0')}`}
                                                    </Link>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-bold text-amber-300">
                                                        Y{inv.rateYear || 1}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-muted-foreground">
                                                    {new Date(inv.date).toLocaleDateString('en-GB')}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-white">
                                                    {formatCurrency(inv.total)}
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[9px] font-black uppercase",
                                                        isFullyPaid ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-gray-300"
                                                    )}>
                                                        {isFullyPaid ? "PAID" : inv.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
