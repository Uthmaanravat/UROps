"use client"

import { useState, useEffect, useCallback, memo, useRef, useDeferredValue, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Sparkles, Loader2, Trash2, Plus, Scissors, CheckCircle, Search, Book, Save } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { generateQuotationAction, getPricingSuggestionsAction, getSuggestedQuoteNumberAction } from "@/app/(dashboard)/projects/[id]/sow/actions"
import { saveWBPDraftAction } from "@/app/(dashboard)/projects/[id]/sow/actions"
import { updateClientJsonAction, getClientsAction } from "@/app/(dashboard)/clients/actions"
import { updateProject, updateProjectCommercialStatus } from "@/app/(dashboard)/projects/actions"
import { getFixedPriceItemsAction } from "@/app/(dashboard)/knowledge/fixed-actions"

// Memoized individual item row to prevent full-table re-renders
const WbpItemRow = memo(({
    item,
    index,
    suggestion,
    aiEnabled,
    onUpdate,
    onRemove,
    onSplit
}: {
    item: any,
    index: number,
    suggestion: any,
    aiEnabled: boolean,
    onUpdate: (index: number, field: string, value: any) => void,
    onRemove: (index: number) => void,
    onSplit: (index: number) => void
}) => {
    // Local stable handlers to bind the index
    const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(index, 'description', e.target.value)
    }, [index, onUpdate])

    const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(index, 'notes', e.target.value)
    }, [index, onUpdate])

    const handleQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(index, 'quantity', parseFloat(e.target.value) || 0)
    }, [index, onUpdate])

    const handleUnitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(index, 'unit', e.target.value)
    }, [index, onUpdate])

    const handleUnitPriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(index, 'unitPrice', parseFloat(e.target.value) || 0)
    }, [index, onUpdate])

    const handleAreaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(index, 'area', e.target.value)
    }, [index, onUpdate])

    const handleSplit = useCallback(() => {
        onSplit(index)
    }, [index, onSplit])

    const handleRemove = useCallback(() => {
        onRemove(index)
    }, [index, onRemove])

    return (
        <tr className="hover:bg-white/[0.02] transition-colors group border-b border-white/5 md:border-none">
            <td className="px-4 md:px-8 py-4 md:py-6 space-y-3 block md:table-cell">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Textarea
                            value={item.description}
                            onChange={handleDescriptionChange}
                            className="min-h-[70px] bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-black text-base resize-none"
                            placeholder="Item specification..."
                        />
                        {item.description.includes('\n') && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute bottom-2 right-2 h-7 w-7 text-primary hover:bg-primary/20"
                                onClick={handleSplit}
                                title="Split into multiple lines"
                            >
                                <Scissors className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="w-1/4">
                        <Label className="text-[10px] font-black uppercase text-primary italic mb-1 block">Heading</Label>
                        <Input
                            value={item.area || ""}
                            onChange={handleAreaChange}
                            className="h-10 text-[11px] font-bold text-white bg-[#14141E] border-white/10 hover:border-primary/50 transition-all"
                            placeholder="HEADING (OPTIONAL)"
                        />
                    </div>
                </div>
                <Input
                    value={item.notes}
                    onChange={handleNotesChange}
                    className="h-8 text-[11px] font-bold text-muted-foreground/60 bg-transparent border-white/5 hover:border-white/20 transition-all italic"
                    placeholder="Commercial or technical notes..."
                />
            </td>
            <td className="px-2 md:px-4 py-3 md:py-6 text-center align-top inline-block md:table-cell w-1/3 md:w-28">
                <Label className="text-[9px] font-black uppercase text-muted-foreground/40 mb-1 block md:hidden">Qty</Label>
                <Input
                    type="number"
                    value={item.quantity}
                    onChange={handleQuantityChange}
                    className="h-10 text-center font-black bg-[#14141E] border-white/10 text-white"
                />
            </td>
            <td className="px-2 md:px-4 py-3 md:py-6 text-center align-top inline-block md:table-cell w-1/3 md:w-28">
                <Label className="text-[9px] font-black uppercase text-muted-foreground/40 mb-1 block md:hidden">Unit</Label>
                <Input
                    value={item.unit}
                    onChange={handleUnitChange}
                    className="h-10 text-center font-bold bg-[#14141E] border-white/10 text-muted-foreground uppercase text-[10px] tracking-widest"
                    placeholder="ea"
                />
            </td>
            <td className="px-2 md:px-4 py-3 md:py-6 text-right align-top inline-block md:table-cell w-1/3 md:w-44">
                <Label className="text-[9px] font-black uppercase text-muted-foreground/40 mb-1 block md:hidden">Price</Label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 font-black">R</span>
                    <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={handleUnitPriceChange}
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
            <td className="px-4 md:px-8 py-3 md:py-6 text-right align-top font-black text-white text-base md:text-lg pt-4 md:pt-8 block md:table-cell">
                <Label className="text-[9px] font-black uppercase text-primary italic mb-1 block md:hidden">Total</Label>
                {formatCurrency(item.quantity * item.unitPrice)}
            </td>
            <td className="px-4 py-3 md:py-6 align-top pt-4 md:pt-8 block md:table-cell text-right md:text-left">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-500/10 transition-colors opacity-100"
                    onClick={handleRemove}
                >
                    <Trash2 className="h-5 w-5" />
                </Button>
            </td>
        </tr>
    )
})

WbpItemRow.displayName = "WbpItemRow"

interface WorkBreakdownPricingEditorProps {
    wbp: any
    aiEnabled?: boolean
}

export function WorkBreakdownPricingEditor({ wbp, aiEnabled = true }: WorkBreakdownPricingEditorProps) {
    const { id: wbpId, items: initialItems, project } = wbp
    const { client } = project
    const router = useRouter()
    const [items, setItems] = useState<any[]>(initialItems.map((i: any) => ({
        id: i.id || Math.random().toString(36).substr(2, 9),
        area: i.area || "",
        description: i.description,
        quantity: i.quantity,
        unit: i.unit || "",
        notes: i.notes || "",
        unitPrice: i.unitPrice || 0
    })))
    const [site, setSite] = useState(wbp.site || "")
    const [quoteNumber, setQuoteNumber] = useState(wbp.quoteNumber || "")
    const [reference, setReference] = useState(wbp.reference || project.name || "")
    const [commercialStatus, setCommercialStatus] = useState<any>(project.commercialStatus || "AWAITING_PO")
    const [quotationNotes, setQuotationNotes] = useState(wbp.notes || "")
    const [suggestions, setSuggestions] = useState<Record<string, { typicalPrice: number; source: string }>>({})
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [lastQuoteId, setLastQuoteId] = useState<string | null>(null)
    const [lastQuoteNumber, setLastQuoteNumber] = useState<string | null>(null)

    const STORAGE_KEY = `wbp-draft-${wbpId}`

    // Check localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const { items: savedItems, site: savedSite, quoteNumber: savedQuote, reference: savedRef, notes: savedNotes } = JSON.parse(saved)
                if (confirm("You have an unsaved session. Would you like to resume?")) {
                    setItems(savedItems)
                    setSite(savedSite)
                    setQuoteNumber(savedQuote)
                    setReference(savedRef)
                    setQuotationNotes(savedNotes)
                } else {
                    localStorage.removeItem(STORAGE_KEY)
                }
            } catch (e) {
                console.error("Failed to parse saved session", e)
            }
        }
    }, [wbpId, STORAGE_KEY])

    // Auto-save to localStorage
    useEffect(() => {
        if (items.length > 0 && !submitted) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                items, site, quoteNumber, reference, notes: quotationNotes, timestamp: Date.now()
            }))
        }
    }, [items, site, quoteNumber, reference, quotationNotes, submitted, STORAGE_KEY])

    // Catalog state
    const [catalog, setCatalog] = useState<any[]>([])
    const [catalogSearch, setCatalogSearch] = useState("")
    const [isCatalogOpen, setIsCatalogOpen] = useState(false)

    const [allClients, setAllClients] = useState<any[]>([])
    const [selectedClientId, setSelectedClientId] = useState(client.id)

    const [clientEmail, setClientEmail] = useState(client.email || "")
    const [clientVat, setClientVat] = useState(client.vatNumber || "")
    const [clientReg, setClientReg] = useState(client.registrationNumber || "")

    // Ref for debounced client updates
    const clientUpdatesRef = useRef<{ vat?: string, reg?: string }>({})

    const handleClientUpdateSync = useCallback(async (updates: { vatNumber?: string, registrationNumber?: string }) => {
        try {
            await updateClientJsonAction(selectedClientId, updates)
        } catch (err) {
            console.error("Failed to update client:", err)
        }
    }, [selectedClientId])

    // Debounce client updates
    useEffect(() => {
        const timer = setTimeout(() => {
            if (Object.keys(clientUpdatesRef.current).length > 0) {
                const updates: any = {}
                if (clientUpdatesRef.current.vat !== undefined) updates.vatNumber = clientUpdatesRef.current.vat
                if (clientUpdatesRef.current.reg !== undefined) updates.registrationNumber = clientUpdatesRef.current.reg
                handleClientUpdateSync(updates)
                clientUpdatesRef.current = {}
            }
        }, 1000)
        return () => clearTimeout(timer)
    }, [clientVat, clientReg, handleClientUpdateSync])

    const handleClientSwitch = useCallback(async (clientId: string) => {
        const newClient = allClients.find(c => c.id === clientId)
        if (!newClient) return

        setSelectedClientId(clientId)
        setClientEmail(newClient.email || "")
        setClientVat(newClient.vatNumber || "")
        setClientReg(newClient.registrationNumber || "")

        try {
            await updateProject(project.id, { clientId })
        } catch (err) {
            console.error("Failed to switch client on project:", err)
        }
    }, [allClients, project.id])

    const handleCommercialStatusChange = useCallback(async (status: any) => {
        setCommercialStatus(status)
        try {
            await updateProjectCommercialStatus(project.id, status)
            router.refresh()
        } catch (err) {
            console.error("Failed to update commercial status:", err)
        }
    }, [project.id, router])

    useEffect(() => {
        async function loadData() {
            try {
                const clients = await getClientsAction()
                setAllClients(clients)

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
            if (!aiEnabled || initialItems.length === 0) return;
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

    const updateItem = useCallback((index: number, field: string, value: any) => {
        setItems((prev: any[]) => {
            if (prev[index] && (prev[index] as any)[field] === value) return prev
            const next = [...prev]
            next[index] = { ...next[index], [field]: value }
            return next
        })
    }, [])

    const addItem = useCallback(() => {
        setItems((prev: any[]) => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            area: prev[prev.length - 1]?.area || "",
            description: "",
            quantity: 1,
            unit: "",
            notes: "",
            unitPrice: 0
        }])
    }, [])

    const removeItem = useCallback((index: number) => {
        setItems((prev: any[]) => {
            if (prev.length <= 1) return prev
            return prev.filter((_: any, i: number) => i !== index)
        })
    }, [])

    const splitItem = useCallback((index: number) => {
        setItems((prev: any[]) => {
            const item = prev[index]
            if (!item.description.includes('\n')) return prev

            const lines = item.description.split('\n').filter((l: string) => l.trim().length > 0)
            if (lines.length <= 1) return prev

            const next = [...prev]
            next[index] = { ...next[index], description: lines[0] }

            const additions = lines.slice(1).map((line: string) => ({
                id: Math.random().toString(36).substr(2, 9),
                description: line.trim(),
                quantity: 1,
                unit: "",
                notes: "",
                unitPrice: 0
            }))

            next.splice(index + 1, 0, ...additions)
            return next
        })
    }, [])

    const addFromCatalog = useCallback((catalogItem: any) => {
        setItems((prev: any[]) => {
            const newItem = {
                id: Math.random().toString(36).substr(2, 9),
                area: prev[prev.length - 1]?.area || "",
                description: catalogItem.description,
                quantity: 1,
                unit: catalogItem.unit || "",
                notes: "",
                unitPrice: catalogItem.unitPrice
            }

            if (prev.length === 1 && !prev[0].description && prev[0].unitPrice === 0) {
                return [newItem]
            } else {
                return [...prev, newItem]
            }
        })
        setIsCatalogOpen(false)
        setCatalogSearch("")
    }, [])

    const deferredCatalogSearch = useDeferredValue(catalogSearch)

    const filteredCatalog = useMemo(() => {
        return catalog.filter(item =>
            item.description.toLowerCase().includes(deferredCatalogSearch.toLowerCase()) ||
            item.category?.toLowerCase().includes(deferredCatalogSearch.toLowerCase())
        )
    }, [catalog, deferredCatalogSearch])

    const subtotal = useMemo(() => {
        return items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0)
    }, [items])

    const total = useMemo(() => subtotal * 1.15, [subtotal]) // 15% VAT

    const handleGenerate = async () => {
        setIsGenerating(true)
        try {
            const quote = await generateQuotationAction(wbpId, items, { site, quoteNumber, reference, notes: quotationNotes })
            // @ts-ignore
            setLastQuoteId(quote.id)
            // @ts-ignore
            setLastQuoteNumber(quote.quoteNumber || quote.number?.toString())
            // Remove success card auto-show if user wants to stay in editor, or just keep it but ensure it's not locking
            setSubmitted(true)
            localStorage.removeItem(STORAGE_KEY)

            // Rename project in UI locally if reference changed
            project.name = reference;

            router.refresh()
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (error) {
            console.error("Error generating quotation:", error)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSaveDraft = async () => {
        setIsSavingDraft(true)
        try {
            await saveWBPDraftAction(wbpId, items, { site, quoteNumber, reference, notes: quotationNotes })
            alert("Draft saved successfully!")
        } catch (error) {
            console.error("Error saving draft:", error)
            alert("Failed to save draft.")
        } finally {
            setIsSavingDraft(false)
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
                <CardHeader className="bg-white/5 p-6 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 md:gap-3 text-lg md:text-2xl font-black text-white uppercase italic">
                                <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                                Pricing Breakdown
                            </CardTitle>
                            <p className="text-[9px] md:text-xs text-muted-foreground font-black mt-1 md:mt-2 uppercase tracking-[0.2em]">
                                Engineering metrics & commercial validation.
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={addItem} className="border-primary/20 hover:bg-primary/10 text-primary font-black px-6 transition-all">
                            <Plus className="h-4 w-4 mr-2" /> Add Component
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
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
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary italic">Commercial Status</Label>
                            <select
                                value={commercialStatus}
                                onChange={(e) => handleCommercialStatusChange(e.target.value)}
                                className={cn(
                                    "flex h-12 w-full rounded-md border px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer",
                                    commercialStatus === 'EMERGENCY_WORK' ? "bg-red-500/20 border-red-500 text-red-400" :
                                        commercialStatus === 'PO_RECEIVED' ? "bg-primary/20 border-primary text-primary" :
                                            "bg-[#14141E] border-white/10 text-white"
                                )}
                            >
                                <option value="AWAITING_PO">AWAITING PO</option>
                                <option value="PO_RECEIVED">PO RECEIVED</option>
                                <option value="EMERGENCY_WORK">EMERGENCY WORK</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5 bg-primary/5 -mx-6 px-6 py-4">
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
                                    clientUpdatesRef.current.vat = e.target.value
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
                                    clientUpdatesRef.current.reg = e.target.value
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
                                    <th className="px-4 md:px-8 py-4 md:py-5 min-w-[200px] md:min-w-[350px]">Description & Headings</th>
                                    <th className="hidden md:table-cell px-4 py-5 text-center w-28">Quantity</th>
                                    <th className="hidden md:table-cell px-4 py-5 text-center w-28">Unit</th>
                                    <th className="hidden md:table-cell px-4 py-5 text-right w-44">Unit Price (R)</th>
                                    <th className="px-4 md:px-8 py-4 md:py-5 text-right w-32 md:w-40 text-primary">Total</th>
                                    <th className="px-4 py-5 w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {(() => {
                                    const grouped = items.reduce((acc: any, item, originalIndex) => {
                                        const area = item.area?.trim() || ""
                                        if (!acc[area]) acc[area] = []
                                        acc[area].push({ ...item, originalIndex })
                                        return acc
                                    }, {})

                                    return Object.entries(grouped).map(([area, areaItems]: [string, any]) => (
                                        <>
                                            <tr key={`header-${area}`} className="bg-primary/5 border-y border-white/5">
                                                <td colSpan={6} className="px-8 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary italic">{area ? `Heading: ${area}` : ""}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {areaItems.map((item: any) => {
                                                const suggestion = suggestions[item.description]
                                                return (
                                                    <WbpItemRow
                                                        key={item.id}
                                                        item={item}
                                                        index={item.originalIndex}
                                                        suggestion={suggestion}
                                                        aiEnabled={aiEnabled}
                                                        onUpdate={updateItem}
                                                        onRemove={removeItem}
                                                        onSplit={splitItem}
                                                    />
                                                )
                                            })}
                                        </>
                                    ))
                                })()}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-white/5 border-t border-white/5 p-6 md:p-10 flex flex-col lg:flex-row justify-between items-start gap-8 md:gap-10">
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

                        <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 w-full lg:w-auto">
                            <div className="text-center sm:text-right flex-1 sm:flex-none">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] block mb-1 md:mb-3 opacity-50 italic">Commercial Total</span>
                                <span className="text-4xl md:text-5xl font-black text-white shadow-primary/20 drop-shadow-2xl">{formatCurrency(total)}</span>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={handleSaveDraft}
                                    disabled={isGenerating || isSavingDraft}
                                    className="flex-1 sm:flex-none border-primary/20 hover:bg-primary/5 text-primary font-black px-6 h-16 rounded-xl transition-all"
                                >
                                    {isSavingDraft ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                    <span className="sm:hidden ml-2">Save</span>
                                </Button>
                                <Button
                                    size="lg"
                                    onClick={handleGenerate}
                                    disabled={isGenerating || isSavingDraft}
                                    className="flex-[2] sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-2xl shadow-primary/20 px-6 md:px-12 h-14 md:h-16 rounded-xl transition-all active:scale-95 text-xs md:text-sm uppercase tracking-widest italic"
                                >
                                    {isGenerating ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                        "AUTHORIZE & GENERATE QUOTATION"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
