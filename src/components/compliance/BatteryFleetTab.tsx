"use client"

import React, { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertTriangle,
    BatteryCharging,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    History,
    Loader2,
    Plus,
    Settings2,
    Trash2,
    Zap,
} from "lucide-react"
import {
    deleteDroneBatteryAction,
    incrementBatteryCyclesAction,
    upsertDroneBatteryAction,
} from "@/app/(dashboard)/compliance/actions"
import { evaluateBatteryStatus } from "@/lib/compliance-status"

interface BatteryFleetTabProps {
    isAdmin: boolean
    batteries: any[]
    drones: any[]
}

export function BatteryFleetTab({
    isAdmin,
    batteries,
    drones,
}: BatteryFleetTabProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [showRetired, setShowRetired] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // Add/Edit Battery Modal
    const [batModalOpen, setBatModalOpen] = useState(false)
    const [editingBat, setEditingBat] = useState<any | null>(null)
    const [formError, setFormError] = useState<string | null>(null)

    const [label, setLabel] = useState("")
    const [pairGroup, setPairGroup] = useState("")
    const [assignedDroneId, setAssignedDroneId] = useState("")
    const [model, setModel] = useState("TB65")
    const [serialNumber, setSerialNumber] = useState("")
    const [currentCycles, setCurrentCycles] = useState("0")
    const [maxRecommendedCycles, setMaxRecommendedCycles] = useState("200")
    const [healthPercent, setHealthPercent] = useState("100")
    const [nextInspectionDueDate, setNextInspectionDueDate] = useState("")
    const [status, setStatus] = useState<
        "ACTIVE" | "MAINTENANCE_DUE" | "SWOLLEN_QUARANTINE" | "RETIRED"
    >("ACTIVE")
    const [notes, setNotes] = useState("")

    // Detailed Charge / Health Inspection Modal
    const [inspectBat, setInspectBat] = useState<any | null>(null)
    const [cyclesAdded, setCyclesAdded] = useState("1")
    const [inspectHealth, setInspectHealth] = useState("")
    const [voltageDevMv, setVoltageDevMv] = useState("")
    const [swellingObserved, setSwellingObserved] = useState(false)
    const [inspectNotes, setInspectNotes] = useState("")

    const visibleBatteries = useMemo(() => {
        return (batteries || []).filter(b => (showRetired ? true : b.status !== "RETIRED"))
    }, [batteries, showRetired])

    const pairGroups = useMemo(() => {
        const map = new Map<string, any[]>()
        for (const b of batteries || []) {
            if (b.status === "RETIRED" || b.status === "SWOLLEN_QUARANTINE") continue
            if (b.pairGroup?.trim()) {
                const key = b.pairGroup.trim()
                map.set(key, [...(map.get(key) || []), b])
            }
        }
        return Array.from(map.entries())
    }, [batteries])

    const openAddBattery = () => {
        setEditingBat(null)
        setLabel("")
        setPairGroup("")
        setAssignedDroneId(drones[0]?.id || "")
        setModel("TB65")
        setSerialNumber("")
        setCurrentCycles("0")
        setMaxRecommendedCycles("200")
        setHealthPercent("100")
        setNextInspectionDueDate("")
        setStatus("ACTIVE")
        setNotes("")
        setFormError(null)
        setBatModalOpen(true)
    }

    const openEditBattery = (b: any) => {
        setEditingBat(b)
        setLabel(b.label || "")
        setPairGroup(b.pairGroup || "")
        setAssignedDroneId(b.assignedDroneId || "")
        setModel(b.model || "")
        setSerialNumber(b.serialNumber || "")
        setCurrentCycles(String(b.currentCycles ?? 0))
        setMaxRecommendedCycles(String(b.maxRecommendedCycles ?? 200))
        setHealthPercent(b.healthPercent != null ? String(b.healthPercent) : "")
        setNextInspectionDueDate(
            b.nextInspectionDueDate ? String(b.nextInspectionDueDate).split("T")[0] : ""
        )
        setStatus(b.status || "ACTIVE")
        setNotes(b.notes || "")
        setFormError(null)
        setBatModalOpen(true)
    }

    const handleQuickIncrement = (batteryIds: string[]) => {
        startTransition(async () => {
            const res = await incrementBatteryCyclesAction({
                batteryIds,
                cyclesAdded: 1,
            })
            if (!res.success) alert(res.error)
            else router.refresh()
        })
    }

    const handleSaveBattery = (e: React.FormEvent) => {
        e.preventDefault()
        setFormError(null)
        startTransition(async () => {
            const res = await upsertDroneBatteryAction({
                id: editingBat?.id,
                label,
                pairGroup,
                assignedDroneId: assignedDroneId || null,
                model,
                serialNumber,
                currentCycles: Number(currentCycles || 0),
                maxRecommendedCycles: Number(maxRecommendedCycles || 200),
                healthPercent: healthPercent !== "" ? Number(healthPercent) : null,
                nextInspectionDueDate: nextInspectionDueDate || null,
                status,
                notes,
            })
            if (!res.success) setFormError(res.error || "Failed to save battery")
            else {
                setBatModalOpen(false)
                router.refresh()
            }
        })
    }

    const handleSaveInspection = (e: React.FormEvent) => {
        e.preventDefault()
        if (!inspectBat) return
        setFormError(null)
        startTransition(async () => {
            const res = await incrementBatteryCyclesAction({
                batteryIds: [inspectBat.id],
                cyclesAdded: Number(cyclesAdded || 1),
                healthPercent: inspectHealth !== "" ? Number(inspectHealth) : null,
                voltageDeviationMv: voltageDevMv !== "" ? Number(voltageDevMv) : null,
                swellingObserved,
                notes: inspectNotes,
            })
            if (!res.success) setFormError(res.error || "Failed to log inspection")
            else {
                setInspectBat(null)
                router.refresh()
            }
        })
    }

    const handleDeleteBattery = (id: string) => {
        if (!confirm("Delete this battery and its charge history?")) return
        startTransition(async () => {
            const res = await deleteDroneBatteryAction(id)
            if (!res.success) alert(res.error)
            else router.refresh()
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-bold text-white">
                        Battery Fleet, Charge Cycles & Cell Health
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Track cycle counts against manufacturer retirement limits, paired sets, and swelling checks.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showRetired}
                            onChange={e => setShowRetired(e.target.checked)}
                        />
                        Show Retired
                    </label>
                    <Button size="sm" onClick={openAddBattery} className="font-bold gap-1.5">
                        <Plus className="h-4 w-4" />
                        Add Battery
                    </Button>
                </div>
            </div>

            {/* Paired Set 1-Click Batch Bar */}
            {pairGroups.length > 0 && (
                <Card className="border-white/10 bg-[#141424]">
                    <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-muted-foreground">
                            Quick Paired-Set Charge Log (+1 Cycle to Set):
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {pairGroups.map(([groupName, groupBats]) => (
                                <Button
                                    key={groupName}
                                    size="sm"
                                    variant="outline"
                                    disabled={isPending}
                                    onClick={() =>
                                        handleQuickIncrement(groupBats.map(b => b.id))
                                    }
                                    className="h-8 text-xs border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 font-bold gap-1.5"
                                >
                                    <Zap className="h-3.5 w-3.5" />
                                    {groupName} ({groupBats.map(b => b.label).join(" + ")}) +1
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {visibleBatteries.length === 0 ? (
                <Card className="border-white/10 bg-[#141424]">
                    <CardContent className="py-12 text-center text-muted-foreground text-sm">
                        No batteries registered yet. Add your flight batteries (e.g. BAT-01A / Set A) to track charge cycles and maintenance due alerts.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {visibleBatteries.map(b => {
                        const ev = evaluateBatteryStatus(b)
                        const pct = Math.min(100, Math.round(ev.cycleRatio * 100))
                        const isExpanded = expandedId === b.id
                        const logs = b.chargeLogs || []

                        const pillClass =
                            ev.severity === "EXPIRED"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                : ev.severity === "CRITICAL"
                                ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                                : ev.severity === "DUE_SOON"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"

                        return (
                            <Card key={b.id} className="border-white/10 bg-[#141424]">
                                <CardHeader className="pb-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <CardTitle className="text-sm font-black text-white flex items-center gap-1.5">
                                                <BatteryCharging className="h-4 w-4 text-primary" />
                                                {b.label}
                                                {b.pairGroup && (
                                                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-semibold text-muted-foreground">
                                                        {b.pairGroup}
                                                    </span>
                                                )}
                                            </CardTitle>
                                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                                {b.model || "LiPo/LiHV"}
                                                {b.serialNumber ? ` · SN: ${b.serialNumber}` : ""}
                                                {b.assignedDrone ? ` · ${b.assignedDrone.name}` : ""}
                                            </div>
                                        </div>
                                        <span
                                            className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase inline-flex items-center gap-1 ${pillClass}`}
                                        >
                                            {ev.severity === "VALID" ? (
                                                <CheckCircle2 className="h-3 w-3" />
                                            ) : (
                                                <AlertTriangle className="h-3 w-3" />
                                            )}
                                            {ev.label}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 text-xs">
                                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-black/30 p-2.5 border border-white/5">
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground">
                                                Cycles
                                            </div>
                                            <div className="text-sm font-black text-white">
                                                {b.currentCycles}{" "}
                                                <span className="text-[11px] text-muted-foreground font-normal">
                                                    / {b.maxRecommendedCycles}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground">
                                                SOH %
                                            </div>
                                            <div className="text-sm font-black text-white">
                                                {b.healthPercent != null
                                                    ? `${b.healthPercent}%`
                                                    : "—"}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground">
                                                Last Charged
                                            </div>
                                            <div className="text-xs font-bold text-white mt-0.5">
                                                {b.lastChargedAt
                                                    ? String(b.lastChargedAt).split("T")[0]
                                                    : "—"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[11px] text-muted-foreground">
                                            <span>Lifecycle Used</span>
                                            <span>{pct}%</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${
                                                    pct >= 100
                                                        ? "bg-rose-500"
                                                        : pct >= 85
                                                        ? "bg-amber-500"
                                                        : "bg-emerald-500"
                                                }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>

                                    {ev.reasons.length > 0 && b.status !== "RETIRED" && (
                                        <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                                            {ev.reasons.join(" · ")}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between gap-1.5 pt-1">
                                        <div className="flex items-center gap-1.5">
                                            {b.status !== "RETIRED" &&
                                                b.status !== "SWOLLEN_QUARANTINE" && (
                                                    <Button
                                                        size="sm"
                                                        disabled={isPending}
                                                        onClick={() =>
                                                            handleQuickIncrement([b.id])
                                                        }
                                                        className="h-7 px-2.5 text-xs font-bold gap-1"
                                                    >
                                                        <Zap className="h-3 w-3" />
                                                        +1 Cycle
                                                    </Button>
                                                )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setInspectBat(b)
                                                    setCyclesAdded("1")
                                                    setInspectHealth(
                                                        b.healthPercent != null
                                                            ? String(b.healthPercent)
                                                            : ""
                                                    )
                                                    setVoltageDevMv("")
                                                    setSwellingObserved(false)
                                                    setInspectNotes("")
                                                    setFormError(null)
                                                }}
                                                className="h-7 px-2 text-xs border-white/15"
                                            >
                                                Inspect
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => openEditBattery(b)}
                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-white"
                                                title="Edit battery"
                                            >
                                                <Settings2 className="h-3.5 w-3.5" />
                                            </Button>
                                            {isAdmin && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteBattery(b.id)}
                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
                                                    title="Delete battery"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedId(isExpanded ? null : b.id)
                                            }
                                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-white"
                                        >
                                            <History className="h-3 w-3" />
                                            {logs.length}
                                            {isExpanded ? (
                                                <ChevronUp className="h-3 w-3" />
                                            ) : (
                                                <ChevronDown className="h-3 w-3" />
                                            )}
                                        </button>
                                    </div>

                                    {isExpanded && (
                                        <div className="pt-2 border-t border-white/10 space-y-1.5">
                                            {logs.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground">
                                                    No charge events logged yet.
                                                </p>
                                            ) : (
                                                logs.slice(0, 5).map((cl: any) => (
                                                    <div
                                                        key={cl.id}
                                                        className="flex items-center justify-between text-[11px] bg-black/25 px-2 py-1.5 rounded"
                                                    >
                                                        <span>
                                                            +{cl.cyclesAdded} (&#8594; {cl.cycleCountAfter})
                                                            {cl.swellingObserved ? " · SWOLLEN" : ""}
                                                            {cl.notes ? ` · ${cl.notes}` : ""}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            {String(cl.loggedAt).split("T")[0]}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Add / Edit Battery Dialog */}
            <Dialog open={batModalOpen} onOpenChange={setBatModalOpen}>
                <DialogContent className="max-w-md bg-[#141424] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>
                            {editingBat ? `Edit ${editingBat.label}` : "Add Drone Battery"}
                        </DialogTitle>
                        <DialogDescription>
                            Track cycle counts, paired battery sets, and retirement thresholds.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveBattery} className="space-y-3">
                        {formError && (
                            <div className="p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
                                {formError}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Battery Label</Label>
                                <Input
                                    placeholder="e.g. BAT-01A"
                                    value={label}
                                    onChange={e => setLabel(e.target.value)}
                                    required
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Pair / Set Group (Optional)</Label>
                                <Input
                                    placeholder="e.g. Set A"
                                    value={pairGroup}
                                    onChange={e => setPairGroup(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Model</Label>
                                <Input
                                    placeholder="e.g. TB65 / 12S 22000mAh"
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Serial Number</Label>
                                <Input
                                    value={serialNumber}
                                    onChange={e => setSerialNumber(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Current Cycles</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={currentCycles}
                                    onChange={e => setCurrentCycles(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Max Cycles</Label>
                                <Input
                                    type="number"
                                    min={10}
                                    value={maxRecommendedCycles}
                                    onChange={e => setMaxRecommendedCycles(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Health SOH %</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={healthPercent}
                                    onChange={e => setHealthPercent(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Assigned Aircraft</Label>
                                <select
                                    value={assignedDroneId}
                                    onChange={e => setAssignedDroneId(e.target.value)}
                                    className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                                >
                                    <option value="">Unassigned / Shared</option>
                                    {drones.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Status</Label>
                                <select
                                    value={status}
                                    onChange={e => setStatus(e.target.value as any)}
                                    className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                                >
                                    <option value="ACTIVE">Active</option>
                                    <option value="MAINTENANCE_DUE">Maintenance Due</option>
                                    <option value="SWOLLEN_QUARANTINE">Swollen / Quarantine</option>
                                    <option value="RETIRED">Retired</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Next Inspection Due Date (Optional)</Label>
                            <Input
                                type="date"
                                value={nextInspectionDueDate}
                                onChange={e => setNextInspectionDueDate(e.target.value)}
                                className="bg-black/30 border-white/10 text-xs"
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setBatModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                                Save Battery
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Detailed Cycle & Cell Inspection Dialog */}
            <Dialog open={Boolean(inspectBat)} onOpenChange={v => !v && setInspectBat(null)}>
                <DialogContent className="max-w-md bg-[#141424] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>
                            Log Charge & Cell Check — {inspectBat?.label}
                        </DialogTitle>
                        <DialogDescription>
                            Record charge cycles, state-of-health %, cell voltage deviation, or physical swelling.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveInspection} className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Cycles Added</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={cyclesAdded}
                                    onChange={e => setCyclesAdded(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">SOH %</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={inspectHealth}
                                    onChange={e => setInspectHealth(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Cell Diff (mV)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={voltageDevMv}
                                    onChange={e => setVoltageDevMv(e.target.value)}
                                    placeholder="e.g. 15"
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Inspection Notes</Label>
                            <Textarea
                                rows={2}
                                value={inspectNotes}
                                onChange={e => setInspectNotes(e.target.value)}
                                placeholder="Connector condition, storage charge check..."
                                className="bg-black/30 border-white/10 text-xs"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-rose-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={swellingObserved}
                                onChange={e => setSwellingObserved(e.target.checked)}
                            />
                            Physical puffing/swelling observed (auto-quarantines battery)
                        </label>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setInspectBat(null)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                                Save Log
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
