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

// Individual row component (removed memo to ensure fresh handlers/props)
const ScopeItemRow = ({
    item,
    areaIndex,
    itemIndex,
    onUpdate,
    onRemove,
    onVoiceResult,
    onAIParse,
    isRecording,
    onToggleRecording
}: {
    item: any,
    areaIndex: number,
    itemIndex: number,
    onUpdate: (areaIdx: number, itemIdx: number, field: string, value: any) => void,
    onRemove: (areaIdx: number, itemIdx: number) => void,
    onVoiceResult: (areaIdx: number, itemIdx: number, text: string) => void,
    onAIParse: (areaIdx: number, itemIdx: number) => void,
    isRecording: boolean,
    onToggleRecording: (areaIdx: number, itemIdx: number, recording: boolean) => void
}) => {
    const handleUpdate = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(areaIndex, itemIndex, 'description', e.target.value)
    }, [areaIndex, itemIndex, onUpdate])

    const handleRemove = useCallback(() => {
        onRemove(areaIndex, itemIndex)
    }, [areaIndex, itemIndex, onRemove])

    const handleVoice = useCallback((text: string) => {
        console.log("Voice result received for item:", itemIndex, text);
        onVoiceResult(areaIndex, itemIndex, text)
    }, [areaIndex, itemIndex, onVoiceResult])

    const handleAI = useCallback(() => {
        onAIParse(areaIndex, itemIndex)
    }, [areaIndex, itemIndex, onAIParse])

    const handleToggle = useCallback((rec: boolean) => {
        console.log("Toggle recording for item:", itemIndex, rec);
        onToggleRecording(areaIndex, itemIndex, rec)
    }, [areaIndex, itemIndex, onToggleRecording])

    return (
        <div className="flex gap-2 items-start p-2 md:p-3 border border-white/5 rounded-lg bg-background/50 group hover:bg-background/80 transition-all duration-200">
            <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Item {itemIndex + 1}</Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={handleRemove}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
                <div className="flex gap-2 items-start">
                    <Textarea
                        value={item.description}
                        onChange={handleUpdate}
                        placeholder="Describe technical requirement..."
                        className="min-h-[50px] md:min-h-[60px] bg-background/50 border-white/5 focus:border-primary/50 text-sm font-bold resize-none"
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
        </div>
    )
}

// Area Section component (removed memo)
const AreaSection = ({
    area,
    index,
    onUpdateName,
    onRemoveArea,
    onAddItem,
    children
}: {
    area: any,
    index: number,
    onUpdateName: (idx: number, name: string) => void,
    onRemoveArea: (idx: number) => void,
    onAddItem: (idx: number) => void,
    children: React.ReactNode
}) => {
    return (
        <Card className="border-white/5 bg-[#1A1A2E]/50 backdrop-blur-sm border-l-4 border-l-primary/30 shadow-xl overflow-hidden animate-in fade-in duration-300">
            <CardHeader className="p-3 md:p-4 md:bg-primary/5 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-1.5 mr-4">
                        <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-primary italic">Area Title / Grouping</Label>
                        <Input
                            value={area.name}
                            onChange={(e) => onUpdateName(index, e.target.value)}
                            placeholder="e.g. Roof Section, Ground Floor, Exterior"
                            className="h-9 md:h-10 bg-[#14141E] border-white/10 text-white font-black text-sm md:text-base shadow-inner"
                        />
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive mt-4 md:mt-5 h-8 w-8"
                        onClick={() => onRemoveArea(index)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-3 md:p-4 space-y-3 md:space-y-4">
                {children}
                <Button
                    type="button"
                    variant="ghost"
                    className="w-full border-dashed border border-white/10 hover:border-primary/50 hover:bg-primary/5 text-[10px] md:text-xs font-bold text-muted-foreground hover:text-primary h-10 md:h-12 transition-all group mt-2"
                    onClick={() => {
                        console.log("Add task clicked for area index:", index);
                        onAddItem(index);
                    }}
                >
                    <Plus className="h-3 w-3 mr-2 group-hover:scale-125 transition-transform" /> Add Task to {area.name || "this area"}
                </Button>
            </CardContent>
        </Card>
    )
}

export function ScopeEntryForm({ clients }: { clients: any[] }) {
    const router = useRouter()

    // 1. Initial state with zero non-deterministic values (Hydration Fix)
    const [clientId, setClientId] = useState("")
    const [site, setSite] = useState("")
    const [date, setDate] = useState("")
    const [areas, setAreas] = useState<any[]>([
        {
            id: "initial-area",
            name: "",
            items: [{ id: "initial-item", description: "" }]
        }
    ])

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [showResume, setShowResume] = useState(false)
    const [pendingDraft, setPendingDraft] = useState<any>(null)
    const [recordingKey, setRecordingKey] = useState<string | null>(null)
    const [submitted, setSubmitted] = useState(false)
    const [wbpId, setWbpId] = useState<string | null>(null)

    const STORAGE_KEY = `mobile-sow-draft-v4` // Fresh key

    // 2. Client-side only initialization
    useEffect(() => {
        // Set date
        if (!date) {
            setDate(new Date().toISOString().split('T')[0])
        }

        // Check draft
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setPendingDraft(parsed)
                setShowResume(true)
            } catch (e) {
                console.error("Draft parse error", e)
            }
        }
    }, [date])

    // Auto-save
    useEffect(() => {
        if (!submitted && (clientId || site || areas.length > 1 || areas[0].name || areas[0].items[0].description)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId, site, areas, date }))
        }
    }, [clientId, site, areas, date, submitted])

    // 3. Simple Handlers (GUARANTEED IMMUTABLE UPDATES)
    const addArea = () => {
        console.log("Add Area triggered");
        const newArea = {
            id: `area-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: "",
            items: [{ id: `item-${Date.now()}`, description: "" }]
        }
        setAreas(prev => [...prev, newArea])
    }

    const removeArea = (index: number) => {
        console.log("Remove Area:", index);
        setAreas(prev => {
            if (prev.length <= 1) {
                return [{ id: "initial-area", name: "", items: [{ id: "initial-item", description: "" }] }]
            }
            return prev.filter((_, i) => i !== index)
        })
    }

    const updateAreaName = (index: number, name: string) => {
        setAreas(prev => prev.map((area, i) =>
            i === index ? { ...area, name } : area
        ))
    }

    const addItem = (areaIndex: number) => {
        console.log("Add Item for area:", areaIndex);
        const newItem = { id: `item-${Date.now()}`, description: "" }
        setAreas(prev => prev.map((area, i) =>
            i === areaIndex ? { ...area, items: [...area.items, newItem] } : area
        ))
    }

    const removeItem = (areaIndex: number, itemIndex: number) => {
        setAreas(prev => prev.map((area, i) => {
            if (i !== areaIndex) return area
            const newItems = area.items.filter((_: any, j: number) => j !== itemIndex)
            if (newItems.length === 0) {
                newItems.push({ id: `item-${Date.now()}`, description: "" })
            }
            return { ...area, items: newItems }
        }))
    }

    const updateItem = (areaIndex: number, itemIndex: number, field: string, value: any) => {
        setAreas(prev => prev.map((area, i) => {
            if (i !== areaIndex) return area
            const newItems = area.items.map((item: any, j: number) =>
                j === itemIndex ? { ...item, [field]: value } : item
            )
            return { ...area, items: newItems }
        }))
    }

    const handleVoiceResult = (areaIdx: number, itemIdx: number, text: string) => {
        setAreas(prev => prev.map((area, i) => {
            if (i !== areaIdx) return area
            const newItems = area.items.map((item: any, j: number) => {
                if (j !== itemIdx) return item
                const current = item.description || ""
                return { ...item, description: current + (current ? " " : "") + text }
            })
            return { ...area, items: newItems }
        }))
    }

    const parseWithAI = (areaIdx: number, itemIdx: number) => {
        const text = areas[areaIdx].items[itemIdx].description
        if (!text) return

        if (text.includes('\n') || text.toLowerCase().includes('item:')) {
            const lines = text.split(/\n|Item:/i).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
            if (lines.length > 1) {
                setAreas(prev => prev.map((area, i) => {
                    if (i !== areaIdx) return area
                    const items = [...area.items]
                    items[itemIdx] = { ...items[itemIdx], description: lines[0] }
                    const newItems = lines.slice(1).map((line: string) => ({
                        id: `ai-${Math.random().toString(36).substr(2, 5)}`,
                        description: line
                    }))
                    items.splice(itemIdx + 1, 0, ...newItems)
                    return { ...area, items }
                }))
            }
        }
    }

    const handleToggleRecording = (areaIdx: number, itemIdx: number, recording: boolean) => {
        setRecordingKey(recording ? `${areaIdx}-${itemIdx}` : null)
    }

    const flattenData = () => {
        const flattenedItems: any[] = []
        areas.forEach(area => {
            area.items.forEach((item: any) => {
                if (item.description.trim()) {
                    flattenedItems.push({
                        description: item.description,
                        area: area.name || "General"
                    })
                }
            })
        })
        return flattenedItems
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        console.log("Submit Form");
        const flattened = flattenData()

        if (!clientId || flattened.length === 0) {
            alert("Please select a client and add at least one task.")
            return
        }

        setLoading(true)
        try {
            const result = await createMobileSOWAction({
                clientId, site, date, items: flattened
            })
            setWbpId(result.wbpId)
            setSubmitted(true)
            localStorage.removeItem(STORAGE_KEY)
            window.scrollTo({ top: 0, behavior: "smooth" })
        } catch (error) {
            console.error("Submit Error", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveDraft = async () => {
        if (!clientId) {
            alert("Select a client first.")
            return
        }
        setSaving(true)
        try {
            await saveScopeDraftAction({
                clientId, site, date, items: flattenData()
            })
            alert("Draft saved!")
            localStorage.removeItem(STORAGE_KEY)
        } catch (error) {
            console.error("Draft Error", error)
        } finally {
            setSaving(false)
        }
    }

    if (submitted) {
        return (
            <div className="space-y-6 py-6 px-4 max-w-lg mx-auto">
                <Card className="bg-primary/10 border-primary shadow-2xl rounded-2xl p-6 md:p-8 text-center space-y-4 md:space-y-6">
                    <Sparkles className="h-12 w-12 md:h-16 md:w-16 text-primary mx-auto" />
                    <div className="space-y-1 md:space-y-2">
                        <h2 className="text-xl md:text-2xl font-black text-primary uppercase italic">Scope submitted</h2>
                        <p className="text-sm md:text-base text-muted-foreground">Technical requirements captured.</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <Link href="/work-breakdown-pricing" className="w-full">
                            <Button className="w-full h-12">View on WB&P</Button>
                        </Link>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setSubmitted(false)
                                setAreas([{ id: "initial-area", name: "", items: [{ id: "initial-item", description: "" }] }])
                                setSite("")
                            }}
                        >
                            Submit Another
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto py-6 px-4 relative">
            {showResume && pendingDraft && (
                <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-full duration-500">
                    <Card className="bg-primary border-primary p-4 shadow-2xl flex items-center justify-between text-primary-foreground rounded-xl">
                        <div className="flex-1">
                            <p className="font-black uppercase text-[10px] tracking-widest opacity-80">Draft Found</p>
                            <p className="text-xs font-bold">Resume your previous session?</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 text-[10px] font-black uppercase"
                                onClick={() => {
                                    setClientId(pendingDraft.clientId || "")
                                    setSite(pendingDraft.site || "")
                                    setAreas(pendingDraft.areas || areas)
                                    setShowResume(false)
                                }}
                            >
                                Resume
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-[10px] font-black uppercase text-primary-foreground hover:bg-white/10"
                                onClick={() => {
                                    localStorage.removeItem(STORAGE_KEY)
                                    setShowResume(false)
                                }}
                            >
                                Dismiss
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <Link href="/manager">
                        <Button variant="ghost" size="icon" type="button" className="hover:bg-primary/10 text-primary">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white uppercase italic">Scope Entry</h1>
                        <p className="text-[9px] md:text-[10px] font-bold text-primary uppercase tracking-[0.2em] md:tracking-[0.3em] -mt-1">Technical Requirement Capture</p>
                    </div>
                </div>
            </div>

            <Card className="border-white/5 bg-[#1A1A2E]/50 backdrop-blur-sm border-l-4 border-l-primary shadow-xl">
                <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
                    <CardTitle className="text-xs md:text-sm font-black uppercase tracking-widest text-muted-foreground italic flex items-center gap-2">
                        <div className="h-1 w-3 md:w-4 bg-primary rounded-full" />
                        Project Context
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-2 md:pt-4 space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Target Client</Label>
                        <select
                            className="flex h-11 md:h-12 w-full rounded-lg border border-white/10 bg-[#14141E] px-4 py-2 text-white font-bold text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all cursor-pointer appearance-none shadow-inner"
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
                                className="bg-[#14141E] border-white/10 text-white font-bold h-11 md:h-12 shadow-inner"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Capture Date</Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                                className="bg-[#14141E] border-white/10 text-white font-bold h-11 md:h-12 shadow-inner"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-black uppercase tracking-widest text-white italic">Technical Scopes</h2>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addArea}
                        className="bg-primary/5 border-primary/20 hover:bg-primary/20 text-primary font-black px-6 rounded-lg transition-all active:scale-95 h-10"
                    >
                        <Plus className="h-4 w-4 mr-2" /> New Area
                    </Button>
                </div>

                <div className="space-y-8">
                    {areas.map((area, areaIndex) => (
                        <AreaSection
                            key={area.id}
                            area={area}
                            index={areaIndex}
                            onUpdateName={updateAreaName}
                            onRemoveArea={removeArea}
                            onAddItem={addItem}
                        >
                            <div className="space-y-3 pl-2 border-l border-white/5 ml-1">
                                {area.items.map((item: any, itemIndex: number) => (
                                    <ScopeItemRow
                                        key={item.id}
                                        item={item}
                                        areaIndex={areaIndex}
                                        itemIndex={itemIndex}
                                        onUpdate={updateItem}
                                        onRemove={removeItem}
                                        onVoiceResult={handleVoiceResult}
                                        onAIParse={parseWithAI}
                                        isRecording={recordingKey === `${areaIndex}-${itemIndex}`}
                                        onToggleRecording={handleToggleRecording}
                                    />
                                ))}
                            </div>
                        </AreaSection>
                    ))}
                </div>
            </div>

            <div className="pt-8 pb-10 flex gap-3 flex-col">
                <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-14 md:h-16 rounded-xl text-base md:text-lg shadow-2xl shadow-primary/20 transition-all active:scale-95 uppercase tracking-widest italic"
                    disabled={loading || saving}
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" />
                            Validating & Uploading...
                        </div>
                    ) : "Official Submission to Commercial"}
                </Button>
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleSaveDraft}
                        className="bg-secondary/50 hover:bg-secondary/70 text-secondary-foreground font-bold h-11 md:h-12 rounded-xl transition-all"
                        disabled={loading || saving}
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Draft
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            if (confirm("Are you sure you want to clear everything?")) {
                                setAreas([{ id: "initial-area", name: "", items: [{ id: "initial-item", description: "" }] }])
                                setClientId("")
                                setSite("")
                                localStorage.removeItem(STORAGE_KEY)
                            }
                        }}
                        className="text-muted-foreground hover:text-white font-bold h-11 md:h-12 rounded-xl"
                    >
                        Clear Form
                    </Button>
                </div>
                <p className="text-center text-[9px] text-muted-foreground uppercase font-bold tracking-[0.4em] mt-4 opacity-50 underline decoration-primary/30">Build: MVP-FEBRUARY-V6.2 (Mobile-Type-Recovery)</p>
            </div>
        </form>
    )
}
