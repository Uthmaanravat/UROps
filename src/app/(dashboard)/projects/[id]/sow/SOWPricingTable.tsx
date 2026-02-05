"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Sparkles, Loader2, DollarSign, Trash2, Plus, Scissors } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { generateQuotationAction, getPricingSuggestionsAction } from "./actions"

interface SOWPricingTableProps {
    sowId: string
    items: any[]
}

export function SOWPricingTable({ sowId, items: initialItems }: SOWPricingTableProps) {
    const router = useRouter()
    const [items, setItems] = useState(initialItems.map(i => ({
        id: i.id || Math.random().toString(36).substr(2, 9),
        description: i.description,
        quantity: i.quantity,
        unit: i.unit || "",
        notes: i.notes || "",
        unitPrice: 0
    })))
    const [suggestions, setSuggestions] = useState<Record<string, { typicalPrice: number; source: string }>>({})
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)

    useEffect(() => {
        async function fetchSuggestions() {
            setIsLoadingSuggestions(true)
            try {
                const res = await getPricingSuggestionsAction(initialItems)
                setSuggestions(res)

                // Auto-apply suggestions if available for items with 0 price
                setItems(prev => prev.map(item => ({
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
    }, [initialItems])

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
        setItems(items.filter((_, i) => i !== index))
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

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const total = subtotal * 1.15 // 15% VAT

    const handleGenerate = async () => {
        if (items.some(i => i.unitPrice === 0)) {
            if (!confirm("Some items have zero price. Proceed anyway?")) return
        }

        setIsGenerating(true)
        try {
            await generateQuotationAction(sowId, items)
            router.refresh()
        } catch (error) {
            console.error("Error generating quotation:", error)
            alert("Failed to generate quotation.")
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <Card className="border-2 border-blue-100 shadow-lg overflow-hidden">
            <CardHeader className="bg-blue-600 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Work Breakdown & Pricing (WB&P)
                        </CardTitle>
                        <p className="text-xs text-blue-100 mt-1">
                            Finalize descriptions, quantities, and pricing before generating a quotation.
                        </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={addItem} className="bg-white text-blue-600 hover:bg-blue-50">
                        <Plus className="h-4 w-4 mr-1" /> Add Line
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3 min-w-[300px]">Description & Notes</th>
                                <th className="px-4 py-3 text-center w-24">Qty</th>
                                <th className="px-4 py-3 text-center w-24">Unit</th>
                                <th className="px-4 py-3 text-right w-40">Price (R)</th>
                                <th className="px-4 py-3 text-right w-32">Total</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {items.map((item, index) => {
                                const suggestion = suggestions[item.description]
                                return (
                                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-4 py-4 space-y-2">
                                            <div className="relative">
                                                <Textarea
                                                    value={item.description}
                                                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                    className="min-h-[60px] text-sm font-medium resize-none focus:ring-blue-500"
                                                    placeholder="Item description..."
                                                />
                                                {item.description.includes('\n') && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="absolute bottom-1 right-1 h-6 w-6 text-orange-500 hover:text-orange-600 bg-white shadow-sm"
                                                        onClick={() => splitItem(index)}
                                                        title="Split into multiple lines"
                                                    >
                                                        <Scissors className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                            <Input
                                                value={item.notes}
                                                onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                                className="h-7 text-[11px] italic text-muted-foreground border-dashed bg-muted/20"
                                                placeholder="Internal notes..."
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-center align-top">
                                            <Input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                                className="h-8 text-center"
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-center align-top">
                                            <Input
                                                value={item.unit}
                                                onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                className="h-8 text-center"
                                                placeholder="ea"
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-right align-top">
                                            <div className="relative">
                                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                                                    className="pl-6 text-right h-8"
                                                />
                                            </div>
                                            {suggestion && (
                                                <div className="text-[9px] text-green-600 mt-1 font-semibold flex items-center justify-end gap-1">
                                                    <Sparkles className="h-2 w-2" />
                                                    AI: R{suggestion.typicalPrice}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right align-top font-bold pt-6">
                                            {formatCurrency(item.quantity * item.unitPrice)}
                                        </td>
                                        <td className="px-4 py-4 align-top pt-6">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-300 hover:text-red-500 transition-colors"
                                                onClick={() => removeItem(index)}
                                                disabled={items.length === 1}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 border-t p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <div className="flex gap-4 text-sm">
                            <span className="text-slate-500">Subtotal:</span>
                            <span className="font-bold">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex gap-4 text-sm">
                            <span className="text-slate-500">VAT (15%):</span>
                            <span className="font-bold">{formatCurrency(total - subtotal)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <span className="text-xs text-slate-500 block">Work Breakdown & Pricing Total</span>
                            <span className="text-2xl font-black text-blue-900">{formatCurrency(total)}</span>
                        </div>
                        <Button
                            size="lg"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="bg-blue-600 hover:bg-blue-700 shadow-xl px-10 h-14 font-bold rounded-xl"
                        >
                            {isGenerating ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                "APPROVE WORK BREAKDOWN & PRICING & GENERATE QUOTATION"
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
