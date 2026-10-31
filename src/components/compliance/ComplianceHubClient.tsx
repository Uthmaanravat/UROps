"use client"

import React, { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
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
    Bell,
    CheckCircle2,
    Clock,
    Download,
    Eye,
    FileCheck2,
    Loader2,
    PackageCheck,
    Plane,
    ShieldAlert,
    ShieldCheck,
    Upload,
} from "lucide-react"
import {
    ALL_COMPLIANCE_CATEGORY_META,
    type AllComplianceCategory,
    CORE_COMPLIANCE_CATEGORIES,
    evaluateBatteryStatus,
    evaluateComplianceDocument,
    evaluateDroneMaintenance,
    evaluateVendorPackReadiness,
} from "@/lib/compliance-status"
import {
    getComplianceDocumentSignedUrlAction,
    triggerComplianceAlertDigestAction,
    uploadComplianceDocumentAction,
} from "@/app/(dashboard)/compliance/actions"
import { FlightLogTab } from "@/components/compliance/FlightLogTab"
import { DroneFleetTab } from "@/components/compliance/DroneFleetTab"
import { BatteryFleetTab } from "@/components/compliance/BatteryFleetTab"
import { DocumentVaultTab } from "@/components/compliance/DocumentVaultTab"

type TabId = "FLIGHT_LOG" | "DRONES" | "BATTERIES" | "DOCUMENTS"

interface ComplianceHubClientProps {
    companyName: string
    isAdmin: boolean
    flightLogs: any[]
    drones: any[]
    batteries: any[]
    documents: any[]
    pilots: any[]
    projects: any[]
}

const DEFAULT_TITLES: Record<AllComplianceCategory, { title: string; authority: string }> = {
    ABEOD_AGREEMENT: {
        title: "ABEOD Part 101 ROC Operating Agreement",
        authority: "ABEOD / SACAA ROC",
    },
    INSURANCE: {
        title: "Aviation Public Liability & Hull Insurance",
        authority: "Aviation Insurer",
    },
    COIDA: {
        title: "COIDA Letter of Good Standing",
        authority: "Dept. of Employment & Labour",
    },
    TAX_CLEARANCE: {
        title: "SARS Tax Compliance Status (TCS / PIN)",
        authority: "South African Revenue Service (SARS)",
    },
    RPL: {
        title: "SACAA Remote Pilot Licence (RPL)",
        authority: "SACAA",
    },
    COMPANY_REG: {
        title: "CIPC Company Registration Certificate",
        authority: "CIPC",
    },
    BBBEE: {
        title: "B-BBEE Exempt Micro Enterprise Affidavit",
        authority: "Commissioner of Oaths / SANAS",
    },
    BANK_CONFIRMATION: {
        title: "Official Bank Account Confirmation Letter",
        authority: "Commercial Bank",
    },
    SAFETY_HSE_PLAN: {
        title: "AeroWash Flight Operations & HSE Safety Plan",
        authority: "Internal HSE",
    },
    OTHER: {
        title: "",
        authority: "",
    },
}

export function ComplianceHubClient({
    companyName,
    isAdmin,
    flightLogs,
    drones,
    batteries,
    documents,
    pilots,
    projects,
}: ComplianceHubClientProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<TabId>("FLIGHT_LOG")
    const [isPending, startTransition] = useTransition()

    // Upload Document Modal state
    const [uploadOpen, setUploadOpen] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [docCategory, setDocCategory] = useState<AllComplianceCategory>("ABEOD_AGREEMENT")
    const [docTitle, setDocTitle] = useState(DEFAULT_TITLES.ABEOD_AGREEMENT.title)
    const [docAuthority, setDocAuthority] = useState(DEFAULT_TITLES.ABEOD_AGREEMENT.authority)
    const [docRef, setDocRef] = useState("")
    const [docPilotId, setDocPilotId] = useState("")
    const [docIssued, setDocIssued] = useState("")
    const [docExpiry, setDocExpiry] = useState("")
    const [docAlertDays, setDocAlertDays] = useState("30")
    const [docIncludePack, setDocIncludePack] = useState(true)
    const [docArchivePrev, setDocArchivePrev] = useState(true)
    const [docNotes, setDocNotes] = useState("")
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    // Vendor Pack Guardrail Modal
    const [packWarningOpen, setPackWarningOpen] = useState(false)
    const [downloadingPack, setDownloadingPack] = useState(false)
    const [digestFeedback, setDigestFeedback] = useState<string | null>(null)

    const droneFlightMinutesMap = useMemo(() => {
        const m: Record<string, number> = {}
        for (const fl of flightLogs || []) {
            if (fl.droneId) {
                m[fl.droneId] = (m[fl.droneId] || 0) + Number(fl.durationMinutes || 0)
            }
        }
        return m
    }, [flightLogs])

    const activeDocs = useMemo(
        () => (documents || []).filter(d => !d.isArchived),
        [documents]
    )

    const readiness = useMemo(
        () => evaluateVendorPackReadiness(activeDocs),
        [activeDocs]
    )

    const droneAlertCount = useMemo(() => {
        return (drones || [])
            .filter(d => d.isActive)
            .filter(d => {
                const ev = evaluateDroneMaintenance(d, droneFlightMinutesMap[d.id] || 0)
                return ev.severity !== "VALID"
            }).length
    }, [drones, droneFlightMinutesMap])

    const batteryAlertCount = useMemo(() => {
        return (batteries || [])
            .filter(b => b.status !== "RETIRED")
            .filter(b => evaluateBatteryStatus(b).severity !== "VALID").length
    }, [batteries])

    const docAlertCount = useMemo(() => {
        let count = readiness.missingCategories.length
        for (const d of activeDocs) {
            const ev = evaluateComplianceDocument(d)
            if (ev.severity !== "VALID") count += 1
        }
        return count
    }, [activeDocs, readiness.missingCategories.length])

    const openUploadWithCategory = (cat: AllComplianceCategory = "ABEOD_AGREEMENT") => {
        setDocCategory(cat)
        setDocTitle(DEFAULT_TITLES[cat]?.title || "")
        setDocAuthority(DEFAULT_TITLES[cat]?.authority || "")
        setDocRef("")
        setDocPilotId(cat === "RPL" ? pilots[0]?.id || "" : "")
        setDocIssued("")
        setDocExpiry("")
        setDocAlertDays("30")
        setDocIncludePack(true)
        setDocArchivePrev(true)
        setDocNotes("")
        setSelectedFile(null)
        setUploadError(null)
        setUploadOpen(true)
    }

    const handleCategoryChange = (nextCat: AllComplianceCategory) => {
        setDocCategory(nextCat)
        setDocTitle(DEFAULT_TITLES[nextCat]?.title || "")
        setDocAuthority(DEFAULT_TITLES[nextCat]?.authority || "")
        if (nextCat === "RPL" && !docPilotId && pilots[0]?.id) {
            setDocPilotId(pilots[0].id)
        }
    }

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedFile) {
            setUploadError("Please select a PDF or image file to upload.")
            return
        }
        setUploading(true)
        setUploadError(null)
        try {
            const fd = new FormData()
            fd.set("file", selectedFile)
            fd.set("category", docCategory)
            fd.set("title", docTitle)
            fd.set("issuingAuthority", docAuthority)
            fd.set("referenceNumber", docRef)
            if (docCategory === "RPL" && docPilotId) fd.set("pilotUserId", docPilotId)
            if (docIssued) fd.set("issuedDate", docIssued)
            if (docExpiry) fd.set("expiryDate", docExpiry)
            fd.set("alertDaysBefore", docAlertDays)
            fd.set("includeInVendorPack", String(docIncludePack))
            fd.set("archivePrevious", String(docArchivePrev))
            if (docNotes) fd.set("notes", docNotes)

            const res = await uploadComplianceDocumentAction(fd)
            if (!res.success) {
                setUploadError(res.error || "Upload failed")
            } else {
                setUploadOpen(false)
                router.refresh()
            }
        } catch (err: any) {
            setUploadError(err.message || "Unexpected upload error")
        } finally {
            setUploading(false)
        }
    }

    const triggerZipDownload = async (params?: {
        allowIncomplete?: boolean
        excludeExpired?: boolean
    }) => {
        setDownloadingPack(true)
        try {
            const qs = new URLSearchParams()
            if (params?.allowIncomplete) qs.set("allowIncomplete", "1")
            if (params?.excludeExpired) qs.set("excludeExpired", "1")
            const url = `/api/compliance/vendor-pack${qs.toString() ? `?${qs.toString()}` : ""}`

            const res = await fetch(url)
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}))
                if (res.status === 409) {
                    setPackWarningOpen(true)
                    return
                }
                alert(payload.error || "Failed to generate Vendor Pack.")
                return
            }

            const blob = await res.blob()
            const disposition = res.headers.get("Content-Disposition") || ""
            const match = disposition.match(/filename="([^"]+)"/)
            const fileName = match?.[1] || "Vendor_Compliance_Pack.zip"

            const objectUrl = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = objectUrl
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(objectUrl)
            setPackWarningOpen(false)
        } finally {
            setDownloadingPack(false)
        }
    }

    const handleVendorPackClick = () => {
        if (readiness.isReady) {
            triggerZipDownload()
        } else {
            setPackWarningOpen(true)
        }
    }

    const handlePreviewQuickDoc = async (docId: string) => {
        const res = await getComplianceDocumentSignedUrlAction(docId, false)
        if (res.success && res.url) {
            window.open(res.url, "_blank", "noopener,noreferrer")
        } else {
            alert(res.error || "Could not open document.")
        }
    }

    const handleTriggerDigest = () => {
        setDigestFeedback(null)
        startTransition(async () => {
            const res = await triggerComplianceAlertDigestAction()
            if (!res.success) {
                setDigestFeedback(res.error || "Alert check failed.")
            } else {
                const count = res.result?.documentAlertsTriggered || 0
                const emails = res.result?.emailsDispatchedTo || []
                setDigestFeedback(
                    emails.length > 0
                        ? `Alert digest sent to ${emails.join(", ")} (${count} expiring/expired doc(s)).`
                        : "Compliance check complete — no expiring documents or overdue items require an email right now."
                )
            }
        })
    }

    const overallHealthy =
        readiness.isReady && droneAlertCount === 0 && batteryAlertCount === 0

    return (
        <div className="space-y-6">
            {/* Top Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                            Compliance &amp; Fleet Readiness
                        </h1>
                        <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-1.5 ${
                                overallHealthy
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                    : readiness.expiredDocuments.length > 0
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                    : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            }`}
                        >
                            {overallHealthy ? (
                                <>
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    All Clear
                                </>
                            ) : (
                                <>
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    Attention Needed
                                </>
                            )}
                        </span>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                        SACAA flight logs (auto-synced from Job Sheets), drone &amp; battery service records, statutory document expiry alerts, and 1-click Vendor Pack export.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={handleTriggerDigest}
                            className="border-white/15 gap-1.5 text-xs"
                        >
                            {isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Bell className="h-3.5 w-3.5 text-amber-400" />
                            )}
                            Run Expiry Email Check
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openUploadWithCategory("ABEOD_AGREEMENT")}
                        className="border-white/15 gap-1.5 text-xs font-bold"
                    >
                        <Upload className="h-3.5 w-3.5" />
                        Upload Document
                    </Button>
                    <Button
                        size="sm"
                        disabled={downloadingPack}
                        onClick={handleVendorPackClick}
                        className="font-black gap-2 shadow-lg shadow-primary/20"
                    >
                        {downloadingPack ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <PackageCheck className="h-4 w-4" />
                        )}
                        Download Vendor Pack (.zip)
                    </Button>
                </div>
            </div>

            {digestFeedback && (
                <div className="rounded-xl bg-primary/10 border border-primary/25 px-4 py-2.5 text-xs text-white flex items-center justify-between">
                    <span>{digestFeedback}</span>
                    <button
                        type="button"
                        onClick={() => setDigestFeedback(null)}
                        className="text-muted-foreground hover:text-white ml-4"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Core 5 Statutory Documents Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                {CORE_COMPLIANCE_CATEGORIES.map(core => {
                    const docsInCat = activeDocs.filter(d => d.category === core.category)
                    const primaryDoc = docsInCat[0] || null
                    const ev = primaryDoc ? evaluateComplianceDocument(primaryDoc) : null

                    // If multiple RPLs exist, surface the worst-case status so an expired pilot RPL is never hidden
                    let worstEval = ev
                    if (docsInCat.length > 1) {
                        const rank = { EXPIRED: 4, CRITICAL: 3, DUE_SOON: 2, VALID: 1, MISSING: 5 }
                        for (const d of docsInCat) {
                            const cand = evaluateComplianceDocument(d)
                            if (!worstEval || rank[cand.severity] > rank[worstEval.severity]) {
                                worstEval = cand
                            }
                        }
                    }

                    const severity = worstEval ? worstEval.severity : "MISSING"
                    const borderStyle =
                        severity === "EXPIRED"
                            ? "border-rose-500/40 bg-rose-950/15"
                            : severity === "CRITICAL"
                            ? "border-orange-500/40 bg-orange-950/15"
                            : severity === "DUE_SOON"
                            ? "border-amber-500/35 bg-amber-950/10"
                            : severity === "MISSING"
                            ? "border-white/10 bg-[#141424]"
                            : "border-emerald-500/25 bg-[#141424]"

                    const pillStyle =
                        severity === "EXPIRED"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            : severity === "CRITICAL"
                            ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                            : severity === "DUE_SOON"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : severity === "MISSING"
                            ? "bg-white/5 text-muted-foreground border-white/15"
                            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"

                    return (
                        <Card key={core.category} className={`border ${borderStyle}`}>
                            <CardContent className="p-3.5 flex flex-col justify-between h-full space-y-2.5">
                                <div className="space-y-1">
                                    <div className="flex items-start justify-between gap-1.5">
                                        <span className="text-xs font-black text-white leading-tight">
                                            {core.shortLabel}
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase shrink-0 ${pillStyle}`}
                                        >
                                            {worstEval ? worstEval.label : "Not Uploaded"}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground truncate">
                                        {primaryDoc
                                            ? core.category === "RPL" && docsInCat.length > 1
                                                ? `${docsInCat.length} pilot licences on file`
                                                : primaryDoc.referenceNumber
                                                ? `Ref: ${primaryDoc.referenceNumber}`
                                                : primaryDoc.title
                                            : core.authorityHint}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                                    {primaryDoc ? (
                                        <button
                                            type="button"
                                            onClick={() => handlePreviewQuickDoc(primaryDoc.id)}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-white"
                                        >
                                            <Eye className="h-3 w-3" />
                                            View
                                        </button>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground">
                                            Required for pack
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => openUploadWithCategory(core.category)}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                                    >
                                        <Upload className="h-3 w-3" />
                                        {primaryDoc ? "Renew" : "Upload"}
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Workspace Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10 w-fit flex-wrap">
                <button
                    type="button"
                    onClick={() => setActiveTab("FLIGHT_LOG")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        activeTab === "FLIGHT_LOG"
                            ? "bg-primary text-black shadow-sm"
                            : "text-muted-foreground hover:text-white"
                    }`}
                >
                    <Clock className="h-3.5 w-3.5" />
                    Flight Log ({flightLogs.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("DRONES")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        activeTab === "DRONES"
                            ? "bg-primary text-black shadow-sm"
                            : "text-muted-foreground hover:text-white"
                    }`}
                >
                    <Plane className="h-3.5 w-3.5" />
                    Drones &amp; Maintenance
                    {droneAlertCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                            {droneAlertCount}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("BATTERIES")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        activeTab === "BATTERIES"
                            ? "bg-primary text-black shadow-sm"
                            : "text-muted-foreground hover:text-white"
                    }`}
                >
                    <BatteryCharging className="h-3.5 w-3.5" />
                    Batteries &amp; Cycles
                    {batteryAlertCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black">
                            {batteryAlertCount}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("DOCUMENTS")}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        activeTab === "DOCUMENTS"
                            ? "bg-primary text-black shadow-sm"
                            : "text-muted-foreground hover:text-white"
                    }`}
                >
                    <FileCheck2 className="h-3.5 w-3.5" />
                    Document Vault
                    {docAlertCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                            {docAlertCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Active Tab Body */}
            {activeTab === "FLIGHT_LOG" && (
                <FlightLogTab
                    companyName={companyName}
                    isAdmin={isAdmin}
                    flightLogs={flightLogs}
                    drones={drones}
                    pilots={pilots}
                    batteries={batteries}
                    projects={projects}
                />
            )}
            {activeTab === "DRONES" && (
                <DroneFleetTab
                    isAdmin={isAdmin}
                    drones={drones}
                    droneFlightMinutesMap={droneFlightMinutesMap}
                />
            )}
            {activeTab === "BATTERIES" && (
                <BatteryFleetTab
                    isAdmin={isAdmin}
                    batteries={batteries}
                    drones={drones}
                />
            )}
            {activeTab === "DOCUMENTS" && (
                <DocumentVaultTab
                    isAdmin={isAdmin}
                    documents={documents}
                    onOpenUploadModal={cat => openUploadWithCategory(cat || "ABEOD_AGREEMENT")}
                />
            )}

            {/* Shared Upload / Renew Document Dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="max-w-lg bg-[#141424] border-white/10 text-white max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-primary" />
                            Upload Compliance Certificate / Agreement
                        </DialogTitle>
                        <DialogDescription>
                            Stored securely in a private workspace vault. Expiry alerts fire automatically at 30, 14, and 7 days prior to expiry.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUploadSubmit} className="space-y-3">
                        {uploadError && (
                            <div className="p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
                                {uploadError}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Category</Label>
                                <select
                                    value={docCategory}
                                    onChange={e =>
                                        handleCategoryChange(e.target.value as AllComplianceCategory)
                                    }
                                    className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                                >
                                    {Object.entries(ALL_COMPLIANCE_CATEGORY_META).map(([k, v]) => (
                                        <option key={k} value={k}>
                                            {v.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {docCategory === "RPL" ? (
                                <div className="space-y-1">
                                    <Label className="text-xs">Pilot</Label>
                                    <select
                                        value={docPilotId}
                                        onChange={e => setDocPilotId(e.target.value)}
                                        className="w-full h-10 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                                    >
                                        <option value="">Company / General</option>
                                        {pilots.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name || p.email}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Label className="text-xs">Reference / Policy / PIN #</Label>
                                    <Input
                                        placeholder="e.g. POL-88219 / SARS PIN"
                                        value={docRef}
                                        onChange={e => setDocRef(e.target.value)}
                                        className="bg-black/30 border-white/10 text-xs"
                                    />
                                </div>
                            )}
                        </div>

                        {docCategory === "RPL" && (
                            <div className="space-y-1">
                                <Label className="text-xs">SACAA RPL Licence Number</Label>
                                <Input
                                    placeholder="e.g. 0273-xxxx"
                                    value={docRef}
                                    onChange={e => setDocRef(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Document Title</Label>
                                <Input
                                    value={docTitle}
                                    onChange={e => setDocTitle(e.target.value)}
                                    required
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Issuing Authority</Label>
                                <Input
                                    value={docAuthority}
                                    onChange={e => setDocAuthority(e.target.value)}
                                    placeholder="SACAA / SARS / Santam / ABEOD"
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Issue Date</Label>
                                <Input
                                    type="date"
                                    value={docIssued}
                                    onChange={e => setDocIssued(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Expiry Date</Label>
                                <Input
                                    type="date"
                                    value={docExpiry}
                                    onChange={e => setDocExpiry(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Alert Lead (Days)</Label>
                                <Input
                                    type="number"
                                    min={7}
                                    max={120}
                                    value={docAlertDays}
                                    onChange={e => setDocAlertDays(e.target.value)}
                                    className="bg-black/30 border-white/10 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">File (PDF, JPG, PNG, WEBP — max 25 MB)</Label>
                            <Input
                                type="file"
                                accept=".pdf,image/jpeg,image/png,image/webp"
                                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                required
                                className="bg-black/30 border-white/10 text-xs cursor-pointer"
                            />
                        </div>

                        <div className="space-y-1.5 pt-1">
                            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={docIncludePack}
                                    onChange={e => setDocIncludePack(e.target.checked)}
                                />
                                Include automatically in 1-Click Vendor Compliance Pack (.zip)
                            </label>
                            {docCategory !== "OTHER" && (
                                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={docArchivePrev}
                                        onChange={e => setDocArchivePrev(e.target.checked)}
                                    />
                                    Archive previous active certificate in this category as historical renewal
                                </label>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Notes (Optional)</Label>
                            <Textarea
                                rows={2}
                                value={docNotes}
                                onChange={e => setDocNotes(e.target.value)}
                                placeholder="Coverage limit, endorsement notes, renewal portal..."
                                className="bg-black/30 border-white/10 text-xs"
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setUploadOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={uploading}>
                                {uploading && (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                )}
                                Upload to Vault
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Vendor Pack Readiness Guardrail Modal */}
            <Dialog open={packWarningOpen} onOpenChange={setPackWarningOpen}>
                <DialogContent className="max-w-md bg-[#141424] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-300">
                            <AlertTriangle className="h-5 w-5" />
                            Vendor Compliance Pack Incomplete
                        </DialogTitle>
                        <DialogDescription>
                            Review missing or expired statutory items before sending this pack to a property manager or procurement portal.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 text-xs">
                        {readiness.missingCategories.length > 0 && (
                            <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 space-y-1">
                                <div className="font-bold text-amber-300">
                                    Missing Core Documents ({readiness.missingCategories.length}):
                                </div>
                                <ul className="list-disc pl-4 text-white/90 space-y-0.5">
                                    {readiness.missingCategories.map(m => (
                                        <li key={m.category}>{m.label}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {readiness.expiredDocuments.length > 0 && (
                            <div className="rounded-lg bg-rose-500/15 border border-rose-500/30 p-3 space-y-1">
                                <div className="font-bold text-rose-300">
                                    Expired Included Documents ({readiness.expiredDocuments.length}):
                                </div>
                                <ul className="list-disc pl-4 text-white/90 space-y-0.5">
                                    {readiness.expiredDocuments.map(ed => (
                                        <li key={ed.id}>
                                            {ed.title} ({ed.label})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <p className="text-muted-foreground">
                            The pack always includes an auto-generated{" "}
                            <strong className="text-white">
                                00_Vendor_Compliance_Summary.pdf
                            </strong>{" "}
                            cover sheet plus {readiness.includedCount} active vault file(s).
                        </p>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setPackWarningOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={downloadingPack}
                            onClick={() =>
                                triggerZipDownload({
                                    allowIncomplete: true,
                                    excludeExpired: true,
                                })
                            }
                            className="border-white/15 gap-1.5 text-xs"
                        >
                            {downloadingPack && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            Download Valid Docs Only (.zip)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
