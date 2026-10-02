"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, LINE_ITEM_REASONS, cn } from "@/lib/utils"
import { Plus, GripVertical, Copy, Trash2, Lock, Unlock, AlertCircle, Sparkles, Check, ChevronDown } from "lucide-react"
import { ItemPositionInput } from "@/components/invoices/ItemPositionInput"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export interface LineItem {
    id?: string
    code?: string
    description: string
    quantity: number
    unit?: string
    unitPrice: number
    total?: number
    area?: string
    reason?: string
    isLocked?: boolean
    rateYear?: number
}

interface LineItemEditorProps {
    items: LineItem[]
    onChange: (items: LineItem[]) => void
    catalog: any[]
    workType: "GENERAL" | "TENDER"
    rateYear?: number
    currencySymbol?: string
    pricingSuggestions?: Record<string, { typicalPrice: number; source: string }>
    isAdmin?: boolean
    onLogUnlock?: (data: { itemId?: string; itemCode?: string; reason: string }) => Promise<void>
    highlightIndex?: number | null
}

// Auto-resizing textarea component for line item descriptions
function AutoGrowTextarea({
    value,
    onChange,
    onKeyDown,
    readOnly,
    placeholder,
    className
}: {
    value: string
    onChange: (val: string) => void
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
    readOnly?: boolean
    placeholder?: string
    className?: string
}) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)

    const adjustHeight = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = "auto"
        el.style.height = `${Math.max(el.scrollHeight, 38)}px`
    }, [])

    useEffect(() => {
        adjustHeight()
    }, [value, adjustHeight])

    return (
        <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            readOnly={readOnly}
            placeholder={placeholder}
            onChange={(e) => {
                onChange(e.target.value)
                adjustHeight()
            }}
            onKeyDown={onKeyDown}
            className={cn(
                "w-full resize-none overflow-hidden rounded-md px-3 py-2 text-xs md:text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
                readOnly
                    ? "bg-white/[0.03] text-gray-200 cursor-default border-transparent"
                    : "bg-[#14141E] border border-white/10 text-white focus:border-primary/50",
                className
            )}
        />
    )
}

export function LineItemEditor({
    items,
    onChange,
    catalog,
    workType,
    rateYear = 1,
    currencySymbol = "R",
    pricingSuggestions = {},
    isAdmin = true,
    onLogUnlock,
    highlightIndex = null
}: LineItemEditorProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const [activeHighlight, setActiveHighlight] = useState<number | null>(highlightIndex)
    const rowRefs = useRef<(HTMLDivElement | null)[]>([])

    // Code dropdown state
    const [activeCodeDropdownIndex, setActiveCodeDropdownIndex] = useState<number | null>(null)
    const [codeSearchQuery, setCodeSearchQuery] = useState("")
    const [highlightedCodeOptionIndex, setHighlightedCodeOptionIndex] = useState(0)
    const dropdownRef = useRef<HTMLDivElement | null>(null)

    // Unlock dialog state
    const [unlockDialogOpen, setUnlockDialogOpen] = useState(false)
    const [itemToUnlockIndex, setItemToUnlockIndex] = useState<number | null>(null)
    const [unlockReason, setUnlockReason] = useState("")
    const [unlocking, setUnlocking] = useState(false)

    // Listen to highlightIndex prop changes
    useEffect(() => {
        if (highlightIndex !== null && highlightIndex !== undefined) {
            setActiveHighlight(highlightIndex)
            const targetEl = rowRefs.current[highlightIndex]
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" })
            }
            const timer = setTimeout(() => setActiveHighlight(null), 1800)
            return () => clearTimeout(timer)
        }
    }, [highlightIndex])

    // Close code dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setActiveCodeDropdownIndex(null)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const updateItem = (index: number, field: keyof LineItem, value: any) => {
        const next = [...items]
        const current = { ...next[index], [field]: value }

        if (field === "quantity" || field === "unitPrice") {
            const q = field === "quantity" ? Number(value) || 0 : Number(current.quantity) || 0
            const p = field === "unitPrice" ? Number(value) || 0 : Number(current.unitPrice) || 0
            current.total = q * p
        }
        next[index] = current
        onChange(next)
    }

    const addItem = () => {
        const newItem: LineItem = {
            code: "",
            description: "",
            quantity: 1,
            unit: "each",
            unitPrice: 0,
            total: 0,
            area: "",
            reason: "",
            isLocked: false
        }
        const next = [...items, newItem]
        onChange(next)
        const newIdx = next.length - 1
        setActiveHighlight(newIdx)
        setTimeout(() => {
            rowRefs.current[newIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        }, 50)
    }

    const removeItem = (index: number) => {
        if (items.length <= 1) {
            // Keep at least one empty item
            onChange([{
                code: "",
                description: "",
                quantity: 1,
                unit: "each",
                unitPrice: 0,
                total: 0,
                area: "",
                reason: "",
                isLocked: false
            }])
            return
        }
        const next = [...items]
        next.splice(index, 1)
        onChange(next)
    }

    const duplicateItem = (index: number) => {
        const source = items[index]
        const cloned: LineItem = {
            ...source,
            id: undefined, // Fresh row
            quantity: source.quantity || 1
        }
        const next = [...items]
        next.splice(index + 1, 0, cloned)
        onChange(next)
        setActiveHighlight(index + 1)
    }

    const moveItemToPosition = (fromIndex: number, targetPosition: number) => {
        if (isNaN(targetPosition)) return
        const toIndex = Math.max(0, Math.min(items.length - 1, targetPosition - 1))
        if (fromIndex === toIndex) return

        const next = [...items]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        onChange(next)
    }

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index)
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", index.toString())
    }

    const handleDragEnter = (e: React.DragEvent, index: number) => {
        e.preventDefault()
        setDragOverIndex(index)
    }

    const handleDragEnd = () => {
        if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
            const next = [...items]
            const [moved] = next.splice(draggedIndex, 1)
            next.splice(dragOverIndex, 0, moved)
            onChange(next)
        }
        setDraggedIndex(null)
        setDragOverIndex(null)
    }

    // Helper: determine unit price for catalog item according to tender rate year
    const getCatalogItemPrice = (catItem: any) => {
        if (workType === "TENDER") {
            if (rateYear === 1) return catItem.year1Price ?? catItem.unitPrice ?? 0
            if (rateYear === 2) return catItem.year2Price ?? catItem.year1Price ?? catItem.unitPrice ?? 0
            if (rateYear === 3) return catItem.year3Price ?? catItem.year2Price ?? catItem.year1Price ?? catItem.unitPrice ?? 0
        }
        return catItem.unitPrice ?? 0
    }

    // Apply catalog match to item
    const applyCatalogItem = (index: number, catItem: any) => {
        const price = getCatalogItemPrice(catItem)
        const isTenderItem = workType === "TENDER" || Boolean(catItem.tenderId)

        const next = [...items]
        next[index] = {
            ...next[index],
            code: catItem.code || "",
            description: catItem.description || "",
            unit: catItem.unit || "each",
            unitPrice: price,
            total: (next[index].quantity || 1) * price,
            isLocked: isTenderItem,
            rateYear: workType === "TENDER" ? rateYear : undefined
        }
        onChange(next)
        setActiveCodeDropdownIndex(null)
        setActiveHighlight(index)
    }

    // Filter catalog for code combobox
    const getCodeMatches = (query: string) => {
        const clean = query.trim().toLowerCase()
        if (!clean) return catalog.slice(0, 10)
        return catalog
            .filter((c: any) =>
                c.code && (c.code.toLowerCase().includes(clean) || c.description.toLowerCase().includes(clean))
            )
            .slice(0, 12)
    }

    const handleUnlockConfirm = async () => {
        if (itemToUnlockIndex === null || !unlockReason.trim()) return
        setUnlocking(true)
        try {
            const target = items[itemToUnlockIndex]
            if (onLogUnlock) {
                await onLogUnlock({
                    itemId: target.id,
                    itemCode: target.code,
                    reason: unlockReason.trim()
                })
            }
            updateItem(itemToUnlockIndex, "isLocked", false)
            setUnlockDialogOpen(false)
            setUnlockReason("")
            setItemToUnlockIndex(null)
        } catch (err) {
            console.error("Failed to unlock item:", err)
            alert("Failed to unlock: " + (err instanceof Error ? err.message : "Unknown error"))
        } finally {
            setUnlocking(false)
        }
    }

    return (
        <div className="space-y-3">
            {/* Table Header Row (Hidden on mobile) */}
            <div className="hidden md:flex items-center gap-2.5 px-3 py-2 border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                <div className="w-14 text-center shrink-0">#</div>
                <div className="w-24 shrink-0">Code</div>
                <div className="flex-1 min-w-[280px]">Service Description & Details</div>
                <div className="w-16 text-center shrink-0">Qty</div>
                <div className="w-16 text-center shrink-0">Unit</div>
                <div className="w-28 text-right shrink-0">Price</div>
                <div className="w-28 text-right shrink-0">Total</div>
                <div className="w-16 text-center shrink-0">Actions</div>
            </div>

            {/* Rows List */}
            <div className="space-y-2.5">
                {items.map((item, index) => {
                    const isRowHighlighted = activeHighlight === index
                    const isTenderLocked = Boolean(item.isLocked && workType === "TENDER")
                    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0)

                    // Code matching check for polite warning
                    const hasValidCode = !item.code || catalog.some((c: any) => c.code?.toLowerCase() === item.code?.toLowerCase())

                    return (
                        <div
                            key={item.id || `row-${index}`}
                            ref={(el) => { rowRefs.current[index] = el }}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragOver={(e) => {
                                if (draggedIndex !== null) {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = "move"
                                }
                            }}
                            onDrop={(e) => {
                                if (draggedIndex !== null) {
                                    e.preventDefault()
                                    handleDragEnd()
                                }
                            }}
                            className={cn(
                                "flex flex-col gap-2 p-3 md:p-2.5 rounded-xl border transition-all duration-300 relative group/row",
                                isRowHighlighted
                                    ? "ring-2 ring-primary/80 bg-primary/10 border-primary shadow-lg shadow-primary/10"
                                    : "border-white/5 bg-white/[0.015] hover:bg-white/[0.03]",
                                dragOverIndex === index ? "border-t-2 border-t-primary" : ""
                            )}
                        >
                            {/* Heading & Reason/Justification (Top Sub-bar) */}
                            <div className="flex flex-wrap items-center justify-between gap-3 px-1 border-b border-white/5 pb-1 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] uppercase font-black text-primary/70 tracking-widest">Heading:</span>
                                    <Input
                                        placeholder="SECTION (E.G. PREPARATIONS, LOT 1)"
                                        value={item.area || ""}
                                        onChange={(e) => updateItem(index, "area", e.target.value)}
                                        className="bg-transparent border-none focus:ring-0 text-[10px] font-bold text-primary uppercase tracking-widest h-6 p-0 w-44 md:w-56"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] uppercase font-black text-amber-400/80 tracking-widest">Justification:</span>
                                    <select
                                        value={LINE_ITEM_REASONS.includes(item.reason as any) ? item.reason : (item.reason ? "Custom" : "")}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            if (val === "Custom") {
                                                updateItem(index, "reason", item.reason && !LINE_ITEM_REASONS.includes(item.reason as any) ? item.reason : "Custom: ")
                                            } else {
                                                updateItem(index, "reason", val)
                                            }
                                        }}
                                        className="bg-[#14141E] border border-white/10 rounded px-2 py-0.5 text-[10px] font-semibold text-gray-200 focus:outline-none focus:border-amber-400/50 cursor-pointer"
                                    >
                                        <option value="">(No Justification)</option>
                                        {LINE_ITEM_REASONS.map((r) => (
                                            <option key={r} value={r}>Due to: {r}</option>
                                        ))}
                                        <option value="Custom">Custom Justification...</option>
                                    </select>
                                    {(item.reason && !LINE_ITEM_REASONS.includes(item.reason as any) || item.reason === "Custom") && (
                                        <Input
                                            value={item.reason === "Custom" ? "" : (item.reason || "")}
                                            onChange={(e) => updateItem(index, "reason", e.target.value)}
                                            placeholder="Due to [cause]..."
                                            className="bg-[#14141E] border-white/10 text-[10px] h-6 px-2 w-44 text-amber-200 placeholder:text-muted-foreground/50 focus:border-amber-400/50"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Main Inputs Row */}
                            <div className="flex flex-col md:flex-row items-stretch md:items-start gap-2.5">
                                {/* Position & Drag Handle */}
                                <div className="md:w-14 flex items-center gap-1 pt-1 justify-start md:justify-center shrink-0">
                                    <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden block mr-1 select-none">#</span>
                                    <div
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className="text-white/20 hover:text-primary cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-white/5 transition-colors shrink-0"
                                        title="Drag to reorder"
                                    >
                                        <GripVertical className="h-4 w-4" />
                                    </div>
                                    <ItemPositionInput
                                        position={index + 1}
                                        totalItems={items.length}
                                        onMove={(newPos) => moveItemToPosition(index, newPos)}
                                    />
                                </div>

                                {/* Code Combobox Input */}
                                <div className="md:w-24 shrink-0 relative">
                                    <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">Code</span>
                                    <div className="relative">
                                        <Input
                                            placeholder="Code"
                                            value={item.code || ""}
                                            onChange={(e) => {
                                                const val = e.target.value.toUpperCase()
                                                updateItem(index, "code", val)
                                                setCodeSearchQuery(val)
                                                setActiveCodeDropdownIndex(index)
                                                setHighlightedCodeOptionIndex(0)

                                                // Instant match check
                                                const matched = catalog.find((c: any) => c.code?.toUpperCase() === val)
                                                if (matched) {
                                                    applyCatalogItem(index, matched)
                                                }
                                            }}
                                            onFocus={() => {
                                                setCodeSearchQuery(item.code || "")
                                                setActiveCodeDropdownIndex(index)
                                                setHighlightedCodeOptionIndex(0)
                                            }}
                                            onKeyDown={(e) => {
                                                const matches = getCodeMatches(codeSearchQuery)
                                                if (activeCodeDropdownIndex === index && matches.length > 0) {
                                                    if (e.key === "ArrowDown") {
                                                        e.preventDefault()
                                                        setHighlightedCodeOptionIndex((prev) => (prev + 1) % matches.length)
                                                        return
                                                    }
                                                    if (e.key === "ArrowUp") {
                                                        e.preventDefault()
                                                        setHighlightedCodeOptionIndex((prev) => (prev - 1 + matches.length) % matches.length)
                                                        return
                                                    }
                                                    if (e.key === "Enter") {
                                                        e.preventDefault()
                                                        applyCatalogItem(index, matches[highlightedCodeOptionIndex])
                                                        return
                                                    }
                                                    if (e.key === "Escape") {
                                                        setActiveCodeDropdownIndex(null)
                                                        return
                                                    }
                                                }

                                                // Tab navigation flow: Code -> Qty if tender, or standard Tab
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault()
                                                    if (index === items.length - 1) {
                                                        addItem()
                                                    }
                                                }
                                            }}
                                            className={cn(
                                                "bg-[#14141E] font-mono text-center font-bold h-9 w-full text-xs uppercase",
                                                !hasValidCode && item.code ? "border-amber-500/60 text-amber-300" : "border-white/10 text-primary focus:border-primary/50"
                                            )}
                                        />
                                        {!hasValidCode && item.code && (
                                            <span
                                                title="Code not found in current catalog list"
                                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-amber-400 cursor-help"
                                            >
                                                <AlertCircle className="w-3 h-3" />
                                            </span>
                                        )}
                                    </div>

                                    {/* Dropdown Suggestions */}
                                    {activeCodeDropdownIndex === index && (
                                        <div
                                            ref={dropdownRef}
                                            className="absolute z-50 left-0 top-full mt-1 w-72 bg-[#1A1A2E] border border-primary/30 rounded-xl shadow-2xl max-h-56 overflow-y-auto p-1 text-xs"
                                        >
                                            {getCodeMatches(codeSearchQuery).length === 0 ? (
                                                <div className="p-2 text-muted-foreground italic text-[11px] text-center">
                                                    No matching catalog codes
                                                </div>
                                            ) : (
                                                getCodeMatches(codeSearchQuery).map((match: any, mIdx: number) => {
                                                    const price = getCatalogItemPrice(match)
                                                    const isSelected = mIdx === highlightedCodeOptionIndex
                                                    return (
                                                        <button
                                                            key={match.id}
                                                            type="button"
                                                            onMouseEnter={() => setHighlightedCodeOptionIndex(mIdx)}
                                                            onClick={() => applyCatalogItem(index, match)}
                                                            className={cn(
                                                                "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors",
                                                                isSelected ? "bg-primary/20 text-white" : "hover:bg-white/5 text-gray-200"
                                                            )}
                                                        >
                                                            <div className="min-w-0 pr-2">
                                                                <span className="font-mono font-bold text-primary mr-1.5 text-[11px]">
                                                                    {match.code}
                                                                </span>
                                                                <span className="truncate inline-block max-w-[140px] text-[11px] align-middle">
                                                                    {match.description}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                                                {formatCurrency(price, currencySymbol)}
                                                            </span>
                                                        </button>
                                                    )
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Service Description: 45%-50% widest column, auto-grow, natural casing */}
                                <div className="flex-1 min-w-[280px] flex flex-col justify-start">
                                    <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">
                                        Service Description & Details
                                    </span>
                                    <div className="relative">
                                        <AutoGrowTextarea
                                            value={item.description}
                                            readOnly={isTenderLocked}
                                            placeholder="Service description and work details..."
                                            onChange={(val) => updateItem(index, "description", val)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                                    e.preventDefault()
                                                    if (index === items.length - 1) addItem()
                                                }
                                            }}
                                            className={cn(
                                                isTenderLocked ? "pr-20" : ""
                                            )}
                                        />
                                        {isTenderLocked && (
                                            <div className="absolute right-2 top-2 flex items-center gap-1.5">
                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                                    <Lock className="w-2.5 h-2.5" /> Locked
                                                </span>
                                                {isAdmin && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setItemToUnlockIndex(index)
                                                            setUnlockDialogOpen(true)
                                                        }}
                                                        className="h-5 px-1.5 text-[9px] text-amber-300 hover:text-white hover:bg-amber-500/20"
                                                        title="Unlock fixed tender rate for this item"
                                                    >
                                                        <Unlock className="w-2.5 h-2.5 mr-0.5" /> Unlock
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Quantity: Always editable */}
                                <div className="md:w-16 shrink-0">
                                    <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">Qty</span>
                                    <Input
                                        type="number"
                                        placeholder="1"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault()
                                                if (index === items.length - 1) addItem()
                                            }
                                        }}
                                        className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-bold text-center h-9 w-full text-xs"
                                        required
                                    />
                                </div>

                                {/* Unit */}
                                <div className="md:w-16 shrink-0">
                                    <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">Unit</span>
                                    <Input
                                        placeholder="ea"
                                        value={item.unit || ""}
                                        readOnly={isTenderLocked}
                                        onChange={(e) => updateItem(index, "unit", e.target.value)}
                                        className={cn(
                                            "text-center h-9 w-full text-xs font-medium italic",
                                            isTenderLocked
                                                ? "bg-white/[0.03] border-transparent text-gray-300 cursor-default"
                                                : "bg-[#14141E] border-white/10 focus:border-primary/50 text-white"
                                        )}
                                    />
                                </div>

                                {/* Price */}
                                <div className="md:w-28 shrink-0">
                                    <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">Price</span>
                                    <div className="relative">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/40">
                                            {currencySymbol}
                                        </span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={item.unitPrice}
                                            readOnly={isTenderLocked}
                                            onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                                            className={cn(
                                                "pl-6 text-right h-9 w-full text-xs font-black",
                                                isTenderLocked
                                                    ? "bg-white/[0.03] border-transparent text-amber-200/90 cursor-default"
                                                    : "bg-[#14141E] border-white/10 focus:border-primary/50 text-white"
                                            )}
                                            required
                                        />
                                    </div>
                                    {pricingSuggestions[item.description] && (!item.unitPrice || item.unitPrice === 0) && !isTenderLocked && (
                                        <button
                                            type="button"
                                            onClick={() => updateItem(index, "unitPrice", pricingSuggestions[item.description].typicalPrice)}
                                            className="mt-1 flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-1 py-0.5 rounded transition-all w-full justify-center"
                                            title={`Apply R${pricingSuggestions[item.description].typicalPrice}`}
                                        >
                                            <Sparkles className="h-2.5 w-2.5" /> R{pricingSuggestions[item.description].typicalPrice}
                                        </button>
                                    )}
                                </div>

                                {/* Line Total */}
                                <div className="md:w-28 shrink-0 text-right pt-2 md:pt-2.5">
                                    <span className="text-[9px] uppercase font-black text-muted-foreground/50 md:hidden mb-1 block">Total</span>
                                    <span className="text-xs md:text-sm font-black text-gray-100 font-mono">
                                        {formatCurrency(lineTotal, currencySymbol)}
                                    </span>
                                </div>

                                {/* Actions: Duplicate & Delete */}
                                <div className="md:w-16 shrink-0 flex items-center justify-end gap-1 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => duplicateItem(index)}
                                        className="p-1.5 text-muted-foreground hover:text-white rounded hover:bg-white/5 transition-colors"
                                        title="Duplicate item"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeItem(index)}
                                        className="p-1.5 text-muted-foreground hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors"
                                        title="Delete item"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Bottom Add Item Row */}
            <div className="pt-2 flex justify-start">
                <Button
                    type="button"
                    onClick={addItem}
                    size="sm"
                    variant="outline"
                    className="border-white/10 hover:border-primary/50 text-xs font-bold"
                >
                    <Plus className="mr-1.5 h-3.5 w-3.5 text-primary" /> Add Line Item
                </Button>
            </div>

            {/* Admin Unlock Confirmation Dialog */}
            <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
                <DialogContent className="sm:max-w-md bg-[#1A1A2E] border border-amber-500/30 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-400 text-base">
                            <Unlock className="h-4 w-4" /> Unlock Tender Item Rate
                        </DialogTitle>
                        <DialogDescription className="text-gray-300 text-xs">
                            City of Cape Town tender rates are legally fixed under contract 152G/2025/26.
                            Unlocking this item enables manual editing of its description, unit, and price.
                            A logged reason is required for auditing.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <div className="text-xs bg-white/5 p-2.5 rounded-lg border border-white/5">
                            <p className="font-mono text-primary font-bold">
                                Code: {itemToUnlockIndex !== null ? items[itemToUnlockIndex]?.code || "—" : ""}
                            </p>
                            <p className="text-gray-200 mt-0.5 line-clamp-2">
                                {itemToUnlockIndex !== null ? items[itemToUnlockIndex]?.description : ""}
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-200">
                                Justification for Price Override <span className="text-rose-400">*</span>
                            </Label>
                            <Textarea
                                placeholder="E.g. Approved variation order #4, specialized non-standard timber specification requested by municipal engineer..."
                                value={unlockReason}
                                onChange={(e) => setUnlockReason(e.target.value)}
                                className="bg-[#14141E] border-white/10 text-xs min-h-[70px]"
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setUnlockDialogOpen(false)}
                            className="text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={!unlockReason.trim() || unlocking}
                            onClick={handleUnlockConfirm}
                            className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs"
                        >
                            {unlocking ? "Unlocking..." : "Confirm & Unlock"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
