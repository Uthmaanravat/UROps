'use client'

import React, { useState } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    Phone,
    MessageCircle,
    Send,
    AlertTriangle,
    Clock,
    CheckCircle2,
    Loader2,
    DollarSign,
    Filter,
    Settings,
    FileText,
    Edit3
} from "lucide-react"
import { sendOverdueReminderAction, toggleClientRemindersAction } from "@/app/(dashboard)/payments/actions"
import Link from "next/link"

interface OpenInvoiceItem {
    id: string
    quoteNumber: string | null
    number: number
    date: Date | string
    dueDate: Date | string | null
    total: number
    balanceDue: number
    daysOverdue: number
    client: {
        id: string
        name: string
        phone: string | null
        email: string | null
        customFields?: any
    }
    lastReminderSentAt?: string | null
}

export function WhoOwesMe({ invoices, currencySymbol = "R" }: { invoices: OpenInvoiceItem[], currencySymbol?: string }) {
    const [sendingId, setSendingId] = useState<string | null>(null)
    const [selectedInvoice, setSelectedInvoice] = useState<OpenInvoiceItem | null>(null)
    const [customMessage, setCustomMessage] = useState("")
    const [isCustomOpen, setIsCustomOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState<'ALL' | '7_DAYS' | '14_DAYS' | '30_DAYS'>('ALL')

    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0)
    const overdue30 = invoices.filter(inv => inv.daysOverdue >= 30)
    const overdue14 = invoices.filter(inv => inv.daysOverdue >= 14 && inv.daysOverdue < 30)
    const overdue7 = invoices.filter(inv => inv.daysOverdue >= 7 && inv.daysOverdue < 14)

    const filteredInvoices = invoices.filter(inv => {
        if (statusFilter === '30_DAYS') return inv.daysOverdue >= 30
        if (statusFilter === '14_DAYS') return inv.daysOverdue >= 14 && inv.daysOverdue < 30
        if (statusFilter === '7_DAYS') return inv.daysOverdue >= 7 && inv.daysOverdue < 14
        return true
    })

    const handleSendQuickReminder = async (inv: OpenInvoiceItem) => {
        try {
            setSendingId(inv.id)
            const res = await sendOverdueReminderAction(inv.id)
            if (res.success) {
                alert(`Reminder email dispatched successfully to ${inv.client.email}!`)
            } else {
                alert(res.error || "Failed to send reminder")
            }
        } catch (e: any) {
            alert(e?.message || "Failed to send reminder")
        } finally {
            setSendingId(null)
        }
    }

    const handleSendCustomReminder = async () => {
        if (!selectedInvoice) return
        try {
            setSendingId(selectedInvoice.id)
            const res = await sendOverdueReminderAction(selectedInvoice.id, customMessage)
            if (res.success) {
                alert(`Custom reminder email dispatched successfully!`)
                setIsCustomOpen(false)
            } else {
                alert(res.error || "Failed to send reminder")
            }
        } catch (e: any) {
            alert(e?.message || "Failed to send reminder")
        } finally {
            setSendingId(null)
        }
    }

    const buildWhatsAppUrl = (inv: OpenInvoiceItem) => {
        const rawPhone = inv.client.phone || ""
        let clean = rawPhone.replace(/[^0-9]/g, '')
        if (clean.startsWith('0')) clean = '27' + clean.slice(1)
        const numLabel = inv.quoteNumber || `Invoice #${inv.number}`
        const text = `Hi ${inv.client.name}, this is a friendly reminder from AeroWash regarding overdue invoice ${numLabel} for ${formatCurrency(inv.balanceDue, currencySymbol)}. Please let us know once payment has been processed. Thank you!`
        return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-[#0F172A] border border-white/10 shadow-lg space-y-1">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Outstanding Debt</div>
                    <div className="text-2xl font-black text-[#D05E00]">
                        {formatCurrency(totalOutstanding, currencySymbol)}
                    </div>
                    <div className="text-[11px] text-gray-400">{invoices.length} unpaid / partial invoice(s)</div>
                </div>

                <div 
                    onClick={() => setStatusFilter(statusFilter === '7_DAYS' ? 'ALL' : '7_DAYS')}
                    className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer shadow-lg space-y-1",
                        statusFilter === '7_DAYS' ? "bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/50" : "bg-[#0F172A] border-white/10 hover:border-amber-500/30"
                    )}
                >
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">7–13 Days Overdue</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-xl font-bold text-white">
                        {formatCurrency(overdue7.reduce((s, i) => s + i.balanceDue, 0), currencySymbol)}
                    </div>
                    <div className="text-[11px] text-gray-400">{overdue7.length} client(s)</div>
                </div>

                <div 
                    onClick={() => setStatusFilter(statusFilter === '14_DAYS' ? 'ALL' : '14_DAYS')}
                    className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer shadow-lg space-y-1",
                        statusFilter === '14_DAYS' ? "bg-orange-500/15 border-orange-500/50 ring-1 ring-orange-500/50" : "bg-[#0F172A] border-white/10 hover:border-orange-500/30"
                    )}
                >
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">14–29 Days Overdue</span>
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="text-xl font-bold text-white">
                        {formatCurrency(overdue14.reduce((s, i) => s + i.balanceDue, 0), currencySymbol)}
                    </div>
                    <div className="text-[11px] text-gray-400">{overdue14.length} client(s)</div>
                </div>

                <div 
                    onClick={() => setStatusFilter(statusFilter === '30_DAYS' ? 'ALL' : '30_DAYS')}
                    className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer shadow-lg space-y-1",
                        statusFilter === '30_DAYS' ? "bg-red-500/15 border-red-500/50 ring-1 ring-red-500/50" : "bg-[#0F172A] border-white/10 hover:border-red-500/30"
                    )}
                >
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">30+ Days Overdue</span>
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="text-xl font-bold text-white">
                        {formatCurrency(overdue30.reduce((s, i) => s + i.balanceDue, 0), currencySymbol)}
                    </div>
                    <div className="text-[11px] text-gray-400">{overdue30.length} client(s)</div>
                </div>
            </div>

            {/* Invoices List */}
            <div className="bg-[#0F172A] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <div className="p-4 bg-white/[0.02] border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">Who Owes Me</h3>
                        <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-[10px]">
                            {filteredInvoices.length} open
                        </Badge>
                    </div>

                    <div className="text-xs text-gray-400">
                        Automatic reminders scheduled at <strong>7, 14, and 30 days</strong> overdue.
                    </div>
                </div>

                {filteredInvoices.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 text-xs">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                        No outstanding debts in this category. All invoices are up to date!
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filteredInvoices.map(inv => {
                            const isOverdue = inv.daysOverdue > 0
                            return (
                                <div key={inv.id} className="p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-sm text-white">{inv.client.name}</span>
                                            <Link href={`/invoices/${inv.id}`} className="text-xs font-mono text-[#D05E00] hover:underline">
                                                {inv.quoteNumber || `INV-${inv.number}`}
                                            </Link>
                                            {isOverdue ? (
                                                <Badge className={cn(
                                                    "text-[10px] py-0 px-2 font-bold",
                                                    inv.daysOverdue >= 30 ? "bg-red-500/20 text-red-300 border-red-500/40" :
                                                    inv.daysOverdue >= 14 ? "bg-orange-500/20 text-orange-300 border-orange-500/40" :
                                                    "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                                )}>
                                                    {inv.daysOverdue} days overdue
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] py-0 px-2 text-gray-400">
                                                    Current
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                                            <span>Issued: {new Date(inv.date).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span>Total: {formatCurrency(inv.total, currencySymbol)}</span>
                                            <span>•</span>
                                            <span>Balance Due: <strong className="text-white font-mono">{formatCurrency(inv.balanceDue, currencySymbol)}</strong></span>
                                            {inv.lastReminderSentAt && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-[11px] text-gray-500">Last reminder: {new Date(inv.lastReminderSentAt).toLocaleDateString()}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons: Call / WhatsApp / Send Reminder */}
                                    <div className="flex items-center gap-2 self-end lg:self-center flex-wrap">
                                        {/* Call */}
                                        {inv.client.phone ? (
                                            <a
                                                href={`tel:${inv.client.phone}`}
                                                className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors"
                                                title={`Call ${inv.client.phone}`}
                                            >
                                                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                                <span>Call</span>
                                            </a>
                                        ) : null}

                                        {/* WhatsApp */}
                                        {inv.client.phone ? (
                                            <a
                                                href={buildWhatsAppUrl(inv)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="h-8 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30 transition-colors"
                                                title="Open WhatsApp reminder"
                                            >
                                                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                                <span>WhatsApp</span>
                                            </a>
                                        ) : null}

                                        {/* Send Email Reminder */}
                                        <Button
                                            size="sm"
                                            disabled={sendingId === inv.id || !inv.client.email}
                                            onClick={() => handleSendQuickReminder(inv)}
                                            className="h-8 px-3 text-xs font-bold bg-[#D05E00] hover:bg-[#B34E00] text-white flex items-center gap-1.5 rounded-lg shadow"
                                        >
                                            {sendingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                            <span>Send Reminder</span>
                                        </Button>

                                        {/* Custom Message Dialog trigger */}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setSelectedInvoice(inv)
                                                setCustomMessage(`Dear ${inv.client.name},\n\nWe would like to follow up on outstanding invoice ${inv.quoteNumber || `INV-${inv.number}`} for ${formatCurrency(inv.balanceDue, currencySymbol)}.\n\nPlease let us know if you require any additional information to facilitate payment.`)
                                                setIsCustomOpen(true)
                                            }}
                                            className="h-8 px-2 text-xs text-gray-400 hover:text-white"
                                            title="Edit custom reminder message"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Custom Reminder Modal */}
            <Dialog open={isCustomOpen} onOpenChange={setIsCustomOpen}>
                <DialogContent className="sm:max-w-md bg-[#0F172A] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">Custom Overdue Reminder</DialogTitle>
                        <DialogDescription className="text-xs text-gray-400">
                            Edit the message below before sending to {selectedInvoice?.client.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="text-xs text-gray-300">
                            Recipient: <strong className="text-white">{selectedInvoice?.client.email}</strong>
                        </div>
                        <Textarea
                            rows={6}
                            value={customMessage}
                            onChange={e => setCustomMessage(e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-xs font-mono"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" size="sm" onClick={() => setIsCustomOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={sendingId === selectedInvoice?.id}
                            onClick={handleSendCustomReminder}
                            className="bg-[#D05E00] hover:bg-[#B34E00] text-white font-bold text-xs"
                        >
                            {sendingId === selectedInvoice?.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                            Dispatch Reminder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
