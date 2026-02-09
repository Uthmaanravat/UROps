"use client"

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { cn } from "@/lib/utils"

export function SearchInput({
    placeholder = "Search...",
    className,
    containerClassName
}: {
    placeholder?: string,
    className?: string,
    containerClassName?: string
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const handleSearch = (term: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (term) {
            params.set("q", term)
        } else {
            params.delete("q")
        }
        startTransition(() => {
            router.push(`?${params.toString()}`)
        })
    }

    return (
        <div className={cn("relative", containerClassName)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder={placeholder}
                defaultValue={searchParams.get("q") || ""}
                onChange={(e) => handleSearch(e.target.value)}
                className={cn("pl-9 w-64", className)}
            />
            {isPending && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    )
}
