"use client"

import { useState } from "react"
import { createInteraction, deleteInteraction } from "@/app/(dashboard)/clients/[id]/interactions/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Mail, MessageSquare, Users, Trash2, CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface InteractionListProps {
    clientId: string
    interactions: any[]
}

export function InteractionList({ clientId, interactions }: InteractionListProps) {
    const [loading, setLoading] = useState(false)
    const [content, setContent] = useState("")
    const [type, setType] = useState("NOTE")

    const handleAdd = async () => {
        if (!content.trim()) return
        setLoading(true)
        await createInteraction({ clientId, type, content })
        setContent("")
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this interaction?")) return
        await deleteInteraction(id, clientId)
    }

    const typeIcons = {
        NOTE: <MessageSquare className="h-4 w-4" />,
        CALL: <Phone className="h-4 w-4" />,
        EMAIL: <Mail className="h-4 w-4" />,
        MEETING: <Users className="h-4 w-4" />
    }

    return (
        <div className="space-y-6">
            <h3 className="font-black text-2xl text-white uppercase tracking-tighter italic">CRM & Interactions</h3>

            <div className="border border-white/5 rounded-2xl bg-card p-4 md:p-6 space-y-6 shadow-2xl">
                <div className="flex flex-wrap gap-2">
                    {Object.entries(typeIcons).map(([key, icon]) => (
                        <Button
                            key={key}
                            size="sm"
                            variant={type === key ? "default" : "outline"}
                            onClick={() => setType(key)}
                            className={cn(
                                "flex-1 min-w-[80px] md:flex-none gap-2 font-black uppercase text-[10px] tracking-widest h-10 rounded-xl transition-all",
                                type === key ? "bg-primary text-primary-foreground" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                            )}
                        >
                            {icon} <span className="hidden sm:inline">{key.charAt(0) + key.slice(1).toLowerCase()}</span>
                        </Button>
                    ))}
                </div>
                <div className="relative group/input">
                    <Textarea
                        placeholder={`Log a ${type.toLowerCase()} details here...`}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-medium min-h-[120px] rounded-2xl p-4 transition-all resize-none mb-4"
                    />
                    <Button
                        onClick={handleAdd}
                        disabled={loading || !content.trim()}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-xs tracking-[0.2em] h-12 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
                    >
                        {loading ? "Logging..." : `Post ${type} Entry`}
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {interactions.map(interaction => (
                    <div key={interaction.id} className="flex gap-4 p-4 md:p-6 border border-white/5 rounded-2xl bg-[#1A1A2E]/50 group/item transition-all hover:bg-[#1A1A2E] hover:border-primary/20">
                        <div className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover/item:scale-110",
                            interaction.type === 'CALL' && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                            interaction.type === 'EMAIL' && "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
                            interaction.type === 'MEETING' && "bg-purple-500/10 text-purple-400 border border-purple-500/20",
                            interaction.type === 'NOTE' && "bg-primary/10 text-primary border border-primary/20",
                        )}>
                            {typeIcons[interaction.type as keyof typeof typeIcons]}
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="flex justify-between items-start">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                                    {new Date(interaction.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                    onClick={() => handleDelete(interaction.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-sm text-white/90 leading-relaxed font-medium whitespace-pre-wrap">{interaction.content}</p>
                        </div>
                    </div>
                ))}
                {interactions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/[0.02] border border-dashed border-white/5 rounded-3xl">
                        <div className="h-16 w-16 rounded-3xl bg-white/5 flex items-center justify-center text-muted-foreground/30 mb-4">
                            <MessageSquare className="h-8 w-8" />
                        </div>
                        <p className="font-black text-muted-foreground/30 uppercase tracking-[0.3em] text-xs">History is empty</p>
                    </div>
                )}
            </div>
        </div>
    )
}
