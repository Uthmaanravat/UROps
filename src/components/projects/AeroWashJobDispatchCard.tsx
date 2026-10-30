"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Smartphone,
    Users,
    Plane,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    FileText,
    ShieldAlert
} from "lucide-react"
import { WeatherBadge } from "@/components/projects/WeatherBadge"
import { assignCrewAndAircraftAction, resolveStandbyChargeAction } from "@/app/(dashboard)/my-jobs/actions"
import type { EvaluatedFlightWeather } from "@/lib/weather"

interface TeamMemberOption {
    id: string
    name: string | null
    email: string
    role: string
}

interface DroneOption {
    id: string
    name: string
    serialNumber: string
    isActive?: boolean
}

interface AeroWashJobDispatchCardProps {
    project: {
        id: string
        name: string
        status: string
        isRecurring?: boolean
        parentProjectId?: string | null
        assignedCrewIds?: string[]
        pilotUserId?: string | null
        droneId?: string | null
    }
    jobSheet?: {
        id: string
        status: string
        startedAt?: string | null
        finishedAt?: string | null
        totalFlightMinutes?: number | null
        standbyFlagged?: boolean
        standbyReason?: string | null
        standbyNotes?: string | null
        standbyStatus?: string | null
        completionReportId?: string | null
    } | null
    teamUsers: TeamMemberOption[]
    drones: DroneOption[]
    flightWeather?: EvaluatedFlightWeather | null
    isOwnerOrAdmin?: boolean
}

export function AeroWashJobDispatchCard({
    project,
    jobSheet,
    teamUsers,
    drones,
    flightWeather,
    isOwnerOrAdmin = true
}: AeroWashJobDispatchCardProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>(project.assignedCrewIds || [])
    const [pilotUserId, setPilotUserId] = useState<string>(project.pilotUserId || "")
    const [droneId, setDroneId] = useState<string>(project.droneId || "")
    const [applyToFutureVisits, setApplyToFutureVisits] = useState<boolean>(false)
    const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null)

    // Standby charge approval state
    const [standbyAmount, setStandbyAmount] = useState<string>("2500")
    const [standbyDesc, setStandbyDesc] = useState<string>(
        jobSheet?.standbyReason === "ACCESS"
            ? "Standby / Return Attendance – Site access unavailable on scheduled attendance"
            : "Standby / Return Attendance – Work stopped on site at client request"
    )
    const [isResolvingStandby, setIsResolvingStandby] = useState(false)

    const toggleCrewMember = (userId: string) => {
        setSelectedCrewIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        )
    }

    const handleSaveDispatch = () => {
        setFeedback(null)
        startTransition(async () => {
            const res = await assignCrewAndAircraftAction({
                projectId: project.id,
                assignedCrewIds: selectedCrewIds,
                pilotUserId: pilotUserId || null,
                droneId: droneId || null,
                applyToFutureVisits
            })
            if (res.success) {
                setFeedback({ type: "ok", msg: "Crew, pilot & aircraft assignment saved." })
                router.refresh()
            } else {
                setFeedback({ type: "err", msg: res.error || "Failed to save assignment." })
            }
        })
    }

    const handleStandbyDecision = async (decision: "APPROVE" | "DISMISS") => {
        setIsResolvingStandby(true)
        setFeedback(null)
        try {
            const res = await resolveStandbyChargeAction({
                projectId: project.id,
                decision,
                amountZar: decision === "APPROVE" ? parseFloat(standbyAmount) : undefined,
                description: standbyDesc
            })
            if (res.success) {
                setFeedback({
                    type: "ok",
                    msg:
                        decision === "APPROVE"
                            ? "Standby / Return Attendance charge added to draft invoice."
                            : "Standby flag dismissed."
                })
                router.refresh()
            } else {
                setFeedback({ type: "err", msg: res.error || "Failed to process standby decision." })
            }
        } finally {
            setIsResolvingStandby(false)
        }
    }

    const showStandbyApproval =
        Boolean(jobSheet?.standbyFlagged) && jobSheet?.standbyStatus === "PENDING_APPROVAL"

    return (
        <div className="border border-orange-500/25 rounded-2xl bg-[#141722] p-6 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                            <Plane className="w-3 h-3" /> AeroWash Site Operations
                        </span>
                        {jobSheet?.status && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">
                                Job Sheet: {jobSheet.status.replace("_", " ")}
                            </span>
                        )}
                    </div>
                    <h3 className="text-lg font-black text-white mt-2">
                        Crew Dispatch, Aircraft & Mobile Job Sheet
                    </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {flightWeather && <WeatherBadge weather={flightWeather} />}
                    <Link href={`/my-jobs/${project.id}`}>
                        <Button className="bg-[#FF6B00] hover:bg-[#E05E00] text-white font-black shadow-lg shadow-orange-500/20">
                            <Smartphone className="w-4 h-4 mr-2" />
                            Open Mobile Job Sheet
                        </Button>
                    </Link>
                    {jobSheet?.completionReportId && (
                        <Link href={`/reports/${jobSheet.completionReportId}`}>
                            <Button variant="outline" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 font-bold">
                                <FileText className="w-4 h-4 mr-2" />
                                Completion Report
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Standby / Return Attendance Charge Approval Alert */}
            {showStandbyApproval && isOwnerOrAdmin && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1 flex-1">
                            <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                                Standby / Return Attendance Charge Flagged by Crew
                            </div>
                            <p className="text-xs text-amber-100/90">
                                Reason: <strong>{jobSheet?.standbyReason === "ACCESS" ? "Site Access Blocked" : "Client Requested Stop"}</strong>
                                {jobSheet?.standbyNotes ? ` — "${jobSheet.standbyNotes}"` : ""}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div>
                            <Label className="text-[10px] uppercase font-bold text-amber-200/80">
                                Charge Amount (ZAR excl. VAT)
                            </Label>
                            <Input
                                type="number"
                                step="50"
                                value={standbyAmount}
                                onChange={e => setStandbyAmount(e.target.value)}
                                className="bg-black/40 border-amber-500/30 text-white h-9 mt-1"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Label className="text-[10px] uppercase font-bold text-amber-200/80">
                                Invoice Line Description
                            </Label>
                            <Input
                                value={standbyDesc}
                                onChange={e => setStandbyDesc(e.target.value)}
                                className="bg-black/40 border-amber-500/30 text-white h-9 mt-1"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={isResolvingStandby}
                            onClick={() => handleStandbyDecision("DISMISS")}
                            className="border-white/15 text-slate-300 hover:bg-white/5"
                        >
                            Dismiss (No Charge)
                        </Button>
                        <Button
                            size="sm"
                            disabled={isResolvingStandby}
                            onClick={() => handleStandbyDecision("APPROVE")}
                            className="bg-amber-500 hover:bg-amber-600 text-black font-black"
                        >
                            {isResolvingStandby && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                            Approve & Add to Draft Invoice
                        </Button>
                    </div>
                </div>
            )}

            {/* Pilot & Aircraft selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Assigned Pilot (RPAS PIC)
                    </Label>
                    <select
                        value={pilotUserId}
                        onChange={e => {
                            const val = e.target.value
                            setPilotUserId(val)
                            if (val && !selectedCrewIds.includes(val)) {
                                setSelectedCrewIds(prev => [...prev, val])
                            }
                        }}
                        className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-orange-500"
                    >
                        <option value="" className="bg-slate-900">— Select Pilot —</option>
                        {teamUsers.map(u => (
                            <option key={u.id} value={u.id} className="bg-slate-900">
                                {u.name || u.email} ({u.role})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            Assigned Aircraft (Drone)
                        </Label>
                        <Link href="/settings" className="text-[11px] text-orange-400 hover:underline">
                            Manage Drones in Settings
                        </Link>
                    </div>
                    <select
                        value={droneId}
                        onChange={e => setDroneId(e.target.value)}
                        className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-orange-500"
                    >
                        <option value="" className="bg-slate-900">— Select Aircraft —</option>
                        {drones.map(d => (
                            <option key={d.id} value={d.id} className="bg-slate-900">
                                {d.name} — SN: {d.serialNumber}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Assigned Crew Checkboxes */}
            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-orange-400" />
                    Assigned On-Site Crew (Sees this job on &ldquo;My Jobs Today&rdquo; — no prices)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                    {teamUsers.map(u => {
                        const checked = selectedCrewIds.includes(u.id)
                        return (
                            <label
                                key={u.id}
                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                                    checked
                                        ? "bg-orange-500/15 border-orange-500/40 text-white"
                                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCrewMember(u.id)}
                                    className="h-4 w-4 accent-[#FF6B00] rounded"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold truncate">{u.name || u.email}</div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">{u.role}</div>
                                </div>
                            </label>
                        )
                    })}
                </div>
            </div>

            {(project.isRecurring || project.parentProjectId) && (
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={applyToFutureVisits}
                        onChange={e => setApplyToFutureVisits(e.target.checked)}
                        className="h-4 w-4 accent-[#FF6B00] rounded"
                    />
                    Apply crew, pilot & aircraft assignment to future recurring contract visits
                </label>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
                <div className="text-xs">
                    {feedback?.type === "ok" && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> {feedback.msg}
                        </span>
                    )}
                    {feedback?.type === "err" && (
                        <span className="inline-flex items-center gap-1.5 text-red-400 font-semibold">
                            <AlertTriangle className="w-4 h-4" /> {feedback.msg}
                        </span>
                    )}
                    {!feedback && jobSheet?.totalFlightMinutes != null && (
                        <span className="text-slate-400">
                            Recorded flight time: <strong className="text-white">{jobSheet.totalFlightMinutes} mins</strong>
                        </span>
                    )}
                </div>

                <Button
                    onClick={handleSaveDispatch}
                    disabled={isPending}
                    className="bg-white/10 hover:bg-white/15 text-white border border-white/15 font-bold"
                >
                    {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Crew & Aircraft Assignment
                </Button>
            </div>
        </div>
    )
}
