"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
    Plus,
    Trash2,
    Loader2,
    Save,
    X,
    Edit2,
    Bookmark,
    Search,
    FileSpreadsheet,
    AlertTriangle,
    Check,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Download
} from "lucide-react"
import {
    saveFixedPriceItemAction,
    deleteFixedPriceItemAction,
    getFixedPriceItemsAction
} from "@/app/(dashboard)/knowledge/fixed-actions"
import { importTenderRatesAction, getTendersAction } from "@/app/(dashboard)/tenders/actions"
import { formatCurrency, compareItemCodes, cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"

interface FixedPriceManagerProps {
    clients?: { id: string; name: string }[]
    tenders?: { id: string; name: string; tenderNumber: string }[]
    initialScope?: "all" | "general" | "tender"
}

export function FixedPriceManager({
    clients = [],
    tenders: initialTenders = [],
    initialScope = "all"
}: FixedPriceManagerProps) {
    const [items, setItems] = useState<any[]>([])
    const [tenders, setTenders] = useState<any[]>(initialTenders)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    // Form state
    const [itemScope, setItemScope] = useState<"GENERAL" | "TENDER">(
        initialScope === "tender" ? "TENDER" : "GENERAL"
    )
    const [tenderId, setTenderId] = useState<string>("")
    const [description, setDescription] = useState("")
    const [unitPrice, setUnitPrice] = useState("")
    const [year1Price, setYear1Price] = useState("")
    const [year2Price, setYear2Price] = useState("")
    const [year3Price, setYear3Price] = useState("")
    const [unit, setUnit] = useState("each")
    const [category, setCategory] = useState("")
    const [clientId, setClientId] = useState("")
    const [code, setCode] = useState("")

    // Filter & Search state
    const [scopeFilter, setScopeFilter] = useState<"all" | "general" | "tender">(initialScope)
    const [selectedClientFilter, setSelectedClientFilter] = useState("all")
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 50

    // CSV Import Dialog state
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [csvInput, setCsvInput] = useState("")
    const [isImporting, setIsImporting] = useState(false)
    const [importResult, setImportResult] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [catalogData, tendersData] = await Promise.all([
                getFixedPriceItemsAction(),
                tenders.length === 0 ? getTendersAction() : Promise.resolve(tenders)
            ])
            setItems(catalogData || [])
            if (tendersData && tendersData.length > 0) {
                setTenders(tendersData)
                if (!tenderId) setTenderId(tendersData[0].id)
            }
        } catch (err) {
            console.error("Failed to load catalog data", err)
        } finally {
            setLoading(false)
        }
    }

    // Check for duplicate code warning
    const duplicateCodeWarning = useMemo(() => {
        if (!code || !code.trim()) return null
        const trimmed = code.trim().toUpperCase()

        const duplicate = items.find((item) => {
            if (item.id === editingId) return false
            if (!item.code) return false
            if (item.code.trim().toUpperCase() !== trimmed) return false

            // Same tender
            if (itemScope === "TENDER" && item.tenderId === tenderId) return true
            // Same client / global general
            if (itemScope === "GENERAL" && !item.tenderId && (item.clientId === clientId || (!item.clientId && !clientId))) {
                return true
            }
            return false
        })

        if (duplicate) {
            return `Code "${trimmed}" is already assigned to "${duplicate.description}". Duplicate codes in the same price list can cause ambiguity during lookup.`
        }
        return null
    }, [code, itemScope, tenderId, clientId, items, editingId])

    // Dynamic list of unique categories
    const availableCategories = useMemo(() => {
        const cats = new Set<string>()
        for (const item of items) {
            if (item.category && item.category.trim()) {
                cats.add(item.category.trim())
            }
        }
        return Array.from(cats).sort()
    }, [items])

    // Filter items
    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            // Scope filter
            if (scopeFilter === "general" && item.tenderId) return false
            if (scopeFilter === "tender" && !item.tenderId) return false

            // Client filter
            if (selectedClientFilter === "global" && item.clientId) return false
            if (selectedClientFilter !== "all" && selectedClientFilter !== "global" && item.clientId !== selectedClientFilter) {
                return false
            }

            // Category filter
            if (selectedCategoryFilter !== "all" && item.category !== selectedCategoryFilter) {
                return false
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const codeMatch = item.code && item.code.toLowerCase().includes(q)
                const descMatch = item.description && item.description.toLowerCase().includes(q)
                const catMatch = item.category && item.category.toLowerCase().includes(q)
                if (!codeMatch && !descMatch && !catMatch) return false
            }

            return true
        }).sort((a, b) => compareItemCodes(a.code, b.code))
    }, [items, scopeFilter, selectedClientFilter, selectedCategoryFilter, searchQuery])

    // Pagination for safe, responsive 100+ items rendering
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return filteredItems.slice(start, start + pageSize)
    }, [filteredItems, currentPage, pageSize])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()

        if (duplicateCodeWarning && !confirm(`${duplicateCodeWarning}\n\nDo you want to proceed anyway?`)) {
            return
        }

        setSaving(true)
        try {
            const isTender = itemScope === "TENDER"
            const parsedY1 = isTender
                ? parseFloat(year1Price || "0")
                : parseFloat(unitPrice || "0")
            const parsedY2 = isTender && year2Price ? parseFloat(year2Price) : null
            const parsedY3 = isTender && year3Price ? parseFloat(year3Price) : null

            const result = await saveFixedPriceItemAction({
                id: editingId || undefined,
                description: description.trim(),
                unitPrice: isNaN(parsedY1) ? 0 : parsedY1,
                unit: unit.trim() || "each",
                category: category.trim() || undefined,
                clientId: isTender ? (tenders.find(t => t.id === tenderId)?.clientId || clientId || null) : (clientId || null),
                code: code.trim() || null,
                tenderId: isTender ? (tenderId || (tenders[0]?.id ?? null)) : null,
                year1Price: isNaN(parsedY1) ? null : parsedY1,
                year2Price: parsedY2,
                year3Price: parsedY3
            })

            if (result && result.success) {
                resetForm()
                await loadData()
            } else {
                alert("Failed to save: " + (result?.error || "Unknown error"))
            }
        } catch (err) {
            console.error(err)
            alert("Failed to save item: " + (err instanceof Error ? err.message : "Error"))
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this catalog item? This will not affect existing finalized quotes or invoices.")) {
            return
        }
        try {
            await deleteFixedPriceItemAction(id)
            await loadData()
        } catch (err) {
            console.error(err)
            alert("Failed to delete item")
        }
    }

    const startEdit = (item: any) => {
        setEditingId(item.id)
        setDescription(item.description || "")
        setCode(item.code || "")
        setUnit(item.unit || "each")
        setCategory(item.category || "")

        if (item.tenderId) {
            setItemScope("TENDER")
            setTenderId(item.tenderId)
            setYear1Price(String(item.year1Price ?? item.unitPrice ?? ""))
            setYear2Price(item.year2Price !== null && item.year2Price !== undefined ? String(item.year2Price) : "")
            setYear3Price(item.year3Price !== null && item.year3Price !== undefined ? String(item.year3Price) : "")
            setUnitPrice("")
        } else {
            setItemScope("GENERAL")
            setClientId(item.clientId || "")
            setUnitPrice(String(item.unitPrice ?? ""))
            setYear1Price("")
            setYear2Price("")
            setYear3Price("")
        }

        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const resetForm = () => {
        setEditingId(null)
        setDescription("")
        setCode("")
        setUnitPrice("")
        setYear1Price("")
        setYear2Price("")
        setYear3Price("")
        setUnit("each")
        setCategory("")
        setClientId("")
    }

    // CSV parser for batch rate updates
    const handleParseAndImportCsv = async () => {
        if (!csvInput.trim()) return
        const activeTenderId = tenderId || (tenders.length > 0 ? tenders[0].id : "")
        if (!activeTenderId) {
            alert("No active tender selected for rate import.")
            return
        }

        setIsImporting(true)
        setImportResult(null)

        try {
            const lines = csvInput.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
            const rows: any[] = []

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i]
                // Skip header row if it contains keywords
                if (i === 0 && (line.toLowerCase().includes("code") || line.toLowerCase().includes("description"))) {
                    continue
                }

                // Support comma, tab, or semicolon separated
                let parts: string[] = []
                if (line.includes("\t")) parts = line.split("\t")
                else if (line.includes(";")) parts = line.split(";")
                else {
                    // Simple CSV split (handling basic quotes)
                    parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                }

                parts = parts.map(p => p.trim().replace(/^["']|["']$/g, ""))

                if (parts.length >= 4) {
                    const itemCode = parts[0]
                    const itemDesc = parts[1]
                    const itemUnit = parts[2]
                    const y1 = parseFloat(parts[3].replace(/[^0-9.]/g, ""))
                    const y2 = parts[4] ? parseFloat(parts[4].replace(/[^0-9.]/g, "")) : null
                    const y3 = parts[5] ? parseFloat(parts[5].replace(/[^0-9.]/g, "")) : null
                    const itemCat = parts[6] || undefined

                    if (itemCode && itemDesc && !isNaN(y1)) {
                        rows.push({
                            code: itemCode,
                            description: itemDesc,
                            unit: itemUnit || "each",
                            y1,
                            y2: y2 !== null && !isNaN(y2) ? y2 : null,
                            y3: y3 !== null && !isNaN(y3) ? y3 : null,
                            category: itemCat
                        })
                    }
                }
            }

            if (rows.length === 0) {
                alert("Could not parse any valid rows. Please check the format: code, description, unit, y1, y2, y3")
                setIsImporting(false)
                return
            }

            const res = await importTenderRatesAction(activeTenderId, rows)
            const totalCount = res.createdCount + res.updatedCount
            setImportResult(`Successfully imported ${totalCount} tender items (${res.createdCount} new, ${res.updatedCount} updated).`)
            await loadData()
            setCsvInput("")
        } catch (err) {
            console.error("Import error", err)
            alert("Failed to import rates: " + (err instanceof Error ? err.message : "Error"))
        } finally {
            setIsImporting(false)
        }
    }

    if (loading && items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">
                    Loading Standard Catalog...
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Top Scope Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                        Catalog Scope:
                    </span>
                    <Button
                        type="button"
                        size="sm"
                        variant={scopeFilter === "all" ? "default" : "outline"}
                        onClick={() => { setScopeFilter("all"); setCurrentPage(1); }}
                        className={cn(
                            "text-xs font-bold h-8",
                            scopeFilter === "all" ? "bg-primary text-black font-black" : "border-white/10 bg-white/5"
                        )}
                    >
                        All Catalog ({items.length})
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={scopeFilter === "general" ? "default" : "outline"}
                        onClick={() => { setScopeFilter("general"); setCurrentPage(1); }}
                        className={cn(
                            "text-xs font-bold h-8",
                            scopeFilter === "general" ? "bg-blue-500 text-white font-black" : "border-white/10 bg-white/5 text-blue-300"
                        )}
                    >
                        General Work ({items.filter(i => !i.tenderId).length})
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={scopeFilter === "tender" ? "default" : "outline"}
                        onClick={() => { setScopeFilter("tender"); setCurrentPage(1); }}
                        className={cn(
                            "text-xs font-bold h-8 gap-1.5",
                            scopeFilter === "tender" ? "bg-amber-500 text-black font-black" : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        )}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        Tender 152G ({items.filter(i => i.tenderId).length})
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsImportOpen(true)}
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-amber-300 gap-2 h-8"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-amber-400" />
                        Import 3-Year Rates (CSV)
                    </Button>
                </div>
            </div>

            {/* Form Section */}
            <Card className="bg-[#14141E] border-white/10 shadow-2xl overflow-hidden">
                <CardContent className="p-6">
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-black uppercase tracking-wider text-primary">
                                    {editingId ? "Edit Catalog Item" : "Add New Catalog Item"}
                                </h3>
                                <div className="flex items-center rounded-lg bg-white/5 p-0.5 border border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setItemScope("GENERAL")}
                                        className={cn(
                                            "px-2.5 py-1 text-[10px] font-black uppercase rounded-md transition-all",
                                            itemScope === "GENERAL" ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" : "text-muted-foreground hover:text-white"
                                        )}
                                    >
                                        General Item
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setItemScope("TENDER")}
                                        className={cn(
                                            "px-2.5 py-1 text-[10px] font-black uppercase rounded-md transition-all",
                                            itemScope === "TENDER" ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-muted-foreground hover:text-white"
                                        )}
                                    >
                                        Tender 152G Item
                                    </button>
                                </div>
                            </div>
                            {editingId && (
                                <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="text-muted-foreground h-8 text-xs">
                                    <X className="h-3.5 w-3.5 mr-1" /> Cancel Edit
                                </Button>
                            )}
                        </div>

                        {/* Duplicate code warning */}
                        {duplicateCodeWarning && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-start gap-2 animate-in fade-in">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                                <span>{duplicateCodeWarning}</span>
                            </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                                    Catalog Code
                                </Label>
                                <Input
                                    placeholder="e.g. 20.4 or LAB01"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="bg-white/5 border-white/10 focus:border-primary font-mono font-bold text-xs"
                                />
                            </div>

                            <div className="space-y-1.5 lg:col-span-3">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                                    Service Description
                                </Label>
                                <Input
                                    placeholder="e.g. Site Clearance: removal of scrub, small trees, and debris"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    required
                                    className="bg-white/5 border-white/10 focus:border-primary text-xs"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                                    Unit
                                </Label>
                                <Input
                                    placeholder="e.g. m², m, ea, hr"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    className="bg-white/5 border-white/10 focus:border-primary font-mono text-xs"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                                    Category
                                </Label>
                                <Input
                                    placeholder="e.g. Earthworks"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="bg-white/5 border-white/10 focus:border-primary text-xs"
                                />
                            </div>
                        </div>

                        {/* Pricing section based on General vs Tender */}
                        {itemScope === "TENDER" ? (
                            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                                        Fixed 3-Year Contract Rates (excl. VAT)
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                        Tender 152G/2025/26
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-black text-amber-300 tracking-wider">
                                            Year 1 Rate (2025/26) *
                                        </Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={year1Price}
                                            onChange={(e) => setYear1Price(e.target.value)}
                                            required
                                            className="bg-white/5 border-amber-500/30 text-amber-300 font-black text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">
                                            Year 2 Rate (2026/27)
                                        </Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="Year 1 + escalation"
                                            value={year2Price}
                                            onChange={(e) => setYear2Price(e.target.value)}
                                            className="bg-white/5 border-white/10 font-black text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-wider">
                                            Year 3 Rate (2027/28)
                                        </Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="Year 2 + escalation"
                                            value={year3Price}
                                            onChange={(e) => setYear3Price(e.target.value)}
                                            className="bg-white/5 border-white/10 font-black text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-white/5">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                                        Standard Rate (excl. VAT) *
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={unitPrice}
                                        onChange={(e) => setUnitPrice(e.target.value)}
                                        required
                                        className="bg-white/5 border-white/10 focus:border-primary text-primary font-bold text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">
                                        Client Association (Optional)
                                    </Label>
                                    <select
                                        value={clientId}
                                        onChange={(e) => setClientId(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-white/10 bg-[#0F0F1A] px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
                                    >
                                        <option value="">Global / All Clients</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <span className="text-[10px] text-muted-foreground font-medium italic">
                                {itemScope === "TENDER"
                                    ? "Tender items are isolated and will only appear on Tender quotes/invoices."
                                    : "General items are available for all non-tender quotations."}
                            </span>
                            <Button
                                type="submit"
                                disabled={saving}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 text-xs h-9"
                            >
                                {saving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : editingId ? (
                                    <Save className="mr-2 h-4 w-4" />
                                ) : (
                                    <Plus className="mr-2 h-4 w-4" />
                                )}
                                {editingId ? "Update Item" : "Add to Catalog"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* List & Search Section */}
            <div className="rounded-2xl border border-white/10 bg-[#14141E] shadow-2xl overflow-hidden space-y-0">
                {/* Search & Secondary Filter Bar */}
                <div className="bg-white/5 p-4 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search by code (e.g. 17.3), description, or category..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="pl-9 h-9 bg-white/5 border-white/10 text-xs focus:border-primary"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Client Filter */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-black text-muted-foreground">Client:</span>
                            <select
                                value={selectedClientFilter}
                                onChange={(e) => { setSelectedClientFilter(e.target.value); setCurrentPage(1); }}
                                className="h-8 rounded-md border border-white/10 bg-[#0F0F1A] px-2 py-1 text-xs text-white"
                            >
                                <option value="all">All Clients</option>
                                <option value="global">Global Only</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Category Filter */}
                        {availableCategories.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-black text-muted-foreground">Category:</span>
                                <select
                                    value={selectedCategoryFilter}
                                    onChange={(e) => { setSelectedCategoryFilter(e.target.value); setCurrentPage(1); }}
                                    className="h-8 rounded-md border border-white/10 bg-[#0F0F1A] px-2 py-1 text-xs text-white"
                                >
                                    <option value="all">All Categories</option>
                                    {availableCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase border border-primary/20">
                            {filteredItems.length} items
                        </span>
                    </div>
                </div>

                {/* Catalog Table */}
                <div className="relative w-full overflow-x-auto">
                    {filteredItems.length === 0 ? (
                        <div className="text-center text-muted-foreground py-16 text-xs italic">
                            No catalog items match your search or filter criteria.
                        </div>
                    ) : (
                        <table className="w-full text-xs text-left">
                            <thead className="bg-white/5 border-b border-white/10 text-muted-foreground font-black uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="py-3 px-4 w-20">Code</th>
                                    <th className="py-3 px-4">Service Description</th>
                                    <th className="py-3 px-3 text-center w-16">Unit</th>
                                    <th className="py-3 px-4 text-right w-28">Year 1 / Price</th>
                                    <th className="py-3 px-4 text-right w-28">Year 2 Rate</th>
                                    <th className="py-3 px-4 text-right w-28">Year 3 Rate</th>
                                    <th className="py-3 px-4 text-center w-28">Scope</th>
                                    <th className="py-3 px-4 text-right w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-medium">
                                {paginatedItems.map((item) => {
                                    const isTender = Boolean(item.tenderId)
                                    const y1 = item.year1Price ?? item.unitPrice ?? 0
                                    const y2 = item.year2Price
                                    const y3 = item.year3Price

                                    return (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-white/[0.02] transition-colors group"
                                        >
                                            <td className="py-3 px-4 font-mono font-bold text-amber-300">
                                                {item.code || "—"}
                                            </td>
                                            <td className="py-3 px-4 text-white">
                                                <div className="font-bold text-xs">{item.description}</div>
                                                {item.category && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {item.category}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                                                {item.unit || "each"}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-white">
                                                {formatCurrency(y1)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-muted-foreground">
                                                {y2 !== null && y2 !== undefined ? (
                                                    <span className="text-white font-semibold">{formatCurrency(y2)}</span>
                                                ) : isTender ? (
                                                    <span className="text-zinc-600 italic">Not set</span>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right text-muted-foreground">
                                                {y3 !== null && y3 !== undefined ? (
                                                    <span className="text-white font-semibold">{formatCurrency(y3)}</span>
                                                ) : isTender ? (
                                                    <span className="text-zinc-600 italic">Not set</span>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {isTender ? (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                        Tender 152G
                                                    </span>
                                                ) : item.client ? (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                                        {item.client.name}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/5 text-gray-400">
                                                        Global
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => startEdit(item)}
                                                        className="h-7 w-7 text-muted-foreground hover:text-white"
                                                        title="Edit in form"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(item.id)}
                                                        className="h-7 w-7 text-muted-foreground hover:text-red-400"
                                                        title="Delete item"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="p-3 bg-white/5 border-t border-white/10 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px]">
                            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} items
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="h-7 px-2 text-xs border-white/10"
                            >
                                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                            </Button>
                            <span className="text-xs font-mono font-bold text-white px-2">
                                {currentPage} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className="h-7 px-2 text-xs border-white/10"
                            >
                                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* CSV Import Modal Dialog */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className="max-w-2xl bg-[#14141E] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            Import Tender Rates (CSV / Excel)
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Paste tabular or CSV data containing the 3-year tender rates. Existing codes will have their Year 1, Year 2, and Year 3 prices updated without altering existing quotes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="text-[11px] font-mono bg-white/5 p-3 rounded-lg border border-white/10 text-zinc-300">
                            <p className="font-bold text-amber-400 mb-1">Expected Format (columns):</p>
                            <p>code, description, unit, year1_price, year2_price, year3_price</p>
                            <p className="text-zinc-500 mt-1 italic">Example: 20.4, Site Clearance, m2, 135.00, 145.00, 155.00</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Paste CSV or Tab-Delimited Data:
                            </Label>
                            <Textarea
                                rows={8}
                                placeholder="20.4, Site Clearance, m2, 135.00, 145.00, 155.00&#10;20.12, Excavation in earth, m3, 210.00, 225.00, 240.00"
                                value={csvInput}
                                onChange={(e) => setCsvInput(e.target.value)}
                                className="font-mono text-xs bg-white/5 border-white/10 focus:border-amber-400 text-white resize-y"
                            />
                        </div>

                        {importResult && (
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                                <span>{importResult}</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setIsImportOpen(false)}
                            disabled={isImporting}
                            className="text-xs text-muted-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleParseAndImportCsv}
                            disabled={isImporting || !csvInput.trim()}
                            className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs gap-2"
                        >
                            {isImporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Import & Update Rates
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
