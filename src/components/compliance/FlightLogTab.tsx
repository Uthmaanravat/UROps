"use client"

import React, { useMemo, useState, useTransition } from "react"
import Link from "next/link"
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
    Clock,
    Download,
    ExternalLink,
    FileSpreadsheet,
    FileText,
    Loader2,
    Plane,
    Plus,
    RefreshCw,
    Trash2,
} from "lucide-react"
import {
    createManualFlightLogAction,
    deleteFlightLogEntryAction,
    syncFlightLogsFromJobSheetsAction,
} from "@/app/(dashboard)/compliance/actions"
import { formatFlightHoursAndMinutes } from "@/lib/compliance-status"
import { buildSacaaFlightLogPdf } from "@/lib/vendor-pack-pdf"

interface FlightLogTabProps {
    companyName: string
    isAdmin: boolean
    flightLogs: any[]
    drones: any[]
    pilots: any[]
    batteries: any[]
    projects: any[]
}

export function FlightLogTab({
    companyName,
    isAdmin,
    flightLogs,
    drones,
    pilots,
    batteries,
    projects,
}: FlightLogTabProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // Filters
    const [pilotFilter, setPilotFilter] = useState("ALL")
    const [droneFilter, setDroneFilter] = useState("ALL")
    const [sourceFilter, setSourceFilter] = useState("ALL")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [search, setSearch] = useState("")

    // Manual Log Modal
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [syncMessage, setSyncMessage] = useState<string | null>(null)

    const todayStr = new Date().toISOString().split("T")[0]
    const [flightDate, setFlightDate] = useState(todayStr)
    const [pilotUserId, setPilotUserId] = useState(pilots[0]?.id || "")
    const [droneId, setDroneId] = useState(drones[0]?.id || "")
    const [projectId, setProjectId] = useState("")
    const [durationMinutes, setDurationMinutes] = useState("25")
    const [sorties, setSorties] = useState("1")
    const [purpose, setPurpose] = useState<
        "COMMERCIAL_OPS" | "SITE_RECON" | "TRAINING" | "MAINTENANCE_TEST" | "OTHER"
    >("COMMERCIAL_OPS")
    const [siteLocation, setSiteLocation] = useState("")
    const [weatherSummary, setWeatherSummary] = useState("")
    const [selectedBatteryIds, setSelectedBatteryIds] = useState<string[]>([])
    const [incrementBatteries, setIncrementBatteries] = useState(true)
    const [incidentOccurred, setIncidentOccurred] = useState(false)
    const [notes, setNotes] = useState("")

    const filteredLogs = useMemo(() => {
        return (flightLogs || []).filter(entry => {
            if (pilotFilter !== "ALL" && entry.pilotUserId !== pilotFilter) return false
            if (droneFilter !== "ALL" && entry.droneId !== droneFilter) return false
            if (sourceFilter !== "ALL" && entry.source !== sourceFilter) return false

            const entryDay = entry.flightDate ? String(entry.flightDate).split("T")[0] : ""
            if (dateFrom && entryDay < dateFrom) return false
            if (dateTo && entryDay > dateTo) return false

            if (search.trim()) {
                const q = search.trim().toLowerCase()
                const hay = [
                    entry.pilotUser?.name,
                    entry.pilotNameSnapshot,
                    entry.drone?.name,
                    entry.droneNameSnapshot,
                    entry.project?.name,
                    entry.project?.client?.name,
                    entry.siteLocation,
                    entry.notes,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                if (!hay.includes(q)) return false
            }
            return true
        })
    }, [flightLogs, pilotFilter, droneFilter, sourceFilter, dateFrom, dateTo, search])

    const stats = useMemo(() => {
        const now = Date.now()
        const thirtyDaysAgo = now - 30 * 86400000
        let allMinutes = 0
        let last30Minutes = 0
        let totalSorties = 0

        for (const l of filteredLogs) {
            const mins = Number(l.durationMinutes || 0)
            allMinutes += mins
            totalSorties += Number(l.sorties || 1)
            const t = new Date(l.flightDate).getTime()
            if (!isNaN(t) && t >= thirtyDaysAgo) {
                last30Minutes += mins
            }
        }
        return { allMinutes, last30Minutes, totalSorties }
    }, [filteredLogs])

    const handleSyncJobSheets = () => {
        setSyncMessage(null)
        startTransition(async () => {
            const res = await syncFlightLogsFromJobSheetsAction()
            if (res.success) {
                setSyncMessage(`Synced ${res.syncedCount} completed/logged Job Sheet(s).`)
                router.refresh()
            } else {
                setSyncMessage(res.error || "Sync failed")
            }
        })
    }

    const handleSaveManualFlight = (e: React.FormEvent) => {
        e.preventDefault()
        setFormError(null)
        startTransition(async () => {
            const res = await createManualFlightLogAction({
                flightDate,
                pilotUserId,
                droneId,
                projectId: projectId || null,
                durationMinutes: Number(durationMinutes),
                sorties: Number(sorties || 1),
                purpose,
                siteLocation,
                weatherSummary,
                batteryIdsUsed: selectedBatteryIds,
                incrementSelectedBatteries: incrementBatteries,
                incidentOccurred,
                notes,
            })
            if (!res.success) {
                setFormError(res.error || "Failed to save flight entry")
            } else {
                setIsModalOpen(false)
                setSiteLocation("")
                setWeatherSummary("")
                setNotes("")
                setSelectedBatteryIds([])
                router.refresh()
            }
        })
    }

    const handleDeleteManual = (id: string) => {
        if (!confirm("Delete this manual flight log entry?")) return
        startTransition(async () => {
            const res = await deleteFlightLogEntryAction(id)
            if (!res.success) alert(res.error)
            else router.refresh()
        })
    }

    const exportCsv = () => {
        const headers = [
            "Date",
            "Pilot",
            "Aircraft",
            "SACAA Reg",
            "Project",
            "Client",
            "Site Location",
            "Purpose",
            "Sorties",
            "Duration (min)",
            "Weather",
            "Incident",
            "Source",
            "Notes",
        ]
        const lines = [headers.join(",")]
        for (const l of filteredLogs) {
            const row = [
                l.flightDate ? String(l.flightDate).split("T")[0] : "",
                l.pilotUser?.name || l.pilotNameSnapshot || "—",
                l.drone ? `${l.drone.name} (${l.drone.serialNumber})` : l.droneNameSnapshot || "—",
                l.drone?.sacaaRegNumber || "",
                l.project?.name || "",
                l.project?.client?.name || "",
                l.siteLocation || "",
                l.purpose || "COMMERCIAL_OPS",
                String(l.sorties || 1),
                String(l.durationMinutes || 0),
                l.weatherSummary || "",
                l.incidentOccurred ? "YES" : "NO",
                l.source,
                (l.notes || "").replace(/\r?\n/g, " "),
            ].map(cell => `"${String(cell).replace(/"/g, '""')}"`)
            lines.push(row.join(","))
        }

        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `SACAA_Flight_Log_${todayStr}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const exportPdf = () => {
        const pdf = buildSacaaFlightLogPdf({
            companyName,
            rows: filteredLogs.map(l => ({
                flightDate: l.flightDate ? String(l.flightDate).split("T")[0] : "—",
                pilotName: l.pilotUser?.name || l.pilotNameSnapshot || "—",
                droneName: l.drone
                    ? `${l.drone.name} (${l.drone.sacaaRegNumber || l.drone.serialNumber})`
                    : l.droneNameSnapshot || "—",
                projectName: l.project?.name || "Standalone",
                siteLocation: l.siteLocation || "—",
                purpose: l.purpose || "COMMERCIAL_OPS",
                sorties: l.sorties || 1,
                durationMinutes: l.durationMinutes || 0,
                source: l.source || "JOB_SHEET",
            })),
            filterSummary:
                dateFrom || dateTo ? `${dateFrom || "Start"} to ${dateTo || "Now"}` : "All Dates",
        })
        pdf.save(`SACAA_Flight_Logbook_${todayStr}.pdf`)
    }

    const toggleBatterySelection = (id: string) => {
        setSelectedBatteryIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    return (
        <div className="space-y-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="border-white/10 bg-[#141424]">
                    <CardContent className="p-4">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                            Filtered Flight Time
                        </div>
                        <div className="text-2xl font-black text-white mt-1">
                            {formatFlightHoursAndMinutes(stats.allMinutes)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {stats.allMinutes.toLocaleString()} total minutes
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-white/10 bg-[#141424]">
                    <CardContent className="p-4">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                            Last 30 Days
                        </div>
                        <div className="text-2xl font-black text-primary mt-1">
                            {formatFlightHoursAndMinutes(stats.last30Minutes)}
                        </div>
                        <div className="text-xs text-muted-foreground">Rolling 30-day currency</div>
                    </CardContent>
                </Card>
                <Card className="border-white/10 bg-[#141424]">
                    <CardContent className="p-4">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                            Logged Flights / Sorties
                        </div>
                        <div className="text-2xl font-black text-white mt-1">
                            {filteredLogs.length}{" "}
                            <span className="text-sm font-semibold text-muted-foreground">
                                ({stats.totalSorties} sorties)
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground">Job Sheets + manual logs</div>
                    </CardContent>
                </Card>
                <Card className="border-white/10 bg-[#141424]">
                    <CardContent className="p-4">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                            Active Fleet / Crew
                        </div>
                        <div className="text-2xl font-black text-white mt-1">
                            {drones.filter(d => d.isActive).length} Aircraft · {pilots.length} Team
                        </div>
                        <div className="text-xs text-muted-foreground">Auto-synced from Job Sheets</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter & Action Toolbar */}
            <Card className="border-white/10 bg-[#141424]">
                <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                size="sm"
                                onClick={() => setIsModalOpen(true)}
                                className="font-bold gap-1.5"
                            >
                                <Plus className="h-4 w-4" />
                                Log Standalone Flight
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleSyncJobSheets}
                                disabled={isPending}
                                className="border-white/15 gap-1.5"
                            >
                                {isPending ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                )}
                                Sync from Job Sheets
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={exportCsv}
                                disabled={filteredLogs.length === 0}
                                className="border-white/15 gap-1.5"
                            >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                                Export CSV
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={exportPdf}
                                disabled={filteredLogs.length === 0}
                                className="border-white/15 gap-1.5"
                            >
                                <FileText className="h-3.5 w-3.5 text-primary" />
                                SACAA Logbook PDF
                            </Button>
                        </div>
                    </div>

                    {syncMessage && (
                        <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                            {syncMessage}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 pt-1">
                        <Input
                            placeholder="Search site, job, pilot..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-black/30 border-white/10 h-9 text-xs lg:col-span-2"
                        />
                        <select
                            value={pilotFilter}
                            onChange={e => setPilotFilter(e.target.value)}
                            className="h-9 rounded-md bg-black/30 border border-white/10 px-2.5 text-xs text-white"
                        >
                            <option value="ALL">All Pilots</option>
                            {pilots.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name || p.email}
                                </option>
                            ))}
                        </select>
                        <select
                            value={droneFilter}
                            onChange={e => setDroneFilter(e.target.value)}
                            className="h-9 rounded-md bg-black/30 border border-white/10 px-2.5 text-xs text-white"
                        >
                            <option value="ALL">All Aircraft</option>
                            {drones.map(d => (
                                <option key={d.id} value={d.id}>
                                    {d.name} ({d.serialNumber})
                                </option>
                            ))}
                        </select>
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="bg-black/30 border-white/10 h-9 text-xs"
                            title="From date"
                        />
                        <div className="flex gap-1.5">
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="bg-black/30 border-white/10 h-9 text-xs flex-1"
                                title="To date"
                            />
                            <select
                                value={sourceFilter}
                                onChange={e => setSourceFilter(e.target.value)}
                                className="h-9 rounded-md bg-black/30 border border-white/10 px-2 text-xs text-white"
                            >
                                <option value="ALL">All</option>
                                <option value="JOB_SHEET">Job</option>
                                <option value="MANUAL">Manual</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Flight Log Table */}
            <Card className="border-white/10 bg-[#141424] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/10 bg-black/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Pilot</th>
                                <th className="py-3 px-4">Aircraft</th>
                                <th className="py-3 px-4">Job / Site</th>
                                <th className="py-3 px-4">Purpose</th>
                                <th className="py-3 px-4">Sorties</th>
                                <th className="py-3 px-4">Duration</th>
                                <th className="py-3 px-4">Source</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="py-12 text-center text-muted-foreground"
                                    >
                                        No flight log entries match your current filter. Flights from completed Job Sheets sync automatically.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(entry => {
                                    const dateLabel = entry.flightDate
                                        ? String(entry.flightDate).split("T")[0]
                                        : "—"
                                    const pilotName =
                                        entry.pilotUser?.name ||
                                        entry.pilotUser?.email ||
                                        entry.pilotNameSnapshot ||
                                        "Unassigned"
                                    const droneName = entry.drone
                                        ? `${entry.drone.name} (${entry.drone.sacaaRegNumber || entry.drone.serialNumber})`
                                        : entry.droneNameSnapshot || "Unassigned"

                                    return (
                                        <tr
                                            key={entry.id}
                                            className="hover:bg-white/[0.02] transition-colors"
                                        >
                                            <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                                                {dateLabel}
                                            </td>
                                            <td className="py-3 px-4 text-white/90">{pilotName}</td>
                                            <td className="py-3 px-4 text-white/90">{droneName}</td>
                                            <td className="py-3 px-4">
                                                {entry.project ? (
                                                    <div>
                                                        <Link
                                                            href={`/projects/${entry.project.id}`}
                                                            className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                                                        >
                                                            {entry.project.name}
                                                            <ExternalLink className="h-3 w-3" />
                                                        </Link>
                                                        {entry.siteLocation && (
                                                            <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                                                                {entry.siteLocation}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        {entry.siteLocation || "Standalone Flight"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold uppercase">
                                                    {String(entry.purpose || "COMMERCIAL_OPS").replace(
                                                        /_/g,
                                                        " "
                                                    )}
                                                </span>
                                                {entry.incidentOccurred && (
                                                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                                                        INCIDENT
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-mono">
                                                {entry.sorties || 1}
                                            </td>
                                            <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-primary" />
                                                    {entry.durationMinutes} min
                                                </span>
                                                <span className="text-muted-foreground font-normal ml-1">
                                                    ({formatFlightHoursAndMinutes(entry.durationMinutes)})
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                {entry.source === "JOB_SHEET" ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                                        Job Sheet
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px] font-bold">
                                                        Manual
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {isAdmin && entry.source === "MANUAL" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteManual(entry.id)}
                                                        className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                                                        title="Delete manual entry"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Log Standalone Flight Dialog */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-lg bg-[#141424] border-white/10 text-white max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plane className="h-5 w-5 text-primary" />
                            Log Standalone Flight
                        </DialogTitle>
                        <DialogDescription>
                            Record training, maintenance check, or site-recon flights not tied to a commercial Job Sheet.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveManualFlight} className="space-y-3">
                        {formError && (
                            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
                                {formError}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Flight Date</Label>
                                <Input
                                    type="date"
                                    value={flightDate}
                                    onChange={e => setFlightDate(e.target.value)}
                                    required
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Purpose</Label>
                                <select
                                    value={purpose}
                                    onChange={e => setPurpose(e.target.value as any)}
                                    className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                                >
                                    <option value="TRAINING">Pilot Training / Currency</option>
                                    <option value="MAINTENANCE_TEST">Maintenance Test Flight</option>
                                    <option value="SITE_RECON">Site Recon / Demo</option>
                                    <option value="COMMERCIAL_OPS">Commercial Wash Ops</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Pilot in Command</Label>
                                <select
                                    value={pilotUserId}
                                    onChange={e => setPilotUserId(e.target.value)}
                                    required
                                    className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                                >
                                    <option value="">Select pilot...</option>
                                    {pilots.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name || p.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Aircraft</Label>
                                <select
                                    value={droneId}
                                    onChange={e => setDroneId(e.target.value)}
                                    required
                                    className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                                >
                                    <option value="">Select aircraft...</option>
                                    {drones.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.name} ({d.serialNumber})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Duration (Minutes)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={durationMinutes}
                                    onChange={e => setDurationMinutes(e.target.value)}
                                    required
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Sorties (Takeoffs)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={sorties}
                                    onChange={e => setSorties(e.target.value)}
                                    required
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Site / Location</Label>
                                <Input
                                    placeholder="e.g. Training Field / Century City"
                                    value={siteLocation}
                                    onChange={e => setSiteLocation(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Optional Project Link</Label>
                                <select
                                    value={projectId}
                                    onChange={e => setProjectId(e.target.value)}
                                    className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                                >
                                    <option value="">None (Standalone)</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {batteries.filter(b => b.status !== "RETIRED").length > 0 && (
                            <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold">
                                        Batteries Flown (Optional)
                                    </Label>
                                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={incrementBatteries}
                                            onChange={e => setIncrementBatteries(e.target.checked)}
                                            className="rounded"
                                        />
                                        Auto +1 charge cycle
                                    </label>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {batteries
                                        .filter(b => b.status !== "RETIRED")
                                        .map(b => {
                                            const active = selectedBatteryIds.includes(b.id)
                                            return (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    onClick={() => toggleBatterySelection(b.id)}
                                                    className={`px-2 py-1 rounded text-[11px] font-bold border transition-all ${
                                                        active
                                                            ? "bg-primary/20 text-primary border-primary/40"
                                                            : "bg-white/5 text-muted-foreground border-white/10 hover:text-white"
                                                    }`}
                                                >
                                                    {b.label} ({b.currentCycles}/{b.maxRecommendedCycles})
                                                </button>
                                            )
                                        })}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label className="text-xs">Weather / Notes</Label>
                            <Textarea
                                rows={2}
                                placeholder="Wind speed, flight checks, observations..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="bg-black/30 border-white/10 text-xs"
                            />
                        </div>

                        <label className="flex items-center gap-2 text-xs text-rose-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={incidentOccurred}
                                onChange={e => setIncidentOccurred(e.target.checked)}
                            />
                            Flag reportable safety observation / incident on this flight
                        </label>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                                Save Flight Log
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
