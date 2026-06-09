"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Trash2, Loader2, Save, X, Edit2, Bookmark } from "lucide-react"
import { saveFixedPriceItemAction, deleteFixedPriceItemAction, getFixedPriceItemsAction } from "@/app/(dashboard)/knowledge/fixed-actions"
import { formatCurrency } from "@/lib/utils"

export function FixedPriceManager({ clients = [] }: { clients?: { id: string; name: string }[] }) {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    // Form state
    const [description, setDescription] = useState("")
    const [unitPrice, setUnitPrice] = useState("")
    const [unit, setUnit] = useState("")
    const [category, setCategory] = useState("")
    const [clientId, setClientId] = useState("")
    const [code, setCode] = useState("")
    
    // Filter state
    const [selectedClientFilter, setSelectedClientFilter] = useState("all")

    useEffect(() => {
        loadItems()
    }, [])

    const loadItems = async () => {
        setLoading(true)
        try {
            const data = await getFixedPriceItemsAction()
            setItems(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const result = await saveFixedPriceItemAction({
                id: editingId || undefined,
                description,
                unitPrice: parseFloat(unitPrice),
                unit,
                category,
                clientId: clientId || null,
                code: code || null
            })

            if (result && result.success) {
                resetForm()
                loadItems()
            } else {
                alert("Failed to save: " + (result?.error || "Unknown server error"))
            }
        } catch (err) {
            console.error(err)
            alert("Failed to save item: " + (err instanceof Error ? err.message : "Network error"))
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this standard item?")) return
        try {
            await deleteFixedPriceItemAction(id)
            loadItems()
        } catch (err) {
            console.error(err)
            alert("Failed to delete item")
        }
    }

    const startEdit = (item: any) => {
        setEditingId(item.id)
        setDescription(item.description)
        setUnitPrice(item.unitPrice.toString())
        setUnit(item.unit || "")
        setCategory(item.category || "")
        setClientId(item.clientId || "")
        setCode(item.code || "")
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const resetForm = () => {
        setEditingId(null)
        setDescription("")
        setUnitPrice("")
        setUnit("")
        setCategory("")
        setClientId("")
        setCode("")
    }

    if (loading && items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Loading Catalog...</p>
            </div>
        )
    }

    const filteredItems = items.filter(item => {
        if (selectedClientFilter === "all") return true;
        if (selectedClientFilter === "global") return !item.clientId;
        return item.clientId === selectedClientFilter;
    })

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Form Section */}
            <Card className="bg-[#1A1A2E]/50 border-primary/20 shadow-2xl overflow-hidden border-dashed">
                <CardContent className="p-6">
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary italic">
                                {editingId ? "Edit Standard Item" : "Add New Standard Item"}
                            </h3>
                            {editingId && (
                                <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="text-muted-foreground">
                                    <X className="h-4 w-4 mr-2" /> Cancel Edit
                                </Button>
                            )}
                        </div>

                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Item Code</Label>
                                <Input
                                    placeholder="e.g. LAB01"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    className="bg-white/5 border-white/10 focus:border-primary font-mono uppercase"
                                />
                            </div>
                            <div className="space-y-2 lg:col-span-2">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Service Description</Label>
                                <Input
                                    placeholder="e.g. Call-out Fee (Emergency)"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    required
                                    className="bg-white/5 border-white/10 focus:border-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Unit Price (R)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={unitPrice}
                                    onChange={(e) => setUnitPrice(e.target.value)}
                                    required
                                    className="bg-white/5 border-white/10 focus:border-primary text-primary font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Unit (Optional)</Label>
                                <Input
                                    placeholder="e.g. hr, m2, km"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    className="bg-white/5 border-white/10 focus:border-primary font-mono lowercase"
                                />
                            </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2 pt-2 border-t border-white/5">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest font-bold text-primary">Link to Client (Optional)</Label>
                                <select
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-white/10 bg-[#0F0F1A] px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                >
                                    <option value="">Global / All Clients</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Category (Optional)</Label>
                                <Input
                                    placeholder="e.g. Labor, Materials"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="bg-white/5 border-white/10 focus:border-primary"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <Bookmark className="h-4 w-4 text-primary opacity-50" />
                                <span className="text-[10px] font-black text-muted-foreground uppercase italic tracking-tighter">
                                    Client-linked items override global pricing for that client
                                </span>
                            </div>
                            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8">
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                {editingId ? "Update Item" : "Add to Catalog"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* List Section */}
            <div className="rounded-2xl border border-white/5 bg-[#1A1A2E] shadow-2xl overflow-hidden">
                <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-lg font-black text-white uppercase tracking-widest italic">Standard Pricing Catalog</h2>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Filter by Client:</Label>
                            <select
                                value={selectedClientFilter}
                                onChange={(e) => setSelectedClientFilter(e.target.value)}
                                className="h-8 rounded-md border border-white/10 bg-[#0F0F1A] px-2 py-1 text-xs text-white"
                            >
                                <option value="all">All Clients</option>
                                <option value="global">Global Only</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-primary/20">
                            {filteredItems.length} Standard Services
                        </span>
                    </div>
                </div>

                <div className="p-0">
                    {filteredItems.length === 0 ? (
                        <div className="text-center text-muted-foreground py-20 italic">
                            No standard items found matching the selected filter.
                        </div>
                    ) : (
                        <div className="relative w-full overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="border-b border-white/5 bg-white/[0.02]">
                                        <th className="py-4 px-6 text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">Code</th>
                                        <th className="py-4 px-6 text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">Service / Description</th>
                                        <th className="py-4 px-6 text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">Client Link</th>
                                        <th className="py-4 px-6 text-right text-[10px] font-black uppercase text-primary tracking-widest italic">Standard Rate</th>
                                        <th className="py-4 px-6 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">Unit</th>
                                        <th className="py-4 px-6 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map(item => (
                                        <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors group">
                                            <td className="py-5 px-6 font-mono text-sm text-primary font-bold">{item.code || "—"}</td>
                                            <td className="py-5 px-6 font-bold text-white group-hover:text-primary transition-colors">{item.description}</td>
                                            <td className="py-5 px-6">
                                                {item.client ? (
                                                    <span className="text-xs font-bold text-white bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full uppercase tracking-tighter">
                                                        {item.client.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-muted-foreground bg-white/5 border border-white/10 px-2.5 py-1 rounded-full uppercase tracking-tighter">
                                                        Global
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-5 px-6 text-right font-black text-lg text-primary tracking-tight">{formatCurrency(item.unitPrice)}</td>
                                            <td className="py-5 px-6 text-right text-xs text-muted-foreground font-mono uppercase">
                                                {item.unit || "Lot"}
                                            </td>
                                            <td className="py-5 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Button variant="ghost" size="icon" onClick={() => startEdit(item)} className="h-8 w-8 text-muted-foreground hover:text-white">
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-muted-foreground hover:text-red-500">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
