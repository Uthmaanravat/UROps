"use client"

import React, { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
    MapPin,
    Calendar,
    ChevronRight,
    CloudOff,
    RefreshCw,
    Plane,
    Repeat,
    CheckCircle2,
    Clock,
    PauseCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { WeatherBadge } from "@/components/projects/WeatherBadge"
import {
    listQueuedPhotos,
    removeQueuedPhoto,
    recordQueuedPhotoFailure,
    PHOTO_QUEUE_EVENT,
    type QueuedJobPhoto
} from "@/lib/offline-photo-queue"
import { uploadJobPhotoAction } from "@/app/(dashboard)/my-jobs/actions"

export function MyJobsTodayClient({
    jobs,
    userName,
    userRole
}: {
    jobs: any[]
    userName: string
    userRole: string
}) {
    const [tab, setTab] = useState<"TODAY" | "UPCOMING" | "DONE">("TODAY")
    const [queuedPhotos, setQueuedPhotos] = useState<QueuedJobPhoto[]>([])
    const [syncing, setSyncing] = useState(false)

    const refreshQueue = useCallback(async () => {
        const all = await listQueuedPhotos()
        setQueuedPhotos(all)
    }, [])

    const flushOfflineQueue = useCallback(async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) return
        const pending = await listQueuedPhotos()
        if (pending.length === 0) return
        setSyncing(true)
        try {
            for (const item of pending) {
                const res = await uploadJobPhotoAction({
                    projectId: item.projectId,
                    photoId: item.id,
                    kind: item.kind,
                    elevationKey: item.elevationKey,
                    caption: item.caption,
                    dataUrl: item.dataUrl,
                    takenAt: item.takenAt
                })
                if (res.success) {
                    await removeQueuedPhoto(item.id)
                } else {
                    await recordQueuedPhotoFailure(item.id, res.error || "Upload failed")
                }
            }
        } finally {
            setSyncing(false)
            await refreshQueue()
        }
    }, [refreshQueue])

    useEffect(() => {
        refreshQueue()
        const onQueueChange = () => refreshQueue()
        const onOnline = () => flushOfflineQueue()
        window.addEventListener(PHOTO_QUEUE_EVENT, onQueueChange)
        window.addEventListener("online", onOnline)
        return () => {
            window.removeEventListener(PHOTO_QUEUE_EVENT, onQueueChange)
            window.removeEventListener("online", onOnline)
        }
    }, [refreshQueue, flushOfflineQueue])

    const todayStr = new Date().toISOString().split("T")[0]

    const todayJobs = jobs.filter(j => {
        if (j.projectStatus === "COMPLETED" || j.jobSheetStatus === "COMPLETED") return false
        if (j.jobSheetStatus === "IN_PROGRESS" || j.jobSheetStatus === "PAUSED") return true
        if (!j.startDate) return true
        const dStr = j.startDate.split("T")[0]
        return dStr <= todayStr
    })

    const upcomingJobs = jobs.filter(j => {
        if (j.projectStatus === "COMPLETED" || j.jobSheetStatus === "COMPLETED") return false
        if (j.jobSheetStatus === "IN_PROGRESS" || j.jobSheetStatus === "PAUSED") return false
        if (!j.startDate) return false
        return j.startDate.split("T")[0] > todayStr
    })

    const doneJobs = jobs.filter(
        j => j.projectStatus === "COMPLETED" || j.jobSheetStatus === "COMPLETED"
    )

    const activeList = tab === "TODAY" ? todayJobs : tab === "UPCOMING" ? upcomingJobs : doneJobs

    return (
        <div className="max-w-lg mx-auto space-y-4 pb-24">
            {/* Header */}
            <div className="rounded-2xl bg-[#141422] border border-white/10 p-4 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                            AeroWash Field Ops · {userRole}
                        </p>
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            My Jobs Today
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Crew: {userName}
                        </p>
                    </div>
                    <div className="text-right">
                        <span className="inline-flex items-center rounded-xl bg-primary/15 border border-primary/30 px-3 py-1.5 text-xs font-black text-primary">
                            {todayJobs.length} Today
                        </span>
                    </div>
                </div>
            </div>

            {/* Offline Queued Photos Indicator */}
            {queuedPhotos.length > 0 && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/15 p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs text-amber-200 font-bold">
                        <CloudOff className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>
                            {queuedPhotos.length} photo{queuedPhotos.length === 1 ? "" : "s"} waiting to upload
                        </span>
                    </div>
                    <Button
                        size="sm"
                        onClick={flushOfflineQueue}
                        disabled={syncing}
                        className="h-9 px-3 text-xs font-black bg-amber-500 text-black hover:bg-amber-400"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Uploading..." : "Sync Now"}
                    </Button>
                </div>
            )}

            {/* Big Phone Tabs */}
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#141422] p-1.5 border border-white/10">
                <button
                    type="button"
                    onClick={() => setTab("TODAY")}
                    className={`min-h-[48px] rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        tab === "TODAY"
                            ? "bg-primary text-black shadow-lg"
                            : "text-zinc-400 hover:text-white"
                    }`}
                >
                    Today ({todayJobs.length})
                </button>
                <button
                    type="button"
                    onClick={() => setTab("UPCOMING")}
                    className={`min-h-[48px] rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        tab === "UPCOMING"
                            ? "bg-primary text-black shadow-lg"
                            : "text-zinc-400 hover:text-white"
                    }`}
                >
                    Upcoming ({upcomingJobs.length})
                </button>
                <button
                    type="button"
                    onClick={() => setTab("DONE")}
                    className={`min-h-[48px] rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        tab === "DONE"
                            ? "bg-primary text-black shadow-lg"
                            : "text-zinc-400 hover:text-white"
                    }`}
                >
                    Done ({doneJobs.length})
                </button>
            </div>

            {/* Job Cards */}
            {activeList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[#141422]/60 p-8 text-center space-y-2">
                    <p className="text-sm font-bold text-white">
                        {tab === "TODAY"
                            ? "No jobs scheduled for today"
                            : tab === "UPCOMING"
                                ? "No upcoming jobs assigned"
                                : "No completed jobs yet"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Assigned site job sheets appear here automatically.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {activeList.map((job) => {
                        const dateLabel = job.startDate
                            ? new Date(job.startDate).toLocaleDateString("en-ZA", {
                                weekday: "short",
                                day: "numeric",
                                month: "short"
                            })
                            : "Unscheduled"

                        return (
                            <div
                                key={job.id}
                                className="rounded-2xl border border-white/10 bg-[#141422] p-4 shadow-xl space-y-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[11px] font-black uppercase tracking-wider text-primary">
                                                {job.clientName}
                                            </span>
                                            {job.isRecurringVisit && (
                                                <span className="inline-flex items-center gap-1 rounded bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.5 text-[10px] font-bold text-teal-300">
                                                    <Repeat className="h-2.5 w-2.5" /> Contract Visit
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-base font-black text-white leading-snug mt-0.5">
                                            {job.name}
                                        </h2>
                                    </div>

                                    {job.jobSheetStatus === "IN_PROGRESS" && (
                                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-300">
                                            <Clock className="h-3 w-3" /> In Progress
                                        </span>
                                    )}
                                    {job.jobSheetStatus === "PAUSED" && (
                                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-[10px] font-black uppercase text-amber-300">
                                            <PauseCircle className="h-3 w-3" /> Paused
                                        </span>
                                    )}
                                    {(job.jobSheetStatus === "COMPLETED" || job.projectStatus === "COMPLETED") && (
                                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-teal-500/20 border border-teal-500/40 px-2.5 py-1 text-[10px] font-black uppercase text-teal-300">
                                            <CheckCircle2 className="h-3 w-3" /> Completed
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1.5 text-xs text-zinc-300">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                        <span>{job.siteAddress}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                                        <span className="inline-flex items-center gap-1.5 text-zinc-400 font-semibold">
                                            <Calendar className="h-3.5 w-3.5 text-primary" />
                                            {dateLabel}
                                        </span>
                                        {job.poNumber && (
                                            <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-200">
                                                PO: {job.poNumber}
                                            </span>
                                        )}
                                    </div>
                                    {job.aircraftLabel && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                                            <Plane className="h-3.5 w-3.5 text-primary" />
                                            <span>Aircraft: {job.aircraftLabel}</span>
                                        </div>
                                    )}
                                </div>

                                {job.flightWeather && (
                                    <div>
                                        <WeatherBadge weather={job.flightWeather} />
                                    </div>
                                )}

                                <Link
                                    href={`/my-jobs/${job.id}`}
                                    className="flex w-full min-h-[52px] items-center justify-between rounded-xl bg-primary px-4 py-3 text-sm font-black uppercase tracking-wider text-black shadow-lg shadow-primary/20 active:scale-[0.99] transition-transform"
                                >
                                    <span>
                                        {job.jobSheetStatus === "IN_PROGRESS"
                                            ? "Continue Active Job Sheet"
                                            : job.jobSheetStatus === "PAUSED"
                                                ? "Open Paused Job Sheet"
                                                : "Open Job Sheet"}
                                    </span>
                                    <ChevronRight className="h-5 w-5" />
                                </Link>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
