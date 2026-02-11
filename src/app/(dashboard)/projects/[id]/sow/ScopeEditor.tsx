"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, ArrowLeft, Sparkles, Save, Mic, Loader2, CheckCircle2, ExternalLink } from "lucide-react"
import { VoiceFieldInput } from "@/components/ui/VoiceFieldInput"
import { submitScopeAction, saveSOWDraftAction } from "./actions"
import Link from "next/link"
import { useEffect } from "react"

interface ScopeEditorProps {
    projectId: string
    initialItems?: any[]
}

export function ScopeEditor({ projectId, initialItems }: ScopeEditorProps) {
    const router = useRouter()
    const [items, setItems] = useState(initialItems || [{ description: "", quantity: 1, unit: "", notes: "" }])
    const [site, setSite] = useState("")
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [recordingIndex, setRecordingIndex] = useState<number | null>(null)
    const [submitted, setSubmitted] = useState(false)
    const [wbpId, setWbpId] = useState<string | null>(null)

    const STORAGE_KEY = `sow-draft-${projectId}`

    // Check localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const { items: savedItems, site: savedSite } = JSON.parse(saved)
                if (confirm("You have an unsaved session. Would you like to resume?")) {
                    setItems(savedItems)
                    setSite(savedSite)
                } else {
                    localStorage.removeItem(STORAGE_KEY)
                }
            } catch (e) {
                console.error("Failed to parse saved session", e)
            }
        }
    }, [projectId, STORAGE_KEY])

    // Auto-save to localStorage
    useEffect(() => {
        if (items.length > 0 && !submitted) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, site, timestamp: Date.now() }))
        }
    }, [items, site, submitted, STORAGE_KEY])

    const addItem = () => setItems([...items, { description: "", quantity: 1, unit: "", notes: "" }])
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index))

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items]
        // @ts-ignore
        newItems[index][field] = value
        setItems(newItems)
    }

    const handleVoiceResult = (index: number, text: string) => {
        const current = items[index].description || ""
        updateItem(index, 'description', current + (current ? " " : "") + text)
    }

    const parseWithAI = (index: number) => {
        const text = items[index].description
        if (!text) return

        // Simple heuristic: split by newlines or "Item:" keywords
        if (text.includes('\n') || text.toLowerCase().includes('item:')) {
            const lines = text.split(/\n|Item:/i).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
            if (lines.length > 1) {
                const newItems = [...items]
                newItems[index].description = lines[0]
                lines.slice(1).forEach((line: string) => {
                    newItems.splice(index + 1, 0, { description: line, quantity: 1, unit: "", notes: "" })
                })
                setItems(newItems)
            }
        }
    }

    const handleSaveDraft = async () => {
        setSaving(true)
        try {
            await saveSOWDraftAction(projectId, items, site)
            alert("Draft saved successfully!")
        } catch (error) {
            console.error("Error saving draft:", error)
            alert("Failed to save draft. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    const handleSubmit = async () => {
        if (items.some(i => !i.description)) {
            alert("Please provide a description for all items.")
            return
        }

        setLoading(true)
        try {
            const result = await submitScopeAction(projectId, items, site)
            // @ts-ignore
            setWbpId(result.wbpId)
            setSubmitted(true)
            localStorage.removeItem(STORAGE_KEY)
            // Scroll to top to show confirmation
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (error) {
            console.error("Error submitting scope:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8 pb-20">
            {/* SAME-PAGE SUBMISSION CONFIRMATION */}
            {submitted && (
                <Card className="bg-primary/10 border-primary shadow-2xl overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <CardContent className="p-8 text-center space-y-6">
                        <div className="mx-auto bg-primary rounded-full p-4 w-16 h-16 flex items-center justify-center shadow-lg shadow-primary/20">
                            <Sparkles className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-primary uppercase tracking-widest">
                                ✅ Scope of Work submitted
                            </h2>
                            <p className="text-muted-foreground font-medium uppercase tracking-[0.2em] text-[10px]">Technical Handover Complete</p>
                        </div>

                        {site && (
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 inline-block mx-auto min-w-[200px]">
                                <span className="text-[10px] font-black uppercase text-muted-foreground block mb-1">Site Identification</span>
                                <span className="text-lg font-bold text-white tracking-widest uppercase">{site}</span>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 pt-6 justify-center">
                            <Link href="/work-breakdown-pricing" className="flex-1 max-w-[240px]">
                                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-12 rounded-xl shadow-xl shadow-primary/10">
                                    Review on WB&P Page
                                </Button>
                            </Link>
                            {wbpId && (
                                <Link href={`/work-breakdown-pricing/${wbpId}`} className="flex-1 max-w-[240px]">
                                    <Button variant="outline" className="w-full border-primary/20 hover:bg-primary/5 text-primary font-black h-12 rounded-xl">
                                        Open Detailed Breakdown
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
            <Card className="bg-[#1A1A2E] border-white/5 shadow-2xl overflow-hidden rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-white/5 bg-white/5">
                    <div>
                        <CardTitle className="text-2xl font-black text-white">Scope Definition</CardTitle>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Specify technical requirements for the breakdown.</p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addItem}
                        className="border-primary/20 hover:bg-primary/10 text-primary font-bold transition-all"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Add Requirement
                    </Button>
                </CardHeader>
                <div className="px-8 pb-6 border-b border-white/5 bg-white/5">
                    <div className="max-w-md space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary italic">Site Name</Label>
                        <Input
                            value={site}
                            onChange={e => setSite(e.target.value)}
                            placeholder="e.g. 15 Culemborg Street, Avondale"
                            className="bg-[#14141E] border-primary/20 text-white font-bold h-12 focus:border-primary transition-all"
                        />
                    </div>
                </div>
                <CardContent className="space-y-6 p-8">
                    {items.map((item, index) => (
                        <div key={index} className="flex gap-6 items-start p-6 border border-white/5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all group relative">
                            <div className="flex-1 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Description & Details</Label>
                                        <div className="flex items-center gap-3">
                                            <VoiceFieldInput
                                                onResult={(text) => handleVoiceResult(index, text)}
                                                isRecording={recordingIndex === index}
                                                onToggle={(recording) => setRecordingIndex(recording ? index : null)}
                                                className="h-8 w-8 hover:bg-primary/10 rounded-full transition-colors"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-primary hover:bg-primary/10"
                                                title="Split Items (AI)"
                                                onClick={() => parseWithAI(index)}
                                            >
                                                <Sparkles className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <Textarea
                                        value={item.description}
                                        onChange={e => updateItem(index, 'description', e.target.value)}
                                        placeholder="Describe the specialized work requirement..."
                                        className="min-h-[100px] bg-[#14141E] border-white/10 focus:border-primary/50 transition-all text-white font-medium resize-none"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Qty</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                            className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Unit</Label>
                                        <Input
                                            value={item.unit}
                                            onChange={e => updateItem(index, 'unit', e.target.value)}
                                            placeholder="ea, m2, hr"
                                            className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-medium italic"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Internal Notes</Label>
                                        <Input
                                            value={item.notes}
                                            onChange={e => updateItem(index, 'notes', e.target.value)}
                                            placeholder="Site specifics..."
                                            className="bg-[#14141E] border-white/10 focus:border-primary/50 text-muted-foreground text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground/40 hover:text-red-500 mt-8 transition-colors self-start opacity-0 group-hover:opacity-100"
                                onClick={() => removeItem(index)}
                                disabled={items.length === 1}
                            >
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex justify-between items-center bg-[#1A1A2E] p-6 rounded-2xl border border-primary/10 shadow-2xl">
                <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground hover:text-white font-bold">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Discard Changes
                </Button>
                <div className="flex gap-4">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={handleSaveDraft}
                        disabled={loading || saving}
                        className="border-primary/20 hover:bg-primary/5 text-primary font-black px-8 h-14 rounded-xl transition-all"
                    >
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-5 w-5" />
                        )}
                        Save Draft
                    </Button>
                    <Button
                        size="lg"
                        onClick={handleSubmit}
                        disabled={loading || saving}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-12 h-14 shadow-xl shadow-primary/20 transition-all active:scale-95"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing Submission...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-2 h-5 w-5" /> Terminate & Submit SOW
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
