"use client"

import React, { useState, useTransition } from "react"
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
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    History,
    Loader2,
    Plane,
    Plus,
    Settings2,
    Wrench,
} from "lucide-react"
import {
    logDroneMaintenanceAction,
    upsertComplianceDroneAction,
} from "@/app/(dashboard)/compliance/actions"
import {
    evaluateDroneMaintenance,
    formatFlightHoursAndMinutes,
} from "@/lib/compliance-status"

interface DroneFleetTabProps {
    isAdmin: boolean
    drones: any[]
    droneFlightMinutesMap: Record<string, number>
}

export function DroneFleetTab({
    isAdmin,
    drones,
    droneFlightMinutesMap,
}: DroneFleetTabProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Aircraft Add/Edit Modal
    const [droneModalOpen, setDroneModalOpen] = useState(false)
    const [editingDrone, setEditingDrone] = useState<any | null>(null)
    const [formError, setFormError] = useState<string | null>(null)

    const [name, setName] = useState("")
    const [serialNumber, setSerialNumber] = useState("")
    const [model, setModel] = useState("JTC10")
    const [sacaaRegNumber, setSacaaRegNumber] = useState("")
    const [commissionDate, setCommissionDate] = useState("")
    const [airworthinessStatus, setAirworthinessStatus] = useState<
        "SERVICEABLE" | "MAINTENANCE_DUE" | "GROUNDED" | "RETIRED"
    >("SERVICEABLE")
    const [maintenanceIntervalDays, setMaintenanceIntervalDays] = useState("90")
    const [maintenanceIntervalHours, setMaintenanceIntervalHours] = useState("50")
    const [manualBaseFlightMinutes, setManualBaseFlightMinutes] = useState("0")
    const [nextMaintenanceDueDate, setNextMaintenanceDueDate] = useState("")

    // Maintenance Log Modal
    const [maintModalOpen, setMaintModalOpen] = useState(false)
    const [maintDrone, setMaintDrone] = useState<any | null>(null)
    const [maintDate, setMaintDate] = useState(new Date().toISOString().split("T")[0])
    const [maintType, setMaintType] = useState<
        "SCHEDULED_SERVICE" | "UNSCHEDULED_REPAIR" | "WASH_RIG_INSPECTION" | "FIRMWARE_CALIBRATION"
    >("SCHEDULED_SERVICE")
    const [maintSummary, setMaintSummary] = useState("")
    const [maintParts, setMaintParts] = useState("")
    const [maintCost, setMaintCost] = useState("")
    const [resetCounter, setResetCounter] = useState(true)
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

    const openCreateDrone = () => {
        setEditingDrone(null)
        setName("")
        setSerialNumber("")
        setModel("JTC10")
        setSacaaRegNumber("")
        setCommissionDate("")
        setAirworthinessStatus("SERVICEABLE")
        setMaintenanceIntervalDays("90")
        setMaintenanceIntervalHours("50")
        setManualBaseFlightMinutes("0")
        setNextMaintenanceDueDate("")
        setFormError(null)
        setDroneModalOpen(true)
    }

    const openEditDrone = (d: any) => {
        setEditingDrone(d)
        setName(d.name || "")
        setSerialNumber(d.serialNumber || "")
        setModel(d.model || "JTC10")
        setSacaaRegNumber(d.sacaaRegNumber || "")
        setCommissionDate(d.commissionDate ? String(d.commissionDate).split("T")[0] : "")
        setAirworthinessStatus(d.airworthinessStatus || "SERVICEABLE")
        setMaintenanceIntervalDays(String(d.maintenanceIntervalDays ?? 90))
        setMaintenanceIntervalHours(
            String(Math.round(((d.maintenanceIntervalMinutes ?? 3000) / 60) * 10) / 10)
        )
        setManualBaseFlightMinutes(String(d.manualBaseFlightMinutes ?? 0))
        setNextMaintenanceDueDate(
            d.nextMaintenanceDueDate ? String(d.nextMaintenanceDueDate).split("T")[0] : ""
        )
        setFormError(null)
        setDroneModalOpen(true)
    }

    const openLogMaintenance = (d: any) => {
        setMaintDrone(d)
        setMaintDate(new Date().toISOString().split("T")[0])
        setMaintType("SCHEDULED_SERVICE")
        setMaintSummary("")
        setMaintParts("")
        setMaintCost("")
        setResetCounter(true)
        setFormError(null)
        setMaintModalOpen(true)
    }

    const handleSaveDrone = (e: React.FormEvent) => {
        e.preventDefault()
        setFormError(null)
        startTransition(async () => {
            const res = await upsertComplianceDroneAction({
                id: editingDrone?.id,
                name,
                serialNumber,
                model,
                sacaaRegNumber,
                commissionDate: commissionDate || null,
                airworthinessStatus,
                maintenanceIntervalDays: Number(maintenanceIntervalDays || 90),
                maintenanceIntervalMinutes: Math.round(Number(maintenanceIntervalHours || 50) * 60),
                manualBaseFlightMinutes: Number(manualBaseFlightMinutes || 0),
                nextMaintenanceDueDate: nextMaintenanceDueDate || null,
            })
            if (!res.success) setFormError(res.error || "Failed to save aircraft")
            else {
                setDroneModalOpen(false)
                router.refresh()
            }
        })
    }

    const handleSaveMaintenance = (e: React.FormEvent) => {
        e.preventDefault()
        if (!maintDrone) return
        setFormError(null)
        startTransition(async () => {
            const res = await logDroneMaintenanceAction({
                droneId: maintDrone.id,
                performedAt: maintDate,
                type: maintType,
                workSummary: maintSummary,
                partsReplaced: maintParts,
                cost: maintCost ? Number(maintCost) : null,
                resetServiceCounter: resetCounter,
                airworthinessStatusAfter: "SERVICEABLE",
            })
            if (!res.success) setFormError(res.error || "Failed to log maintenance")
            else {
                setMaintModalOpen(false)
                router.refresh()
            }
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-white">
                        UAS Airframe Register & Scheduled Maintenance
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Dual-threshold tracking: airframe flight hours (from Job Sheets + manual flights) and calendar intervals.
                    </p>
                </div>
                {isAdmin && (
                    <Button size="sm" onClick={openCreateDrone} className="font-bold gap-1.5">
                        <Plus className="h-4 w-4" />
                        Add Aircraft
                    </Button>
                )}
            </div>

            {drones.length === 0 ? (
                <Card className="border-white/10 bg-[#141424]">
                    <CardContent className="py-12 text-center text-muted-foreground text-sm">
                        No aircraft registered yet. Add your primary wash drone to track airframe hours and service intervals.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {drones.map(d => {
                        const loggedMins = droneFlightMinutesMap[d.id] || 0
                        const ev = evaluateDroneMaintenance(d, loggedMins)
                        const intervalMins = d.maintenanceIntervalMinutes || 3000
                        const pct = Math.min(
                            100,
                            Math.round((ev.minutesSinceLastService / Math.max(1, intervalMins)) * 100)
                        )
                        const history = d.maintenanceLogs || []
                        const isExpanded = expandedHistoryId === d.id

                        const badgeClass =
                            ev.severity === "EXPIRED"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                : ev.severity === "CRITICAL"
                                ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                                : ev.severity === "DUE_SOON"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"

                        return (
                            <Card key={d.id} className="border-white/10 bg-[#141424]">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <CardTitle className="text-base font-black text-white flex items-center gap-2">
                                                <Plane className="h-4 w-4 text-primary" />
                                                {d.name}
                                                {d.sacaaRegNumber && (
                                                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-primary">
                                                        {d.sacaaRegNumber}
                                                    </span>
                                                )}
                                            </CardTitle>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                Model: <span className="text-white/80">{d.model || "—"}</span> · SN:{" "}
                                                <span className="font-mono text-white/80">{d.serialNumber}</span>
                                            </div>
                                        </div>
                                        <span
                                            className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${badgeClass}`}
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
                                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-black/30 p-3 border border-white/5">
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground">
                                                Total Airframe
                                            </div>
                                            <div className="text-sm font-black text-white mt-0.5">
                                                {formatFlightHoursAndMinutes(ev.totalAirframeMinutes)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground">
                                                Since Service
                                            </div>
                                            <div className="text-sm font-black text-white mt-0.5">
                                                {formatFlightHoursAndMinutes(ev.minutesSinceLastService)} /{" "}
                                                {Math.round(intervalMins / 60)}h
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase text-muted-foreground">
                                                Next Calendar Due
                                            </div>
                                            <div className="text-sm font-black text-white mt-0.5">
                                                {d.nextMaintenanceDueDate
                                                    ? String(d.nextMaintenanceDueDate).split("T")[0]
                                                    : ev.daysUntilNextService !== null
                                                    ? `In ${ev.daysUntilNextService}d`
                                                    : "Not set"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Flight-time service progress bar */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[11px] text-muted-foreground">
                                            <span>Service Interval Usage</span>
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

                                    {ev.reasons.length > 0 && (
                                        <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1.5">
                                            {ev.reasons.join(" · ")}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => openLogMaintenance(d)}
                                                className="h-8 text-xs font-bold gap-1.5"
                                            >
                                                <Wrench className="h-3.5 w-3.5" />
                                                Log Maintenance
                                            </Button>
                                            {isAdmin && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openEditDrone(d)}
                                                    className="h-8 text-xs border-white/15 gap-1"
                                                >
                                                    <Settings2 className="h-3.5 w-3.5" />
                                                    Configure
                                                </Button>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedHistoryId(isExpanded ? null : d.id)
                                            }
                                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-white"
                                        >
                                            <History className="h-3.5 w-3.5" />
                                            History ({history.length})
                                            {isExpanded ? (
                                                <ChevronUp className="h-3 w-3" />
                                            ) : (
                                                <ChevronDown className="h-3 w-3" />
                                            )}
                                        </button>
                                    </div>

                                    {isExpanded && (
                                        <div className="pt-2 border-t border-white/10 space-y-2">
                                            {history.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground">
                                                    No maintenance logs recorded yet.
                                                </p>
                                            ) : (
                                                history.slice(0, 6).map((m: any) => (
                                                    <div
                                                        key={m.id}
                                                        className="rounded-md bg-black/25 p-2.5 border border-white/5 space-y-0.5"
                                                    >
                                                        <div className="flex items-center justify-between font-bold text-white">
                                                            <span>
                                                                {String(m.type).replace(/_/g, " ")}
                                                            </span>
                                                            <span className="text-muted-foreground font-normal">
                                                                {String(m.performedAt).split("T")[0]}
                                                            </span>
                                                        </div>
                                                        <div className="text-white/80">
                                                            {m.workSummary}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground">
                                                            By {m.performedBy} at{" "}
                                                            {formatFlightHoursAndMinutes(
                                                                m.airframeMinutesAtService
                                                            )}
                                                            {m.partsReplaced
                                                                ? ` · Parts: ${m.partsReplaced}`
                                                                : ""}
                                                            {m.cost != null
                                                                ? ` · R${Number(m.cost).toLocaleString()}`
                                                                : ""}
                                                        </div>
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

            {/* Add / Configure Drone Modal */}
            <Dialog open={droneModalOpen} onOpenChange={setDroneModalOpen}>
                <DialogContent className="max-w-md bg-[#141424] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>
                            {editingDrone ? `Configure ${editingDrone.name}` : "Register Aircraft"}
                        </DialogTitle>
                        <DialogDescription>
                            Set SACAA registration and scheduled maintenance intervals.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveDrone} className="space-y-3">
                        {formError && (
                            <div className="p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
                                {formError}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Aircraft Name</Label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Wash Rig Alpha"
                                    required
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Model</Label>
                                <Input
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                    placeholder="e.g. JTC10 / M350"
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Serial Number</Label>
                                <Input
                                    value={serialNumber}
                                    onChange={e => setSerialNumber(e.target.value)}
                                    required
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">SACAA Registration (ZT-...)</Label>
                                <Input
                                    value={sacaaRegNumber}
                                    onChange={e => setSacaaRegNumber(e.target.value)}
                                    placeholder="e.g. ZT-R..."
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Service Interval (Hours)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={maintenanceIntervalHours}
                                    onChange={e => setMaintenanceIntervalHours(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Service Interval (Days)</Label>
                                <Input
                                    type="number"
                                    min={7}
                                    value={maintenanceIntervalDays}
                                    onChange={e => setMaintenanceIntervalDays(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Next Scheduled Service Date</Label>
                                <Input
                                    type="date"
                                    value={nextMaintenanceDueDate}
                                    onChange={e => setNextMaintenanceDueDate(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Airworthiness Status</Label>
                                <select
                                    value={airworthinessStatus}
                                    onChange={e => setAirworthinessStatus(e.target.value as any)}
                                    className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                                >
                                    <option value="SERVICEABLE">Serviceable</option>
                                    <option value="MAINTENANCE_DUE">Maintenance Due</option>
                                    <option value="GROUNDED">Grounded</option>
                                    <option value="RETIRED">Retired</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">
                                Opening Airframe Minutes (Prior to UROps)
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                value={manualBaseFlightMinutes}
                                onChange={e => setManualBaseFlightMinutes(e.target.value)}
                                className="bg-black/30 border-white/10 text-xs"
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setDroneModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                                Save Aircraft
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Log Maintenance Modal */}
            <Dialog open={maintModalOpen} onOpenChange={setMaintModalOpen}>
                <DialogContent className="max-w-md bg-[#141424] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-primary" />
                            Log Maintenance — {maintDrone?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Records airframe service and automatically advances the next maintenance due threshold.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveMaintenance} className="space-y-3">
                        {formError && (
                            <div className="p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
                                {formError}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Service Date</Label>
                                <Input
                                    type="date"
                                    value={maintDate}
                                    onChange={e => setMaintDate(e.target.value)}
                                    required
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Maintenance Type</Label>
                                <select
                                    value={maintType}
                                    onChange={e => setMaintType(e.target.value as any)}
                                    className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                                >
                                    <option value="SCHEDULED_SERVICE">Scheduled Service</option>
                                    <option value="WASH_RIG_INSPECTION">Wash Rig / Hose / Nozzle Check</option>
                                    <option value="UNSCHEDULED_REPAIR">Unscheduled Repair</option>
                                    <option value="FIRMWARE_CALIBRATION">Firmware & IMU Calibration</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Work Performed Summary</Label>
                            <Textarea
                                rows={3}
                                placeholder="Propeller inspection, motor bearings, high-pressure swivel seal check..."
                                value={maintSummary}
                                onChange={e => setMaintSummary(e.target.value)}
                                required
                                className="bg-black/30 border-white/10 text-xs"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Parts Replaced (Optional)</Label>
                                <Input
                                    value={maintParts}
                                    onChange={e => setMaintParts(e.target.value)}
                                    placeholder="e.g. CW/CCW prop pair"
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Cost ZAR (Optional)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={maintCost}
                                    onChange={e => setMaintCost(e.target.value)}
                                    placeholder="0.00"
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-emerald-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={resetCounter}
                                onChange={e => setResetCounter(e.target.checked)}
                            />
                            Reset service interval counter & advance next scheduled due date
                        </label>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setMaintModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                                Record Service
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
