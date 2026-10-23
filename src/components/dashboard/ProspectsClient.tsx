"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover"
import {
    updateProspectStatusAction,
    logProspectContactAction,
    setProspectFollowupAction,
    saveProspectNotesAction,
    addProspectAction,
    updateProspectDetailsAction,
    deleteProspectAction,
    markProspectInterestedAndCreateClientAction,
    logResultAction,
    type ProspectInput
} from "@/app/(dashboard)/drone/prospect-actions"
import {
    generateProspectEmail,
    prospectsToCsv,
    type ProspectDTO,
    type SenderInfo,
    type ContactLogEntry
} from "@/lib/prospect-email"
import {
    Phone,
    Mail,
    MapPin,
    Search,
    Loader2,
    Copy,
    Check,
    Plus,
    Download,
    Pencil,
    X,
    ExternalLink,
    AlertCircle,
    Clock,
    CheckCircle2,
    MoreVertical,
    FileText,
    Briefcase,
    DollarSign,
    Filter,
    Building2,
    Calendar,
    MessageSquare,
    Flame,
    ArrowUpRight,
    HelpCircle
} from "lucide-react"

const CATEGORIES = ["Water Facing", "No Gondola", "Heritage", "Rooftop Solar", "Multiplier", "Niche"]

interface ProspectsClientProps {
    prospects: ProspectDTO[]
    sender: SenderInfo
    quotes?: any[]
    clients?: any[]
    projects?: any[]
    onOpenScanner?: () => void
}

function startOfDay(d: Date): number {
    const c = new Date(d)
    c.setHours(0, 0, 0, 0)
    return c.getTime()
}

function daysSince(dateStr: string | null): number | null {
    if (!dateStr) return null
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function fmtDate(dateStr: string | null): string {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
}

function isFollowupDue(p: ProspectDTO): boolean {
    if (!p.nextFollowupDate) return false
    if (p.status === "won" || p.status === "passed" || p.status === "lost") return false
    return startOfDay(new Date(p.nextFollowupDate)) <= startOfDay(new Date())
}

function urgencyRank(p: ProspectDTO): number {
    if (isFollowupDue(p)) return 0
    if (p.status === "interested") return 1
    if (p.status === "quoted") return 2
    if (p.status === "follow_up_pending") return 3
    if (p.status === "new") return 4
    if (p.status === "contacted") return 5
    if (p.status === "not_interested") return 6
    if (p.status === "won") return 7
    return 8 // lost / passed
}

function renderStageBadge(status: string) {
    switch (status) {
        case "new":
            return <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 font-bold uppercase text-[10px]">New</Badge>
        case "contacted":
            return <Badge className="bg-blue-950 text-blue-400 border-blue-800 font-bold uppercase text-[10px]">Contacted</Badge>
        case "interested":
            return <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 font-bold uppercase text-[10px]">Interested</Badge>
        case "quoted":
            return <Badge className="bg-primary/20 text-primary border-primary/40 font-bold uppercase text-[10px]">Quoted</Badge>
        case "won":
            return <Badge className="bg-green-950 text-green-400 border-green-800 font-bold uppercase text-[10px]">Won</Badge>
        case "lost":
            return <Badge className="bg-red-950 text-red-400 border-red-800 font-bold uppercase text-[10px]">Lost</Badge>
        case "not_interested":
            return <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 font-bold uppercase text-[10px]">Not Interested</Badge>
        case "follow_up_pending":
            return <Badge className="bg-amber-950 text-amber-400 border-amber-800 font-bold uppercase text-[10px]">Follow-up</Badge>
        case "passed":
            return <Badge className="bg-zinc-800 text-zinc-500 border-zinc-700 font-bold uppercase text-[10px]">Passed</Badge>
        default:
            return <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 font-bold uppercase text-[10px]">{status}</Badge>
    }
}

const EMPTY_FORM: ProspectInput = {
    name: "", location: "", ownersEntity: "",
    propertyManagerName: "", propertyManagerEmail: "", propertyManagerPhone: "",
    receptionistEmail: "", companyMainPhone: "",
    category: "Niche", accessMoat: "", whyDronesMatter: "", estimatedValue: "medium", notes: ""
}

export function ProspectsClient({
    prospects: initialProspects,
    sender,
    quotes = [],
    clients = [],
    projects = [],
    onOpenScanner
}: ProspectsClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [prospects, setProspects] = useState<ProspectDTO[]>(initialProspects || [])

    useEffect(() => {
        setProspects(initialProspects || [])
    }, [initialProspects])

    // Filters
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [sourceFilter, setSourceFilter] = useState("all")

    // Side panel state
    const [selectedProspect, setSelectedProspect] = useState<ProspectDTO | null>(null)
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)

    // Log result modal state
    const [logResultModalOpen, setLogResultModalOpen] = useState(false)
    const [selectedCallbackDate, setSelectedCallbackDate] = useState("")
    const [notInterestedReason, setNotInterestedReason] = useState("Existing contract in place")

    // Working state inside side panel
    const [noteDraft, setNoteDraft] = useState("")
    const [isSavingNotes, setIsSavingNotes] = useState(false)
    const [draftCopied, setDraftCopied] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)

    // Add / Edit Prospect Dialog
    const [formOpen, setFormOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<ProspectInput>(EMPTY_FORM)
    const [formSaving, setFormSaving] = useState(false)

    // Open prospect directly if query param matches
    useEffect(() => {
        const pId = searchParams?.get("prospectId")
        if (pId) {
            const found = prospects.find(p => p.id === pId)
            if (found) {
                openProspect(found)
            }
        }
    }, [searchParams, prospects])

    const setField = (k: keyof ProspectInput, v: string) => setForm(prev => ({ ...prev, [k]: v }))

    const applyUpdated = (updated: ProspectDTO) => {
        setProspects(prev => prev.map(p => p.id === updated.id ? updated : p))
        if (selectedProspect?.id === updated.id) {
            setSelectedProspect(updated)
            setNoteDraft(updated.notes || "")
        }
    }

    const openProspect = (p: ProspectDTO) => {
        setSelectedProspect(p)
        setNoteDraft(p.notes || "")
        setIsSidePanelOpen(true)
    }

    const closeSidePanel = () => {
        setIsSidePanelOpen(false)
        setSelectedProspect(null)
    }

    // Map linked client, quote, project for the selected prospect
    const linkedClient = useMemo(() => {
        if (!selectedProspect) return null
        return clients.find(c =>
            c.customFields?.prospectId === selectedProspect.id ||
            c.name.trim().toLowerCase() === selectedProspect.name.trim().toLowerCase()
        ) || null
    }, [selectedProspect, clients])

    const linkedQuotes = useMemo(() => {
        if (!selectedProspect) return []
        return quotes.filter(q =>
            (linkedClient && q.clientId === linkedClient.id) ||
            q.site?.toLowerCase().includes(selectedProspect.name.toLowerCase()) ||
            q.notes?.includes(selectedProspect.id)
        )
    }, [selectedProspect, linkedClient, quotes])

    const linkedProject = useMemo(() => {
        if (!selectedProspect) return null
        return projects.find(prj =>
            (linkedClient && prj.clientId === linkedClient.id) ||
            prj.name.toLowerCase().includes(selectedProspect.name.toLowerCase())
        ) || null
    }, [selectedProspect, linkedClient, projects])

    // ---- 3 Top Tiles Counts ----
    const dueTodayCount = useMemo(() => {
        return prospects.filter(isFollowupDue).length
    }, [prospects])

    const interestedCount = useMemo(() => {
        return prospects.filter(p => p.status === "interested").length
    }, [prospects])

    const quotesOutMetrics = useMemo(() => {
        const outQuotes = quotes.filter(q => q.status === "SENT" || q.status === "DRAFT" || q.status === "PENDING")
        const totalVal = outQuotes.reduce((acc, q) => acc + (q.total || 0), 0)
        return { count: outQuotes.length, total: totalVal }
    }, [quotes])

    // ---- Filtered & Sorted Table ----
    const filteredProspects = useMemo(() => {
        const q = searchQuery.toLowerCase().trim()
        return prospects
            .filter(p => {
                const textMatch = !q ||
                    p.name.toLowerCase().includes(q) ||
                    (p.location || "").toLowerCase().includes(q) ||
                    (p.ownersEntity || "").toLowerCase().includes(q) ||
                    (p.propertyManagerName || "").toLowerCase().includes(q) ||
                    (p.propertyManagerPhone || "").toLowerCase().includes(q) ||
                    (p.companyMainPhone || "").toLowerCase().includes(q)

                let statusMatch = true
                if (statusFilter === "due_today") {
                    statusMatch = isFollowupDue(p)
                } else if (statusFilter === "quoted") {
                    statusMatch = p.status === "quoted" || quotes.some(q => q.clientId && clients.some(c => c.id === q.clientId && (c.customFields?.prospectId === p.id || c.name.toLowerCase() === p.name.toLowerCase())))
                } else if (statusFilter !== "all") {
                    statusMatch = p.status === statusFilter
                }

                const categoryMatch = categoryFilter === "all" || p.category === categoryFilter
                const sourceMatch = sourceFilter === "all" || p.source === sourceFilter

                return textMatch && statusMatch && categoryMatch && sourceMatch
            })
            .sort((a, b) => {
                // Default: next follow-up first
                const aDue = isFollowupDue(a)
                const bDue = isFollowupDue(b)
                if (aDue && !bDue) return -1
                if (!aDue && bDue) return 1

                const da = a.nextFollowupDate ? new Date(a.nextFollowupDate).getTime() : Infinity
                const db = b.nextFollowupDate ? new Date(b.nextFollowupDate).getTime() : Infinity
                if (da !== db) return da - db

                return urgencyRank(a) - urgencyRank(b)
            })
    }, [prospects, searchQuery, statusFilter, categoryFilter, sourceFilter, quotes, clients])

    // ---- 1-Tap Handlers ----
    const handleLogResult = async (result: 'no_answer' | 'interested' | 'callback' | 'not_interested', details?: { date?: string; reason?: string }) => {
        if (!selectedProspect) return
        setBusyId(selectedProspect.id)
        try {
            const res: any = await logResultAction(selectedProspect.id, result, details)
            if (!res.success) {
                alert(res.error || "Failed to log result")
                return
            }
            if (res.prospect) {
                applyUpdated(res.prospect)
            }
            setLogResultModalOpen(false)
            router.refresh()
        } catch (err: any) {
            console.error(err)
            alert(err.message || "Failed to log result")
        } finally {
            setBusyId(null)
        }
    }

    const handleSaveNotes = async () => {
        if (!selectedProspect) return
        setIsSavingNotes(true)
        try {
            const res = await saveProspectNotesAction(selectedProspect.id, noteDraft)
            if (!res.success) {
                alert(res.error)
                return
            }
            applyUpdated(res.data)
            router.refresh()
        } finally {
            setIsSavingNotes(false)
        }
    }

    const openEditContact = (p: ProspectDTO) => {
        setEditingId(p.id)
        setForm({
            name: p.name,
            location: p.location || "",
            ownersEntity: p.ownersEntity || "",
            propertyManagerName: p.propertyManagerName || "",
            propertyManagerEmail: p.propertyManagerEmail || "",
            propertyManagerPhone: p.propertyManagerPhone || "",
            receptionistEmail: p.receptionistEmail || "",
            companyMainPhone: p.companyMainPhone || "",
            category: p.category,
            accessMoat: p.accessMoat || "",
            whyDronesMatter: p.whyDronesMatter || "",
            estimatedValue: p.estimatedValue,
            notes: p.notes || ""
        })
        setFormOpen(true)
    }

    const handleSubmitForm = async () => {
        if (!form.name?.trim()) { alert("Building / company name is required."); return }
        setFormSaving(true)
        try {
            const res = editingId
                ? await updateProspectDetailsAction(editingId, form)
                : await addProspectAction(form)
            if (!res.success) { alert(res.error); return }
            if (editingId) {
                applyUpdated(res.data)
            } else {
                setProspects(prev => [res.data, ...prev])
            }
            setFormOpen(false)
            router.refresh()
        } catch (err: any) {
            alert(err?.message || "Failed to save prospect")
        } finally {
            setFormSaving(false)
        }
    }

    const handleExportCsv = () => {
        const csv = prospectsToCsv(prospects)
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `sales-pipeline-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const currentEmailDraft = useMemo(() => {
        if (!selectedProspect) return null
        return generateProspectEmail(selectedProspect, prospects, sender)
    }, [selectedProspect, prospects, sender])

    const handleCopyDraft = async () => {
        if (!currentEmailDraft) return
        const full = `To: ${currentEmailDraft.to || "(no email on file)"}\nSubject: ${currentEmailDraft.subject}\n\n${currentEmailDraft.body}`
        await navigator.clipboard.writeText(full)
        setDraftCopied(true)
        setTimeout(() => setDraftCopied(false), 2000)
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center gap-3">
                        Sales Pipeline
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide">
                        Core Targets, outreach & client conversion
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Next Actions Pill */}
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#14141E] border border-white/10 text-xs text-gray-300">
                        <Flame className="h-4 w-4 text-primary shrink-0" />
                        <span><strong>Next Actions:</strong> {dueTodayCount} calls due · {interestedCount} interested · {quotesOutMetrics.count} quotes out</span>
                    </div>

                    {/* Options Menu (...) */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-white/10 bg-[#14141E] hover:bg-white/5 text-gray-300">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-56 p-2 bg-[#14141E] border border-white/10 text-white rounded-2xl shadow-2xl space-y-1">
                            <button
                                onClick={() => {
                                    setEditingId(null)
                                    setForm(EMPTY_FORM)
                                    setFormOpen(true)
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-white/5 rounded-xl flex items-center gap-2"
                            >
                                <Plus className="h-3.5 w-3.5 text-primary" /> Discover New Property
                            </button>
                            {onOpenScanner && (
                                <button
                                    onClick={onOpenScanner}
                                    className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-white/5 rounded-xl flex items-center gap-2"
                                >
                                    <Filter className="h-3.5 w-3.5 text-blue-400" /> Open Drone Scanner
                                </button>
                            )}
                            <button
                                onClick={handleExportCsv}
                                className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-white/5 rounded-xl flex items-center gap-2"
                            >
                                <Download className="h-3.5 w-3.5 text-green-400" /> Export CSV
                            </button>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* PART 3 REQUIREMENT: 3 TILES ONLY: "Call today" (due + overdue), "Interested", "Quotes out (R value)" */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tile 1: Call Today */}
                <button
                    onClick={() => setStatusFilter(prev => prev === "due_today" ? "all" : "due_today")}
                    className="text-left w-full group focus:outline-none"
                >
                    <Card className={`transition-all rounded-2xl p-5 border shadow-xl ${statusFilter === "due_today" ? "bg-primary/10 border-primary shadow-primary/20" : "bg-[#14141E]/80 backdrop-blur-md border-white/5 hover:border-white/20"}`}>
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-black uppercase tracking-wider text-muted-foreground group-hover:text-white transition-colors">
                                Call Today
                            </div>
                            <Clock className={`h-4 w-4 ${dueTodayCount > 0 ? "text-amber-400" : "text-muted-foreground"}`} />
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-4xl font-black text-white">{dueTodayCount}</span>
                            <span className="text-xs font-medium text-muted-foreground">due + overdue</span>
                        </div>
                        <div className="mt-2 text-[11px] font-bold text-amber-400/90 flex items-center gap-1">
                            {dueTodayCount > 0 ? "● Action required today" : "✓ All caught up"}
                        </div>
                    </Card>
                </button>

                {/* Tile 2: Interested */}
                <button
                    onClick={() => setStatusFilter(prev => prev === "interested" ? "all" : "interested")}
                    className="text-left w-full group focus:outline-none"
                >
                    <Card className={`transition-all rounded-2xl p-5 border shadow-xl ${statusFilter === "interested" ? "bg-emerald-500/10 border-emerald-500 shadow-emerald-500/20" : "bg-[#14141E]/80 backdrop-blur-md border-white/5 hover:border-white/20"}`}>
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-black uppercase tracking-wider text-muted-foreground group-hover:text-white transition-colors">
                                Interested
                            </div>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-4xl font-black text-white">{interestedCount}</span>
                            <span className="text-xs font-medium text-muted-foreground">leads</span>
                        </div>
                        <div className="mt-2 text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            Ready for quotation
                        </div>
                    </Card>
                </button>

                {/* Tile 3: Quotes Out (R value) */}
                <button
                    onClick={() => setStatusFilter(prev => prev === "quoted" ? "all" : "quoted")}
                    className="text-left w-full group focus:outline-none"
                >
                    <Card className={`transition-all rounded-2xl p-5 border shadow-xl ${statusFilter === "quoted" ? "bg-primary/10 border-primary shadow-primary/20" : "bg-[#14141E]/80 backdrop-blur-md border-white/5 hover:border-white/20"}`}>
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-black uppercase tracking-wider text-muted-foreground group-hover:text-white transition-colors">
                                Quotes Out
                            </div>
                            <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white">
                                R {quotesOutMetrics.total.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">({quotesOutMetrics.count})</span>
                        </div>
                        <div className="mt-2 text-[11px] font-bold text-primary flex items-center gap-1">
                            Awaiting client decision
                        </div>
                    </Card>
                </button>
            </div>

            {/* Filters: 1 search box + Stage dropdown + "More" */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search building, contact person, phone, suburb..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-[#14141E] border-white/10 rounded-xl h-10 text-white placeholder:text-zinc-500 focus-visible:ring-primary"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-10 px-3 rounded-xl border border-white/10 bg-[#14141E] text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="all">All Stages</option>
                        <option value="due_today">⚠ Call Today (Due / Overdue)</option>
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="interested">Interested</option>
                        <option value="quoted">Quoted</option>
                        <option value="won">Won</option>
                        <option value="follow_up_pending">Follow-up Pending</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="passed">Passed</option>
                    </select>

                    {/* Secondary Filters under "More" */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-10 px-3 rounded-xl border border-white/10 bg-[#14141E] hover:bg-white/5 text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <Filter className="h-3.5 w-3.5" />
                                More Filters
                                {(categoryFilter !== "all" || sourceFilter !== "all") && (
                                    <span className="h-2 w-2 rounded-full bg-primary" />
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-4 bg-[#14141E] border border-white/10 rounded-2xl shadow-2xl text-white space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-gray-400 uppercase">Category</Label>
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="w-full h-9 px-2 rounded-lg border border-white/10 bg-black/40 text-xs text-white"
                                >
                                    <option value="all">All Categories</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-gray-400 uppercase">Target Source</Label>
                                <select
                                    value={sourceFilter}
                                    onChange={(e) => setSourceFilter(e.target.value)}
                                    className="w-full h-9 px-2 rounded-lg border border-white/10 bg-black/40 text-xs text-white"
                                >
                                    <option value="all">All Sources</option>
                                    <option value="fable_37">Core Targets</option>
                                    <option value="user_discovery">My Discoveries</option>
                                </select>
                            </div>

                            {(categoryFilter !== "all" || sourceFilter !== "all") && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setCategoryFilter("all"); setSourceFilter("all"); }}
                                    className="w-full text-xs text-primary font-bold hover:bg-primary/10"
                                >
                                    Reset Filters
                                </Button>
                            )}
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="text-xs text-muted-foreground font-medium self-center">
                    Showing <strong>{filteredProspects.length}</strong> of {prospects.length} prospects
                </div>
            </div>

            {/* PART 3 REQUIREMENT: Clean table, 1 line per prospect */}
            <div className="rounded-2xl border border-white/10 bg-[#14141E] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-white/10 bg-black/30 text-muted-foreground uppercase text-[10px] tracking-wider font-black">
                                <th className="p-3.5 pl-4">Company</th>
                                <th className="p-3.5">Contact Person</th>
                                <th className="p-3.5">Phone</th>
                                <th className="p-3.5">Stage</th>
                                <th className="p-3.5">Last Contact</th>
                                <th className="p-3.5 pr-4">Next Follow-up</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredProspects.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                                        No prospects match your search or filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredProspects.map((p) => {
                                    const due = isFollowupDue(p)
                                    const hasContact = Boolean(p.propertyManagerName?.trim())
                                    const hasPhone = Boolean(p.propertyManagerPhone?.trim() || p.companyMainPhone?.trim())
                                    const phoneToDisplay = p.propertyManagerPhone?.trim() || p.companyMainPhone?.trim() || ""

                                    return (
                                        <tr
                                            key={p.id}
                                            onClick={() => openProspect(p)}
                                            className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${selectedProspect?.id === p.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                                        >
                                            {/* Company Column */}
                                            <td className="p-3.5 pl-4 font-semibold text-white whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-white hover:text-primary transition-colors">
                                                        {p.name}
                                                    </span>
                                                    {/* Quiet grey category tag */}
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                                        {p.category}
                                                    </span>
                                                </div>
                                                {p.location && (
                                                    <div className="text-[11px] text-zinc-500 font-normal">
                                                        {p.location}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Contact Person Column */}
                                            <td className="p-3.5 whitespace-nowrap">
                                                {hasContact ? (
                                                    <span className="text-zinc-200 font-medium">{p.propertyManagerName}</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openEditContact(p)
                                                        }}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full hover:bg-amber-500/20"
                                                    >
                                                        <Plus className="h-3 w-3" /> Add contact
                                                    </button>
                                                )}
                                            </td>

                                            {/* Phone Column */}
                                            <td className="p-3.5 whitespace-nowrap">
                                                {hasPhone ? (
                                                    <a
                                                        href={`tel:${phoneToDisplay}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="inline-flex items-center gap-1 text-zinc-300 hover:text-primary transition-colors font-medium"
                                                    >
                                                        <Phone className="h-3 w-3 text-zinc-500" />
                                                        {phoneToDisplay}
                                                    </a>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openEditContact(p)
                                                        }}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full hover:bg-amber-500/20"
                                                    >
                                                        <Plus className="h-3 w-3" /> Add phone
                                                    </button>
                                                )}
                                            </td>

                                            {/* Stage Column */}
                                            <td className="p-3.5 whitespace-nowrap">
                                                {renderStageBadge(p.status)}
                                            </td>

                                            {/* Last Contact Column */}
                                            <td className="p-3.5 whitespace-nowrap text-zinc-400">
                                                {p.lastContactDate ? (
                                                    <span>{fmtDate(p.lastContactDate)}</span>
                                                ) : (
                                                    <span className="text-zinc-600">Never</span>
                                                )}
                                            </td>

                                            {/* Next Follow-up Column */}
                                            <td className="p-3.5 pr-4 whitespace-nowrap">
                                                {p.nextFollowupDate ? (
                                                    <div className={`flex items-center gap-1.5 ${due ? "text-amber-400 font-bold" : "text-zinc-300"}`}>
                                                        {due && <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                                                        <span>{fmtDate(p.nextFollowupDate)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-600">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PART 3 REQUIREMENT: Slide-over Side Panel on Row Click */}
            {isSidePanelOpen && selectedProspect && (
                <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                        <div className="w-screen max-w-md lg:max-w-xl bg-[#14141E] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                            {/* Panel Header */}
                            <div className="p-6 border-b border-white/10 flex items-start justify-between gap-4 bg-black/20">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                            {selectedProspect.category}
                                        </span>
                                        {renderStageBadge(selectedProspect.status)}
                                    </div>
                                    <h2 className="text-xl font-black text-white">{selectedProspect.name}</h2>
                                    {selectedProspect.location && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{selectedProspect.location}</p>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={closeSidePanel}
                                    className="rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            {/* Panel Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Top Quick Buttons: Call, WhatsApp, Log Result */}
                                <div className="grid grid-cols-3 gap-2">
                                    <a
                                        href={`tel:${selectedProspect.propertyManagerPhone || selectedProspect.companyMainPhone || ""}`}
                                        className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/30 transition-all"
                                    >
                                        <Phone className="h-4 w-4" /> Call
                                    </a>
                                    <a
                                        href={`https://wa.me/${(selectedProspect.propertyManagerPhone || selectedProspect.companyMainPhone || "").replace(/[^0-9]/g, "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-11 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <MessageSquare className="h-4 w-4" /> WhatsApp
                                    </a>
                                    <Button
                                        onClick={() => setLogResultModalOpen(true)}
                                        className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
                                    >
                                        <CheckCircle2 className="h-4 w-4" /> Log Result
                                    </Button>
                                </div>

                                {/* PART 4: LINK EVERYTHING - CRM Client & Quote & Project */}
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase text-gray-400">Linked Business Assets</span>
                                        {selectedProspect.status === "interested" && !linkedQuotes.length && (
                                            <Link
                                                href={`/invoices/new?type=QUOTE&clientId=${linkedClient?.id || ""}&site=${encodeURIComponent(selectedProspect.location || selectedProspect.name)}&prospectId=${selectedProspect.id}`}
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                                            >
                                                <Plus className="h-3 w-3" /> Create Quote
                                            </Link>
                                        )}
                                    </div>

                                    {linkedClient ? (
                                        <div className="p-3 rounded-xl bg-[#14141E] border border-white/5 flex items-center justify-between">
                                            <div>
                                                <div className="text-[10px] font-mono text-muted-foreground uppercase">CRM Client</div>
                                                <div className="text-xs font-bold text-white">{linkedClient.name}</div>
                                            </div>
                                            <Link
                                                href={`/clients/${linkedClient.id}`}
                                                className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                                            >
                                                View CRM <ExternalLink className="h-3 w-3" />
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-xl bg-[#14141E] border border-dashed border-white/10 text-xs text-zinc-400 flex items-center justify-between">
                                            <span>Not yet converted to CRM client</span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleLogResult("interested")}
                                                className="h-7 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                            >
                                                Convert Now
                                            </Button>
                                        </div>
                                    )}

                                    {linkedQuotes.length > 0 && (
                                        <div className="space-y-1.5">
                                            {linkedQuotes.map(q => (
                                                <div key={q.id} className="p-3 rounded-xl bg-[#14141E] border border-white/5 flex items-center justify-between">
                                                    <div>
                                                        <div className="text-[10px] font-mono text-muted-foreground uppercase">
                                                            Quote #{q.number} ({q.status})
                                                        </div>
                                                        <div className="text-xs font-bold text-white">
                                                            R {(q.total || 0).toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <Link
                                                        href={`/invoices/${q.id}`}
                                                        className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                                                    >
                                                        Open Quote <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {linkedProject && (
                                        <div className="p-3 rounded-xl bg-[#14141E] border border-white/5 flex items-center justify-between">
                                            <div>
                                                <div className="text-[10px] font-mono text-muted-foreground uppercase">
                                                    Project ({linkedProject.status})
                                                </div>
                                                <div className="text-xs font-bold text-white">{linkedProject.name}</div>
                                            </div>
                                            <Link
                                                href={`/projects/${linkedProject.id}`}
                                                className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                                            >
                                                Open Job <ExternalLink className="h-3 w-3" />
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                {/* Contact Details Card */}
                                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase text-gray-400">Contact Cascade</span>
                                        <button
                                            type="button"
                                            onClick={() => openEditContact(selectedProspect)}
                                            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            <Pencil className="h-3 w-3" /> Edit
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase">Property Manager</div>
                                            <div className="font-semibold text-white mt-0.5">
                                                {selectedProspect.propertyManagerName || "—"}
                                            </div>
                                            {selectedProspect.propertyManagerPhone && (
                                                <a href={`tel:${selectedProspect.propertyManagerPhone}`} className="text-zinc-400 hover:text-white block mt-0.5">
                                                    {selectedProspect.propertyManagerPhone}
                                                </a>
                                            )}
                                            {selectedProspect.propertyManagerEmail && (
                                                <a href={`mailto:${selectedProspect.propertyManagerEmail}`} className="text-zinc-400 hover:text-white block truncate">
                                                    {selectedProspect.propertyManagerEmail}
                                                </a>
                                            )}
                                        </div>

                                        <div>
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase">Switchboard / Reception</div>
                                            <div className="font-semibold text-white mt-0.5">
                                                {selectedProspect.companyMainPhone || "—"}
                                            </div>
                                            {selectedProspect.receptionistEmail && (
                                                <a href={`mailto:${selectedProspect.receptionistEmail}`} className="text-zinc-400 hover:text-white block truncate mt-0.5">
                                                    {selectedProspect.receptionistEmail}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Notes Section */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold text-gray-300">Operational Notes</Label>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleSaveNotes}
                                            disabled={isSavingNotes}
                                            className="h-7 text-xs font-bold text-primary hover:bg-primary/10"
                                        >
                                            {isSavingNotes ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                            Save Notes
                                        </Button>
                                    </div>
                                    <Textarea
                                        value={noteDraft}
                                        onChange={(e) => setNoteDraft(e.target.value)}
                                        placeholder="Add notes about decision makers, building access, rope requirements..."
                                        className="bg-black/40 border-white/10 rounded-xl text-xs text-white min-h-[80px]"
                                    />
                                </div>

                                {/* Core Target Intelligence */}
                                {(selectedProspect.whyDronesMatter || selectedProspect.accessMoat) && (
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2 text-xs">
                                        <span className="text-[11px] font-black uppercase text-gray-400">Core Target Intelligence</span>
                                        {selectedProspect.whyDronesMatter && (
                                            <div>
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Why Drones Matter: </span>
                                                <span className="text-zinc-300">{selectedProspect.whyDronesMatter}</span>
                                            </div>
                                        )}
                                        {selectedProspect.accessMoat && (
                                            <div>
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Access Moat: </span>
                                                <span className="text-zinc-300">{selectedProspect.accessMoat}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Email Draft helper */}
                                {currentEmailDraft && (
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black uppercase text-gray-400">Outreach Email Draft</span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleCopyDraft}
                                                className="h-7 text-[11px] font-bold border-white/10 bg-[#14141E] text-white hover:bg-white/5"
                                            >
                                                {draftCopied ? <Check className="h-3 w-3 text-emerald-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                                {draftCopied ? "Copied" : "Copy Draft"}
                                            </Button>
                                        </div>
                                        <div className="text-xs text-zinc-300 font-mono bg-black/40 p-3 rounded-xl border border-white/5 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                            <strong>Subject:</strong> {currentEmailDraft.subject}
                                            <div className="mt-2 text-zinc-400">{currentEmailDraft.body}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Contact History Timeline */}
                                <div className="space-y-3">
                                    <span className="text-[11px] font-black uppercase text-gray-400">Contact & Status History</span>
                                    {(!selectedProspect.contactLog || selectedProspect.contactLog.length === 0) ? (
                                        <div className="text-xs text-zinc-500 italic p-3 rounded-xl bg-black/20 border border-white/5">
                                            No contact logged yet. Tap &quot;Log Result&quot; after calling.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {(selectedProspect.contactLog as ContactLogEntry[]).slice().reverse().map((entry, idx) => (
                                                <div key={idx} className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs">
                                                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                                        <span className="uppercase font-mono">{entry.method}</span>
                                                        <span>{new Date(entry.date).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                    </div>
                                                    <div className="text-zinc-200 mt-1 font-medium">{entry.outcome}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PART 3 REQUIREMENT: 1-Tap Log Result Modal */}
            <Dialog open={logResultModalOpen} onOpenChange={setLogResultModalOpen}>
                <DialogContent className="max-w-md bg-[#14141E] border border-white/10 text-white rounded-3xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase text-white flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            Log Call Result: {selectedProspect?.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            One tap updates follow-up dates, creates calendar meetings, and advances pipeline stage.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-3 py-4">
                        {/* 1. No Answer -> 2 working days */}
                        <button
                            type="button"
                            onClick={() => handleLogResult("no_answer")}
                            className="p-4 rounded-2xl bg-[#0d0d15] border border-white/10 hover:border-amber-400/50 hover:bg-amber-500/5 text-left transition-all group"
                        >
                            <div className="text-xs font-black uppercase text-amber-400 group-hover:text-amber-300">
                                No Answer
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-1 font-medium">
                                Auto-schedules follow-up in +2 working days.
                            </div>
                        </button>

                        {/* 2. Interested -> Converted to Client & Offer Quote */}
                        <button
                            type="button"
                            onClick={() => handleLogResult("interested")}
                            className="p-4 rounded-2xl bg-[#0d0d15] border border-white/10 hover:border-emerald-400/50 hover:bg-emerald-500/5 text-left transition-all group"
                        >
                            <div className="text-xs font-black uppercase text-emerald-400 group-hover:text-emerald-300">
                                Interested
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-1 font-medium">
                                Creates Client in CRM and offers quote creation.
                            </div>
                        </button>

                        {/* 3. Call Back Later */}
                        <div className="p-4 rounded-2xl bg-[#0d0d15] border border-white/10 text-left space-y-2 col-span-2">
                            <div className="text-xs font-black uppercase text-blue-400">
                                Call Back Later
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="date"
                                    value={selectedCallbackDate}
                                    onChange={(e) => setSelectedCallbackDate(e.target.value)}
                                    className="bg-black/40 border-white/10 text-xs text-white h-9 rounded-xl"
                                />
                                <Button
                                    size="sm"
                                    disabled={!selectedCallbackDate}
                                    onClick={() => handleLogResult("callback", { date: selectedCallbackDate })}
                                    className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                                >
                                    Set Date
                                </Button>
                            </div>
                        </div>

                        {/* 4. Not Interested -> 6 months window */}
                        <div className="p-4 rounded-2xl bg-[#0d0d15] border border-white/10 text-left space-y-2 col-span-2">
                            <div className="text-xs font-black uppercase text-zinc-400">
                                Not Interested (+6 Months Window)
                            </div>
                            <p className="text-[11px] text-zinc-500">
                                Never deleted. Recontact set for 6 months time.
                            </p>
                            <select
                                value={notInterestedReason}
                                onChange={(e) => setNotInterestedReason(e.target.value)}
                                className="w-full h-9 px-2 rounded-xl border border-white/10 bg-black/40 text-xs text-white"
                            >
                                <option value="Existing contractor in place">Existing contractor in place</option>
                                <option value="Budget constraints / No funds">Budget constraints / No funds</option>
                                <option value="Not currently looking for facade wash">Not currently looking for facade wash</option>
                                <option value="Property manager changed / unreachable">Property manager changed / unreachable</option>
                                <option value="Other">Other</option>
                            </select>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLogResult("not_interested", { reason: notInterestedReason })}
                                className="w-full h-8 rounded-xl border-white/10 text-xs font-bold text-zinc-300 hover:bg-white/5"
                            >
                                Confirm Not Interested
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add / Edit Prospect Modal */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="max-w-lg bg-[#14141E] border border-white/10 text-white rounded-3xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase text-white">
                            {editingId ? "Edit Property / Contact Details" : "Discover New Property"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Update contact cascade, decision makers, and site details.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-3 py-3 max-h-[70vh] overflow-y-auto pr-1">
                        <div className="col-span-2 space-y-1">
                            <Label className="text-[11px] font-bold text-gray-300">Building / Company Name *</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setField("name", e.target.value)}
                                placeholder="e.g. The Silo Hotel"
                                className="bg-black/40 border-white/10 text-xs h-9"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-gray-300">Location / Suburb</Label>
                            <Input
                                value={form.location || ""}
                                onChange={(e) => setField("location", e.target.value)}
                                placeholder="e.g. V&A Waterfront, Cape Town"
                                className="bg-black/40 border-white/10 text-xs h-9"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-gray-300">Category</Label>
                            <select
                                value={form.category || "Niche"}
                                onChange={(e) => setField("category", e.target.value)}
                                className="w-full h-9 px-2 rounded-md border border-white/10 bg-black/40 text-xs text-white"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="col-span-2 border-t border-white/5 pt-2">
                            <span className="text-[10px] font-mono text-primary uppercase font-bold">Contact Cascade</span>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-gray-300">Property Manager Name</Label>
                            <Input
                                value={form.propertyManagerName || ""}
                                onChange={(e) => setField("propertyManagerName", e.target.value)}
                                placeholder="e.g. Johan Smith"
                                className="bg-black/40 border-white/10 text-xs h-9"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-gray-300">Direct Phone</Label>
                            <Input
                                value={form.propertyManagerPhone || ""}
                                onChange={(e) => setField("propertyManagerPhone", e.target.value)}
                                placeholder="e.g. 082 123 4567"
                                className="bg-black/40 border-white/10 text-xs h-9"
                            />
                        </div>

                        <div className="col-span-2 space-y-1">
                            <Label className="text-[11px] font-bold text-gray-300">Property Manager Email</Label>
                            <Input
                                value={form.propertyManagerEmail || ""}
                                onChange={(e) => setField("propertyManagerEmail", e.target.value)}
                                placeholder="e.g. johan@property.co.za"
                                className="bg-black/40 border-white/10 text-xs h-9"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-gray-300">Switchboard Phone</Label>
                            <Input
                                value={form.companyMainPhone || ""}
                                onChange={(e) => setField("companyMainPhone", e.target.value)}
                                placeholder="e.g. 021 555 1234"
                                className="bg-black/40 border-white/10 text-xs h-9"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-gray-300">Reception Email</Label>
                            <Input
                                value={form.receptionistEmail || ""}
                                onChange={(e) => setField("receptionistEmail", e.target.value)}
                                placeholder="e.g. info@building.co.za"
                                className="bg-black/40 border-white/10 text-xs h-9"
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-3 border-t border-white/10 flex items-center justify-between">
                        <Button
                            variant="ghost"
                            onClick={() => setFormOpen(false)}
                            className="text-xs text-gray-400"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitForm}
                            disabled={formSaving}
                            className="bg-primary text-black font-bold text-xs"
                        >
                            {formSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                            Save Property
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
