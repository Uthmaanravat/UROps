"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash, Wand2, Loader2, FileText } from "lucide-react"
import { createInvoiceAction } from "@/app/(dashboard)/invoices/actions"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"

import { parseScopeAction } from "@/app/(dashboard)/invoices/ai-actions"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { VoiceRecorder } from "@/components/voice/VoiceRecorder"
import { getFixedPriceItemsAction } from "@/app/(dashboard)/knowledge/fixed-actions"
import { Search, Book } from "lucide-react"
import { useEffect } from "react"

interface QuoteFormProps {
    clients: { id: string; name: string }[]
    projects: { id: string; name: string, clientId: string }[]
    initialClientId?: string
    initialProjectId?: string
    initialScope?: string
    aiEnabled?: boolean
}

export function QuoteForm({ clients, projects, initialClientId, initialProjectId, initialScope, aiEnabled = true }: QuoteFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [scopeOpen, setScopeOpen] = useState(!!initialScope)
    const [scopeText, setScopeText] = useState(initialScope || "")
    const [isProcessingScope, setIsProcessingScope] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null)

    const [clientId, setClientId] = useState(initialClientId || (clients.length > 0 ? clients[0].id : ""))
    const [projectId, setProjectId] = useState(initialProjectId || "")
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])

    const [items, setItems] = useState(initialScope ? [] : [{ description: "", quantity: 1, unit: "", unitPrice: 0, area: "" }])
    const [site, setSite] = useState("")
    const [quoteNumber, setQuoteNumber] = useState("")
    const [reference, setReference] = useState("")
    const [paymentNotes, setPaymentNotes] = useState("50% deposit required before project commences.")
    const [showPaymentNotes, setShowPaymentNotes] = useState(true)

    // Catalog state
    const [catalog, setCatalog] = useState<any[]>([])
    const [catalogSearch, setCatalogSearch] = useState("")
    const [isCatalogOpen, setIsCatalogOpen] = useState(false)

    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const data = await getFixedPriceItemsAction()
                setCatalog(data)
            } catch (err) {
                console.error("Failed to load catalog", err)
            }
        }
        loadCatalog()
    }, [])

    const filteredCatalog = catalog.filter(item =>
        item.description.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.category?.toLowerCase().includes(catalogSearch.toLowerCase())
    )

    const addFromCatalog = (catalogItem: any) => {
        // If the last item is empty, replace it, otherwise add new
        const lastItem = items[items.length - 1]
        const newItem = {
            description: catalogItem.description,
            quantity: 1,
            unit: catalogItem.unit || "",
            unitPrice: catalogItem.unitPrice,
            area: ""
        }

        if (items.length === 1 && !items[0].description && items[0].unitPrice === 0) {
            setItems([newItem])
        } else {
            setItems([...items, newItem])
        }
        setIsCatalogOpen(false)
        setCatalogSearch("")
    }

    const addItem = () => {
        setItems([...items, { description: "", quantity: 1, unit: "", unitPrice: 0, area: "" }])
    }

    const removeItem = (index: number) => {
        const newItems = [...items]
        newItems.splice(index, 1)
        setItems(newItems)
    }

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items]
        // @ts-ignore
        newItems[index][field] = value
        setItems(newItems)
    }

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const tax = subtotal * 0.15
    const total = subtotal + tax

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const invoiceId = await createInvoiceAction({
                clientId,
                projectId: projectId || undefined,
                date,
                items,
                site,
                quoteNumber,
                reference,
                paymentNotes: showPaymentNotes ? paymentNotes : undefined
            })
            setLastInvoiceId(invoiceId)
            setSubmitted(true)
            router.refresh()
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    if (submitted) {
        return (
            <div className="space-y-6 max-w-lg mx-auto py-10">
                <Card className="bg-primary/10 border-primary shadow-2xl overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <CardContent className="p-8 text-center space-y-6">
                        <div className="mx-auto bg-primary rounded-full p-4 w-16 h-16 flex items-center justify-center">
                            <FileText className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-primary uppercase tracking-wider">
                                ✅ Quotation submitted
                            </h2>
                            <p className="text-muted-foreground font-medium">
                                Your quotation has been generated and is ready for client review.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 pt-4">
                            <Link href={`/invoices/${lastInvoiceId}`} className="w-full">
                                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-12">
                                    View Official Document
                                </Button>
                            </Link>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSubmitted(false)
                                    setItems([{ description: "", quantity: 1, unit: "", unitPrice: 0, area: "" }])
                                }}
                                className="text-muted-foreground hover:text-white font-bold"
                            >
                                Create Another Quotation
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div >
        )
    }

    return (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Header Details */}
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Client</Label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={clientId}
                                onChange={(e) => {
                                    setClientId(e.target.value);
                                    setProjectId(""); // Reset project when client changes
                                }}
                                required
                            >
                                <option value="" disabled>Select a client</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Site Name / Address</Label>
                            <Input
                                placeholder="e.g. 123 Main St"
                                value={site}
                                onChange={(e) => setSite(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Quote # (Optional)</Label>
                                <Input
                                    placeholder="e.g. Q-2024-001"
                                    value={quoteNumber}
                                    onChange={(e) => setQuoteNumber(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Reference</Label>
                                <Input
                                    placeholder="e.g. PO-789"
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Voice Action */}
                <VoiceRecorder onParsed={(newItems) => {
                    if (newItems && newItems.length > 0) {
                        const formattedItems = newItems.map(i => ({
                            description: i.description,
                            quantity: i.quantity || 1,
                            unit: i.unit || "",
                            unitPrice: i.unitPrice || 0,
                            area: ""
                        }));
                        setItems(formattedItems);
                    }
                }} />

                {/* AI Action */}
                {aiEnabled && (
                    <div className="rounded-md bg-muted/50 p-4 border border-blue-100 dark:border-blue-900">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">Use AI to generate items from scope?</div>

                            <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
                                <DialogTrigger asChild>
                                    <Button type="button" variant="secondary" size="sm">
                                        <Wand2 className="mr-2 h-3 w-3" />
                                        Paste Scope
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Paste Scope of Work</DialogTitle>
                                        <DialogDescription>
                                            Paste the email, message, or notes here. The AI will break it down into priced line items.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <Textarea
                                            placeholder="e.g. Install 3 new AC units in the main hall..."
                                            className="min-h-[150px]"
                                            value={scopeText}
                                            onChange={(e) => setScopeText(e.target.value)}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" onClick={async () => {
                                            if (!scopeText) return;
                                            setIsProcessingScope(true);
                                            try {
                                                const newItems = await parseScopeAction(scopeText);
                                                // @ts-ignore
                                                if (newItems && newItems.length > 0) {
                                                    // @ts-ignore
                                                    const formattedItems = newItems.map(i => ({
                                                        description: i.description,
                                                        quantity: i.quantity || 1,
                                                        unit: "",
                                                        unitPrice: i.unitPrice || 0,
                                                        area: ""
                                                    }));

                                                    if (confirm(`AI found ${formattedItems.length} items. Replace current items?`)) {
                                                        setItems(formattedItems);
                                                        setScopeOpen(false);
                                                    }
                                                } else {
                                                    alert("Could not extract items. Try being more specific.");
                                                }
                                            } catch (e) {
                                                alert("AI Error. Please check API Key.");
                                            } finally {
                                                setIsProcessingScope(false);
                                            }
                                        }} disabled={isProcessingScope}>
                                            {isProcessingScope && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Generate Items
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                )}

                {/* Catalog Picker */}
                {catalog.length > 0 && (
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-2">
                            <Book className="h-4 w-4 text-primary" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground italic">Standard Catalog</h3>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            </div>
                            <Input
                                placeholder="Search your standard catalog (e.g. Call-out, Labor...)"
                                className="pl-10 bg-primary/5 border-primary/20 hover:border-primary/40 focus:border-primary transition-all text-sm font-bold h-11"
                                value={catalogSearch}
                                onChange={(e) => {
                                    setCatalogSearch(e.target.value)
                                    setIsCatalogOpen(true)
                                }}
                                onFocus={() => setIsCatalogOpen(true)}
                            />

                            {isCatalogOpen && catalogSearch && (
                                <div className="absolute z-50 w-full mt-2 bg-[#1A1A2E] border border-primary/20 rounded-xl shadow-2xl max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-200">
                                    {filteredCatalog.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-muted-foreground italic">
                                            No matching standard items found.
                                        </div>
                                    ) : (
                                        <div className="p-1">
                                            {filteredCatalog.map(item => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => addFromCatalog(item)}
                                                    className="w-full text-left p-3 hover:bg-primary/10 rounded-lg flex items-center justify-between group/item transition-colors"
                                                >
                                                    <div>
                                                        <p className="font-bold text-white group-hover/item:text-primary transition-colors">{item.description}</p>
                                                        {item.category && <p className="text-[10px] text-muted-foreground uppercase">{item.category}</p>}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-primary">{formatCurrency(item.unitPrice)}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase">{item.unit || 'ea'}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {isCatalogOpen && catalogSearch && (
                            <div
                                className="fixed inset-0 z-40 transition-opacity"
                                onClick={() => setIsCatalogOpen(false)}
                            />
                        )}
                    </div>
                )}


                {/* Items */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="font-semibold">Line Items</h3>
                        <Button type="button" onClick={addItem} size="sm" variant="outline">
                            <Plus className="mr-2 h-4 w-4" /> Add Item
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-4">
                            {items.map((item, index) => (
                                <div key={index} className="flex flex-col md:flex-row gap-4 md:gap-3 items-start p-4 md:p-0 rounded-2xl border md:border-none bg-white/[0.02] md:bg-transparent shadow-sm md:shadow-none border-white/5 md:border-transparent group/row">
                                    <div className="flex-1 w-full space-y-2 md:space-y-0 flex gap-2">
                                        <div className="flex-1">
                                            <Label className="md:hidden text-[10px] uppercase font-black tracking-widest text-primary/70">Description & Details</Label>
                                            <Input
                                                placeholder="Item description..."
                                                value={item.description}
                                                onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-medium"
                                                required
                                            />
                                        </div>
                                        <div className="w-1/3 max-w-[120px]">
                                            <Label className="md:hidden text-[10px] uppercase font-black tracking-widest text-primary/70">Heading</Label>
                                            <Input
                                                placeholder="HEADING (OPTIONAL)"
                                                // @ts-ignore
                                                value={item.area || ""}
                                                onChange={(e) => updateItem(index, 'area', e.target.value)}
                                                className="bg-[#14141E] border-white/10 focus:border-primary/50 text-[10px] font-bold text-primary uppercase tracking-widest"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
                                        <div className="space-y-2 md:space-y-0 md:w-20">
                                            <Label className="md:hidden text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Qty</Label>
                                            <Input
                                                type="number"
                                                placeholder="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                                className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-bold text-center"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2 md:space-y-0 md:w-24">
                                            <Label className="md:hidden text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">Unit</Label>
                                            <Input
                                                placeholder="ea"
                                                // @ts-ignore
                                                value={item.unit || ""}
                                                onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-medium italic text-center"
                                            />
                                        </div>
                                        <div className="space-y-2 md:space-y-0 md:w-32">
                                            <Label className="md:hidden text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">R Price</Label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/30">R</span>
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                                                    className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-black pl-6"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between w-full md:w-auto md:pt-1">
                                        <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.2)]">Line Total</div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-lg md:text-sm font-black text-white md:w-28 text-right">
                                                {formatCurrency(item.quantity * item.unitPrice)}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                onClick={() => removeItem(index)}
                                                disabled={items.length === 1}
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Payment Notes */}
                <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="showPaymentNotes"
                            checked={showPaymentNotes}
                            onChange={(e) => setShowPaymentNotes(e.target.checked)}
                        />
                        <Label htmlFor="showPaymentNotes">Include Payment Notes / Terms</Label>
                    </div>
                    {showPaymentNotes && (
                        <Textarea
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            placeholder="e.g. 50% deposit required..."
                            rows={2}
                        />
                    )}
                </div>

                {/* Totals */}
                <div className="flex flex-col items-end space-y-2 border-t pt-4">
                    <div className="flex gap-8">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex gap-8">
                        <span className="text-muted-foreground">VAT (15%):</span>
                        <span className="font-medium">{formatCurrency(tax)}</span>
                    </div>
                    <div className="flex gap-8 text-lg font-bold">
                        <span>Total:</span>
                        <span>{formatCurrency(total)}</span>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Quote
                    </Button>
                </div>
            </form>
        </div>
    )
}
