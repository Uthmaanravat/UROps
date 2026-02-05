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
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">CRM & Interactions</h3>

            <div className="border rounded-lg bg-card p-4 space-y-4">
                <div className="flex gap-2">
                    {Object.entries(typeIcons).map(([key, icon]) => (
                        <Button
                            key={key}
                            size="sm"
                            variant={type === key ? "default" : "outline"}
                            onClick={() => setType(key)}
                            className="gap-2"
                        >
                            {icon} {key.charAt(0) + key.slice(1).toLowerCase()}
                        </Button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Textarea
                        placeholder={`Log a ${type.toLowerCase()}...`}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="resize-none"
                    />
                    <Button
                        onClick={handleAdd}
                        disabled={loading || !content.trim()}
                        className="h-auto"
                    >
                        Add
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {interactions.map(interaction => (
                    <div key={interaction.id} className="flex gap-4 p-4 border rounded-lg bg-card/50">
                        <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                            interaction.type === 'CALL' && "bg-blue-100 text-blue-600",
                            interaction.type === 'EMAIL' && "bg-yellow-100 text-yellow-600",
                            interaction.type === 'MEETING' && "bg-purple-100 text-purple-600",
                            interaction.type === 'NOTE' && "bg-gray-100 text-gray-600",
                        )}>
                            {typeIcons[interaction.type as keyof typeof typeIcons]}
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                                <div className="font-medium text-sm">
                                    {new Date(interaction.date).toLocaleString()}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-red-600"
                                    onClick={() => handleDelete(interaction.id)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{interaction.content}</p>
                        </div>
                    </div>
                ))}
                {interactions.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                        No interactions logged yet.
                    </div>
                )}
            </div>
        </div>
    )
}
