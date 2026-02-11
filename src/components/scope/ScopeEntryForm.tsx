"use client"

import { useState, useCallback, memo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, ArrowLeft, Sparkles, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { createMobileSOWAction, saveScopeDraftAction } from "@/app/(dashboard)/scope/actions"
import { VoiceFieldInput } from "@/components/ui/VoiceFieldInput"

// Memoized individual row with stable handlers
const ScopeItemRow = memo(({
    item,
    index,
    onUpdate,
    onRemove,
    onVoiceResult,
    onAIParse,
    isRecording,
    onToggleRecording
}: {
    item: any,
    index: number,
    onUpdate: (index: number, field: string, value: any) => void,
    onRemove: (index: number) => void,
    onVoiceResult: (index: number, text: string) => void,
    onAIParse: (index: number) => void,
    isRecording: boolean,
    onToggleRecording: (index: number, recording: boolean) => void
}) => {
    // Stabilize handlers within the row to bind the index
    const handleUpdate = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(index, 'description', e.target.value)
    }, [index, onUpdate])

    const handleRemove = useCallback(() => {
        onRemove(index)
    }, [index, onRemove])

    const handleVoice = useCallback((text: string) => {
        onVoiceResult(index, text)
    }, [index, onVoiceResult])

    const handleAI = useCallback(() => {
        onAIParse(index)
    }, [index, onAIParse])

    const handleToggle = useCallback((rec: boolean) => {
        onToggleRecording(index, rec)
    }, [index, onToggleRecording])

    return (
        <div className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors">
            <div className="flex-1 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Task {index + 1}</Label>
                <div className="flex gap-2 items-start">
                    <Textarea
                        value={item.description}
                        onChange={handleUpdate}
                        placeholder="e.g. Surface preparation and painting"
                        className="min-h-[70px] bg-background border-white/5 focus:border-primary/50 text-sm font-bold resize-none"
                    />
                    <div className="flex flex-col gap-2">
                        <VoiceFieldInput
                            onResult={handleVoice}
                            isRecording={isRecording}
                            onToggle={handleToggle}
                            className="h-8 w-8"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10 transition-all"
                            title="Split Items (AI)"
                            onClick={handleAI}
                        >
                            <Sparkles className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive mt-6 transition-colors"
                onClick={handleRemove}
                disabled={index === 0 && item.description === "" && !isRecording}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    )
})

ScopeItemRow.displayName = "ScopeItemRow"

export function ScopeEntryForm({ clients }: { clients: any[] }) {
    const router = useRouter()
    const [clientId, setClientId] = useState("")
    const [site, setSite] = useState("")
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [items, setItems] = useState<{ id: string, description: string }[]>([{ id: Math.random().toString(36).substr(2, 9), description: "" }])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [recordingIndex, setRecordingIndex] = useState<number | null>(null)
    const [submitted, setSubmitted] = useState(false)
    const [wbpId, setWbpId] = useState<string | null>(null)

    const STORAGE_KEY = `mobile-sow-draft`

    // Check localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const { clientId: savedClientId, site: savedSite, items: savedItems } = JSON.parse(saved)
                if (confirm("You have an unsaved session. Would you like to resume?")) {
                    setClientId(savedClientId || "")
                    setSite(savedSite || "")
                    setItems(savedItems || [{ id: Math.random().toString(36).substr(2, 9), description: "" }])
                } else {
                    localStorage.removeItem(STORAGE_KEY)
                }
            } catch (e) {
                console.error("Failed to parse saved session", e)
            }
        }
    }, [])

    // Auto-save to localStorage
    useEffect(() => {
        if (!submitted && (clientId || site || items.some(i => i.description))) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId, site, items, timestamp: Date.now() }))
        }
    }, [clientId, site, items, submitted])

    const addItem = useCallback(() => {
        setItems(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), description: "" }])
    }, [])

    const removeItem = useCallback((index: number) => {
        setItems(prev => {
            if (prev.length <= 1) return [{ id: Math.random().toString(36).substr(2, 9), description: "" }]
            return prev.filter((_, i) => i !== index)
        })
    }, [])

    const updateItem = useCallback((index: number, field: string, value: any) => {
        setItems(prev => {
            if (prev[index] && (prev[index] as any)[field] === value) return prev
            const next = [...prev]
            next[index] = { ...next[index], [field]: value }
            return next
        })
    }, [])

    const handleVoiceResult = useCallback((index: number, text: string) => {
        setItems(prev => {
            const next = [...prev]
            const current = next[index].description || ""
            next[index] = {
                ...next[index],
                description: current + (current ? " " : "") + text
            }
            return next
        })
    }, [])

    const parseWithAI = useCallback((index: number) => {
        setItems(prev => {
            const text = prev[index].description
            if (!text) return prev

            if (text.includes('\n') || text.toLowerCase().includes('item:')) {
                const lines = text.split(/\n|Item:/i).map(s => s.trim()).filter(s => s.length > 0)
                if (lines.length > 1) {
                    const next = [...prev]
                    next[index] = { ...next[index], description: lines[0] }
                    const newItems = lines.slice(1).map(line => ({
                        id: Math.random().toString(36).substr(2, 9),
                        description: line
                    }))
                    next.splice(index + 1, 0, ...newItems)
                    return next
                }
            }
            return prev
        })
    }, [])

    const handleToggleRecording = useCallback((index: number, recording: boolean) => {
        setRecordingIndex(recording ? index : null)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!clientId || items.some(i => !i.description)) {
            alert("Please fill in client and all item descriptions.")
            return
        }

        setLoading(true)
        try {
            const result = await createMobileSOWAction({
                clientId,
                site,
                date,
                items: items.map(i => ({ description: i.description }))
            })
            setWbpId(result.wbpId)
            setSubmitted(true)
            localStorage.removeItem(STORAGE_KEY)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (error) {
            console.error("Error saving scope:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveDraft = async () => {
        if (!clientId) {
            alert("Please select a client to save.")
            return
        }

        setSaving(true)
        try {
            const result = await saveScopeDraftAction({
                clientId,
                site,
                date,
                items: items.map(i => ({ description: i.description }))
            })
            // Optional: Notify user or just save silently?
            // User requested "Save Progress button"
            alert("Draft saved successfully!")
            localStorage.removeItem(STORAGE_KEY) // Clear local storage as we have it in DB

            // Maybe reset form? Or just leave it?
            // "Save Progress" implies continue working.
        } catch (error) {
            console.error("Error saving draft:", error)
            alert("Failed to save draft.")
        } finally {
            setSaving(false)
        }
    }

    if (submitted) {
        return (
            <div className="space-y-6 py-6 px-4 max-w-lg mx-auto">
                <Card className="bg-primary/10 border-primary shadow-2xl overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                    <CardContent className="p-8 text-center space-y-6">
                        <div className="mx-auto bg-primary rounded-full p-4 w-16 h-16 flex items-center justify-center">
                            <Sparkles className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-primary uppercase tracking-wider">
                                ✅ Scope of Work submitted
                            </h2>
                            <p className="text-muted-foreground font-medium">
                                Technical requirements have been captured and sent to the commercial team.
                            </p>
                        </div>

                        {site && (
                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <span className="text-[10px] font-black uppercase text-muted-foreground block mb-1">Site Identification</span>
                                <span className="text-lg font-bold text-white">{site}</span>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 pt-4">
                            <Link href="/work-breakdown-pricing" className="w-full">
                                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-12">
                                    View on WB&P Page
                                </Button>
                            </Link>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSubmitted(false)
                                    setItems([{ id: Math.random().toString(36).substr(2, 9), description: "" }])
                                    setSite("")
                                }}
                                className="text-muted-foreground hover:text-white font-bold"
                            >
                                Submit Another Scope
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto py-6 px-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <Link href="/manager">
                        <Button variant="ghost" size="icon" type="button" className="hover:bg-primary/10 text-primary">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Scope Entry</h1>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] -mt-1">Technical Requirement Capture</p>
                    </div>
                </div>
            </div>

            <Card className="border-white/5 bg-[#1A1A2E]/50 backdrop-blur-sm border-l-4 border-l-primary shadow-xl">
                <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground italic flex items-center gap-2">
                        <div className="h-1 w-4 bg-primary rounded-full" />
                        Project Context
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Target Client</Label>
                        <select
                            className="flex h-12 w-full rounded-lg border border-white/10 bg-[#14141E] px-4 py-2 text-white font-bold text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer appearance-none shadow-inner"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            required
                        >
                            <option value="" disabled className="text-muted-foreground">Select Client Account...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Site Identity / Address</Label>
                            <Input
                                value={site}
                                onChange={e => setSite(e.target.value)}
                                placeholder="e.g. 15 Culemborg Street"
                                className="bg-[#14141E] border-white/10 text-white font-bold h-12 shadow-inner"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Capture Date</Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                                className="bg-[#14141E] border-white/10 text-white font-bold h-12 shadow-inner"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-black uppercase tracking-widest text-white italic">Technical Scopes</h2>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addItem}
                        className="border-primary/20 hover:bg-primary/10 text-primary font-black px-4 rounded-lg transition-all active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-1" /> New Task
                    </Button>
                </div>

                <div className="space-y-4">
                    {items.map((item, index) => (
                        <ScopeItemRow
                            key={item.id}
                            item={item}
                            index={index}
                            onUpdate={updateItem}
                            onRemove={removeItem}
                            onVoiceResult={handleVoiceResult}
                            onAIParse={parseWithAI}
                            isRecording={recordingIndex === index}
                            onToggleRecording={handleToggleRecording}
                        />
                    ))}
                </div>
            </div>

            <div className="pt-8 pb-10 flex gap-3 flex-col">
                <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-16 rounded-xl text-lg shadow-2xl shadow-primary/20 transition-all active:scale-95 uppercase tracking-widest italic"
                    disabled={loading || saving}
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" />
                            Validating & Uploading...
                        </div>
                    ) : "Official Submission to Commercial"}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSaveDraft}
                    className="w-full bg-secondary/50 hover:bg-secondary/70 text-secondary-foreground font-bold h-12 rounded-xl transition-all"
                    disabled={loading || saving}
                >
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Progress (Draft)
                </Button>
                <p className="text-center text-[9px] text-muted-foreground uppercase font-bold tracking-[0.4em] mt-4 opacity-50 underline decoration-primary/30">Build: MVP-FEBRUARY-V1</p>
            </div>
        </form>
    )
}
