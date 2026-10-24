"use client"

import React, { useState } from "react"
import {
    Repeat,
    Calendar,
    DollarSign,
    Check,
    Clock,
    AlertCircle,
    Building2,
    FileText,
    Sparkles
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createRecurringProjectAction } from "@/app/(dashboard)/projects/actions"
import type { RecurrenceFrequency } from "@/lib/project-recurrence-utils"

interface ProjectRecurrenceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    clients: any[]
    onSuccess?: () => void
}

export function ProjectRecurrenceModal({
    open,
    onOpenChange,
    clients,
    onSuccess
}: ProjectRecurrenceModalProps) {
    const [name, setName] = useState("")
    const [clientId, setClientId] = useState(clients[0]?.id || "")
    const [description, setDescription] = useState("")
    const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
    const [frequency, setFrequency] = useState<RecurrenceFrequency>("QUARTERLY")
    const [interval, setInterval] = useState("1")
    const [intervalUnit, setIntervalUnit] = useState<"weeks" | "months">("months")
    const [endOption, setEndOption] = useState<"ONGOING" | "COUNT" | "UNTIL">("ONGOING")
    const [visitCount, setVisitCount] = useState("4")
    const [untilDate, setUntilDate] = useState("")
    const [pricePerVisit, setPricePerVisit] = useState("62100")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!name.trim()) {
            setError("Contract project name is required")
            return
        }
        if (!clientId) {
            setError("Please select a client")
            return
        }

        setLoading(true)
        try {
            const res = await createRecurringProjectAction({
                name: name.trim(),
                clientId,
                description: description.trim(),
                startDate,
                frequency,
                interval: frequency === "CUSTOM" ? parseInt(interval, 10) || 1 : 1,
                intervalUnit: frequency === "CUSTOM" ? intervalUnit : "months",
                count: endOption === "COUNT" ? parseInt(visitCount, 10) || 4 : undefined,
                untilDate: endOption === "UNTIL" && untilDate ? untilDate : undefined,
                pricePerVisit: parseFloat(pricePerVisit) || 0
            })

            if (!res.success) {
                setError(res.error || "Failed to create recurring project")
                return
            }

            onOpenChange(false)
            onSuccess?.()
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#0f0f1a] border border-white/10 text-white sm:max-w-[560px] backdrop-blur-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-wider text-primary flex items-center gap-2">
                        <Repeat className="h-5 w-5 text-primary" />
                        Create Recurring Contract / Repeat Work
                    </DialogTitle>
                    <DialogDescription className="text-gray-300 text-xs">
                        Set up a master recurring contract. Future visits are automatically generated as individual jobs across the schedule, calendar and board for the next 12 months rolling forward.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Contract Name */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-300">Contract / Project Name *</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Silo District Scheduled Exterior Cladding Clean"
                            className="bg-black/40 border-white/10 text-white h-10 text-xs focus:border-primary"
                        />
                    </div>

                    {/* Client Selector */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-300">Client / Partner *</Label>
                        <select
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-md px-3 h-10 text-xs text-white focus:border-primary font-bold"
                        >
                            {clients.map((c: any) => (
                                <option key={c.id} value={c.id} className="bg-[#14141E]">
                                    {c.name} {c.companyName ? `(${c.companyName})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Recurrence Frequency Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-300">Repeat Frequency *</Label>
                            <select
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                                className="w-full bg-black/40 border border-white/10 rounded-md px-3 h-10 text-xs text-white focus:border-primary font-bold"
                            >
                                <option value="MONTHLY" className="bg-[#14141E]">Monthly (12 visits/yr)</option>
                                <option value="EVERY_2_MONTHS" className="bg-[#14141E]">Every 2 Months (6 visits/yr)</option>
                                <option value="QUARTERLY" className="bg-[#14141E]">Quarterly (4 visits/yr)</option>
                                <option value="TWICE_A_YEAR" className="bg-[#14141E]">Twice a Year (2 visits/yr)</option>
                                <option value="YEARLY" className="bg-[#14141E]">Yearly (Annual)</option>
                                <option value="EVERY_2_YEARS" className="bg-[#14141E]">Every 2 Years (Biennial)</option>
                                <option value="CUSTOM" className="bg-[#14141E]">Custom Interval...</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-300">First Visit Start Date *</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-black/40 border-white/10 text-white h-10 text-xs focus:border-primary font-mono"
                            />
                        </div>
                    </div>

                    {/* Custom Interval if selected */}
                    {frequency === "CUSTOM" && (
                        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-black/30 border border-white/5">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-gray-300">Repeat Every</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={interval}
                                    onChange={(e) => setInterval(e.target.value)}
                                    className="bg-black/40 border-white/10 text-white h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-gray-300">Interval Unit</Label>
                                <select
                                    value={intervalUnit}
                                    onChange={(e) => setIntervalUnit(e.target.value as "weeks" | "months")}
                                    className="w-full bg-black/40 border border-white/10 rounded-md px-3 h-9 text-xs text-white"
                                >
                                    <option value="weeks">Weeks</option>
                                    <option value="months">Months</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Commercial: Price Per Visit & Duration */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-300">Price Per Visit (ZAR)</Label>
                            <Input
                                type="number"
                                value={pricePerVisit}
                                onChange={(e) => setPricePerVisit(e.target.value)}
                                placeholder="62100"
                                className="bg-black/40 border-white/10 text-white h-10 text-xs font-mono font-bold"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-300">Contract Duration</Label>
                            <select
                                value={endOption}
                                onChange={(e) => setEndOption(e.target.value as any)}
                                className="w-full bg-black/40 border border-white/10 rounded-md px-3 h-10 text-xs text-white font-bold"
                            >
                                <option value="ONGOING" className="bg-[#14141E]">Ongoing (12 Months Rolling)</option>
                                <option value="COUNT" className="bg-[#14141E]">Specific Visit Count</option>
                                <option value="UNTIL" className="bg-[#14141E]">Until Specific End Date</option>
                            </select>
                        </div>
                    </div>

                    {endOption === "COUNT" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-300">Total Visits</Label>
                            <Input
                                type="number"
                                min="2"
                                max="36"
                                value={visitCount}
                                onChange={(e) => setVisitCount(e.target.value)}
                                className="bg-black/40 border-white/10 text-white h-9 text-xs"
                            />
                        </div>
                    )}

                    {endOption === "UNTIL" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-300">Contract End Date</Label>
                            <Input
                                type="date"
                                value={untilDate}
                                onChange={(e) => setUntilDate(e.target.value)}
                                className="bg-black/40 border-white/10 text-white h-9 text-xs font-mono"
                            />
                        </div>
                    )}

                    <DialogFooter className="pt-2 flex items-center justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="text-gray-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-primary text-primary-foreground font-black px-6 shadow-lg shadow-primary/20"
                        >
                            {loading ? "Generating Visits..." : "Generate Contract & Rolling Visits"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
