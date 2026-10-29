'use client'

import React, { useState, useRef, useEffect } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    CheckCircle2,
    ShieldCheck,
    AlertTriangle,
    FileText,
    Clock,
    Lock,
    Edit3,
    Send,
    Loader2,
    Building2,
    ChevronRight,
    Download
} from "lucide-react"
import { acceptQuotePublicAction, requestQuoteChangesPublicAction } from "@/app/(dashboard)/invoices/acceptance-actions"

interface ClientQuoteAcceptanceProps {
    quote: any
    company: any
    companySettings?: any
    isExpired: boolean
    isLockedByApproval: boolean
    expiryDate: Date
    validityDays: number
}

export function ClientQuoteAcceptance({
    quote,
    company,
    companySettings,
    isExpired,
    isLockedByApproval,
    expiryDate,
    validityDays
}: ClientQuoteAcceptanceProps) {
    const [activeTab, setActiveTab] = useState<'VIEW' | 'ACCEPT' | 'REVISE'>('ACCEPT')
    
    // Acceptance form state
    const [name, setName] = useState(quote.attentionTo || "")
    const [position, setPosition] = useState("")
    const [email, setEmail] = useState(quote.client?.email || "")
    const [poNumber, setPoNumber] = useState("")
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitSuccess, setSubmitSuccess] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // Revision request state
    const [revisionName, setRevisionName] = useState(quote.attentionTo || "")
    const [revisionEmail, setRevisionEmail] = useState(quote.client?.email || "")
    const [revisionMessage, setRevisionMessage] = useState("")
    const [revisionSubmitting, setRevisionSubmitting] = useState(false)
    const [revisionSuccess, setRevisionSuccess] = useState(false)

    // Canvas Signature Pad
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasSignature, setHasSignature] = useState(false)

    const isAccepted = quote.status === 'ACCEPTED' || submitSuccess
    const acceptance = quote.metadata?.acceptance || {}

    // Canvas drawing helpers
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.strokeStyle = '#D05E00' // AeroWash Orange
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
    }, [activeTab])

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        setIsDrawing(true)
        setHasSignature(true)
        const rect = canvas.getBoundingClientRect()
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

        ctx.beginPath()
        ctx.moveTo(clientX - rect.left, clientY - rect.top)
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

        ctx.lineTo(clientX - rect.left, clientY - rect.top)
        ctx.stroke()
    }

    const stopDrawing = () => {
        setIsDrawing(false)
    }

    const clearSignature = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setHasSignature(false)
    }

    const handleAcceptSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (!hasSignature) {
            setErrorMessage("Please provide your signature on the signature pad below.")
            return
        }

        const canvas = canvasRef.current
        const signatureDataUrl = canvas ? canvas.toDataURL("image/png") : ""

        try {
            setIsSubmitting(true)
            const res = await acceptQuotePublicAction({
                quoteId: quote.id,
                acceptedByName: name,
                acceptedByPosition: position,
                acceptedByEmail: email,
                poNumber,
                termsAccepted,
                signatureDataUrl
            })

            if (res.success) {
                setSubmitSuccess(true)
            } else {
                setErrorMessage(res.error || "Failed to accept quotation")
            }
        } catch (err: any) {
            setErrorMessage(err?.message || "An unexpected error occurred.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRevisionSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        try {
            setRevisionSubmitting(true)
            const res = await requestQuoteChangesPublicAction({
                quoteId: quote.id,
                name: revisionName,
                email: revisionEmail,
                message: revisionMessage
            })

            if (res.success) {
                setRevisionSuccess(true)
            } else {
                setErrorMessage(res.error || "Failed to submit change request")
            }
        } catch (err: any) {
            setErrorMessage(err?.message || "An unexpected error occurred.")
        } finally {
            setRevisionSubmitting(false)
        }
    }

    const formattedDate = new Date(quote.date).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })

    const formattedExpiry = expiryDate.toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })

    return (
        <div className="min-h-screen bg-[#070B14] text-white">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 bg-[#0B1120]/90 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#D05E00] flex items-center justify-center font-black text-white text-sm shadow">
                        AW
                    </div>
                    <div>
                        <div className="font-extrabold text-sm text-white tracking-wide">
                            {companySettings?.name || company?.name || "AeroWash (Pty) Ltd"}
                        </div>
                        <div className="text-[10px] text-gray-400">
                            Quotation {quote.quoteNumber || quote.number}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-block text-xs text-gray-400">Total:</span>
                    <span className="text-sm sm:text-base font-black text-[#D05E00]">
                        {formatCurrency(quote.total, "R")}
                    </span>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                {/* Status Banners */}
                {isLockedByApproval ? (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                        <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-amber-300">Quotation Pending Authorization</h4>
                            <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                                This quotation exceeds our standard sign-off threshold and is currently undergoing internal authorization by company management. Acceptance will open automatically once approved.
                            </p>
                        </div>
                    </div>
                ) : isExpired ? (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                        <Clock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-red-300">Quotation Expired</h4>
                            <p className="text-xs text-red-200/80 mt-1 leading-relaxed">
                                This quotation was valid until {formattedExpiry} and has now expired. Please contact AeroWash at <strong className="text-white">info@aerowash.co.za</strong> to request an updated quotation.
                            </p>
                        </div>
                    </div>
                ) : isAccepted ? (
                    <div className="p-4 sm:p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-4">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
                        <div className="space-y-1">
                            <h4 className="text-base font-bold text-emerald-300">Quotation Officially Accepted</h4>
                            <p className="text-xs text-emerald-200/80 leading-relaxed">
                                Accepted on {acceptance.acceptedAt ? new Date(acceptance.acceptedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Today'} by <strong className="text-white">{acceptance.acceptedByName || name}</strong> ({acceptance.acceptedByPosition || position}).
                            </p>
                            {acceptance.poNumber && (
                                <p className="text-xs text-gray-300">Purchase Order: <strong className="text-white">{acceptance.poNumber}</strong></p>
                            )}
                            <p className="text-xs text-emerald-400 font-semibold pt-1">
                                ✓ 60% Deposit invoice has been generated and dispatched to your email. Our scheduling team will contact you shortly to coordinate access.
                            </p>
                        </div>
                    </div>
                ) : null}

                {/* Document View Card */}
                <div className="bg-[#0E1626] rounded-2xl border border-white/10 p-6 sm:p-8 space-y-8 shadow-2xl">
                    {/* Header Details */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-white/10 pb-6">
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#D05E00]">
                                OFFICIAL QUOTATION
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                                {quote.quoteNumber || quote.number}
                            </h1>
                            <p className="text-xs text-gray-400 mt-1">Date: {formattedDate} • Valid until: {formattedExpiry} ({validityDays} days)</p>
                        </div>
                        <div className="text-left sm:text-right">
                            <div className="text-xs text-gray-400">Prepared for:</div>
                            <div className="text-base font-bold text-white">{quote.client?.companyName || quote.client?.name}</div>
                            {quote.attentionTo && <div className="text-xs text-gray-300">Attn: {quote.attentionTo}</div>}
                            {quote.site && <div className="text-xs text-orange-400/90 font-medium mt-0.5">Site: {quote.site}</div>}
                        </div>
                    </div>

                    {/* Scope / Elevation Line Items */}
                    <div className="space-y-3">
                        <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                            Quotation Breakdown
                        </div>
                        <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-black/20">
                            {quote.items.map((item: any, idx: number) => (
                                <div key={item.id || idx} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-white/[0.02]">
                                    <div className="space-y-1 pr-4">
                                        <div className="text-xs font-bold text-white">
                                            {item.description.split('\n')[0]}
                                        </div>
                                        {item.description.includes('\n') && (
                                            <div className="text-[11px] text-gray-400 leading-relaxed">
                                                {item.description.split('\n').slice(1).join('\n')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs sm:text-sm font-bold text-white shrink-0 self-end sm:self-center font-mono">
                                        {formatCurrency(item.total, "R")}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Totals Summary */}
                    <div className="flex flex-col items-end gap-1.5 pt-4 border-t border-white/10 text-xs">
                        <div className="flex justify-between w-full max-w-xs text-gray-400">
                            <span>Subtotal:</span>
                            <span className="font-mono text-white">{formatCurrency(quote.subtotal, "R")}</span>
                        </div>
                        {quote.taxAmount > 0 && (
                            <div className="flex justify-between w-full max-w-xs text-gray-400">
                                <span>VAT ({(quote.taxRate * 100).toFixed(0)}%):</span>
                                <span className="font-mono text-white">{formatCurrency(quote.taxAmount, "R")}</span>
                            </div>
                        )}
                        <div className="flex justify-between w-full max-w-xs text-base font-extrabold text-[#D05E00] pt-2 border-t border-white/10">
                            <span>TOTAL DUE:</span>
                            <span className="font-mono">{formatCurrency(quote.total, "R")}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 text-right pt-1">
                            Payment terms: 60% Deposit upon quotation acceptance; 40% balance upon completion.
                        </div>
                    </div>
                </div>

                {/* Acceptance or Changes Request Form */}
                {!isAccepted && !isExpired && !isLockedByApproval && (
                    <div className="bg-[#0E1626] rounded-2xl border border-white/10 p-6 sm:p-8 space-y-6 shadow-2xl">
                        {/* Tab Switcher */}
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 max-w-md mx-auto">
                            <button
                                type="button"
                                onClick={() => setActiveTab('ACCEPT')}
                                className={cn(
                                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                                    activeTab === 'ACCEPT' ? "bg-[#D05E00] text-white shadow-md" : "text-gray-400 hover:text-white"
                                )}
                            >
                                Accept Quotation
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('REVISE')}
                                className={cn(
                                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                                    activeTab === 'REVISE' ? "bg-white/10 text-white shadow-md" : "text-gray-400 hover:text-white"
                                )}
                            >
                                Request Changes
                            </button>
                        </div>

                        {errorMessage && (
                            <div className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-semibold">
                                {errorMessage}
                            </div>
                        )}

                        {activeTab === 'ACCEPT' ? (
                            <form onSubmit={handleAcceptSubmit} className="space-y-5">
                                <div>
                                    <h3 className="text-base font-bold text-white">Acceptance Sign-Off</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Please complete your details and sign below to officially authorize this quotation.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-gray-300">Full Name *</Label>
                                        <Input
                                            required
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Your full name"
                                            className="bg-white/5 border-white/10 text-white text-xs h-10"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-gray-300">Position / Job Title *</Label>
                                        <Input
                                            required
                                            value={position}
                                            onChange={e => setPosition(e.target.value)}
                                            placeholder="e.g. Property Manager, Director"
                                            className="bg-white/5 border-white/10 text-white text-xs h-10"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-gray-300">Official Email *</Label>
                                        <Input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="your.email@company.co.za"
                                            className="bg-white/5 border-white/10 text-white text-xs h-10"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-gray-300">Purchase Order (PO) Number (Optional)</Label>
                                        <Input
                                            value={poNumber}
                                            onChange={e => setPoNumber(e.target.value)}
                                            placeholder="e.g. PO-2026-449"
                                            className="bg-white/5 border-white/10 text-white text-xs h-10"
                                        />
                                    </div>
                                </div>

                                {/* On-Screen Signature Canvas */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs text-gray-300">Sign with Mouse or Finger (Touch screen) *</Label>
                                        {hasSignature && (
                                            <button
                                                type="button"
                                                onClick={clearSignature}
                                                className="text-[11px] text-gray-400 hover:text-white underline"
                                            >
                                                Clear Signature
                                            </button>
                                        )}
                                    </div>
                                    <div className="rounded-xl border border-white/15 bg-black/40 overflow-hidden relative">
                                        <canvas
                                            ref={canvasRef}
                                            width={600}
                                            height={160}
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseLeave={stopDrawing}
                                            onTouchStart={startDrawing}
                                            onTouchMove={draw}
                                            onTouchEnd={stopDrawing}
                                            className="w-full h-36 cursor-crosshair touch-none"
                                        />
                                        {!hasSignature && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-500 text-xs italic">
                                                Sign here
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Terms Checkbox */}
                                <label className="flex items-start gap-2.5 cursor-pointer pt-2">
                                    <input
                                        type="checkbox"
                                        required
                                        checked={termsAccepted}
                                        onChange={e => setTermsAccepted(e.target.checked)}
                                        className="mt-0.5 rounded text-[#D05E00] focus:ring-0"
                                    />
                                    <span className="text-xs text-gray-300 leading-relaxed">
                                        I confirm that I am authorized to accept this quotation and agree to AeroWash Terms and Conditions of service.
                                    </span>
                                </label>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !termsAccepted || !hasSignature}
                                    className="w-full h-12 bg-[#D05E00] hover:bg-[#B34E00] text-white font-extrabold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Processing Acceptance &amp; Generating Deposit...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="w-4 h-4" />
                                            <span>Accept &amp; Authorize Quotation</span>
                                        </>
                                    )}
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleRevisionSubmit} className="space-y-4">
                                <div>
                                    <h3 className="text-base font-bold text-white">Request Quotation Changes</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Let us know what you would like adjusted or clarified. Our operations team will review and reply promptly.
                                    </p>
                                </div>

                                {revisionSuccess ? (
                                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                                        ✓ Your change request has been submitted. AeroWash has been notified and will contact you shortly with an updated quotation.
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-gray-300">Your Name *</Label>
                                                <Input
                                                    required
                                                    value={revisionName}
                                                    onChange={e => setRevisionName(e.target.value)}
                                                    placeholder="Your name"
                                                    className="bg-white/5 border-white/10 text-white text-xs h-10"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-gray-300">Your Email *</Label>
                                                <Input
                                                    type="email"
                                                    required
                                                    value={revisionEmail}
                                                    onChange={e => setRevisionEmail(e.target.value)}
                                                    placeholder="your.email@company.co.za"
                                                    className="bg-white/5 border-white/10 text-white text-xs h-10"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-gray-300">Requested Adjustments *</Label>
                                            <Textarea
                                                required
                                                rows={4}
                                                value={revisionMessage}
                                                onChange={e => setRevisionMessage(e.target.value)}
                                                placeholder="e.g. Please add detail hand cleaning for the rear entrance, or provide an option for quarterly visits."
                                                className="bg-white/5 border-white/10 text-white text-xs"
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={revisionSubmitting || !revisionMessage.trim()}
                                            className="w-full h-11 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2"
                                        >
                                            {revisionSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            <span>Send Change Request</span>
                                        </Button>
                                    </>
                                )}
                            </form>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
