"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Trash2, ExternalLink, CheckCircle2, ShieldCheck, FileText } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { updateCreditNoteStatusAction, deleteCreditNoteAction } from "@/app/actions/credit-notes"

interface CreditNoteViewerProps {
    creditNote: any
    companySettings: any
}

export function CreditNoteViewer({ creditNote, companySettings }: CreditNoteViewerProps) {
    const router = useRouter()
    const [status, setStatus] = useState(creditNote.status || "ISSUED")
    const [isUpdating, setIsUpdating] = useState(false)

    const company = {
        name: companySettings?.name || "LR Builders & Maintenance Pty (Ltd)",
        address: companySettings?.address || "15 Culemborg Street, Avondale, Parow, Cape Town, 7500",
        email: companySettings?.email || "Loedvi@lrbuilders.co.za",
        phone: companySettings?.phone || "082 448 7490",
        vatNumber: companySettings?.taxId || "4880295847",
        logoUrl: companySettings?.logoUrl || ""
    }

    const client = creditNote.client
    const invoice = creditNote.invoice
    const tender = creditNote.tender
    const isTender = creditNote.workType === "TENDER" || Boolean(tender)

    const handleStatusChange = async (newStatus: string) => {
        setIsUpdating(true)
        try {
            await updateCreditNoteStatusAction(creditNote.id, newStatus)
            setStatus(newStatus)
        } catch (error: any) {
            alert(error.message || "Failed to update status")
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete Credit Note ${creditNote.creditNoteNumber}?`)) return
        try {
            await deleteCreditNoteAction(creditNote.id)
            router.push("/credit-notes")
        } catch (error: any) {
            alert(error.message || "Failed to delete credit note")
        }
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            {/* Top Toolbar (Hidden when printing) */}
            <div className="print:hidden flex items-center justify-between flex-wrap gap-4 bg-[#14141E] border border-white/10 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                    <Link href="/credit-notes">
                        <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs font-bold text-muted-foreground hover:text-white">
                            <ArrowLeft className="w-4 h-4" /> Back to Credit Notes
                        </Button>
                    </Link>

                    <span className="h-4 w-px bg-white/10" />

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Status:</span>
                        <select
                            value={status}
                            disabled={isUpdating}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className="bg-[#1C1C28] border border-white/10 rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                        >
                            <option value="ISSUED">ISSUED</option>
                            <option value="DRAFT">DRAFT</option>
                            <option value="APPLIED">APPLIED</option>
                            <option value="CANCELLED">CANCELLED</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        onClick={handlePrint}
                        className="bg-white text-black hover:bg-white/90 font-bold text-xs shadow-md rounded-xl h-9"
                    >
                        <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / Save PDF
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDelete}
                        className="text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 h-9 w-9 rounded-xl"
                        title="Delete Credit Note"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Official Printable Tax Credit Note Document */}
            <div className="bg-white text-black p-8 sm:p-12 rounded-2xl shadow-2xl border border-gray-200 print:p-0 print:border-none print:shadow-none print:m-0 print:rounded-none">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-rose-600 pb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-black tracking-tight text-gray-900">{company.name}</h2>
                        </div>
                        <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed max-w-sm">
                            {company.address}
                        </p>
                        <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                            <div><span className="font-semibold text-gray-800">Phone:</span> {company.phone}</div>
                            <div><span className="font-semibold text-gray-800">Email:</span> {company.email}</div>
                            <div><span className="font-semibold text-gray-800">VAT Reg No:</span> {company.vatNumber}</div>
                        </div>
                    </div>

                    <div className="text-right sm:self-start">
                        <div className="inline-block bg-rose-600 text-white font-black text-xl sm:text-2xl px-4 py-1.5 rounded-lg tracking-wider uppercase mb-3">
                            TAX CREDIT NOTE
                        </div>
                        <div className="text-sm font-black font-mono text-gray-900">
                            {creditNote.creditNoteNumber || `CN-${String(creditNote.number).padStart(3, '0')}`}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                            <span className="font-semibold text-gray-800">Date Issued:</span> {new Date(creditNote.date).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}
                        </div>
                        {isTender && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                                TENDER 152G/2025/26
                            </div>
                        )}
                    </div>
                </div>

                {/* Bill To & Invoice Reference Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 my-8 text-xs">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <span className="font-black uppercase tracking-wider text-[10px] text-gray-500 block mb-2">CREDIT ISSUED TO:</span>
                        <div className="text-sm font-bold text-gray-900">{client?.name}</div>
                        {client?.companyName && <div className="text-gray-700 font-medium">{client.companyName}</div>}
                        {client?.address && <div className="text-gray-600 whitespace-pre-line mt-1">{client.address}</div>}
                        {client?.vatNumber && (
                            <div className="mt-2 font-semibold text-gray-800">
                                VAT Number: {client.vatNumber}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
                        <span className="font-black uppercase tracking-wider text-[10px] text-gray-500 block">ORIGINAL INVOICE REFERENCE:</span>
                        {invoice ? (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Tax Invoice Number:</span>
                                    <span className="font-mono font-bold text-gray-900">{invoice.quoteNumber || `INV-${String(invoice.number).padStart(3, '0')}`}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Invoice Date:</span>
                                    <span className="font-medium text-gray-800">{new Date(invoice.date).toLocaleDateString("en-ZA")}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Original Invoice Total:</span>
                                    <span className="font-mono font-bold text-gray-900">{formatCurrency(invoice.total)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-600 italic">Direct Account / Billing Credit (No Tax Invoice linked)</div>
                        )}

                        <div className="border-t border-gray-200 pt-2 mt-2">
                            <span className="font-semibold text-gray-700 block text-[10px] uppercase">Reason for Credit:</span>
                            <span className="text-rose-700 font-bold block mt-0.5">{creditNote.reason || "Credit adjustment"}</span>
                        </div>
                    </div>
                </div>

                {/* Line Items Table */}
                <div className="my-8">
                    <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-100 text-gray-700 border-b border-gray-200 text-[10px] font-black uppercase tracking-wider">
                            <tr>
                                <th className="py-2.5 px-3 w-10 text-center">#</th>
                                <th className="py-2.5 px-3 w-20">Code</th>
                                <th className="py-2.5 px-4">Service Description</th>
                                <th className="py-2.5 px-3 w-16 text-center">Qty</th>
                                <th className="py-2.5 px-3 w-20">Unit</th>
                                <th className="py-2.5 px-4 w-28 text-right">Rate (excl)</th>
                                <th className="py-2.5 px-4 w-32 text-right">Total (excl)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {creditNote.items.map((item: any, idx: number) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-3 text-center text-gray-500 font-mono text-[11px]">{idx + 1}</td>
                                    <td className="py-3 px-3 font-mono font-bold text-gray-900 text-[11px]">
                                        {item.code || "-"}
                                    </td>
                                    <td className="py-3 px-4 text-gray-900 font-medium">
                                        {item.description}
                                    </td>
                                    <td className="py-3 px-3 text-center font-mono font-bold text-gray-900">
                                        {item.quantity}
                                    </td>
                                    <td className="py-3 px-3 text-gray-600">
                                        {item.unit || "each"}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-gray-800">
                                        {formatCurrency(item.unitPrice)}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                                        {formatCurrency(item.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Financial Summary & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-start my-8">
                    <div className="space-y-3 text-xs text-gray-600">
                        {creditNote.notes && (
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <span className="font-bold text-gray-800 block text-[10px] uppercase mb-1">Notes:</span>
                                <p className="whitespace-pre-line leading-relaxed">{creditNote.notes}</p>
                            </div>
                        )}
                        <p className="text-[11px] text-gray-500 italic">
                            This Tax Credit Note is issued in accordance with Section 21 of the Value-Added Tax Act, 1991 of the Republic of South Africa.
                        </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-xs">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal (excl. VAT):</span>
                            <span className="font-mono font-bold text-gray-900">{formatCurrency(creditNote.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>VAT @ 15%:</span>
                            <span className="font-mono font-bold text-gray-900">{formatCurrency(creditNote.taxAmount)}</span>
                        </div>
                        <div className="border-t-2 border-rose-600 pt-2 flex justify-between font-black text-base text-rose-600">
                            <span>TOTAL CREDIT AMOUNT:</span>
                            <span className="font-mono">{formatCurrency(creditNote.total)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-6 text-center text-[10px] text-gray-500 uppercase font-semibold tracking-wider">
                    {company.name} • Registered VAT Vendor #{company.vatNumber} • Thank you for your business.
                </div>
            </div>
        </div>
    )
}
