"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Wind, Plane, Plus, Trash2, Save, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import {
    updateFlightWeatherLimitsAction,
    createDroneAction,
    toggleDroneActiveAction,
    deleteDroneAction
} from "@/app/(dashboard)/settings/flight-ops-actions"
import { UNCONFIGURED_WEATHER_PROMPT } from "@/lib/weather"

export function AeroWashFlightOpsSettings({
    initialSettings,
    initialDrones
}: {
    initialSettings: any
    initialDrones: any[]
}) {
    const router = useRouter()
    const [savingLimits, setSavingLimits] = useState(false)
    const [limitsSavedMsg, setLimitsSavedMsg] = useState<string | null>(null)
    const [limitsError, setLimitsError] = useState<string | null>(null)

    const [weatherLimits, setWeatherLimits] = useState({
        sprayDriftWarnKmh: initialSettings?.sprayDriftWarnKmh ?? "",
        windWarnKmh: initialSettings?.windWarnKmh ?? "",
        windLimitKmh: initialSettings?.windLimitKmh ?? "",
        gustWarnKmh: initialSettings?.gustWarnKmh ?? "",
        gustLimitKmh: initialSettings?.gustLimitKmh ?? "",
        rainLimitMm: initialSettings?.rainLimitMm ?? "",
    })

    const isConfigured = Boolean(initialSettings?.weatherLimitsConfigured)

    const [drones, setDrones] = useState<any[]>(initialDrones || [])
    const [droneName, setDroneName] = useState("")
    const [droneSerial, setDroneSerial] = useState("")
    const [droneModel, setDroneModel] = useState("JTC10")
    const [addingDrone, setAddingDrone] = useState(false)
    const [droneError, setDroneError] = useState<string | null>(null)

    const handleSaveWeatherLimits = async (e: React.FormEvent) => {
        e.preventDefault()
        setSavingLimits(true)
        setLimitsError(null)
        setLimitsSavedMsg(null)
        try {
            const res = await updateFlightWeatherLimitsAction(weatherLimits)
            if (!res.success) {
                setLimitsError(res.error || "Failed to save limits")
            } else {
                setLimitsSavedMsg(
                    res.weatherLimitsConfigured
                        ? "Flight weather & spray drift thresholds saved."
                        : "Weather limits cleared."
                )
                router.refresh()
            }
        } catch (err: any) {
            setLimitsError(err.message || "Unexpected error")
        } finally {
            setSavingLimits(false)
        }
    }

    const handleAddDrone = async (e: React.FormEvent) => {
        e.preventDefault()
        setAddingDrone(true)
        setDroneError(null)
        try {
            const res = await createDroneAction({
                name: droneName,
                serialNumber: droneSerial,
                model: droneModel
            })
            if (!res.success) {
                setDroneError(res.error || "Failed to add aircraft")
            } else if (res.drone) {
                setDrones(prev => [...prev, res.drone])
                setDroneName("")
                setDroneSerial("")
                router.refresh()
            }
        } catch (err: any) {
            setDroneError(err.message || "Unexpected error")
        } finally {
            setAddingDrone(false)
        }
    }

    const handleToggleDrone = async (id: string, nextActive: boolean) => {
        const res = await toggleDroneActiveAction(id, nextActive)
        if (res.success) {
            setDrones(prev => prev.map(d => d.id === id ? { ...d, isActive: nextActive } : d))
            router.refresh()
        }
    }

    const handleDeleteDrone = async (id: string) => {
        if (!confirm("Remove this aircraft from the fleet list?")) return
        const res = await deleteDroneAction(id)
        if (res.success) {
            setDrones(prev => prev.filter(d => d.id !== id))
            router.refresh()
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Flight Weather & Spray Drift Limits */}
            <Card className="border-white/10 bg-[#141424]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Wind className="h-5 w-5 text-primary" />
                        Flight Weather &amp; Spray Drift Limits (Internal)
                    </CardTitle>
                    <CardDescription>
                        Used across Calendar, Job List, and Mobile Job Sheets to show Flyable (Green), Marginal / Spray Drift (Amber), and No-Fly (Red) badges, plus day-before Red alerts.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!isConfigured && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-amber-200">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                            <div className="text-xs leading-relaxed">
                                <p className="font-black uppercase tracking-wider text-amber-300 mb-0.5">
                                    Action Required Before Live Dispatch
                                </p>
                                <p className="font-semibold">{UNCONFIGURED_WEATHER_PROMPT}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSaveWeatherLimits} className="space-y-4">
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
                            <Label htmlFor="sprayDriftWarnKmh" className="text-xs font-bold text-amber-300">
                                Spray Drift Warning — Sustained Wind (km/h)
                            </Label>
                            <Input
                                id="sprayDriftWarnKmh"
                                type="number"
                                step="0.5"
                                placeholder="e.g. 15"
                                value={weatherLimits.sprayDriftWarnKmh}
                                onChange={e => setWeatherLimits(s => ({ ...s, sprayDriftWarnKmh: e.target.value }))}
                                className="bg-black/30 border-white/10"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Separate operational threshold for overspray / pure-water drift onto pedestrians, vehicles, or adjacent facades.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="windWarnKmh" className="text-xs font-bold">
                                    Aircraft Sustained Wind — Marginal (km/h)
                                </Label>
                                <Input
                                    id="windWarnKmh"
                                    type="number"
                                    step="0.5"
                                    placeholder="JTC10 / ABEOD amber"
                                    value={weatherLimits.windWarnKmh}
                                    onChange={e => setWeatherLimits(s => ({ ...s, windWarnKmh: e.target.value }))}
                                    className="bg-black/30 border-white/10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="windLimitKmh" className="text-xs font-bold text-red-300">
                                    Aircraft Sustained Wind — No-Fly (km/h)
                                </Label>
                                <Input
                                    id="windLimitKmh"
                                    type="number"
                                    step="0.5"
                                    placeholder="JTC10 / ABEOD red max"
                                    value={weatherLimits.windLimitKmh}
                                    onChange={e => setWeatherLimits(s => ({ ...s, windLimitKmh: e.target.value }))}
                                    className="bg-black/30 border-white/10"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="gustWarnKmh" className="text-xs font-bold">
                                    Wind Gusts — Marginal Warning (km/h)
                                </Label>
                                <Input
                                    id="gustWarnKmh"
                                    type="number"
                                    step="0.5"
                                    placeholder="e.g. 25"
                                    value={weatherLimits.gustWarnKmh}
                                    onChange={e => setWeatherLimits(s => ({ ...s, gustWarnKmh: e.target.value }))}
                                    className="bg-black/30 border-white/10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="gustLimitKmh" className="text-xs font-bold text-red-300">
                                    Wind Gusts — No-Fly Limit (km/h)
                                </Label>
                                <Input
                                    id="gustLimitKmh"
                                    type="number"
                                    step="0.5"
                                    placeholder="JTC10 / ABEOD red gust max"
                                    value={weatherLimits.gustLimitKmh}
                                    onChange={e => setWeatherLimits(s => ({ ...s, gustLimitKmh: e.target.value }))}
                                    className="bg-black/30 border-white/10"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="rainLimitMm" className="text-xs font-bold">
                                Rain / Precipitation No-Fly Limit (mm)
                            </Label>
                            <Input
                                id="rainLimitMm"
                                type="number"
                                step="0.1"
                                placeholder="e.g. 1.0"
                                value={weatherLimits.rainLimitMm}
                                onChange={e => setWeatherLimits(s => ({ ...s, rainLimitMm: e.target.value }))}
                                className="bg-black/30 border-white/10"
                            />
                        </div>

                        {limitsError && (
                            <p className="text-xs font-bold text-red-400">{limitsError}</p>
                        )}
                        {limitsSavedMsg && (
                            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4" /> {limitsSavedMsg}
                            </p>
                        )}

                        <Button type="submit" disabled={savingLimits} className="w-full sm:w-auto font-bold">
                            {savingLimits ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Weather &amp; Drift Limits
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* 2. Simple Drones Fleet Register */}
            <Card className="border-white/10 bg-[#141424]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Plane className="h-5 w-5 text-primary" />
                        Aircraft / Drones Register
                    </CardTitle>
                    <CardDescription>
                        Manage AeroWash aircraft (name &amp; serial) selectable on Mobile Job Sheets to feed the Phase 3 SACAA / ABEOD flight log.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form onSubmit={handleAddDrone} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-5 space-y-1">
                            <Label className="text-xs font-bold">Aircraft Name</Label>
                            <Input
                                placeholder="e.g. JTC10 Alpha"
                                value={droneName}
                                onChange={e => setDroneName(e.target.value)}
                                className="bg-black/30 border-white/10"
                                required
                            />
                        </div>
                        <div className="sm:col-span-5 space-y-1">
                            <Label className="text-xs font-bold">Serial / Registration #</Label>
                            <Input
                                placeholder="e.g. JTC10-ZA-001"
                                value={droneSerial}
                                onChange={e => setDroneSerial(e.target.value)}
                                className="bg-black/30 border-white/10"
                                required
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Button type="submit" disabled={addingDrone} className="w-full font-bold">
                                {addingDrone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            </Button>
                        </div>
                    </form>

                    {droneError && <p className="text-xs font-bold text-red-400">{droneError}</p>}

                    <div className="space-y-2 pt-2">
                        {drones.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-4 text-center border border-dashed border-white/10 rounded-xl">
                                No aircraft added yet. Add your JTC10 airframe(s) above so pilots can select them on site.
                            </p>
                        ) : (
                            drones.map((d) => (
                                <div
                                    key={d.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-white truncate">
                                            {d.name}
                                            {!d.isActive && (
                                                <span className="ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">
                                                    Inactive
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground font-mono">
                                            SN: {d.serialNumber} {d.model ? `· ${d.model}` : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleToggleDrone(d.id, !d.isActive)}
                                            className="h-8 text-xs border-white/10"
                                        >
                                            {d.isActive ? "Set Inactive" : "Activate"}
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDeleteDrone(d.id)}
                                            className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
