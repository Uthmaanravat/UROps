"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Loader2, FileText, CheckCircle2, ShieldCheck } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { createCreditNoteAction } from "@/app/actions/credit-notes"

interface ClientOption {
    id: string
    name: string
}

interface InvoiceOption {
    id: string
    number: number
    quoteNumber?: string | null
    total: number
    date: string | Date
    workType?: string
    tenderId?: string | null
    clientId: string
    items?: any[]
}

interface CreateCreditNoteModalProps {
    isOpen: boolean
    onClose: () => void
    clients: ClientOption[]
    invoices: InvoiceOption[]
    tenders: { id: string; tenderNumber: string; name: string }[]
    initialInvoiceId?: string
    initialClientId?: string
}

export function CreateCreditNoteModal({
    isOpen,
    onClose,
    clients,
    invoices,
    tenders,
    initialInvoiceId,
    initialClientId
}: CreateCreditNoteModalProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [clientId, setClientId] = useState(initialClientId || (clients[0]?.id || ""))
    const [invoiceId, setInvoiceId] = useState(initialInvoiceId || "")
    const [workType, setWorkType] = useState<"GENERAL" | "TENDER">("GENERAL")
    const [selectedTenderId, setSelectedTenderId] = useState(tenders[0]?.id || "")
    const [reason, setReason] = useState("Adjustment of invoice charges")
    const [notes, setNotes] = useState("")
    const [date, setDate] = useState(new Date().toISOString().split("T")[0])

    const [items, setItems] = useState<Array<{
        code: string
        description: string
        quantity: number
        unit: string
        unitPrice: number
    }>>([
        { code: "", description: "", quantity: 1, unit: "each", unitPrice: 0 }
    ])

    // Update state when initial props change
    useEffect(() => {
        if (initialClientId) setClientId(initialClientId)
        if (initialInvoiceId) {
            setInvoiceId(initialInvoiceId)
            const matchedInv = invoices.find(i => i.id === initialInvoiceId)
            if (matchedInv) {
                if (matchedInv.clientId) setClientId(matchedInv.clientId)
                if (matchedInv.workType === "TENDER") {
                    setWorkType("TENDER")
                    if (matchedInv.tenderId) setSelectedTenderId(matchedInv.tenderId)
                }
            }
        }
    }, [initialClientId, initialInvoiceId, invoices])

    // Filter invoices by selected client
    const clientInvoices = invoices.filter(inv => inv.clientId === clientId)

    const handleInvoiceSelect = (invId: string) => {
        setInvoiceId(invId)
        if (!invId) return
        const matched = invoices.find(i => i.id === invId)
        if (matched) {
            if (matched.workType === "TENDER") {
                setWorkType("TENDER")
                if (matched.tenderId) setSelectedTenderId(matched.tenderId)
            } else {
                setWorkType("GENERAL")
            }
        }
    }

    const handleImportInvoiceItems = () => {
        const matched = invoices.find(i => i.id === invoiceId)
        if (matched && matched.items && matched.items.length > 0) {
            setItems(matched.items.map(item => ({
                code: item.code || "",
                description: item.description || "",
                quantity: item.quantity || 1,
                unit: item.unit || "each",
                unitPrice: item.unitPrice || 0
            })))
        }
    }

    const handleAddItem = () => {
        setItems(prev => [...prev, { code: "", description: "", quantity: 1, unit: "each", unitPrice: 0 }])
    }

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return
        setItems(prev => prev.filter((_, i) => i !== index))
    }

    const handleItemChange = (index: number, field: string, value: any) => {
        setItems(prev => prev.map((item, i) => {
            if (i === index) {
                return { ...item, [field]: value }
            }
            return item
        }))
    }

    const subtotal = items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0)
    const vat = subtotal * 0.15
    const total = subtotal + vat

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!clientId) {
            alert("Please select a client.")
            return
        }
        if (items.some(i => !i.description.trim())) {
            alert("Please enter a description for all line items.")
            return
        }
        if (items.some(i => Number(i.unitPrice) <= 0)) {
            alert("Please provide valid prices for credited items.")
            return
        }

        setLoading(true)
        try {
            const newId = await createCreditNoteAction({
                clientId,
                invoiceId: invoiceId || null,
                workType,
                tenderId: workType === "TENDER" ? selectedTenderId : null,
                reason,
                notes: notes.trim() || null,
                date,
                items: items.map(item => ({
                    code: item.code.trim() || null,
                    description: item.description.trim(),
                    quantity: Number(item.quantity) || 1,
                    unit: item.unit.trim() || "each",
                    unitPrice: Number(item.unitPrice) || 0
                }))
            })

            onClose()
            router.push(`/credit-notes/${newId}`)
        } catch (error: any) {
            console.error("Error creating credit note:", error)
            alert(error.message || "Failed to create credit note")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#14141E] text-white border-white/10 p-6">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                            <FileText className="h-4 w-4" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black">Issue Tax Credit Note</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Create an official SARS-compliant Credit Note referencing an original Tax Invoice or direct billing credit.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                    {/* Top Row: Client, Invoice Reference, Date */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                                Client *
                            </label>
                            <select
                                value={clientId}
                                onChange={(e) => {
                                    setClientId(e.target.value)
                                    setInvoiceId("")
                                }}
                                className="w-full h-9 rounded-lg bg-[#1C1C28] border border-white/10 px-3 text-xs font-semibold focus:outline-none focus:border-rose-500 text-white"
                                required
                            >
                                <option value="" disabled>Select client...</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id} className="bg-[#1C1C28]">{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex justify-between">
                                <span>Original Tax Invoice</span>
                                <span className="text-[9px] text-muted-foreground/60">(Optional)</span>
                            </label>
                            <select
                                value={invoiceId}
                                onChange={(e) => handleInvoiceSelect(e.target.value)}
                                className="w-full h-9 rounded-lg bg-[#1C1C28] border border-white/10 px-3 text-xs font-semibold focus:outline-none focus:border-rose-500 text-white"
                            >
                                <option value="">-- Standalone Credit --</option>
                                {clientInvoices.map(inv => (
                                    <option key={inv.id} value={inv.id} className="bg-[#1C1C28]">
                                        {inv.quoteNumber || `INV-${String(inv.number).padStart(3, '0')}`} ({formatCurrency(inv.total)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                                Credit Note Date *
                            </label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="h-9 bg-[#1C1C28] border-white/10 text-xs font-semibold"
                                required
                            />
                        </div>
                    </div>

                    {/* Second Row: Work Type & Reason */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                                Work Type
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setWorkType("GENERAL")}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                                        workType === "GENERAL"
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "bg-[#1C1C28] text-muted-foreground hover:text-white border border-white/5"
                                    }`}
                                >
                                    General
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWorkType("TENDER")}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                        workType === "TENDER"
                                            ? "bg-amber-500 text-black font-black shadow-sm"
                                            : "bg-[#1C1C28] text-muted-foreground hover:text-white border border-white/5"
                                    }`}
                                >
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                    Tender 152G
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                                Circumstance / Reason for Credit *
                            </label>
                            <Input
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g. Scope reduction, damaged swing component credit, rate recalculation"
                                className="h-9 bg-[#1C1C28] border-white/10 text-xs"
                                required
                            />
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                Credited Line Items
                            </h3>
                            <div className="flex items-center gap-2">
                                {invoiceId && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleImportInvoiceItems}
                                        className="h-7 text-[10px] border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white"
                                    >
                                        Copy Items from Invoice
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddItem}
                                    className="h-7 text-[10px] border-white/10 bg-white/5 hover:bg-white/10 text-white"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add Row
                                </Button>
                            </div>
                        </div>

                        <div className="border border-white/10 rounded-xl overflow-hidden bg-[#181824]">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-[#1C1C28] border-b border-white/10 text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                                    <tr>
                                        <th className="py-2.5 px-3 w-20">Code</th>
                                        <th className="py-2.5 px-3">Service Description</th>
                                        <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                                        <th className="py-2.5 px-3 w-24">Unit</th>
                                        <th className="py-2.5 px-3 w-28 text-right">Unit Price</th>
                                        <th className="py-2.5 px-3 w-28 text-right">Credit Total</th>
                                        <th className="py-2.5 px-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-white/[0.02]">
                                            <td className="py-2 px-2">
                                                <Input
                                                    value={item.code}
                                                    onChange={(e) => handleItemChange(idx, "code", e.target.value)}
                                                    placeholder="e.g. 17.30"
                                                    className="h-8 text-xs font-mono bg-transparent border-white/10"
                                                />
                                            </td>
                                            <td className="py-2 px-2">
                                                <Input
                                                    value={item.description}
                                                    onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                                                    placeholder="Description of credited service or material..."
                                                    className="h-8 text-xs bg-transparent border-white/10"
                                                    required
                                                />
                                            </td>
                                            <td className="py-2 px-2">
                                                <Input
                                                    type="number"
                                                    step="any"
                                                    min="0.01"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                                                    className="h-8 text-xs text-center bg-transparent border-white/10"
                                                    required
                                                />
                                            </td>
                                            <td className="py-2 px-2">
                                                <Input
                                                    value={item.unit}
                                                    onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                                                    placeholder="each"
                                                    className="h-8 text-xs bg-transparent border-white/10"
                                                />
                                            </td>
                                            <td className="py-2 px-2">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={item.unitPrice}
                                                    onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                                                    className="h-8 text-xs text-right bg-transparent border-white/10"
                                                    required
                                                />
                                            </td>
                                            <td className="py-2 px-3 text-right font-black font-mono text-rose-400">
                                                {formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                {items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="text-muted-foreground hover:text-rose-400 transition-colors"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bottom Row: Notes & Financial Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                                Additional Notes / References
                            </label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional terms, instructions, or internal notes..."
                                className="h-20 bg-[#1C1C28] border-white/10 text-xs resize-none"
                            />
                        </div>

                        <div className="bg-[#1C1C28] border border-white/10 rounded-xl p-4 space-y-2 text-xs">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Credited Subtotal (excl. VAT):</span>
                                <span className="font-mono font-bold text-white">{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>VAT (15%):</span>
                                <span className="font-mono font-bold text-white">{formatCurrency(vat)}</span>
                            </div>
                            <div className="border-t border-white/10 pt-2 flex justify-between font-black text-sm text-rose-400">
                                <span>Total Credit Amount:</span>
                                <span className="font-mono">{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="text-xs text-muted-foreground hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-5 shadow-lg shadow-rose-900/20"
                        >
                            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            Issue Credit Note
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
