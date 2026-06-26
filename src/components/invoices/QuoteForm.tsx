"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash, Wand2, Loader2, FileText } from "lucide-react"
import { createInvoiceAction, getQuoteSequenceAction } from "@/app/(dashboard)/invoices/actions"
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
import { InfoTooltip } from "@/components/ui/InfoTooltip"


interface QuoteFormProps {
    clients: {
        id: string;
        name: string;
        codePrefix?: string | null;
        attentionTo?: string | null;
        contacts?: {
            id: string;
            clientId: string;
            name: string;
            email: string | null;
            phone: string | null;
            role: string | null;
        }[];
    }[]
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

    const [items, setItems] = useState(initialScope ? [] : [{ code: "", description: "", quantity: 1, unit: "", unitPrice: 0, area: "" }])
    const [site, setSite] = useState("")
    const [quoteNumber, setQuoteNumber] = useState("")
    const [reference, setReference] = useState("")
    const [projectName, setProjectName] = useState("")
    const [isProjectNameManual, setIsProjectNameManual] = useState(false)
    const [paymentNotes, setPaymentNotes] = useState("")
    const [showPaymentNotes, setShowPaymentNotes] = useState(true)
    const [firstPaymentOption, setFirstPaymentOption] = useState<string>("none")
    const [customFirstPaymentPercentage, setCustomFirstPaymentPercentage] = useState<string>("")

    // Contacts state
    const [contactId, setContactId] = useState("")
    const [attentionTo, setAttentionTo] = useState("")

    const handleFirstPaymentOptionChange = (val: string) => {
        setFirstPaymentOption(val);
        if (val === "none") {
            setPaymentNotes("");
        } else if (val === "20") {
            setPaymentNotes("20% partial payment required before project commences.");
        } else if (val === "50") {
            setPaymentNotes("50% partial payment required before project commences.");
        } else if (val === "75") {
            setPaymentNotes("75% partial payment required before project commences.");
        } else if (val === "custom") {
            setPaymentNotes("50% partial payment required before project commences.");
            setCustomFirstPaymentPercentage("50");
        }
    };

    const handleCustomPercentageChange = (pct: string) => {
        setCustomFirstPaymentPercentage(pct);
        const parsed = parseFloat(pct);
        if (!isNaN(parsed) && parsed > 0 && parsed < 100) {
            setPaymentNotes(`${parsed}% partial payment required before project commences.`);
        }
    };

    // Catalog state
    const [catalog, setCatalog] = useState<any[]>([])
    const [catalogSearch, setCatalogSearch] = useState("")
    const [isCatalogOpen, setIsCatalogOpen] = useState(false)

    // Sync sequence number when clientId changes
    useEffect(() => {
        const loadSequence = async () => {
            if (clientId) {
                const docNumber = await getQuoteSequenceAction(clientId);
                if (docNumber) setQuoteNumber(docNumber);
            }
        }
        loadSequence();
    }, [clientId])

    // Sync contacts when clientId changes
    useEffect(() => {
        const selectedClient = clients.find(c => c.id === clientId);
        const contacts = selectedClient?.contacts || [];
        if (contacts.length > 0) {
            setContactId(contacts[0].id);
            setAttentionTo(contacts[0].name);
        } else {
            setContactId("");
            setAttentionTo(selectedClient?.attentionTo || "");
        }
    }, [clientId, clients]);

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

    // Sync Project Name with Reference pattern (simplified to avoid redundancy with Site field)
    useEffect(() => {
        if (!isProjectNameManual) {
            setProjectName(reference);
        }
    }, [reference, isProjectNameManual]);

    const filteredCatalog = catalog.filter(item =>
        (!item.clientId || item.clientId === clientId) &&
        (item.description.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.category?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        item.code?.toLowerCase().includes(catalogSearch.toLowerCase()))
    )

    const addFromCatalog = (catalogItem: any) => {
        // If the last item is empty, replace it, otherwise add new
        const lastItem = items[items.length - 1]
        const newItem = {
            code: catalogItem.code || "",
            description: (catalogItem.description || "").toUpperCase(),
            quantity: 1,
            unit: (catalogItem.unit || "").toUpperCase(),
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
        setItems([...items, { code: "", description: "", quantity: 1, unit: "", unitPrice: 0, area: "" }])
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

        let finalFirstPaymentPercentage: number | undefined = undefined;
        if (firstPaymentOption === "20") finalFirstPaymentPercentage = 20;
        else if (firstPaymentOption === "50") finalFirstPaymentPercentage = 50;
        else if (firstPaymentOption === "75") finalFirstPaymentPercentage = 75;
        else if (firstPaymentOption === "custom") {
            const parsed = parseFloat(customFirstPaymentPercentage);
            if (!isNaN(parsed) && parsed > 0 && parsed < 100) {
                finalFirstPaymentPercentage = parsed;
            }
        }

        try {
            const invoiceId = await createInvoiceAction({
                clientId,
                projectId: projectId || undefined,
                date,
                items,
                site,
                quoteNumber,
                reference,
                projectName,
                paymentNotes: showPaymentNotes ? paymentNotes : undefined,
                firstPaymentPercentage: finalFirstPaymentPercentage,
                contactId: contactId || undefined,
                attentionTo: attentionTo || undefined
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
                                onClick={async () => {
                                    setSubmitted(false)
                                    setItems([{ code: "", description: "", quantity: 1, unit: "", unitPrice: 0, area: "" }])
                                    const docNumber = await getQuoteSequenceAction();
                                    if (docNumber) setQuoteNumber(docNumber);
                                }}
                                className="text-muted-foreground hover:text-white font-bold"
                            >
                                Create Another Quotation
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }
    const clientCatalog = catalog.filter(item => 
        !item.clientId || item.clientId === clientId
    );
    const selectedClient = clients.find(c => c.id === clientId);
    const clientContacts = selectedClient?.contacts || [];

    const parseAttentionToNames = (attn: string | null | undefined): string[] => {
        if (!attn) return [];
        const names = attn.split(/[/,;|]+/).map(n => n.trim()).filter(Boolean);
        return names.length > 1 ? names : [];
    };

    const attentionToNames = selectedClient ? parseAttentionToNames(selectedClient.attentionTo) : [];
    const hasMultipleContacts = clientContacts.length > 0 || attentionToNames.length > 0;
 
    return (
        <div className="flex flex-col lg:flex-row gap-6 items-start max-w-7xl mx-auto pb-20">
            <div className="flex-1 w-full rounded-lg border bg-card p-6 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-8">
                {/* Header Details */}
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5">
                                Client
                                <InfoTooltip content="Select the client for whom this quotation is being created." />
                            </Label>
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
                        {hasMultipleContacts && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1.5">
                                    Select Contact (Optional)
                                    <InfoTooltip content="Choose a specific contact person from this client's organization or select from multiple Attention To names." />
                                </Label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={contactId || (attentionToNames.includes(attentionTo) ? attentionTo : "")}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const contact = clientContacts.find(c => c.id === val);
                                        if (contact) {
                                            setContactId(contact.id);
                                            setAttentionTo(contact.name);
                                        } else {
                                            setContactId("");
                                            setAttentionTo(val || selectedClient?.attentionTo || "");
                                        }
                                    }}
                                >
                                    <option value="">-- Select Contact --</option>
                                    {selectedClient?.attentionTo && (
                                        <option value={selectedClient.attentionTo}>
                                            [Default] {selectedClient.attentionTo}
                                        </option>
                                    )}
                                    {attentionToNames.map(name => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                    {clientContacts.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} {c.role ? `(${c.role})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5">
                                Attention To
                                <InfoTooltip content="The name of the individual or department this document is addressed to." />
                            </Label>
                            <Input
                                placeholder="e.g. Mr. Smith"
                                value={attentionTo}
                                onChange={(e) => setAttentionTo(e.target.value)}
                            />
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
                                placeholder="e.g. 123 MAIN ST"
                                value={site}
                                onChange={(e) => setSite(e.target.value)}
                                className="bg-transparent border-white/10 font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="flex justify-between">
                                Project Name
                                <span className="text-[10px] text-primary/50 font-normal italic">
                                    {isProjectNameManual ? "(Manual)" : "(Auto-syncing)"}
                                </span>
                            </Label>
                            <Input
                                placeholder="e.g. SITE - REFERENCE"
                                value={projectName}
                                onChange={(e) => {
                                    setProjectName(e.target.value);
                                    setIsProjectNameManual(true);
                                }}
                                className="bg-transparent border-white/10 font-bold"
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
                                    className="bg-transparent border-white/10 font-bold"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Voice Action */}
                <VoiceRecorder onParsed={(newItems) => {
                    if (newItems && newItems.length > 0) {
                        const formattedItems = newItems.map(i => ({
                            code: i.code || "",
                            description: (i.description || "").toUpperCase(),
                            quantity: i.quantity || 1,
                            unit: (i.unit || "").toUpperCase(),
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
                                                        description: (i.description || "").toUpperCase(),
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
                        {/* Table-like Header Row (hidden on mobile) */}
                        <div className="hidden md:flex items-center gap-3 px-4 py-2 border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 select-none">
                            <div className="w-24">Code</div>
                            <div className="flex-1">Service Description & Details</div>
                            <div className="w-16 text-center">Qty</div>
                            <div className="w-16 text-center">Unit</div>
                            <div className="w-28 text-right">Price</div>
                            <div className="w-28 text-right">Total</div>
                            <div className="w-10"></div> {/* Delete spacer */}
                        </div>

                        {/* List of Rows */}
                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex flex-col gap-2 p-3 md:p-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-all group/row">
                                    {/* Heading Input placed ON TOP of each item */}
                                    <div className="flex items-center gap-2 px-1">
                                        <span className="text-[9px] uppercase font-black text-primary/70 tracking-widest select-none">Heading:</span>
                                        <Input
                                            placeholder="SECTION/HEADING (E.G. PREPARATIONS, ROOM 1)"
                                            // @ts-ignore
                                            value={item.area || ""}
                                            onChange={(e) => updateItem(index, 'area', e.target.value)}
                                            className="bg-transparent border-none focus:ring-0 text-[10px] font-bold text-primary uppercase tracking-widest h-6 p-0 max-w-sm"
                                        />
                                    </div>

                                    {/* Main Row Inputs */}
                                    <div className="flex flex-col md:flex-row items-stretch md:items-start gap-3">
                                        {/* Code */}
                                        <div className="md:w-24 flex flex-col md:block">
                                            <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">Code</span>
                                            <Input
                                                placeholder="Code"
                                                // @ts-ignore
                                                value={item.code || ""}
                                                onChange={(e) => {
                                                    const codeVal = e.target.value.toUpperCase();
                                                    updateItem(index, 'code', codeVal);
                                                    // Lookup in catalog
                                                    const matched = catalog.find(c => 
                                                        c.code?.toUpperCase() === codeVal && 
                                                        (!c.clientId || c.clientId === clientId)
                                                    );
                                                    if (matched) {
                                                        updateItem(index, 'description', matched.description.toUpperCase());
                                                        updateItem(index, 'unit', (matched.unit || "").toUpperCase());
                                                        updateItem(index, 'unitPrice', matched.unitPrice);
                                                    }
                                                }}
                                                className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-mono uppercase text-center font-bold h-9 w-full text-xs"
                                            />
                                        </div>

                                        {/* Description */}
                                        <div className="flex-1 flex flex-col md:block">
                                            <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">Description & Details</span>
                                            <Textarea
                                                placeholder="Item description..."
                                                value={item.description}
                                                onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-medium min-h-[60px] h-10 w-full text-xs py-1.5 resize-y"
                                                required
                                            />
                                        </div>

                                        {/* Qty */}
                                        <div className="md:w-16 flex flex-col md:block">
                                            <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">Qty</span>
                                            <Input
                                                type="number"
                                                placeholder="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                                className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-bold text-center h-9 w-full text-xs"
                                                required
                                            />
                                        </div>

                                        {/* Unit */}
                                        <div className="md:w-16 flex flex-col md:block">
                                            <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">Unit</span>
                                            <Input
                                                placeholder="ea"
                                                // @ts-ignore
                                                value={item.unit || ""}
                                                onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-medium italic text-center h-9 w-full text-xs"
                                            />
                                        </div>

                                        {/* Price */}
                                        <div className="md:w-28 flex flex-col md:block">
                                            <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">Price</span>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/30">R</span>
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                                                    className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-black pl-6 h-9 w-full text-xs"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Total */}
                                        <div className="md:w-28 flex items-center justify-between md:justify-end gap-2 md:gap-0 mt-2 md:mt-0 pt-2 md:pt-0 border-t border-white/5 md:border-none">
                                            <span className="text-[9px] uppercase font-black text-primary/60 md:hidden block">Line Total</span>
                                            <span className="text-sm font-black text-white pr-2 text-right md:w-full block md:pt-2">
                                                {formatCurrency(item.quantity * item.unitPrice)}
                                            </span>
                                        </div>

                                        {/* Delete action */}
                                        <div className="md:w-10 flex justify-end md:justify-center items-center mt-2 md:mt-0 md:pt-1">
                                            <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                            onClick={() => removeItem(index)}
                                            disabled={items.length === 1}
                                        >
                                            <Trash className="h-4.5 w-4.5" />
                                        </Button>
                                    </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* First Payment / Deposit Option */}
                <div className="space-y-4 border-t pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5">
                                Partial Payment Option
                                <InfoTooltip content="Specify if a deposit/partial payment is required. If set, tracking will highlight when this percentage is met." />
                            </Label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={firstPaymentOption}
                                onChange={(e) => handleFirstPaymentOptionChange(e.target.value)}
                            >
                                <option value="none">Full Payment (100%)</option>
                                <option value="20">20% Partial Payment</option>
                                <option value="50">50% Partial Payment</option>
                                <option value="75">75% Partial Payment</option>
                                <option value="custom">Custom Percentage</option>
                            </select>
                        </div>
                        {firstPaymentOption === "custom" && (
                            <div className="space-y-2">
                                <Label>Custom Percentage (%)</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="99"
                                    placeholder="e.g. 40"
                                    value={customFirstPaymentPercentage}
                                    onChange={(e) => handleCustomPercentageChange(e.target.value)}
                                    className="bg-transparent border-white/10"
                                />
                            </div>
                        )}
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
                            placeholder="e.g. 50% PARTIAL PAYMENT REQUIRED BEFORE PROJECT COMMENCES."
                            rows={2}
                            className="bg-transparent border-white/10 font-medium text-xs leading-relaxed"
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

        {/* Catalog Viewer Panel */}
        <div className="w-full lg:w-80 shrink-0 bg-[#14141E]/80 border border-white/5 rounded-2xl p-5 h-fit sticky top-6 backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Book className="h-4 w-4" /> Catalog Viewer
                    </h3>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">
                        {clients.find(c => c.id === clientId)?.name || "Selected Client"}&apos;s Catalog
                    </p>
                </div>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
                {clientCatalog.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-8">
                        No catalog items linked to this client yet.
                    </p>
                ) : (
                    clientCatalog.map(item => (
                        <div 
                            key={item.id}
                            className="p-3 bg-white/5 border border-white/5 hover:border-primary/20 rounded-xl flex items-center justify-between gap-3 group transition-all"
                        >
                            <div className="min-w-0">
                                <p className="text-xs font-mono font-bold text-primary uppercase">{item.code || "—"}</p>
                                <p className="text-xs font-medium text-white truncate max-w-[150px]">{item.description}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">{formatCurrency(item.unitPrice)} / {item.unit || "ea"}</p>
                            </div>
                            <Button
                                type="button"
                                onClick={() => addFromCatalog(item)}
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 border-primary/20 hover:bg-primary hover:text-black shrink-0 transition-all font-black text-xs"
                            >
                                + Add
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
    )
}
