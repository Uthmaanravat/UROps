"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    Navigation,
    Phone,
    MessageCircle,
    ShieldCheck,
    Play,
    Pause,
    CheckCircle2,
    Camera,
    AlertTriangle,
    CloudOff,
    RefreshCw,
    CalendarClock,
    Plane,
    UserCheck,
    Hand,
    Clock,
    Eraser,
    FileCheck2,
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { WeatherBadge } from "@/components/projects/WeatherBadge"
import {
    compressJobPhotoFile,
    enqueueOfflinePhoto,
    listQueuedPhotos,
    removeQueuedPhoto,
    recordQueuedPhotoFailure,
    PHOTO_QUEUE_EVENT,
    type QueuedJobPhoto
} from "@/lib/offline-photo-queue"
import {
    saveJobPreFlightAndMetaAction,
    startJobAction,
    pauseJobAction,
    resumeJobAction,
    rescheduleWeatherPausedJobAction,
    uploadJobPhotoAction,
    finishJobAction,
    type PreFlightChecklistState
} from "@/app/(dashboard)/my-jobs/actions"

const CHECKLIST_ITEMS: Array<{ key: keyof PreFlightChecklistState; label: string; detail: string }> = [
    { key: "weatherChecked", label: "Weather checked", detail: "Sustained wind, gusts, spray drift & daylight VFR within limits" },
    { key: "exclusionZoneSetUp", label: "Exclusion zone set up", detail: "Cones, caution tape & ground drop-zone perimeter secured" },
    { key: "ppeOn", label: "PPE on", detail: "Hi-vis vest, hard hat, eye protection & non-slip footwear worn" },
    { key: "spotterInPosition", label: "Spotter in position", detail: "Visual observer stationed with clear line of sight & comms" },
    { key: "aircraftCheck", label: "Aircraft check (props, battery, RTH set)", detail: "Propellers locked, airframe inspected, battery voltage & RTH verified" },
    { key: "waterPumpPressurised", label: "Water / pump pressurised", detail: "Hose tether clear, pure water supply & pump pressure tested" }
]

function hhmmNow(): string {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function diffHhmmMinutes(start?: string, end?: string): number | undefined {
    if (!start || !end) return undefined
    const [sh, sm] = start.split(":").map(Number)
    const [eh, em] = end.split(":").map(Number)
    if ([sh, sm, eh, em].some(isNaN)) return undefined
    const diff = (eh * 60 + em) - (sh * 60 + sm)
    return diff > 0 ? diff : 1
}

export function MobileJobSheetClient({
    job,
    currentUserRole
}: {
    job: any
    currentUserRole: string
}) {
    const router = useRouter()
    const [status, setStatus] = useState<string>(job.jobSheet.status || "NOT_STARTED")
    const [checklist, setChecklist] = useState<PreFlightChecklistState>({
        weatherChecked: Boolean(job.jobSheet.checklist?.weatherChecked),
        exclusionZoneSetUp: Boolean(job.jobSheet.checklist?.exclusionZoneSetUp),
        ppeOn: Boolean(job.jobSheet.checklist?.ppeOn),
        spotterInPosition: Boolean(job.jobSheet.checklist?.spotterInPosition),
        aircraftCheck: Boolean(job.jobSheet.checklist?.aircraftCheck),
        waterPumpPressurised: Boolean(job.jobSheet.checklist?.waterPumpPressurised)
    })

    const [pilotUserId, setPilotUserId] = useState<string>(job.jobSheet.pilotUserId || "")
    const [droneId, setDroneId] = useState<string>(job.jobSheet.droneId || "")
    const [elevationFlights, setElevationFlights] = useState<
        Record<string, { flightStart?: string; flightEnd?: string; durationMinutes?: number }>
    >(job.jobSheet.elevationFlights || {})
    const [totalFlightMinutes, setTotalFlightMinutes] = useState<string>(
        job.jobSheet.totalFlightMinutes != null ? String(job.jobSheet.totalFlightMinutes) : ""
    )

    const [timeLogs, setTimeLogs] = useState<any[]>(job.jobSheet.timeLogs || [])
    const [elevationPhotos, setElevationPhotos] = useState<Record<string, { before: any[]; after: any[] }>>(
        job.jobSheet.elevationPhotos || {}
    )
    const [issuePhotos, setIssuePhotos] = useState<any[]>(job.jobSheet.issuePhotos || [])
    const [issuesNotes, setIssuesNotes] = useState<string>(job.jobSheet.issuesNotes || "")

    // Pause & Reschedule states
    const [pauseModalOpen, setPauseModalOpen] = useState(false)
    const [pauseReason, setPauseReason] = useState<"WIND" | "RAIN" | "CLIENT_REQUEST" | "ACCESS">("WIND")
    const [pauseNote, setPauseNote] = useState("")
    const [weatherRescheduleSuggestion, setWeatherRescheduleSuggestion] = useState<{
        suggestedDate: string
        summary: string
    } | null>(null)
    const [rescheduleDateInput, setRescheduleDateInput] = useState("")
    const [standbyBannerVisible, setStandbyBannerVisible] = useState<boolean>(Boolean(job.jobSheet.standbyFlagged))

    // Offline photo queue state
    const [queuedPhotos, setQueuedPhotos] = useState<QueuedJobPhoto[]>([])
    const [isSyncingQueue, setIsSyncingQueue] = useState(false)
    const [isOnline, setIsOnline] = useState(true)
    const [crewConfirmedPendingPhotos, setCrewConfirmedPendingPhotos] = useState(false)

    // Client sign-off state
    const [signOffName, setSignOffName] = useState<string>(job.jobSheet.signOffName || job.contactName || "")
    const [clientUnavailable, setClientUnavailable] = useState<boolean>(Boolean(job.jobSheet.clientUnavailable))
    const [clientUnavailableReason, setClientUnavailableReason] = useState<string>(
        job.jobSheet.clientUnavailableReason || ""
    )
    const [hasSignatureStroke, setHasSignatureStroke] = useState<boolean>(Boolean(job.jobSheet.signOffSignature))
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const drawingRef = useRef(false)
    const metaSaveTimerRef = useRef<any>(null)
    const flushingRef = useRef(false)

    // Feedback & loading
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [toastMsg, setToastMsg] = useState<string | null>(null)
    const [completionResult, setCompletionResult] = useState<{
        reportId?: string | null
        draftedInvoiceId?: string | null
        draftedInvoiceNumber?: string | null
    } | null>(
        job.jobSheet.completionReportId
            ? {
                reportId: job.jobSheet.completionReportId,
                draftedInvoiceId: job.adminLinks?.draftBalanceInvoiceHref?.replace("/invoices/", "") || null,
                draftedInvoiceNumber: job.adminLinks?.draftBalanceInvoiceNumber || null
            }
            : null
    )

    const allChecklistTicked = CHECKLIST_ITEMS.every(i => checklist[i.key] === true)

    // Refresh IndexedDB queue for this job
    const refreshQueue = useCallback(async () => {
        const list = await listQueuedPhotos(job.projectId)
        setQueuedPhotos(list)
    }, [job.projectId])

    const flushOfflinePhotos = useCallback(async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            setIsOnline(false)
            return
        }
        if (flushingRef.current) return
        const initialList = await listQueuedPhotos(job.projectId)
        if (initialList.length === 0) return

        flushingRef.current = true
        setIsSyncingQueue(true)
        try {
            const attemptedIds = new Set<string>()
            while (true) {
                if (typeof navigator !== "undefined" && !navigator.onLine) break
                const list = (await listQueuedPhotos(job.projectId)).filter(p => !attemptedIds.has(p.id))
                if (list.length === 0) break
                for (const item of list) {
                    attemptedIds.add(item.id)
                    try {
                        const res = await uploadJobPhotoAction({
                            projectId: item.projectId,
                            photoId: item.id,
                            kind: item.kind,
                            elevationKey: item.elevationKey,
                            caption: item.caption,
                            dataUrl: item.dataUrl,
                            takenAt: item.takenAt
                        })
                        if (res.success && res.photo) {
                            await removeQueuedPhoto(item.id)
                            if (item.kind === "ISSUE") {
                                setIssuePhotos(prev => [...prev.filter(p => p.id !== item.id), res.photo])
                            } else {
                                const key = item.elevationKey || "elev-1"
                                const slotKey = item.kind === "ELEVATION_BEFORE" ? "before" : "after"
                                setElevationPhotos(prev => {
                                    const cur = prev[key] || { before: [], after: [] }
                                    return {
                                        ...prev,
                                        [key]: {
                                            ...cur,
                                            [slotKey]: [...(cur[slotKey] || []).filter((p: any) => p.id !== item.id), res.photo]
                                        }
                                    }
                                })
                            }
                        } else {
                            await recordQueuedPhotoFailure(item.id, res.error || "Upload failed")
                        }
                    } catch (netErr: any) {
                        await recordQueuedPhotoFailure(item.id, netErr?.message || "Network error")
                    }
                    await refreshQueue()
                }
            }
        } finally {
            flushingRef.current = false
            setIsSyncingQueue(false)
            await refreshQueue()
        }
    }, [job.projectId, refreshQueue])

    useEffect(() => {
        setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true)
        refreshQueue()

        const onOnline = () => {
            setIsOnline(true)
            flushOfflinePhotos()
        }
        const onOffline = () => setIsOnline(false)
        const onQueueEvent = () => refreshQueue()

        window.addEventListener("online", onOnline)
        window.addEventListener("offline", onOffline)
        window.addEventListener(PHOTO_QUEUE_EVENT, onQueueEvent)
        const interval = window.setInterval(() => {
            if (navigator.onLine) flushOfflinePhotos()
        }, 15000)

        return () => {
            window.removeEventListener("online", onOnline)
            window.removeEventListener("offline", onOffline)
            window.removeEventListener(PHOTO_QUEUE_EVENT, onQueueEvent)
            window.clearInterval(interval)
        }
    }, [refreshQueue, flushOfflinePhotos])

    // Auto-roll up elevation flight durations into totalFlightMinutes
    const recomputeTotalFlightMinutes = (
        nextMap: Record<string, { flightStart?: string; flightEnd?: string; durationMinutes?: number }>
    ) => {
        let sum = 0
        for (const v of Object.values(nextMap)) {
            if (v?.durationMinutes && v.durationMinutes > 0) sum += v.durationMinutes
        }
        if (sum > 0) {
            setTotalFlightMinutes(String(sum))
        }
    }

    const handleChecklistToggle = (key: keyof PreFlightChecklistState) => {
        setChecklist(prev => {
            const next = { ...prev, [key]: !prev[key] }
            if (typeof window !== "undefined") {
                localStorage.setItem(`urops_checklist_${job.projectId}`, JSON.stringify(next))
            }
            if (metaSaveTimerRef.current) clearTimeout(metaSaveTimerRef.current)
            metaSaveTimerRef.current = setTimeout(() => {
                saveJobPreFlightAndMetaAction({
                    projectId: job.projectId,
                    checklist: next,
                    pilotUserId,
                    droneId
                }).catch(() => null)
            }, 400)
            return next
        })
        setErrorMsg(null)
    }

    const handleStartJob = async () => {
        if (!allChecklistTicked) {
            setErrorMsg("Tick all 6 pre-flight safety items before starting the job.")
            return
        }
        if (metaSaveTimerRef.current) { clearTimeout(metaSaveTimerRef.current); metaSaveTimerRef.current = null }
        setBusyAction("START")
        setErrorMsg(null)
        try {
            const res = await startJobAction({
                projectId: job.projectId,
                checklist,
                pilotUserId: pilotUserId || null,
                droneId: droneId || null
            })
            if (!res.success) {
                setErrorMsg(res.error || "Could not start job")
            } else {
                setStatus("IN_PROGRESS")
                setTimeLogs(prev => [
                    ...prev,
                    { action: "START", timestamp: res.startedAt || new Date().toISOString() }
                ])
                setToastMsg("Job started — flight timer active.")
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Network error starting job")
        } finally {
            setBusyAction(null)
        }
    }

    const handleConfirmPause = async () => {
        setBusyAction("PAUSE")
        setErrorMsg(null)
        try {
            const res = await pauseJobAction({
                projectId: job.projectId,
                reason: pauseReason,
                note: pauseNote
            })
            if (!res.success) {
                setErrorMsg(res.error || "Failed to pause job")
            } else {
                setStatus("PAUSED")
                setPauseModalOpen(false)
                setTimeLogs(prev => [
                    ...prev,
                    { action: "PAUSE", reason: pauseReason, note: pauseNote, timestamp: new Date().toISOString() }
                ])
                setPauseNote("")

                if (res.isWeatherReason && res.suggestedDate) {
                    setWeatherRescheduleSuggestion({
                        suggestedDate: res.suggestedDate,
                        summary: res.suggestedWeatherSummary || "Next available flyable window"
                    })
                    setRescheduleDateInput(res.suggestedDate)
                }
                if (res.isStandbyReason) {
                    setStandbyBannerVisible(true)
                    setToastMsg("Job paused — possible Standby / Return Attendance charge flagged for owner review.")
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Failed to pause job")
        } finally {
            setBusyAction(null)
        }
    }

    const handleResumeJob = async () => {
        setBusyAction("RESUME")
        setErrorMsg(null)
        try {
            const res = await resumeJobAction(job.projectId)
            if (res.success) {
                setStatus("IN_PROGRESS")
                setWeatherRescheduleSuggestion(null)
                setTimeLogs(prev => [...prev, { action: "RESUME", timestamp: new Date().toISOString() }])
            } else {
                setErrorMsg(res.error || "Could not resume job")
            }
        } finally {
            setBusyAction(null)
        }
    }

    const handleOneTapWeatherReschedule = async () => {
        if (!rescheduleDateInput) return
        setBusyAction("RESCHEDULE")
        setErrorMsg(null)
        try {
            const res = await rescheduleWeatherPausedJobAction({
                projectId: job.projectId,
                newDateStr: rescheduleDateInput
            })
            if (!res.success) {
                setErrorMsg(res.error || "Could not reschedule")
            } else {
                setStatus("RESCHEDULED")
                setToastMsg(`Rescheduled to ${rescheduleDateInput} — No charge (per weather term).`)
                setTimeLogs(prev => [
                    ...prev,
                    {
                        action: "RESCHEDULE_WEATHER",
                        targetDate: rescheduleDateInput,
                        timestamp: new Date().toISOString()
                    }
                ])
            }
        } finally {
            setBusyAction(null)
        }
    }

    const handlePhotoCapture = async (
        files: FileList | null,
        kind: "ELEVATION_BEFORE" | "ELEVATION_AFTER" | "ISSUE",
        elevationKey?: string
    ) => {
        if (!files || files.length === 0) return
        setErrorMsg(null)

        for (const file of Array.from(files)) {
            const compressedDataUrl = await compressJobPhotoFile(file, 1280, 0.75)
            const photoId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            const queuedItem: QueuedJobPhoto = {
                id: photoId,
                projectId: job.projectId,
                kind,
                elevationKey,
                dataUrl: compressedDataUrl,
                takenAt: new Date().toISOString(),
                attempts: 0
            }

            // Always persist in IndexedDB first so slow/dropped mobile signal never loses a photo!
            await enqueueOfflinePhoto(queuedItem)
        }

        await refreshQueue()

        // Immediately flush if online
        if (typeof navigator === "undefined" || navigator.onLine) {
            await flushOfflinePhotos()
        } else {
            setToastMsg("Offline — photo saved on phone and queued for automatic upload.")
        }
    }

    const handleElevationFlightMark = (
        elevKey: string,
        field: "flightStart" | "flightEnd",
        value?: string
    ) => {
        const val = value !== undefined ? value : hhmmNow()
        setElevationFlights(prev => {
            const existing = prev[elevKey] || {}
            const updatedSlot = { ...existing, [field]: val }
            updatedSlot.durationMinutes = diffHhmmMinutes(updatedSlot.flightStart, updatedSlot.flightEnd)
            const nextMap = { ...prev, [elevKey]: updatedSlot }
            recomputeTotalFlightMinutes(nextMap)
            if (metaSaveTimerRef.current) clearTimeout(metaSaveTimerRef.current)
            metaSaveTimerRef.current = setTimeout(() => {
                saveJobPreFlightAndMetaAction({
                    projectId: job.projectId,
                    elevationFlights: nextMap
                }).catch(() => null)
            }, 400)
            return nextMap
        })
    }

    // Touch + Mouse signature canvas handlers
    const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        if ("touches" in e && e.touches.length > 0) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            }
        }
        const me = e as React.MouseEvent
        return {
            x: (me.clientX - rect.left) * scaleX,
            y: (me.clientY - rect.top) * scaleY
        }
    }

    const startSignatureDraw = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        drawingRef.current = true
        const { x, y } = getCanvasCoords(e)
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2.5
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    const moveSignatureDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!drawingRef.current) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        if ("touches" in e) e.preventDefault()
        const { x, y } = getCanvasCoords(e)
        ctx.lineTo(x, y)
        ctx.stroke()
        if (!hasSignatureStroke) setHasSignatureStroke(true)
    }

    const endSignatureDraw = () => {
        drawingRef.current = false
    }

    const clearSignature = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setHasSignatureStroke(false)
    }

    const handleFinishJob = async () => {
        setErrorMsg(null)
        if (queuedPhotos.length > 0 && !crewConfirmedPendingPhotos) {
            setErrorMsg(
                `${queuedPhotos.length} photo(s) are still waiting to upload. Tap "Upload Now" or tick the confirmation box below to finish anyway.`
            )
            return
        }

        let sigDataUrl = job.jobSheet.signOffSignature || ""
        if (!clientUnavailable && canvasRef.current && hasSignatureStroke) {
            sigDataUrl = canvasRef.current.toDataURL("image/png")
        }

        if (metaSaveTimerRef.current) { clearTimeout(metaSaveTimerRef.current); metaSaveTimerRef.current = null }
        setBusyAction("FINISH")
        try {
            const res = await finishJobAction({
                projectId: job.projectId,
                pilotUserId: pilotUserId || null,
                droneId: droneId || null,
                elevationFlights,
                totalFlightMinutes: totalFlightMinutes ? parseInt(totalFlightMinutes, 10) : null,
                issuesNotes,
                signOffName,
                signOffSignature: sigDataUrl,
                clientUnavailable,
                clientUnavailableReason,
                pendingOfflinePhotosCount: queuedPhotos.length,
                crewConfirmedPendingPhotos
            })

            if (!res.success) {
                setErrorMsg(res.error || "Could not finish job")
            } else {
                setStatus("COMPLETED")
                setCompletionResult({
                    reportId: res.reportId,
                    draftedInvoiceId: res.draftedInvoiceId,
                    draftedInvoiceNumber: res.draftedInvoiceNumber
                })
                setToastMsg("Job completed! Completion report generated & balance invoice drafted.")
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Network error completing job")
        } finally {
            setBusyAction(null)
        }
    }

    return (
        <div className="max-w-lg mx-auto space-y-4 pb-28">
            {/* Top Mobile Nav */}
            <div className="flex items-center justify-between gap-2">
                <Link
                    href="/my-jobs"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10"
                >
                    <ArrowLeft className="h-4 w-4 text-primary" />
                    My Jobs
                </Link>

                <span
                    className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider border ${
                        status === "IN_PROGRESS"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : status === "PAUSED"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : status === "COMPLETED"
                                    ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                                    : "bg-white/10 text-zinc-200 border-white/15"
                    }`}
                >
                    {status.replace(/_/g, " ")}
                </span>
            </div>

            {/* Sticky Offline Photo Queue Indicator */}
            {(!isOnline || queuedPhotos.length > 0) && (
                <div className="sticky top-14 z-30 rounded-2xl border border-amber-500/50 bg-[#241A0B]/95 backdrop-blur-md p-3.5 shadow-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-amber-200">
                        <CloudOff className="h-4 w-4 text-amber-400 shrink-0" />
                        <div>
                            <p className="font-black text-amber-300">
                                {queuedPhotos.length} photo{queuedPhotos.length === 1 ? "" : "s"} waiting to upload
                            </p>
                            <p className="text-[11px] text-amber-200/80">
                                {isOnline
                                    ? "Connection active — ready to sync"
                                    : "Offline — saved in phone storage, will upload automatically"}
                            </p>
                        </div>
                    </div>
                    {queuedPhotos.length > 0 && (
                        <Button
                            type="button"
                            size="sm"
                            disabled={isSyncingQueue || !isOnline}
                            onClick={flushOfflinePhotos}
                            className="h-10 px-3 bg-amber-500 text-black font-black text-xs hover:bg-amber-400 shrink-0"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isSyncingQueue ? "animate-spin" : ""}`} />
                            {isSyncingQueue ? "Syncing..." : "Upload Now"}
                        </Button>
                    )}
                </div>
            )}

            {/* Toast & Error Alerts */}
            {toastMsg && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-xs font-bold text-emerald-200 flex items-center justify-between gap-2">
                    <span>{toastMsg}</span>
                    <button type="button" onClick={() => setToastMsg(null)} className="text-emerald-300 font-black">✕</button>
                </div>
            )}
            {errorMsg && (
                <div className="rounded-2xl border border-red-500/50 bg-red-950/60 px-4 py-3 text-xs font-bold text-red-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* 1. Client, Site, Maps, Call/WhatsApp, PO #, Weather */}
            <div className="rounded-2xl border border-white/10 bg-[#141422] p-4 shadow-xl space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-primary">
                            {job.clientName}
                        </p>
                        <h1 className="text-xl font-black text-white leading-tight mt-0.5">
                            {job.jobName}
                        </h1>
                    </div>
                    <span className="shrink-0 rounded-lg bg-primary/15 border border-primary/30 px-2.5 py-1 font-mono text-xs font-black text-primary">
                        PO: {job.poNumber}
                    </span>
                </div>

                <div className="text-xs text-zinc-300 space-y-1">
                    <p className="font-semibold text-white">{job.siteAddress}</p>
                    {job.scheduledDate && (
                        <p className="text-zinc-400">
                            Scheduled:{" "}
                            <strong className="text-zinc-200">
                                {new Date(job.scheduledDate).toLocaleDateString("en-ZA", {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric"
                                })}
                            </strong>
                        </p>
                    )}
                </div>

                {/* Live Weather Badge */}
                <div>
                    <WeatherBadge weather={job.flightWeather} />
                </div>

                {/* Big Phone Action Buttons: Google Maps, Call, WhatsApp */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                    <a
                        href={job.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-primary text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-primary/20 active:scale-[0.99]"
                    >
                        <Navigation className="h-4 w-4" />
                        Google Maps Directions
                    </a>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                        <p className="text-[11px] font-bold text-zinc-400">
                            On-Site Contact: <strong className="text-white">{job.contactName}</strong>
                            {job.contactPhone ? ` · ${job.contactPhone}` : ""}
                        </p>
                        {job.contactPhone ? (
                            <div className="grid grid-cols-2 gap-2">
                                <a
                                    href={`tel:${job.contactPhone}`}
                                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-wider"
                                >
                                    <Phone className="h-4 w-4" />
                                    Call
                                </a>
                                {job.whatsappUrl && (
                                    <a
                                        href={job.whatsappUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#25D366] text-black font-black text-xs uppercase tracking-wider"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                        WhatsApp
                                    </a>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs italic text-zinc-500">No phone number on file for site contact.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Scope by Elevation, Manual by Crew, Exclusions & Condition Flags */}
            <div className="rounded-2xl border border-white/10 bg-[#141422] p-4 shadow-xl space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Site Scope, Manual Areas &amp; Hazards
                </h2>

                <div className="space-y-2.5">
                    {job.elevations.map((el: any) => (
                        <div key={el.key} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-black text-white">{el.name}</span>
                                {el.dimensions && (
                                    <span className="text-[11px] font-mono text-zinc-400">{el.dimensions}</span>
                                )}
                            </div>
                            <ul className="space-y-1 text-xs text-zinc-300 list-disc pl-4">
                                {el.scopeLines.map((line: string, idx: number) => (
                                    <li key={idx}>{line}</li>
                                ))}
                            </ul>

                            {el.manualAreas && el.manualAreas.length > 0 && (
                                <div className="rounded-lg border border-primary/40 bg-primary/10 p-2.5 space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                                        <Hand className="h-3.5 w-3.5" /> Manual by Crew
                                    </p>
                                    {el.manualAreas.map((m: string, idx: number) => (
                                        <p key={idx} className="text-xs font-semibold text-orange-100">
                                            • {m}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Exclusions */}
                <div className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-1.5">
                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                        Exclusions (Do Not Clean / Excluded)
                    </p>
                    <ul className="space-y-1 text-xs text-zinc-300 list-disc pl-4">
                        {job.exclusionsList.map((ex: string, idx: number) => (
                            <li key={idx}>{ex}</li>
                        ))}
                    </ul>
                </div>

                {/* Condition Flags with Pre-Work Photos */}
                {job.conditionFlags && job.conditionFlags.length > 0 && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 space-y-2.5">
                        <p className="text-[11px] font-black uppercase tracking-wider text-rose-300">
                            Recorded Pre-Existing Condition Flags
                        </p>
                        {job.conditionFlags.map((flag: any) => (
                            <div key={flag.id} className="rounded-lg bg-black/40 p-2.5 space-y-2 border border-white/5">
                                <div className="text-xs">
                                    <span className="font-black text-rose-200">{flag.elevationName}: </span>
                                    <span className="font-bold text-white">{flag.type}</span>
                                    {flag.location && <span className="text-zinc-300"> ({flag.location})</span>}
                                    {flag.notes && <p className="text-zinc-400 mt-0.5">{flag.notes}</p>}
                                </div>
                                {flag.photos && flag.photos.length > 0 && (
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                        {flag.photos.map((ph: any) => (
                                            <a
                                                key={ph.id}
                                                href={ph.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0"
                                            >
                                                <img
                                                    src={ph.url}
                                                    alt={ph.caption}
                                                    className="h-16 w-20 rounded-lg object-cover border border-white/15"
                                                />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. Pilot & Aircraft Selection (Feeds Phase 3 Flight Log) */}
            <div className="rounded-2xl border border-white/10 bg-[#141422] p-4 shadow-xl space-y-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Plane className="h-4 w-4 text-primary" />
                    Flight Crew &amp; Aircraft
                </h2>
                <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-primary" /> Pilot in Command
                        </Label>
                        <select
                            aria-label="Pilot in Command"
                            value={pilotUserId}
                            onChange={async (e) => {
                                const val = e.target.value
                                setPilotUserId(val)
                                await saveJobPreFlightAndMetaAction({ projectId: job.projectId, pilotUserId: val })
                            }}
                            className="flex min-h-[48px] w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm font-bold text-white"
                        >
                            <option value="">Select pilot...</option>
                            {job.pilots.map((p: any) => (
                                <option key={p.id} value={p.id}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                            <Plane className="h-3.5 w-3.5 text-primary" /> Aircraft (Name / Serial)
                        </Label>
                        <select
                            aria-label="Aircraft"
                            value={droneId}
                            onChange={async (e) => {
                                const val = e.target.value
                                setDroneId(val)
                                await saveJobPreFlightAndMetaAction({ projectId: job.projectId, droneId: val })
                            }}
                            className="flex min-h-[48px] w-full rounded-xl border border-white/15 bg-black/40 px-3 text-sm font-bold text-white"
                        >
                            <option value="">Select aircraft...</option>
                            {job.drones.map((d: any) => (
                                <option key={d.id} value={d.id}>
                                    {d.name} — SN: {d.serialNumber}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 4. Pre-Flight Checklist (All 6 Required Before Start Job) */}
            <div className="rounded-2xl border border-white/10 bg-[#141422] p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Pre-Flight Safety Checklist
                    </h2>
                    <span className="text-xs font-black text-primary">
                        {CHECKLIST_ITEMS.filter(i => checklist[i.key]).length} / 6
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">
                    All 6 checks are mandatory before &ldquo;Start Job&rdquo; unlocks.
                </p>

                <div className="space-y-2">
                    {CHECKLIST_ITEMS.map((item) => {
                        const checked = checklist[item.key]
                        return (
                            <button
                                key={item.key}
                                type="button"
                                disabled={status === "COMPLETED"}
                                onClick={() => handleChecklistToggle(item.key)}
                                className={`w-full min-h-[58px] rounded-xl border p-3 text-left flex items-start gap-3 transition-all ${
                                    checked
                                        ? "border-emerald-500/50 bg-emerald-500/10 text-white"
                                        : "border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5"
                                }`}
                            >
                                <div
                                    className={`mt-0.5 h-6 w-6 shrink-0 rounded-lg border-2 flex items-center justify-center font-black text-xs ${
                                        checked
                                            ? "border-emerald-400 bg-emerald-500 text-black"
                                            : "border-zinc-500 bg-transparent"
                                    }`}
                                >
                                    {checked ? "✓" : ""}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black leading-snug">{item.label}</p>
                                    <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">{item.detail}</p>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 5. Start / Pause / Resume Controls + Weather Reschedule + Standby Banner */}
            <div className="rounded-2xl border border-white/10 bg-[#141422] p-4 shadow-xl space-y-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Job Execution &amp; Flight Timer
                </h2>

                {(status === "NOT_STARTED" || status === "RESCHEDULED") && (
                    <div className="space-y-2">
                        <Button
                            type="button"
                            disabled={!allChecklistTicked || busyAction === "START"}
                            onClick={handleStartJob}
                            className="w-full min-h-[58px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base uppercase tracking-wider shadow-lg disabled:opacity-40"
                        >
                            {busyAction === "START" ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Play className="mr-2 h-5 w-5 fill-current" />
                            )}
                            {allChecklistTicked ? "Start Job" : "Complete Pre-Flight Checklist to Start"}
                        </Button>
                    </div>
                )}

                {status === "IN_PROGRESS" && (
                    <div className="space-y-2.5">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-bold text-emerald-200 flex items-center justify-between">
                            <span>Job in progress — times logged automatically</span>
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                        </div>
                        <Button
                            type="button"
                            onClick={() => setPauseModalOpen(true)}
                            className="w-full min-h-[54px] rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider"
                        >
                            <Pause className="mr-2 h-5 w-5 fill-current" />
                            Pause Job (Wind / Rain / Client / Access)
                        </Button>
                    </div>
                )}

                {status === "PAUSED" && (
                    <div className="space-y-3">
                        <Button
                            type="button"
                            disabled={busyAction === "RESUME"}
                            onClick={handleResumeJob}
                            className="w-full min-h-[54px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm uppercase tracking-wider"
                        >
                            {busyAction === "RESUME" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
                            Resume Job
                        </Button>

                        {/* 1-Tap Weather Reschedule Card */}
                        {weatherRescheduleSuggestion && (
                            <div className="rounded-xl border border-sky-500/40 bg-sky-950/30 p-3.5 space-y-3">
                                <div className="flex items-start gap-2.5">
                                    <CalendarClock className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
                                    <div className="text-xs">
                                        <p className="font-black uppercase tracking-wider text-sky-300">
                                            Paused for Weather — 1-Tap Reschedule
                                        </p>
                                        <p className="text-zinc-200 mt-0.5">
                                            Suggested next available date:{" "}
                                            <strong className="text-white">{weatherRescheduleSuggestion.suggestedDate}</strong>
                                        </p>
                                        <p className="text-[11px] text-sky-200/80 mt-0.5">
                                            {weatherRescheduleSuggestion.summary}
                                        </p>
                                        <p className="text-[11px] font-bold text-emerald-300 mt-1">
                                            ✓ Rescheduled at no charge (per AeroWash weather term)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        type="date"
                                        value={rescheduleDateInput}
                                        onChange={e => setRescheduleDateInput(e.target.value)}
                                        className="h-12 bg-black/40 border-white/15 text-sm font-bold"
                                    />
                                    <Button
                                        type="button"
                                        disabled={busyAction === "RESCHEDULE"}
                                        onClick={handleOneTapWeatherReschedule}
                                        className="h-12 px-4 bg-sky-400 hover:bg-sky-300 text-black font-black text-xs uppercase shrink-0"
                                    >
                                        {busyAction === "RESCHEDULE" ? "..." : "Reschedule"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {standbyBannerVisible && (
                    <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-xs text-orange-200 font-semibold">
                        ⚠️ Client stop / restricted site access recorded — flagged for owner review (possible Standby / Return Attendance charge).
                    </div>
                )}

                {/* Pause Reason Modal */}
                {pauseModalOpen && (
                    <div className="rounded-xl border border-amber-500/40 bg-black/70 p-4 space-y-3">
                        <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                            Select Pause / Stop Reason
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: "WIND", label: "💨 High Wind" },
                                { id: "RAIN", label: "🌧️ Rain" },
                                { id: "CLIENT_REQUEST", label: "🛑 Client Request" },
                                { id: "ACCESS", label: "🚧 Site Access" }
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setPauseReason(opt.id as any)}
                                    className={`min-h-[48px] rounded-xl border text-xs font-black transition-all ${
                                        pauseReason === opt.id
                                            ? "border-amber-400 bg-amber-500 text-black"
                                            : "border-white/15 bg-white/5 text-white"
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <Input
                            placeholder="Optional note (e.g. Gusts hit 36 km/h on North face / Gate locked)"
                            value={pauseNote}
                            onChange={e => setPauseNote(e.target.value)}
                            className="h-11 bg-black/40 border-white/15 text-xs"
                        />
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setPauseModalOpen(false)}
                                className="flex-1 h-11 text-xs font-bold"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={busyAction === "PAUSE"}
                                onClick={handleConfirmPause}
                                className="flex-1 h-11 bg-amber-500 text-black font-black text-xs uppercase"
                            >
                                {busyAction === "PAUSE" ? "Saving..." : "Confirm Pause"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Time Logs */}
                {timeLogs.length > 0 && (
                    <div className="pt-2 border-t border-white/10 space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Recorded Timestamps
                        </p>
                        {timeLogs.map((log: any, idx: number) => (
                            <div key={idx} className="text-[11px] text-zinc-300 flex items-center justify-between gap-2">
                                <span className="font-bold">
                                    {log.action}
                                    {log.reason ? ` (${log.reason})` : ""}
                                    {log.targetDate ? ` → ${log.targetDate}` : ""}
                                </span>
                                <span className="font-mono text-zinc-400">
                                    {new Date(log.timestamp).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 6. Before & After Photos per Elevation + Optional Per-Elevation Flight Window */}
            <div className="rounded-2xl border border-white/10 bg-[#141422] p-4 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Camera className="h-4 w-4 text-primary" />
                        Elevation Photos &amp; Flight Times
                    </h2>
                </div>

                {job.elevations.map((el: any) => {
                    const uploadedSlot = elevationPhotos[el.key] || elevationPhotos[el.name] || { before: [], after: [] }
                    const queuedBefore = queuedPhotos.filter(q => q.kind === "ELEVATION_BEFORE" && q.elevationKey === el.key)
                    const queuedAfter = queuedPhotos.filter(q => q.kind === "ELEVATION_AFTER" && q.elevationKey === el.key)
                    const ef = elevationFlights[el.key] || {}

                    return (
                        <div key={el.key} className="rounded-xl border border-white/10 bg-black/30 p-3.5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-black text-white">{el.name}</span>
                                {ef.durationMinutes && (
                                    <span className="text-[11px] font-mono font-bold text-primary">
                                        {ef.durationMinutes} min flight
                                    </span>
                                )}
                            </div>

                            {/* Optional Per-Elevation Flight Start / End */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-zinc-400">Flight Start (Optional)</Label>
                                    <div className="flex gap-1">
                                        <Input
                                            type="time"
                                            value={ef.flightStart || ""}
                                            onChange={e => handleElevationFlightMark(el.key, "flightStart", e.target.value)}
                                            className="h-10 bg-black/40 border-white/15 text-xs font-mono"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleElevationFlightMark(el.key, "flightStart")}
                                            className="h-10 px-2.5 text-[10px] font-black border-white/15"
                                        >
                                            Now
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-zinc-400">Flight End (Optional)</Label>
                                    <div className="flex gap-1">
                                        <Input
                                            type="time"
                                            value={ef.flightEnd || ""}
                                            onChange={e => handleElevationFlightMark(el.key, "flightEnd", e.target.value)}
                                            className="h-10 bg-black/40 border-white/15 text-xs font-mono"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleElevationFlightMark(el.key, "flightEnd")}
                                            className="h-10 px-2.5 text-[10px] font-black border-white/15"
                                        >
                                            Now
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Before & After Photo Capture Buttons */}
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                                {/* BEFORE */}
                                <div className="space-y-2">
                                    <label className="flex min-h-[50px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-primary/10 px-3 py-2.5 text-xs font-black uppercase text-primary hover:bg-primary/20">
                                        <Camera className="h-4 w-4" />
                                        <span>+ Before ({(uploadedSlot.before?.length || 0) + queuedBefore.length})</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            multiple
                                            data-testid={`before-input-${el.key}`}
                                            className="hidden"
                                            onChange={e => handlePhotoCapture(e.target.files, "ELEVATION_BEFORE", el.key)}
                                        />
                                    </label>
                                    <div className="flex gap-1.5 overflow-x-auto">
                                        {(uploadedSlot.before || []).map((p: any) => (
                                            <img
                                                key={p.id}
                                                src={p.signedUrl}
                                                alt="Before"
                                                className="h-14 w-14 rounded-lg object-cover border border-emerald-500/40 shrink-0"
                                            />
                                        ))}
                                        {queuedBefore.map((q) => (
                                            <div key={q.id} className="relative shrink-0">
                                                <img
                                                    src={q.dataUrl}
                                                    alt="Queued Before"
                                                    className="h-14 w-14 rounded-lg object-cover border border-amber-400 opacity-75"
                                                />
                                                <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-black text-[8px] font-black text-center">
                                                    QUEUED
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* AFTER */}
                                <div className="space-y-2">
                                    <label className="flex min-h-[50px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-500/50 bg-emerald-500/10 px-3 py-2.5 text-xs font-black uppercase text-emerald-300 hover:bg-emerald-500/20">
                                        <Camera className="h-4 w-4" />
                                        <span>+ After ({(uploadedSlot.after?.length || 0) + queuedAfter.length})</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            multiple
                                            data-testid={`after-input-${el.key}`}
                                            className="hidden"
                                            onChange={e => handlePhotoCapture(e.target.files, "ELEVATION_AFTER", el.key)}
                                        />
                                    </label>
                                    <div className="flex gap-1.5 overflow-x-auto">
                                        {(uploadedSlot.after || []).map((p: any) => (
                                            <img
                                                key={p.id}
                                                src={p.signedUrl}
                                                alt="After"
                                                className="h-14 w-14 rounded-lg object-cover border border-emerald-500/40 shrink-0"
                                            />
                                        ))}
                                        {queuedAfter.map((q) => (
                                            <div key={q.id} className="relative shrink-0">
                                                <img
                                                    src={q.dataUrl}
                                                    alt="Queued After"
                                                    className="h-14 w-14 rounded-lg object-cover border border-amber-400 opacity-75"
                                                />
                                                <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-black text-[8px] font-black text-center">
                                                    QUEUED
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* Total Flight Time (Phase 3 Flight Log Feed) */}
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-center justify-between gap-3">
                    <div>
                        <Label htmlFor="totalFlightMinutes" className="text-xs font-black text-white">
                            Total Airborne Flight Time (mins)
                        </Label>
                        <p className="text-[11px] text-zinc-400">
                            Auto-summed from elevations or enter total airborne minutes for Phase 3 flight log
                        </p>
                    </div>
                    <Input
                        id="totalFlightMinutes"
                        type="number"
                        min="0"
                        placeholder="mins"
                        value={totalFlightMinutes}
                        onChange={e => setTotalFlightMinutes(e.target.value)}
                        onBlur={() =>
                            saveJobPreFlightAndMetaAction({
                                projectId: job.projectId,
                                totalFlightMinutes: totalFlightMinutes ? parseInt(totalFlightMinutes, 10) : null
                            })
                        }
                        className="w-24 h-11 bg-black/50 border-white/15 text-center font-mono font-black text-sm"
                    />
                </div>
            </div>

            {/* 7. Site Issues / Notes + Photos */}
            <div className="rounded-2xl border border-white/10 bg-[#141422] p-4 shadow-xl space-y-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Issues &amp; Field Notes
                </h2>
                <Textarea
                    rows={3}
                    placeholder="Record any newly spotted defects, stubborn staining, water pressure notes or access issues..."
                    value={issuesNotes}
                    onChange={e => setIssuesNotes(e.target.value)}
                    onBlur={() => saveJobPreFlightAndMetaAction({ projectId: job.projectId, issuesNotes })}
                    className="bg-black/30 border-white/15 text-sm"
                />

                <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-white/10">
                    <Camera className="h-4 w-4 text-primary" />
                    <span>+ Attach Issue / Note Photo</span>
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        className="hidden"
                        onChange={e => handlePhotoCapture(e.target.files, "ISSUE")}
                    />
                </label>

                {(issuePhotos.length > 0 || queuedPhotos.some(q => q.kind === "ISSUE")) && (
                    <div className="flex gap-2 overflow-x-auto pt-1">
                        {issuePhotos.map((p: any) => (
                            <img
                                key={p.id}
                                src={p.signedUrl}
                                alt="Issue"
                                className="h-16 w-16 rounded-lg object-cover border border-white/15 shrink-0"
                            />
                        ))}
                        {queuedPhotos
                            .filter(q => q.kind === "ISSUE")
                            .map((q) => (
                                <div key={q.id} className="relative shrink-0">
                                    <img
                                        src={q.dataUrl}
                                        alt="Queued Issue"
                                        className="h-16 w-16 rounded-lg object-cover border border-amber-400 opacity-75"
                                    />
                                    <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-black text-[8px] font-black text-center">
                                        QUEUED
                                    </span>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {/* 8. Client On-Screen Sign-Off & Finish Job */}
            {status !== "COMPLETED" ? (
                <div className="rounded-2xl border border-primary/40 bg-[#141422] p-4 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <FileCheck2 className="h-4 w-4 text-primary" />
                            Client Handover Sign-Off
                        </h2>
                        <span className="text-xs font-mono text-zinc-400">
                            {new Date().toLocaleDateString("en-ZA")}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setClientUnavailable(!clientUnavailable)}
                        className={`w-full min-h-[46px] rounded-xl border px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                            clientUnavailable
                                ? "border-amber-400 bg-amber-500/20 text-amber-200"
                                : "border-white/15 bg-black/30 text-zinc-300"
                        }`}
                    >
                        {clientUnavailable ? "✓ Client Not Available on Site" : "Client Not Available? Tap Here"}
                    </button>

                    {clientUnavailable ? (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-amber-300">
                                Reason Client Was Unavailable (Required)
                            </Label>
                            <Input
                                placeholder="e.g. Building manager left site at 15:00; security signed gate book"
                                value={clientUnavailableReason}
                                onChange={e => setClientUnavailableReason(e.target.value)}
                                className="h-12 bg-black/40 border-white/15 text-sm"
                            />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label htmlFor="signOffName" className="text-xs font-bold text-zinc-300">
                                    Client Representative Name
                                </Label>
                                <Input
                                    id="signOffName"
                                    placeholder="Full name of site representative"
                                    value={signOffName}
                                    onChange={e => setSignOffName(e.target.value)}
                                    className="h-12 bg-black/40 border-white/15 text-sm font-semibold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-zinc-300">
                                        Client Signature (Sign on screen)
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={clearSignature}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white"
                                    >
                                        <Eraser className="h-3.5 w-3.5" /> Clear
                                    </button>
                                </div>
                                <div className="rounded-xl border-2 border-dashed border-white/20 bg-black/60 overflow-hidden">
                                    <canvas
                                        ref={canvasRef}
                                        width={640}
                                        height={220}
                                        style={{ touchAction: "none" }}
                                        onMouseDown={startSignatureDraw}
                                        onMouseMove={moveSignatureDraw}
                                        onMouseUp={endSignatureDraw}
                                        onMouseLeave={endSignatureDraw}
                                        onTouchStart={startSignatureDraw}
                                        onTouchMove={moveSignatureDraw}
                                        onTouchEnd={endSignatureDraw}
                                        className="w-full h-40 cursor-crosshair block"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Finish Job Offline Photo Gate Confirmation */}
                    {queuedPhotos.length > 0 && (
                        <label className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={crewConfirmedPendingPhotos}
                                onChange={e => setCrewConfirmedPendingPhotos(e.target.checked)}
                                className="mt-1 h-4 w-4 rounded"
                            />
                            <span className="font-semibold">
                                Confirm finish with {queuedPhotos.length} photo(s) still waiting to upload on this phone (they will upload automatically as soon as connection returns).
                            </span>
                        </label>
                    )}

                    <Button
                        type="button"
                        disabled={busyAction === "FINISH"}
                        onClick={handleFinishJob}
                        className="w-full min-h-[60px] rounded-xl bg-primary hover:bg-primary/90 text-black font-black text-base uppercase tracking-wider shadow-xl shadow-primary/25"
                    >
                        {busyAction === "FINISH" ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                        )}
                        Finish Job &amp; Complete Handover
                    </Button>
                </div>
            ) : (
                <div className="rounded-2xl border border-teal-500/40 bg-teal-950/30 p-5 space-y-3 text-center">
                    <CheckCircle2 className="h-10 w-10 text-teal-400 mx-auto" />
                    <h2 className="text-lg font-black text-white uppercase">Job Completed</h2>
                    <p className="text-xs text-teal-200">
                        Project marked Completed, Completion Report created from site photos, and Balance Invoice drafted for review.
                    </p>

                    {currentUserRole !== "CREW" && (
                        <div className="grid grid-cols-1 gap-2 pt-2">
                            {completionResult?.reportId && (
                                <Link
                                    href={`/reports/${completionResult.reportId}`}
                                    className="flex min-h-[48px] items-center justify-center rounded-xl bg-primary text-black font-black text-xs uppercase tracking-wider"
                                >
                                    Open Completion Report →
                                </Link>
                            )}
                            {completionResult?.draftedInvoiceId && (
                                <Link
                                    href={`/invoices/${completionResult.draftedInvoiceId}`}
                                    className="flex min-h-[48px] items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white font-black text-xs uppercase tracking-wider"
                                >
                                    Review Draft Balance Invoice ({completionResult.draftedInvoiceNumber || "Draft"}) →
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
