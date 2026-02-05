"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

const statuses = [
    { value: "", label: "All" },
    { value: "DRAFT", label: "Draft" },
    { value: "SENT", label: "Sent" },
    { value: "INVOICED", label: "Invoiced" },
    { value: "PAID", label: "Paid" },
]

export function InvoiceFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const currentStatus = searchParams.get("status") || ""
    const currentType = searchParams.get("type") || ""

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        startTransition(() => {
            router.push(`?${params.toString()}`)
        })
    }

    return (
        <div className="flex items-center gap-2">
            <select
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={currentType}
                onChange={(e) => updateFilter("type", e.target.value)}
            >
                <option value="">All Types</option>
                <option value="QUOTE">Quotes</option>
                <option value="INVOICE">Invoices</option>
            </select>
            <select
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={currentStatus}
                onChange={(e) => updateFilter("status", e.target.value)}
            >
                {statuses.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                ))}
            </select>
            {isPending && (
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
        </div>
    )
}
