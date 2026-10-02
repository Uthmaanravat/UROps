"use client"

import React, { useState, useMemo } from "react"
import { Book, Search, Plus, Check, ChevronDown, ChevronRight, Layers } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency, compareItemCodes, cn } from "@/lib/utils"

interface CatalogSidePanelProps {
    catalog: any[]
    items: Array<{ code?: string; description?: string; quantity?: number }>
    onAddItem: (item: any) => void
    workType: "GENERAL" | "TENDER"
    selectedTender?: any
    clientName?: string
    rateYear?: number
    currencySymbol?: string
    className?: string
}

export function CatalogSidePanel({
    catalog,
    items,
    onAddItem,
    workType,
    selectedTender,
    clientName,
    rateYear = 1,
    currencySymbol = "R",
    className
}: CatalogSidePanelProps) {
    const [search, setSearch] = useState("")
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

    // Count how many times each item/code is currently added to the quote/invoice
    const addedCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const item of items) {
            const key = item.code ? item.code.trim().toUpperCase() : item.description?.trim().toLowerCase()
            if (key) {
                counts[key] = (counts[key] || 0) + (item.quantity || 1)
            }
        }
        return counts
    }, [items])

    // Filter items based on search
    const filteredCatalog = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return catalog

        return catalog.filter((item: any) => {
            const codeMatch = item.code && item.code.toLowerCase().includes(query)
            const descMatch = item.description && item.description.toLowerCase().includes(query)
            const catMatch = item.category && item.category.toLowerCase().includes(query)
            return codeMatch || descMatch || catMatch
        })
    }, [catalog, search])

    // Helper: effective price according to rate year
    const getItemPrice = (catItem: any) => {
        if (workType === "TENDER") {
            if (rateYear === 1) return catItem.year1Price ?? catItem.unitPrice ?? 0
            if (rateYear === 2) return catItem.year2Price ?? catItem.year1Price ?? catItem.unitPrice ?? 0
            if (rateYear === 3) return catItem.year3Price ?? catItem.year2Price ?? catItem.year1Price ?? catItem.unitPrice ?? 0
        }
        return catItem.unitPrice ?? 0
    }

    // Naturally sorted catalog list (strictly 1.1, 1.2, 1.3, ... 21)
    const sortedCatalog = useMemo(() => {
        return [...filteredCatalog].sort((a, b) => compareItemCodes(a.code, b.code))
    }, [filteredCatalog])

    // Group items by category only for general work
    const groupedCatalog = useMemo(() => {
        if (workType === "TENDER") return {}
        const groups: Record<string, any[]> = {}

        for (const item of sortedCatalog) {
            const cat = item.category?.trim() || "General Services"
            if (!groups[cat]) groups[cat] = []
            groups[cat].push(item)
        }

        return groups
    }, [sortedCatalog, workType])

    const toggleCategory = (cat: string) => {
        setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
    }

    const renderItemCard = (item: any) => {
        const codeKey = item.code ? item.code.trim().toUpperCase() : null
        const descKey = item.description?.trim().toLowerCase()
        const addedCount = (codeKey && addedCounts[codeKey]) || (descKey && addedCounts[descKey]) || 0
        const isAdded = addedCount > 0
        const price = getItemPrice(item)

        return (
            <div
                key={item.id}
                className={cn(
                    "p-2.5 rounded-lg border transition-all text-xs flex flex-col gap-1.5",
                    isAdded
                        ? "bg-primary/[0.04] border-primary/20 hover:border-primary/40"
                        : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]"
                )}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        {item.code && (
                            <span className="inline-block font-mono font-black text-primary text-[11px] bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded mr-1.5 mb-0.5">
                                {item.code}
                            </span>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                            {formatCurrency(price, currencySymbol)} / {item.unit || "ea"}
                        </span>
                    </div>

                    {/* Added Badge or Add Button */}
                    <div className="shrink-0 flex items-center gap-1.5">
                        {isAdded && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                                <Check className="w-2.5 h-2.5" />
                                {addedCount > 1 ? `Added ×${addedCount}` : "Added"}
                            </span>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onAddItem(item)}
                            className="h-6 px-2 text-[10px] font-bold border-white/10 hover:border-primary hover:bg-primary/20 hover:text-white"
                        >
                            <Plus className="h-3 w-3 mr-0.5" /> Add
                        </Button>
                    </div>
                </div>

                {/* Full Description with wrapping */}
                <p className="text-gray-200 font-medium text-[12px] leading-relaxed break-words">
                    {item.description}
                </p>
            </div>
        )
    }

    return (
        <div className={cn(
            "w-full lg:w-96 shrink-0 bg-[#14141E]/95 border border-white/10 rounded-2xl p-4 md:p-5 h-fit sticky top-6 backdrop-blur-md shadow-2xl flex flex-col gap-4",
            className
        )}>
            {/* Header */}
            <div className="pb-3 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-2">
                        <Book className="h-4 w-4" />
                        {workType === "TENDER" ? "Tender 152G Catalog" : "Standard Catalog"}
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {filteredCatalog.length} {filteredCatalog.length === 1 ? "item" : "items"}
                    </span>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                    {workType === "TENDER"
                        ? `City of Cape Town (Year ${rateYear} Rate)`
                        : clientName ? `${clientName}'s General Price List` : "Standard Rates"}
                </p>
            </div>

            {/* Search Box */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder="Search code or description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 bg-white/5 border-white/10 focus:border-primary text-xs"
                />
            </div>

            {/* Catalog List */}
            <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-1 scrollbar-thin">
                {workType === "TENDER" ? (
                    sortedCatalog.length === 0 ? (
                        <div className="text-center py-10 text-xs text-muted-foreground italic">
                            {search ? "No matching tender items found." : "No tender items available."}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sortedCatalog.map(renderItemCard)}
                        </div>
                    )
                ) : (
                    Object.keys(groupedCatalog).length === 0 ? (
                        <div className="text-center py-10 text-xs text-muted-foreground italic">
                            {search ? "No matching catalog items found." : "No catalog items available."}
                        </div>
                    ) : (
                        Object.entries(groupedCatalog).map(([categoryName, catItems]) => {
                            const isCollapsed = collapsedCategories[categoryName]
                            return (
                                <div key={categoryName} className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.01]">
                                    {/* Category Header */}
                                    <button
                                        type="button"
                                        onClick={() => toggleCategory(categoryName)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-left bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-200">
                                            <Layers className="h-3 w-3 text-primary" />
                                            <span className="truncate">{categoryName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                ({catItems.length})
                                            </span>
                                            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                                        </div>
                                    </button>

                                    {/* Items in Category */}
                                    {!isCollapsed && (
                                        <div className="p-1.5 space-y-1.5">
                                            {catItems.map(renderItemCard)}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )
                )}
            </div>
        </div>
    )
}
