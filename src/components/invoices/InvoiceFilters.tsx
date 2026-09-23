"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { ArrowUpDown } from "lucide-react"

const statuses = [
    { value: "", label: "All Statuses" },
    { value: "UNINVOICED", label: "⚡ Uninvoiced" },
    { value: "INVOICED", label: "🧾 Invoiced" },
    { value: "DRAFT", label: "Draft" },
    { value: "SENT", label: "Sent" },
    { value: "ACCEPTED", label: "Accepted" },
    { value: "PAID", label: "Paid" },
]

interface ClientOption {
    id: string
    name: string
}

export function InvoiceFilters({ clients }: { clients: ClientOption[] }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const currentStatus = searchParams.get("status") || ""
    const currentType = searchParams.get("type") || ""
    const currentClientId = searchParams.get("clientId") || ""
    const currentCommercialStatus = searchParams.get("commercialStatus") || ""
    const currentSort = searchParams.get("sort") || "date_desc"

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
        <div className="flex items-center gap-2 flex-wrap">
            <select
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={currentClientId}
                onChange={(e) => updateFilter("clientId", e.target.value)}
            >
                <option value="">All Clients</option>
                {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
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
                value={currentCommercialStatus}
                onChange={(e) => updateFilter("commercialStatus", e.target.value)}
            >
                <option value="">All Commercial Statuses</option>
                <option value="AWAITING_PO">Awaiting PO</option>
                <option value="PO_RECEIVED">PO Received</option>
                <option value="EMERGENCY_WORK">Emergency Work</option>
                <option value="REACTIVE_WORK">Reactive Work</option>
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

            {/* Sort Control */}
            <div className="flex items-center gap-1.5 h-9 rounded-md border border-input bg-card px-2.5 py-1 text-sm shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <select
                    className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
                    value={currentSort}
                    onChange={(e) => updateFilter("sort", e.target.value)}
                    title="Sort documents to view what you want on top"
                >
                    <option value="date_desc" className="bg-[#1E293B]">Date: Newest on Top</option>
                    <option value="date_asc" className="bg-[#1E293B]">Date: Oldest on Top</option>
                    <option value="uninvoiced_first" className="bg-[#1E293B]">⚡ Uninvoiced on Top</option>
                    <option value="invoiced_first" className="bg-[#1E293B]">🧾 Invoiced on Top</option>
                    <option value="total_desc" className="bg-[#1E293B]">Total: Highest on Top</option>
                    <option value="total_asc" className="bg-[#1E293B]">Total: Lowest on Top</option>
                    <option value="number_desc" className="bg-[#1E293B]">Number: Highest on Top</option>
                    <option value="number_asc" className="bg-[#1E293B]">Number: Lowest on Top</option>
                    <option value="client_asc" className="bg-[#1E293B]">Client: A → Z</option>
                    <option value="client_desc" className="bg-[#1E293B]">Client: Z → A</option>
                </select>
            </div>

            {isPending && (
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
        </div>
    )
}
