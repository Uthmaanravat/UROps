"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, ArrowLeft, Sparkles } from "lucide-react"
import Link from "next/link"
import { createMobileSOWAction } from "@/app/(dashboard)/scope/actions"
import { VoiceInput } from "@/components/ui/VoiceInput"

export function ScopeEntryForm({ clients }: { clients: any[] }) {
    const router = useRouter()
    const [clientId, setClientId] = useState("")
    const [site, setSite] = useState("")
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [items, setItems] = useState([{ description: "" }])
    const [loading, setLoading] = useState(false)
    const [recordingIndex, setRecordingIndex] = useState<number | null>(null)
    const [submitted, setSubmitted] = useState(false)
    const [wbpId, setWbpId] = useState<string | null>(null)

    const addItem = () => setItems([...items, { description: "" }])
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
            const lines = text.split(/\n|Item:/i).map(s => s.trim()).filter(s => s.length > 0)
            if (lines.length > 1) {
                const newItems = [...items]
                newItems[index].description = lines[0]
                lines.slice(1).forEach(line => {
                    newItems.splice(index + 1, 0, { description: line })
                })
                setItems(newItems)
            }
        }
    }

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
            // SHOW CONFIRMATION ON SAME PAGE instead of redirecting
            setWbpId(result.wbpId)
            setSubmitted(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (error) {
            console.error("Error saving scope:", error)
        } finally {
            setLoading(false)
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
                                    setItems([{ description: "" }])
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
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/manager">
                    <Button variant="ghost" size="icon" type="button">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold">New Scope Entry</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Client *</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            required
                        >
                            <option value="">Select a client...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Site Name / Address</Label>
                            <Input value={site} onChange={e => setSite(e.target.value)} placeholder="e.g. 123 Main St" />
                        </div>
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Scope of Work Items</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                        <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                            <div className="flex-1 space-y-2">
                                <Label className="text-xs">Task Description</Label>
                                <div className="flex gap-2 items-start">
                                    <Textarea
                                        value={item.description}
                                        onChange={e => updateItem(index, 'description', e.target.value)}
                                        placeholder="e.g. Surface preparation and painting"
                                        className="min-h-[60px]"
                                    />
                                    <div className="flex flex-col gap-2">
                                        <VoiceInput
                                            onResult={(text) => handleVoiceResult(index, text)}
                                            isRecording={recordingIndex === index}
                                            onToggle={(recording) => setRecordingIndex(recording ? index : null)}
                                            className="h-6 w-6"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-purple-500 hover:text-purple-600"
                                            title="Split Items (AI)"
                                            onClick={() => parseWithAI(index)}
                                        >
                                            <Sparkles className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive mt-8"
                                onClick={() => removeItem(index)}
                                disabled={items.length === 1}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Button type="submit" className="w-full bg-lime-500 hover:bg-lime-600 text-black font-bold h-12" disabled={loading}>
                {loading ? "Saving..." : "Submit Scope to Admin"}
            </Button>
        </form>
    )
}
