"use client"

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deleteClientAction as deleteClient } from "@/app/(dashboard)/clients/actions"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${clientName}"? This will also delete all their invoices and payments.`)) {
            return
        }

        setLoading(true)
        try {
            await deleteClient(clientId)
        } catch (error) {
            alert("Failed to delete client. Please try again.")
            setLoading(false)
        }
    }

    return (
        <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            <Trash2 className="mr-2 h-4 w-4" />
            {loading ? "Deleting..." : "Delete"}
        </Button>
    )
}
