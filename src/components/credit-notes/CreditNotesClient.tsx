"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, FileText, ArrowUpRight, Trash2, Eye, ExternalLink } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { CreateCreditNoteModal } from "./CreateCreditNoteModal"
import { deleteCreditNoteAction, updateCreditNoteStatusAction } from "@/app/actions/credit-notes"

interface CreditNotesClientProps {
    creditNotes: any[]
    clients: any[]
    invoices: any[]
    tenders: any[]
}

export function CreditNotesClient({
    creditNotes,
    clients,
    invoices,
    tenders
}: CreditNotesClientProps) {
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [workTypeFilter, setWorkTypeFilter] = useState<string>("ALL")
    const [statusFilter, setStatusFilter] = useState<string>("")
    const [searchQuery, setSearchQuery] = useState("")

    // Filter items
    const filtered = creditNotes.filter(cnItem => {
        if (workTypeFilter === "GENERAL" && cnItem.workType === "TENDER") return false
        if (workTypeFilter === "TENDER" && cnItem.workType !== "TENDER") return false
        if (statusFilter && cnItem.status !== statusFilter) return false

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim()
            const matchNumber = (cnItem.creditNoteNumber || "").toLowerCase().includes(q)
            const matchClient = (cnItem.client?.name || "").toLowerCase().includes(q)
            const matchInvoice = (cnItem.invoice?.quoteNumber || "").toLowerCase().includes(q)
            const matchReason = (cnItem.reason || "").toLowerCase().includes(q)
            return matchNumber || matchClient || matchInvoice || matchReason
        }

        return true
    })

    // Metrics
    const totalCredited = creditNotes.reduce((sum, item) => sum + (item.total || 0), 0)
    const tenderCredited = creditNotes
        .filter(item => item.workType === "TENDER")
        .reduce((sum, item) => sum + (item.total || 0), 0)
    const generalCredited = creditNotes
        .filter(item => item.workType !== "TENDER")
        .reduce((sum, item) => sum + (item.total || 0), 0)

    const handleDelete = async (id: string, number: string) => {
        if (!confirm(`Are you sure you want to delete Credit Note ${number}?`)) return
        try {
            await deleteCreditNoteAction(id)
        } catch (error: any) {
            alert(error.message || "Failed to delete credit note")
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        <FileText className="w-8 h-8 text-rose-500" />
                        Credit Notes
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Manage SARS-compliant Tax Credit Notes, track invoice billing credits, and tender equipment returns.
                    </p>
                </div>
                <Button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-900/20 rounded-xl"
                >
                    <Plus className="mr-1.5 h-4 w-4" /> Issue Credit Note
                </Button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-white/10 bg-[#14141E] p-4 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Credit Notes</span>
                    <div className="mt-1 text-2xl font-black text-white">{creditNotes.length}</div>
                    <span className="text-[11px] text-muted-foreground/80 mt-1 block">Issued & Active</span>
                </div>

                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">Total Credited Value</span>
                    <div className="mt-1 text-2xl font-black text-rose-400">{formatCurrency(totalCredited)}</div>
                    <span className="text-[11px] text-rose-400/70 mt-1 block">Incl. 15% VAT</span>
                </div>

                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">Tender 152G Credits</span>
                    <div className="mt-1 text-2xl font-black text-amber-300">{formatCurrency(tenderCredited)}</div>
                    <span className="text-[11px] text-amber-400/70 mt-1 block">City of Cape Town</span>
                </div>

                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-300">General Work Credits</span>
                    <div className="mt-1 text-2xl font-black text-blue-300">{formatCurrency(generalCredited)}</div>
                    <span className="text-[11px] text-blue-400/70 mt-1 block">Boshard & General Jobs</span>
                </div>
            </div>

            {/* Work Type Tabs */}
            <div className="flex items-center gap-2 border-b border-border/40 pb-3 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground mr-1 uppercase tracking-wider text-[10px]">Work Type:</span>
                <button
                    onClick={() => setWorkTypeFilter("ALL")}
                    className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        workTypeFilter === "ALL"
                            ? "bg-primary text-black shadow-sm"
                            : "text-muted-foreground hover:bg-muted/80 bg-muted/30"
                    )}
                >
                    All Credits
                </button>
                <button
                    onClick={() => setWorkTypeFilter("GENERAL")}
                    className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        workTypeFilter === "GENERAL"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                            : "text-muted-foreground hover:bg-muted/80 bg-muted/30"
                    )}
                >
                    General Work
                </button>
                <button
                    onClick={() => setWorkTypeFilter("TENDER")}
                    className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                        workTypeFilter === "TENDER"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-black"
                            : "text-muted-foreground hover:bg-muted/80 bg-muted/30"
                    )}
                >
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Tender 152G Work
                </button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by CN number, client, invoice..."
                        className="pl-9 h-9 bg-card border-white/10 text-xs"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-9 rounded-md border border-white/10 bg-card px-3 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
                    >
                        <option value="">All Statuses</option>
                        <option value="ISSUED">Issued</option>
                        <option value="DRAFT">Draft</option>
                        <option value="APPLIED">Applied</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-white/10 bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-white/10 bg-muted/20 text-muted-foreground text-[10px] uppercase font-black tracking-wider">
                            <tr>
                                <th className="py-3 px-4">Credit Note #</th>
                                <th className="py-3 px-4">Client</th>
                                <th className="py-3 px-4">Tax Invoice Ref</th>
                                <th className="py-3 px-4">Circumstance / Reason</th>
                                <th className="py-3 px-4">Date Issued</th>
                                <th className="py-3 px-4 text-right">Total Credit</th>
                                <th className="py-3 px-4 text-center">Status</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="h-32 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <FileText className="h-8 w-8 text-muted-foreground/40" />
                                            <span>No credit notes found.</span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsCreateOpen(true)}
                                                className="mt-2 text-xs border-white/10"
                                            >
                                                <Plus className="mr-1 h-3.5 w-3.5" /> Issue First Credit Note
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(cnItem => {
                                    const cnNumber = cnItem.creditNoteNumber || `CN-${new Date(cnItem.date).getFullYear()}-${String(cnItem.number).padStart(3, '0')}`

                                    return (
                                        <tr key={cnItem.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-3 px-4 font-black">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-white text-xs">{cnNumber}</span>
                                                    {cnItem.workType === "TENDER" && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                                            TENDER 152G
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-white/90">
                                                {cnItem.client?.name || "-"}
                                            </td>
                                            <td className="py-3 px-4">
                                                {cnItem.invoice ? (
                                                    <Link
                                                        href={`/invoices/${cnItem.invoice.id}`}
                                                        className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-400 hover:text-blue-300 hover:underline"
                                                    >
                                                        {cnItem.invoice.quoteNumber || `INV-${String(cnItem.invoice.number).padStart(3, '0')}`}
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                    </Link>
                                                ) : (
                                                    <span className="text-muted-foreground/60 italic">Standalone</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                                                {cnItem.reason || "Credit adjustment"}
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {new Date(cnItem.date).toLocaleDateString("en-ZA")}
                                            </td>
                                            <td className="py-3 px-4 text-right font-black font-mono text-rose-400">
                                                {formatCurrency(cnItem.total)}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={cn(
                                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase",
                                                    cnItem.status === "ISSUED" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                                                    cnItem.status === "APPLIED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                                    cnItem.status === "CANCELLED" ? "bg-gray-500/10 text-gray-400 border border-gray-500/20" :
                                                    "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                                )}>
                                                    {cnItem.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link href={`/credit-notes/${cnItem.id}`}>
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 hover:bg-white/10 text-white">
                                                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                                                        </Button>
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(cnItem.id, cnNumber)}
                                                        className="p-1.5 text-muted-foreground hover:text-rose-400 transition-colors"
                                                        title="Delete credit note"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <CreateCreditNoteModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                clients={clients}
                invoices={invoices}
                tenders={tenders}
            />
        </div>
    )
}
