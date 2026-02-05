"use client"

import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { dashboardRejectAction } from "./actions"
import { useRouter } from "next/navigation"

export function RejectScopeButton({ id }: { id: string }) {
    const router = useRouter()

    const handleReject = async (e: React.MouseEvent) => {
        e.preventDefault() // prevent card click
        if (!confirm("Reject this scope? It will be removed from the list.")) return

        await dashboardRejectAction(id)
        router.refresh()
    }

    return (
        <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
            onClick={handleReject}
            title="Reject Scope"
        >
            <X className="h-4 w-4" />
        </Button>
    )
}
