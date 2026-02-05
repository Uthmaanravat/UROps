"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Sparkles, Loader2, DollarSign, Trash2, Plus, Scissors, CheckCircle, Search, Book } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { generateQuotationAction, getPricingSuggestionsAction, getSuggestedQuoteNumberAction } from "@/app/(dashboard)/projects/[id]/sow/actions"
import { updateClientJsonAction, getClientsAction } from "@/app/(dashboard)/clients/actions"
import { updateProject } from "@/app/(dashboard)/projects/actions"
import { getFixedPriceItemsAction } from "@/app/(dashboard)/knowledge/fixed-actions"

interface WorkBreakdownPricingEditorProps {
    wbp: any
    aiEnabled?: boolean
}

export function WorkBreakdownPricingEditor({ wbp, aiEnabled = true }: WorkBreakdownPricingEditorProps) {
    const { id: wbpId, items: initialItems, project } = wbp
    const { client } = project
    const router = useRouter()
    const [items, setItems] = useState(initialItems.map((i: any) => ({
        id: i.id || Math.random().toString(36).substr(2, 9),
        description: i.description,
        quantity: i.quantity,
        unit: i.unit || "",
        notes: i.notes || "",
        unitPrice: i.unitPrice || 0
    })))
    const [site, setSite] = useState(wbp.site || "")
    const [quoteNumber, setQuoteNumber] = useState(wbp.quoteNumber || "")
    const [reference, setReference] = useState("")
    const [quotationNotes, setQuotationNotes] = useState(wbp.notes || "")
    const [suggestions, setSuggestions] = useState<Record<string, { typicalPrice: number; source: string }>>({})
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [lastQuoteId, setLastQuoteId] = useState<string | null>(null)
    const [lastQuoteNumber, setLastQuoteNumber] = useState<string | null>(null)

    // Catalog state
    const [catalog, setCatalog] = useState<any[]>([])
    const [catalogSearch, setCatalogSearch] = useState("")
    const [isCatalogOpen, setIsCatalogOpen] = useState(false)

    const [allClients, setAllClients] = useState<any[]>([])
    const [selectedClientId, setSelectedClientId] = useState(client.id)

    const [clientEmail, setClientEmail] = useState(client.email || "")
    const [clientVat, setClientVat] = useState(client.vatNumber || "")
    const [clientReg, setClientReg] = useState(client.registrationNumber || "")

    const handleClientUpdate = async (field: string, value: string) => {
        try {
            await updateClientJsonAction(selectedClientId, { [field]: value })
        } catch (err) {
            console.error("Failed to update client:", err)
        }
    }

    const handleClientSwitch = async (clientId: string) => {
        const newClient = allClients.find(c => c.id === clientId)
        if (!newClient) return

        setSelectedClientId(clientId)
        setClientEmail(newClient.email || "")
        setClientVat(newClient.vatNumber || "")
        setClientReg(newClient.registrationNumber || "")

        try {
            // Logic to update the project's client if switched in this workspace
            await updateProject(client.projectId, { clientId })
        } catch (err) {
            console.error("Failed to switch client on project:", err)
        }
    }

    useEffect(() => {
        async function loadData() {
            try {
                const clients = await getClientsAction()
                setAllClients(clients)

                // Fetch suggested quote number if not already set
                if (!quoteNumber) {
                    const suggested = await getSuggestedQuoteNumberAction()
                    setQuoteNumber(suggested)
                }
            } catch (err) {
                console.error("Failed to load initial data:", err)
            }
        }
        loadData()

        async function loadCatalog() {
            try {
                const data = await getFixedPriceItemsAction()
                setCatalog(data)
            } catch (err) {
                console.error("Failed to load catalog", err)
            }
        }
        loadCatalog()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        async function fetchSuggestions() {
            if (!aiEnabled) return;
            setIsLoadingSuggestions(true)
            try {
                const res = await getPricingSuggestionsAction(initialItems)
                setSuggestions(res)

                setItems((prev: any[]) => prev.map((item: any) => ({
                    ...item,
                    unitPrice: item.unitPrice === 0 ? (res[item.description]?.typicalPrice || 0) : item.unitPrice
                })))
            } catch (err) {
                console.error("Error fetching pricing suggestions:", err)
            } finally {
                setIsLoadingSuggestions(false)
            }
        }
        fetchSuggestions()
    }, [initialItems, aiEnabled])

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items]
        // @ts-ignore
        newItems[index][field] = value
        setItems(newItems)
    }

    const addItem = () => {
        setItems([...items, {
            id: Math.random().toString(36).substr(2, 9),
            description: "",
            quantity: 1,
            unit: "",
            notes: "",
            unitPrice: 0
        }])
    }

    const removeItem = (index: number) => {
        if (items.length <= 1) return
        setItems(items.filter((_: any, i: number) => i !== index))
    }

    const splitItem = (index: number) => {
        const item = items[index]
        if (!item.description.includes('\n')) return

        const lines = item.description.split('\n').filter((l: string) => l.trim().length > 0)
        if (lines.length <= 1) return

        const newItems = [...items]
        newItems[index].description = lines[0]

        const additions = lines.slice(1).map((line: string) => ({
            id: Math.random().toString(36).substr(2, 9),
            description: line.trim(),
            quantity: 1,
            unit: "",
            notes: "",
            unitPrice: 0
        }))

        newItems.splice(index + 1, 0, ...additions)
        setItems(newItems)
    }

    const filteredCatalog = catalog.filter(item =>
        item.description.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.category?.toLowerCase().includes(catalogSearch.toLowerCase())
    )

    const addFromCatalog = (catalogItem: any) => {
        const newItem = {
            id: Math.random().toString(36).substr(2, 9),
            description: catalogItem.description,
            quantity: 1,
            unit: catalogItem.unit || "",
            notes: "",
            unitPrice: catalogItem.unitPrice
        }

        // If the last item is empty, replace it
        const lastItem = items[items.length - 1]
        if (items.length === 1 && !items[0].description && items[0].unitPrice === 0) {
            setItems([newItem])
        } else {
            setItems([...items, newItem])
        }
        setIsCatalogOpen(false)
        setCatalogSearch("")
    }

    const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0)
    const total = subtotal * 1.15 // 15% VAT

    const handleGenerate = async () => {
        setIsGenerating(true)
        try {
            const quote = await generateQuotationAction(wbpId, items, { site, quoteNumber, reference, notes: quotationNotes })
            // @ts-ignore
            setLastQuoteId(quote.id)
            // @ts-ignore
            setLastQuoteNumber(quote.quoteNumber || quote.number?.toString())
            setSubmitted(true)
            router.refresh()
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (error) {
            console.error("Error generating quotation:", error)
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="space-y-8">
            {submitted && (
                <Card className="bg-primary/10 border-primary shadow-2xl overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500 mb-8">
                    <CardContent className="p-8">
                        <div className="flex items-start gap-6">
                            <div className="bg-primary rounded-full p-3 shadow-lg shadow-primary/20">
                                <CheckCircle className="h-8 w-8 text-primary-foreground" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-primary flex items-center gap-2 uppercase tracking-wider">
                                        ✅ Quotation submitted
                                    </h3>
                                    <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Commercial Validation Complete</p>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-primary/10">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-muted-foreground block mb-1">Quote Number</span>
                                        <span className="text-lg font-bold text-white tracking-widest">{lastQuoteNumber || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-muted-foreground block mb-1">Site</span>
                                        <span className="text-sm font-bold text-white truncate block">{site || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-muted-foreground block mb-1">Commercial Total</span>
                                        <span className="text-lg font-black text-primary">{formatCurrency(total)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-muted-foreground block mb-1">Project</span>
                                        <span className="text-sm font-bold text-white truncate block">{project.name}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 pt-2">
                                    <Link
                                        href={`/invoices/${lastQuoteId}`}
                                        className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/10"
                                    >
                                        View Official Quotation
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setSubmitted(false)}
                                        className="text-muted-foreground hover:text-white font-bold"
                                    >
                                        Back to editor
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            <Card className="border-white/5 bg-[#1A1A2E] shadow-2xl overflow-hidden rounded-2xl">
                <CardHeader className="bg-white/5 p-8 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-3 text-2xl font-black text-white">
                                <FileText className="h-6 w-6 text-primary" />
                                Work Breakdown & Pricing (WB&P)
                            </CardTitle>
                            <p className="text-xs text-muted-foreground font-medium mt-2 uppercase tracking-widest">
                                Finalize engineering breakdowns and commercial metrics.
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={addItem} className="border-primary/20 hover:bg-primary/10 text-primary font-black px-6 transition-all">
                            <Plus className="h-4 w-4 mr-2" /> Add Component
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-white/5">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Site Name</Label>
                            <Input
                                value={site}
                                onChange={(e) => setSite(e.target.value)}
                                placeholder="e.g. 15 Culemborg Street, Avondale"
                                className="bg-[#14141E] border-white/10 text-white font-bold h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Custom Quote #</Label>
                            <Input
                                value={quoteNumber}
                                onChange={(e) => setQuoteNumber(e.target.value)}
                                placeholder="e.g. Q-2024-001"
                                className="bg-[#14141E] border-white/10 text-white font-bold h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Customer Reference</Label>
                            <Input
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="e.g. PO Ref / Project Code"
                                className="bg-[#14141E] border-white/10 text-white font-bold h-12"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-white/5 bg-primary/5 -mx-8 px-8 py-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary italic">Select Client from CRM</Label>
                            <select
                                value={selectedClientId}
                                onChange={(e) => handleClientSwitch(e.target.value)}
                                className="flex h-11 w-full rounded-md border border-primary/20 bg-[#14141E] px-3 py-2 text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ring-offset-background cursor-pointer hover:border-primary/40 transition-colors"
                            >
                                {allClients.map(c => (
                                    <option key={c.id} value={c.id}>{c.companyName || c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary italic">Client VAT #</Label>
                            <Input
                                value={clientVat}
                                onChange={(e) => {
                                    setClientVat(e.target.value)
                                    handleClientUpdate('vatNumber', e.target.value)
                                }}
                                placeholder="123456789"
                                className="bg-[#14141E] border-primary/20 text-white font-bold h-11 focus:border-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary italic">Client Reg #</Label>
                            <Input
                                value={clientReg}
                                onChange={(e) => {
                                    setClientReg(e.target.value)
                                    handleClientUpdate('registrationNumber', e.target.value)
                                }}
                                placeholder="2024/123456/07"
                                className="bg-[#14141E] border-primary/20 text-white font-bold h-11 focus:border-primary"
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {/* Catalog Picker */}
                    {catalog.length > 0 && (
                        <div className="bg-primary/5 border-y border-white/5 px-8 py-4 relative">
                            <div className="flex items-center gap-3 mb-3">
                                <Book className="h-4 w-4 text-primary" />
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground italic">Quick-Add from Standard Catalog</h3>
                            </div>
                            <div className="relative group max-w-2xl">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                </div>
                                <Input
                                    placeholder="Search standard rates (Emergency Call-out, Labor, etc.)"
                                    className="pl-10 bg-[#14141E] border-white/10 hover:border-primary/40 focus:border-primary transition-all text-sm font-bold h-11"
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-[#14141E] border-b border-white/5 text-muted-foreground font-black text-[10px] uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-8 py-5 min-w-[350px]">Technical Description & Commercial Notes</th>
                                    <th className="px-4 py-5 text-center w-28">Quantity</th>
                                    <th className="px-4 py-5 text-center w-28">Unit</th>
                                    <th className="px-4 py-5 text-right w-44">Unit Price (R)</th>
                                    <th className="px-8 py-5 text-right w-40 text-primary">Total</th>
                                    <th className="px-4 py-5 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {items.map((item: any, index: number) => {
                                    const suggestion = suggestions[item.description]
                                    return (
                                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-8 py-6 space-y-3">
                                                <div className="relative">
                                                    <Textarea
                                                        value={item.description}
                                                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                        className="min-h-[70px] bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-black text-base resize-none"
                                                        placeholder="Item specification..."
                                                    />
                                                    {item.description.includes('\n') && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="absolute bottom-2 right-2 h-7 w-7 text-primary hover:bg-primary/20"
                                                            onClick={() => splitItem(index)}
                                                            title="Split into multiple lines"
                                                        >
                                                            <Scissors className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <Input
                                                    value={item.notes}
                                                    onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                                    className="h-8 text-[11px] font-bold text-muted-foreground/60 bg-transparent border-white/5 hover:border-white/20 transition-all italic"
                                                    placeholder="Commercial or technical notes..."
                                                />
                                            </td>
                                            <td className="px-4 py-6 text-center align-top">
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                                    className="h-10 text-center font-black bg-[#14141E] border-white/10 text-white"
                                                />
                                            </td>
                                            <td className="px-4 py-6 text-center align-top">
                                                <Input
                                                    value={item.unit}
                                                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                    className="h-10 text-center font-bold bg-[#14141E] border-white/10 text-muted-foreground uppercase text-[10px] tracking-widest"
                                                    placeholder="ea"
                                                />
                                            </td>
                                            <td className="px-4 py-6 text-right align-top">
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 font-black">R</span>
                                                    <Input
                                                        type="number"
                                                        value={item.unitPrice}
                                                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                                                        className="pl-8 text-right h-10 font-black bg-[#14141E] border-white/10 text-white"
                                                    />
                                                </div>
                                                {aiEnabled && suggestion && (
                                                    <div className="text-[10px] text-primary mt-2 font-black flex items-center justify-end gap-1 uppercase tracking-widest animate-pulse">
                                                        <Sparkles className="h-3 w-3" />
                                                        AI Suggests: R{suggestion.typicalPrice}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-right align-top font-black text-white text-lg pt-8">
                                                {formatCurrency(item.quantity * item.unitPrice)}
                                            </td>
                                            <td className="px-4 py-6 align-top pt-8">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:bg-red-500/10 transition-colors opacity-100"
                                                    onClick={() => removeItem(index)}
                                                    disabled={items.length === 1}
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-white/5 border-t border-white/5 p-10 flex flex-col md:flex-row justify-between items-start gap-10">
                        <div className="space-y-6 flex-1 min-w-[300px]">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary italic">Quotation Notes & Specific Requirements</Label>
                                <Textarea
                                    value={quotationNotes}
                                    onChange={(e) => setQuotationNotes(e.target.value)}
                                    placeholder="Add overall requirements, payment terms (e.g. 50% deposit), or site conditions..."
                                    className="min-h-[100px] bg-[#14141E] border-primary/20 focus:border-primary text-white font-medium text-sm resize-none"
                                />
                            </div>
                            <div className="space-y-3 pt-4">
                                <div className="flex gap-6 text-sm">
                                    <span className="text-muted-foreground uppercase font-black tracking-widest text-[10px] w-24">Subtotal:</span>
                                    <span className="font-black text-white">{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex gap-6 text-sm">
                                    <span className="text-muted-foreground uppercase font-black tracking-widest text-[10px] w-24">VAT (15%):</span>
                                    <span className="font-black text-white">{formatCurrency(total - subtotal)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-10">
                            <div className="text-right">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block mb-3 opacity-50">Grand Commercial Total</span>
                                <span className="text-5xl font-black text-white shadow-primary/20 drop-shadow-2xl">{formatCurrency(total)}</span>
                            </div>
                            <Button
                                size="lg"
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-2xl shadow-primary/20 px-12 h-16 rounded-xl transition-all active:scale-95"
                            >
                                {isGenerating ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    "AUTHORIZE & GENERATE QUOTATION"
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
