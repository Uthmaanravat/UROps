"use client"

import { Button } from "./button"
import { Trash2, Loader2 } from "lucide-react"
import { useState } from "react"

interface DeleteButtonProps {
    id: string
    action: (id: string) => Promise<any>
    confirmText?: string
    variant?: "ghost" | "destructive" | "outline"
    size?: "default" | "sm" | "lg" | "icon"
    className?: string
    label?: string
}

export function DeleteButton({
    id,
    action,
    confirmText = "Are you sure you want to delete this item?",
    variant = "ghost",
    size = "icon",
    className,
    label
}: DeleteButtonProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handleDelete = async () => {
        if (!confirm(confirmText)) return

        setIsLoading(true)
        try {
            await action(id)
        } catch (error) {
            console.error("Delete failed:", error)
            alert("Delete failed. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleDelete}
            disabled={isLoading}
            className={className || "h-8 w-8 text-muted-foreground/20 hover:text-red-500 hover:bg-red-500/10 transition-colors"}
        >
            {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <>
                    <Trash2 className="h-4 w-4" />
                    {label && <span className="ml-2">{label}</span>}
                </>
            )}
        </Button>
    )
}
