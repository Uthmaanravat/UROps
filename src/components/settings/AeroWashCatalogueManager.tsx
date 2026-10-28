"use client"

import React, { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import {
    Plus,
    Search,
    Edit3,
    Check,
    Layers,
    Sparkles,
    Shield,
    DollarSign,
    Percent,
    Sliders,
    Loader2,
    Power,
    CheckCircle2,
    XCircle,
    Info,
    AlertCircle
} from "lucide-react"
import {
    updateCatalogueItemAction,
    toggleCatalogueItemActiveAction,
    createCatalogueItemAction
} from "@/app/(dashboard)/settings/catalogue/actions"

export interface CatalogueItemData {
    id: string
    companyId: string
    itemNumber: number
    name: string
    clientDescription: string
    category: string
    pricingMethod: string
    internalNotes?: string | null
    isActive: boolean
    metadata?: any
    createdAt: string | Date
    updatedAt: string | Date
}

interface AeroWashCatalogueManagerProps {
    initialItems: CatalogueItemData[]
}

const CATEGORIES = [
    { key: "ALL", label: "All Items" },
    { key: "CLEANING", label: "Cleaning" },
    { key: "ASSESSMENT & REPORTING", label: "Assessment & Reporting" },
    { key: "SITE CONDITIONS", label: "Site Conditions" },
    { key: "CONTRACTS", label: "Contracts" }
]

export function AeroWashCatalogueManager({ initialItems }: AeroWashCatalogueManagerProps) {
    const [items, setItems] = useState<CatalogueItemData[]>(initialItems)
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [isPending, startTransition] = useTransition()
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Edit Item Modal State
    const [editingItem, setEditingItem] = useState<CatalogueItemData | null>(null)
    const [editName, setEditName] = useState("")
    const [editDescription, setEditDescription] = useState("")
    const [editCategory, setEditCategory] = useState("CLEANING")
    const [editPricingMethod, setEditPricingMethod] = useState("PRICE_ON_QUOTE")
    const [editInternalNotes, setEditInternalNotes] = useState("")
    const [editRates, setEditRates] = useState<any>({})

    // Add Item Modal State
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [newName, setNewName] = useState("")
    const [newDescription, setNewDescription] = useState("")
    const [newCategory, setNewCategory] = useState("CLEANING")
    const [newPricingMethod, setNewPricingMethod] = useState("PRICE_ON_QUOTE")
    const [newInternalNotes, setNewInternalNotes] = useState("")
    const [newRates, setNewRates] = useState<any>({
        bandA: 16,
        bandB: 20,
        bandC: 24,
        bandD: 28,
        bandE: 34,
        percentage: 15,
        defaultPrice: 0
    })

    const showStatus = (type: 'success' | 'error', text: string) => {
        setStatusMessage({ type, text })
        setTimeout(() => setStatusMessage(null), 4000)
    }

    // Toggle Active/Inactive
    const handleToggleActive = (item: CatalogueItemData) => {
        const nextState = !item.isActive
        // Optimistic UI update
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isActive: nextState } : i))

        startTransition(async () => {
            try {
                await toggleCatalogueItemActiveAction(item.id, nextState)
                showStatus('success', `Item ${item.itemNumber} is now ${nextState ? 'Active' : 'Inactive'}.`)
            } catch (err: any) {
                // Revert on error
                setItems(prev => prev.map(i => i.id === item.id ? { ...i, isActive: item.isActive } : i))
                showStatus('error', err.message || 'Failed to update item state.')
            }
        })
    }

    // Open Edit Dialog
    const handleOpenEdit = (item: CatalogueItemData) => {
        setEditingItem(item)
        setEditName(item.name)
        setEditDescription(item.clientDescription)
        setEditCategory(item.category)
        setEditPricingMethod(item.pricingMethod)
        setEditInternalNotes(item.internalNotes || "")

        // Initialize rates from item metadata or defaults
        const meta = (item.metadata as any) || {}
        setEditRates({
            bandA: meta?.rates?.A ?? 16,
            bandB: meta?.rates?.B ?? 20,
            bandC: meta?.rates?.C ?? 24,
            bandD: meta?.rates?.D ?? 28,
            bandE: meta?.rates?.E ?? 34,
            percentage: meta?.defaultPercent ?? (item.itemNumber === 3 ? 12 : item.itemNumber === 4 ? 25 : item.itemNumber === 15 ? 10 : 15),
            solarClient: meta?.solarRates?.client ?? 6,
            solarAeroWash: meta?.solarRates?.aerowash ?? 10,
            waterAtlantis: meta?.waterRates?.atlantis ?? 0.30,
            waterSimonsTown: meta?.waterRates?.simons_town ?? 0.85,
            defaultPrice: meta?.defaultPrice ?? 0
        })
    }

    // Save Edited Item
    const handleSaveEdit = () => {
        if (!editingItem) return
        if (!editName.trim() || !editDescription.trim()) {
            showStatus('error', 'Name and Client Description are required.')
            return
        }

        const existingMeta = (editingItem.metadata as any) || {}
        const updatedMeta = {
            ...existingMeta,
            rates: {
                A: Number(editRates.bandA) || 16,
                B: Number(editRates.bandB) || 20,
                C: Number(editRates.bandC) || 24,
                D: Number(editRates.bandD) || 28,
                E: Number(editRates.bandE) || 34
            },
            defaultPercent: Number(editRates.percentage) || 15,
            solarRates: {
                client: Number(editRates.solarClient) || 6,
                aerowash: Number(editRates.solarAeroWash) || 10
            },
            waterRates: {
                atlantis: Number(editRates.waterAtlantis) || 0.30,
                simons_town: Number(editRates.waterSimonsTown) || 0.85
            },
            defaultPrice: Number(editRates.defaultPrice) || 0
        }

        startTransition(async () => {
            try {
                const updated = await updateCatalogueItemAction({
                    id: editingItem.id,
                    name: editName.trim(),
                    clientDescription: editDescription.trim(),
                    category: editCategory,
                    pricingMethod: editPricingMethod,
                    internalNotes: editInternalNotes.trim() || null,
                    metadata: updatedMeta
                })

                setItems(prev => prev.map(i => i.id === editingItem.id ? {
                    ...i,
                    name: editName.trim(),
                    clientDescription: editDescription.trim(),
                    category: editCategory,
                    pricingMethod: editPricingMethod,
                    internalNotes: editInternalNotes.trim() || null,
                    metadata: updatedMeta
                } : i))

                setEditingItem(null)
                showStatus('success', `Item ${editingItem.itemNumber} updated successfully. Changes will apply to all new quotes.`)
            } catch (err: any) {
                showStatus('error', err.message || 'Failed to update catalogue item.')
            }
        })
    }

    // Add New Item
    const handleSaveNew = () => {
        if (!newName.trim() || !newDescription.trim()) {
            showStatus('error', 'Name and Client Description are required.')
            return
        }

        const meta = {
            rates: newPricingMethod === 'ELEVATION_BAND' ? {
                A: Number(newRates.bandA) || 16,
                B: Number(newRates.bandB) || 20,
                C: Number(newRates.bandC) || 24,
                D: Number(newRates.bandD) || 28,
                E: Number(newRates.bandE) || 34
            } : undefined,
            defaultPercent: newPricingMethod === 'PERCENT' ? (Number(newRates.percentage) || 15) : undefined,
            defaultPrice: newPricingMethod === 'PRICE_ON_QUOTE' ? (Number(newRates.defaultPrice) || 0) : undefined
        }

        startTransition(async () => {
            try {
                const created = await createCatalogueItemAction({
                    name: newName.trim(),
                    clientDescription: newDescription.trim(),
                    category: newCategory,
                    pricingMethod: newPricingMethod,
                    internalNotes: newInternalNotes.trim() || undefined,
                    metadata: meta
                })

                setItems(prev => [...prev, created as any])
                setIsAddOpen(false)
                setNewName("")
                setNewDescription("")
                setNewInternalNotes("")
                showStatus('success', `Item ${created.itemNumber} ("${created.name}") added to catalogue successfully!`)
            } catch (err: any) {
                showStatus('error', err.message || 'Failed to create new catalogue item.')
            }
        })
    }

    // Filtered items
    const filteredItems = items.filter(item => {
        const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory
        const matchesSearch = searchQuery === "" ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.clientDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(item.itemNumber).includes(searchQuery)
        return matchesCategory && matchesSearch
    })

    const activeCount = items.filter(i => i.isActive).length
    const totalCount = items.length

    return (
        <div className="space-y-6">
            {/* Notification alert banner */}
            {statusMessage && (
                <div className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-3 animate-in fade-in ${
                    statusMessage.type === 'success'
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200'
                        : 'bg-red-500/20 border border-red-500/40 text-red-200'
                }`}>
                    {statusMessage.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                    <span>{statusMessage.text}</span>
                </div>
            )}

            {/* Top Toolbar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#14141E] border border-white/10 shadow-lg">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-white tracking-tight">AeroWash Rate Card &amp; Catalogue</h2>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs font-mono">
                            {activeCount} / {totalCount} Active
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Configure client-facing names, descriptions, internal rate defaults, and toggle items on/off. Updates apply to new quotes.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search catalogue..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 bg-black/40 border-white/10 text-xs text-white placeholder:text-muted-foreground"
                        />
                    </div>
                    <Button
                        onClick={() => setIsAddOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-black font-bold h-9 px-4 text-xs shrink-0 flex items-center gap-1.5 shadow-md shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        Add Item
                    </Button>
                </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.key}
                        onClick={() => setSelectedCategory(cat.key)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                            selectedCategory === cat.key
                                ? 'bg-primary text-black shadow-sm font-extrabold'
                                : 'bg-[#14141E] hover:bg-white/10 text-muted-foreground hover:text-white border border-white/5'
                        }`}
                    >
                        {cat.label}
                        <span className="ml-1.5 text-[10px] opacity-70">
                            ({cat.key === "ALL" ? items.length : items.filter(i => i.category === cat.key).length})
                        </span>
                    </button>
                ))}
            </div>

            {/* Catalogue Items Grid */}
            <div className="grid grid-cols-1 gap-4">
                {filteredItems.map(item => {
                    const meta = (item.metadata as any) || {}
                    return (
                        <Card
                            key={item.id}
                            className={`transition-all duration-200 border ${
                                item.isActive
                                    ? 'bg-[#14141E] border-white/10 hover:border-white/20'
                                    : 'bg-black/40 border-white/5 opacity-60'
                            }`}
                        >
                            <CardContent className="p-5">
                                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                    {/* Left: Item identity and text */}
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-white/10 text-primary border border-white/10">
                                                Item {String(item.itemNumber).padStart(2, '0')}
                                            </span>
                                            <Badge variant="outline" className="text-[10px] uppercase font-semibold text-muted-foreground border-white/10">
                                                {item.category}
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px] uppercase font-mono text-amber-300/80 border-amber-500/20 bg-amber-500/5">
                                                {item.pricingMethod.replace(/_/g, ' ')}
                                            </Badge>
                                            {!item.isActive && (
                                                <Badge variant="destructive" className="text-[10px] font-bold">
                                                    Inactive (Hidden in Builder)
                                                </Badge>
                                            )}
                                        </div>

                                        <h3 className="text-base font-bold text-white tracking-tight">
                                            {item.name}
                                        </h3>

                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {item.clientDescription}
                                        </p>

                                        {/* Internal Rates & Defaults summary */}
                                        <div className="pt-2 flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                                            {item.pricingMethod === 'ELEVATION_BAND' && (
                                                <div className="flex items-center gap-1.5 font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    <span>Rates:</span>
                                                    <span>A: R{meta?.rates?.A ?? 16}</span>
                                                    <span>•</span>
                                                    <span>B: R{meta?.rates?.B ?? 20}</span>
                                                    <span>•</span>
                                                    <span>C: R{meta?.rates?.C ?? 24}</span>
                                                    <span>•</span>
                                                    <span>D: R{meta?.rates?.D ?? 28}</span>
                                                    <span>•</span>
                                                    <span>E: R{meta?.rates?.E ?? 34} /m²</span>
                                                </div>
                                            )}

                                            {(item.pricingMethod.includes('PERCENT') || item.pricingMethod === 'PERCENT') && (
                                                <div className="flex items-center gap-1 font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                                    <Percent className="w-3 h-3" />
                                                    <span>Default: {meta?.defaultPercent ?? (item.itemNumber === 3 ? 12 : item.itemNumber === 4 ? 25 : item.itemNumber === 15 ? 10 : 15)}%</span>
                                                </div>
                                            )}

                                            {item.pricingMethod === 'SOLAR_PER_PANEL' && (
                                                <div className="flex items-center gap-2 font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                    <span>Client water: R{meta?.solarRates?.client ?? 6}/panel</span>
                                                    <span>•</span>
                                                    <span>AeroWash water: R{meta?.solarRates?.aerowash ?? 10}/panel</span>
                                                </div>
                                            )}

                                            {item.pricingMethod === 'REGIONAL_WATER_PER_LITRE' && (
                                                <div className="flex items-center gap-2 font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                                    <span>Atlantis: R{meta?.waterRates?.atlantis ?? 0.30}/L</span>
                                                    <span>•</span>
                                                    <span>Simon&apos;s Town: R{meta?.waterRates?.simons_town ?? 0.85}/L</span>
                                                </div>
                                            )}

                                            {item.internalNotes && (
                                                <div className="flex items-center gap-1 text-muted-foreground/80 italic">
                                                    <Info className="w-3 h-3 shrink-0" />
                                                    <span>Note: {item.internalNotes}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                                        {/* Toggle Active Button */}
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleToggleActive(item)}
                                            disabled={isPending}
                                            className={`text-xs font-bold h-9 px-3 gap-1.5 border ${
                                                item.isActive
                                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                                    : 'bg-white/5 text-muted-foreground border-white/10 hover:text-white'
                                            }`}
                                        >
                                            <Power className="w-3.5 h-3.5" />
                                            {item.isActive ? 'Active' : 'Inactive'}
                                        </Button>

                                        {/* Edit Details Button */}
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => handleOpenEdit(item)}
                                            className="bg-white/10 hover:bg-white/20 text-white font-bold h-9 px-3 text-xs gap-1.5"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            Edit
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}

                {filteredItems.length === 0 && (
                    <div className="p-12 text-center rounded-2xl bg-[#14141E] border border-white/10 space-y-3">
                        <Info className="w-8 h-8 text-muted-foreground mx-auto" />
                        <h4 className="text-base font-bold text-white">No catalogue items match your criteria</h4>
                        <p className="text-xs text-muted-foreground">Try clearing your search query or selecting a different category.</p>
                    </div>
                )}
            </div>

            {/* EDIT ITEM MODAL */}
            <Dialog open={!!editingItem} onOpenChange={open => !open && setEditingItem(null)}>
                <DialogContent className="max-w-2xl bg-[#0F172A] border border-white/10 text-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Edit3 className="w-5 h-5 text-primary" />
                            Edit Item {editingItem ? String(editingItem.itemNumber).padStart(2, '0') : ''}: {editingItem?.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Update the client-facing wording and internal rates. Changes apply immediately to new quotations.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-white">Client Name / Line Title</Label>
                            <Input
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="bg-[#14141E] border-white/10 text-sm text-white"
                            />
                        </div>

                        {/* Client Description */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-white">Client Description (Appears on Quote &amp; PDF)</Label>
                            <Textarea
                                rows={3}
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                className="bg-[#14141E] border-white/10 text-xs text-white resize-y"
                            />
                        </div>

                        {/* Category & Pricing Method */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-white">Category</Label>
                                <select
                                    value={editCategory}
                                    onChange={e => setEditCategory(e.target.value)}
                                    className="w-full h-9 rounded-md bg-[#14141E] border border-white/10 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="CLEANING">CLEANING</option>
                                    <option value="ASSESSMENT & REPORTING">ASSESSMENT &amp; REPORTING</option>
                                    <option value="SITE CONDITIONS">SITE CONDITIONS</option>
                                    <option value="CONTRACTS">CONTRACTS</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-white">Pricing Method</Label>
                                <select
                                    value={editPricingMethod}
                                    onChange={e => setEditPricingMethod(e.target.value)}
                                    className="w-full h-9 rounded-md bg-[#14141E] border border-white/10 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="PRICE_ON_QUOTE">Price on Quote</option>
                                    <option value="ELEVATION_BAND">Per Elevation Band (m²)</option>
                                    <option value="ELEVATION_UPLIFT_15">Elevation Band + Uplift</option>
                                    <option value="BALCONY_PERCENT">Balcony Percentage (%)</option>
                                    <option value="PRE_TREATMENT_PERCENT">Pre-treatment Percentage (%)</option>
                                    <option value="OCCUPIED_PERCENT">Occupied Building Percentage (%)</option>
                                    <option value="PERCENT">General Percentage (%)</option>
                                    <option value="SOLAR_PER_PANEL">Solar Per Panel</option>
                                    <option value="REGIONAL_WATER_PER_LITRE">Regional Water Per Litre</option>
                                    <option value="NO_CHARGE">No Charge (R0)</option>
                                </select>
                            </div>
                        </div>

                        {/* Internal Rates / Defaults Configurator */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5" />
                                Internal Rate Defaults
                            </h4>

                            {/* If Band Pricing */}
                            {(editPricingMethod === 'ELEVATION_BAND' || editPricingMethod === 'ELEVATION_UPLIFT_15') && (
                                <div className="space-y-2">
                                    <Label className="text-[11px] text-muted-foreground">Elevation Band Rates (R/m²):</Label>
                                    <div className="grid grid-cols-5 gap-2">
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-mono">Band A (&le;10.5m)</span>
                                            <Input
                                                type="number"
                                                value={editRates.bandA}
                                                onChange={e => setEditRates({ ...editRates, bandA: e.target.value })}
                                                className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-mono">Band B (10.5-21m)</span>
                                            <Input
                                                type="number"
                                                value={editRates.bandB}
                                                onChange={e => setEditRates({ ...editRates, bandB: e.target.value })}
                                                className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-mono">Band C (21-35m)</span>
                                            <Input
                                                type="number"
                                                value={editRates.bandC}
                                                onChange={e => setEditRates({ ...editRates, bandC: e.target.value })}
                                                className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-mono">Band D (35-52.5m)</span>
                                            <Input
                                                type="number"
                                                value={editRates.bandD}
                                                onChange={e => setEditRates({ ...editRates, bandD: e.target.value })}
                                                className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-mono">Band E (&gt;52.5m)</span>
                                            <Input
                                                type="number"
                                                value={editRates.bandE}
                                                onChange={e => setEditRates({ ...editRates, bandE: e.target.value })}
                                                className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* If Percentage Pricing */}
                            {(editPricingMethod.includes('PERCENT') || editPricingMethod === 'PERCENT') && (
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-muted-foreground">Default Percentage (%):</Label>
                                    <Input
                                        type="number"
                                        value={editRates.percentage}
                                        onChange={e => setEditRates({ ...editRates, percentage: e.target.value })}
                                        className="h-8 max-w-[150px] bg-[#14141E] border-white/10 text-xs font-mono"
                                    />
                                </div>
                            )}

                            {/* If Solar Per Panel */}
                            {editPricingMethod === 'SOLAR_PER_PANEL' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-[11px] text-muted-foreground">Client-Supplied Water (R/panel):</Label>
                                        <Input
                                            type="number"
                                            value={editRates.solarClient}
                                            onChange={e => setEditRates({ ...editRates, solarClient: e.target.value })}
                                            className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[11px] text-muted-foreground">AeroWash-Supplied Water (R/panel):</Label>
                                        <Input
                                            type="number"
                                            value={editRates.solarAeroWash}
                                            onChange={e => setEditRates({ ...editRates, solarAeroWash: e.target.value })}
                                            className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* If Regional Water Per Litre */}
                            {editPricingMethod === 'REGIONAL_WATER_PER_LITRE' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-[11px] text-muted-foreground">Atlantis Water Zone (R/L):</Label>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            value={editRates.waterAtlantis}
                                            onChange={e => setEditRates({ ...editRates, waterAtlantis: e.target.value })}
                                            className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[11px] text-muted-foreground">Simon&apos;s Town / Desalination (R/L):</Label>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            value={editRates.waterSimonsTown}
                                            onChange={e => setEditRates({ ...editRates, waterSimonsTown: e.target.value })}
                                            className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* If Price on Quote */}
                            {editPricingMethod === 'PRICE_ON_QUOTE' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-muted-foreground">Default Base Price (R) [Optional, default 0]:</Label>
                                    <Input
                                        type="number"
                                        value={editRates.defaultPrice}
                                        onChange={e => setEditRates({ ...editRates, defaultPrice: e.target.value })}
                                        className="h-8 max-w-[150px] bg-[#14141E] border-white/10 text-xs font-mono"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Internal Notes */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-white">Internal Crew &amp; Quoting Notes (Staff only)</Label>
                            <Input
                                value={editInternalNotes}
                                onChange={e => setEditInternalNotes(e.target.value)}
                                placeholder="e.g. Laser confirmation required within 2 m of band edge"
                                className="bg-[#14141E] border-white/10 text-xs text-white"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setEditingItem(null)}
                            className="text-xs text-muted-foreground hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={isPending}
                            className="bg-primary hover:bg-primary/90 text-black font-bold text-xs"
                        >
                            {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ADD NEW ITEM MODAL */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-2xl bg-[#0F172A] border border-white/10 text-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            Add New Catalogue Item
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Create a new service or provision in the AeroWash catalogue. It will immediately appear as a tickable option in the quote builder.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-white">Service / Item Name <span className="text-primary">*</span></Label>
                            <Input
                                placeholder="e.g. High-Pressure Entrance Paver Wash"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="bg-[#14141E] border-white/10 text-sm text-white"
                            />
                        </div>

                        {/* Client Description */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-white">Client Description (Appears on Quote &amp; PDF) <span className="text-primary">*</span></Label>
                            <Textarea
                                rows={3}
                                placeholder="Exact wording printed for the client..."
                                value={newDescription}
                                onChange={e => setNewDescription(e.target.value)}
                                className="bg-[#14141E] border-white/10 text-xs text-white resize-y"
                            />
                        </div>

                        {/* Category & Pricing Type */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-white">Category</Label>
                                <select
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    className="w-full h-9 rounded-md bg-[#14141E] border border-white/10 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="CLEANING">CLEANING</option>
                                    <option value="ASSESSMENT & REPORTING">ASSESSMENT &amp; REPORTING</option>
                                    <option value="SITE CONDITIONS">SITE CONDITIONS</option>
                                    <option value="CONTRACTS">CONTRACTS</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-white">Pricing Type</Label>
                                <select
                                    value={newPricingMethod}
                                    onChange={e => setNewPricingMethod(e.target.value)}
                                    className="w-full h-9 rounded-md bg-[#14141E] border border-white/10 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="PRICE_ON_QUOTE">Price on Quote (Custom entry per quote)</option>
                                    <option value="PERCENT">Percentage (%) of Elevation / Cleaning</option>
                                    <option value="ELEVATION_BAND">Per Elevation Band (m² Rate Card)</option>
                                </select>
                            </div>
                        </div>

                        {/* Default Rates / Value */}
                        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5" />
                                Pricing Defaults
                            </h4>

                            {newPricingMethod === 'PRICE_ON_QUOTE' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-muted-foreground">Default Base Amount (R) [0 = Enter on quote]:</Label>
                                    <Input
                                        type="number"
                                        value={newRates.defaultPrice}
                                        onChange={e => setNewRates({ ...newRates, defaultPrice: e.target.value })}
                                        className="h-8 max-w-[150px] bg-[#14141E] border-white/10 text-xs font-mono"
                                    />
                                </div>
                            )}

                            {newPricingMethod === 'PERCENT' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-muted-foreground">Default Percentage (%):</Label>
                                    <Input
                                        type="number"
                                        value={newRates.percentage}
                                        onChange={e => setNewRates({ ...newRates, percentage: e.target.value })}
                                        className="h-8 max-w-[150px] bg-[#14141E] border-white/10 text-xs font-mono"
                                    />
                                </div>
                            )}

                            {newPricingMethod === 'ELEVATION_BAND' && (
                                <div className="space-y-2">
                                    <Label className="text-[11px] text-muted-foreground">Band Rates (R/m²):</Label>
                                    <div className="grid grid-cols-5 gap-2">
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-mono">Band A</span>
                                            <Input
                                                type="number"
                                                value={newRates.bandA}
                                                onChange={e => setNewRates({ ...newRates, bandA: e.target.value })}
                                                className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-mono">Band B</span>
                                            <Input
                                                type="number"
                                                value={newRates.bandB}
                                                onChange={e => setNewRates({ ...newRates, bandB: e.target.value })}
                                                className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-mono">Band C</span>
                                            <Input
                                                type="number"
                                                value={newRates.bandC}
                                                onChange={e => setNewRates({ ...newRates, bandC: e.target.value })}
                                                className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-mono">Band D</span>
                                            <Input
                                                type="number"
                                                value={newRates.bandD}
                                                onChange={e => setNewRates({ ...newRates, bandD: e.target.value })}
                                                className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-mono">Band E</span>
                                            <Input
                                                type="number"
                                                value={newRates.bandE}
                                                onChange={e => setNewRates({ ...newRates, bandE: e.target.value })}
                                                className="h-8 bg-[#14141E] border-white/10 text-xs font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Internal Notes */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-white">Internal Crew &amp; Quoting Notes (Optional)</Label>
                            <Input
                                placeholder="Internal guidance for quoting..."
                                value={newInternalNotes}
                                onChange={e => setNewInternalNotes(e.target.value)}
                                className="bg-[#14141E] border-white/10 text-xs text-white"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsAddOpen(false)}
                            className="text-xs text-muted-foreground hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveNew}
                            disabled={isPending}
                            className="bg-primary hover:bg-primary/90 text-black font-bold text-xs"
                        >
                            {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                            Create Catalogue Item
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
