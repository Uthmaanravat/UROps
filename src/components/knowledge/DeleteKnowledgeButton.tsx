"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { deletePricingKnowledgeAction } from "@/app/(dashboard)/knowledge/actions"

export function DeleteKnowledgeButton({ id }: { id: string }) {
    const [loading, setLoading] = useState(false)

    const handleDelete = async () => {
        if (!confirm("Remove this item from pricing memory? This cannot be undone.")) return

        setLoading(true)
        try {
            const result = await deletePricingKnowledgeAction(id)
            if (result && !result.success) {
                alert("Failed to delete item: " + (result.error || "Unknown error"))
            }
        } catch (err) {
            console.error(err)
            alert("Failed to delete item.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={loading}
            className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
    )
}
