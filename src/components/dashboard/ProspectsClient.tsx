"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    updateProspectStatusAction,
    logProspectContactAction,
    setProspectFollowupAction,
    saveProspectNotesAction,
    addProspectAction,
    updateProspectDetailsAction,
    deleteProspectAction,
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
    Trash2,
    Pencil,
    CalendarClock,
    ChevronDown,
    ChevronUp,
    History,
    Save,
    ExternalLink
} from "lucide-react"

const CATEGORIES = ["Water Facing", "No Gondola", "Heritage", "Rooftop Solar", "Multiplier", "Niche"]
const VALUES = ["low", "medium", "high", "strategic_multiplier"]

interface ProspectsClientProps {
    prospects: ProspectDTO[]
    sender: SenderInfo
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
    if (p.status === "won" || p.status === "passed") return false
    return startOfDay(new Date(p.nextFollowupDate)) <= startOfDay(new Date())
}

// Lower number = shown first in the call queue
function urgencyRank(p: ProspectDTO): number {
    if (isFollowupDue(p)) return 0
    if (p.status === "new") return 1
    if (p.status === "interested") return 2
    if (p.status === "follow_up_pending") return 3
    if (p.status === "contacted") return 4
    if (p.status === "not_interested") return 5
    if (p.status === "won") return 6
    return 7 // passed
}

function statusBadge(status: string) {
    switch (status) {
        case "new":
            return <Badge className="bg-sky-950 text-sky-400 border-sky-800 font-black uppercase text-[10px]">New</Badge>
        case "contacted":
            return <Badge className="bg-violet-950 text-violet-400 border-violet-800 font-black uppercase text-[10px]">Contacted</Badge>
        case "interested":
            return <Badge className="bg-pink-950 text-pink-400 border-pink-800 font-black uppercase text-[10px]">Interested</Badge>
        case "not_interested":
            return <Badge className="bg-zinc-800 text-zinc-500 border-zinc-700 font-black uppercase text-[10px]">Not Interested</Badge>
        case "follow_up_pending":
            return <Badge className="bg-amber-950 text-amber-500 border-amber-800 font-black uppercase text-[10px]">Follow-up</Badge>
        case "won":
            return <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 font-black uppercase text-[10px]">Won</Badge>
        case "passed":
            return <Badge className="bg-zinc-800 text-zinc-500 border-zinc-700 font-black uppercase text-[10px]">Passed</Badge>
        default:
            return <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 font-black uppercase text-[10px]">{status}</Badge>
    }
}

function categoryBadge(category: string) {
    const colors: Record<string, string> = {
        "Water Facing": "bg-blue-950 text-blue-400 border-blue-800",
        "Heritage": "bg-orange-950 text-orange-400 border-orange-800",
        "Rooftop Solar": "bg-yellow-950 text-yellow-400 border-yellow-800",
        "Multiplier": "bg-purple-950 text-purple-400 border-purple-800",
        "No Gondola": "bg-teal-950 text-teal-400 border-teal-800",
        "Niche": "bg-zinc-800 text-zinc-300 border-zinc-700"
    }
    return (
        <Badge className={`${colors[category] || colors["Niche"]} font-black uppercase text-[9px]`}>
            {category}
        </Badge>
    )
}

const EMPTY_FORM: ProspectInput = {
    name: "", location: "", ownersEntity: "",
    propertyManagerName: "", propertyManagerEmail: "", propertyManagerPhone: "",
    receptionistEmail: "", companyMainPhone: "",
    category: "Niche", accessMoat: "", whyDronesMatter: "", estimatedValue: "medium", notes: ""
}

export function ProspectsClient({ prospects: initialProspects, sender }: ProspectsClientProps) {
    const router = useRouter()
    const [prospects, setProspects] = useState<ProspectDTO[]>(initialProspects || [])

    useEffect(() => {
        setProspects(initialProspects || [])
    }, [initialProspects])

    // Filters
    const [searchQuery, setSearchQuery] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")
    const [sourceFilter, setSourceFilter] = useState("all")
    const [valueFilter, setValueFilter] = useState("all")
    const [recencyFilter, setRecencyFilter] = useState("all")

    // Expanded card + per-card working state
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [draftSubject, setDraftSubject] = useState("")
    const [draftBody, setDraftBody] = useState("")
    const [draftTo, setDraftTo] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [followupDate, setFollowupDate] = useState("")
    const [noteDraft, setNoteDraft] = useState("")
    const [callOutcome, setCallOutcome] = useState("")
    const [callMethod, setCallMethod] = useState<"call" | "email" | "whatsapp">("call")
    const [showLog, setShowLog] = useState(false)

    const [busy, setBusy] = useState<Record<string, boolean>>({})

    // Add / Edit dialog
    const [formOpen, setFormOpen] = useState(false)
    const [formSaving, setFormSaving] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<ProspectInput>(EMPTY_FORM)

    const setField = (k: keyof ProspectInput, v: string) => setForm(prev => ({ ...prev, [k]: v }))

    const applyUpdated = (updated: ProspectDTO) => {
        setProspects(prev => prev.map(p => p.id === updated.id ? updated : p))
    }

    const openProspect = (p: ProspectDTO) => {
        if (expandedId === p.id) {
            setExpandedId(null)
            return
        }
        const draft = generateProspectEmail(p, prospects, sender)
        setDraftSubject(draft.subject)
        setDraftBody(draft.body)
        setDraftTo(draft.to)
        setFollowupDate(p.nextFollowupDate ? p.nextFollowupDate.slice(0, 10) : "")
        setNoteDraft(p.notes || "")
        setCallOutcome("")
        setShowLog(false)
        setCopied(false)
        setExpandedId(p.id)
    }

    const withBusy = async (id: string, fn: () => Promise<void>) => {
        setBusy(prev => ({ ...prev, [id]: true }))
        try {
            await fn()
        } catch (err: any) {
            console.error(err)
            alert(err?.message || "Action failed")
        } finally {
            setBusy(prev => ({ ...prev, [id]: false }))
        }
    }

    const handleStatus = (p: ProspectDTO, status: string) => withBusy(p.id, async () => {
        const res = await updateProspectStatusAction(p.id, status)
        if (!res.success) { alert(res.error); return }
        applyUpdated(res.data)
        router.refresh()
    })

    const handleSetFollowup = (p: ProspectDTO) => withBusy(p.id, async () => {
        if (!followupDate) { alert("Pick a follow-up date first."); return }
        const res = await setProspectFollowupAction(p.id, followupDate)
        if (!res.success) { alert(res.error); return }
        applyUpdated(res.data)
        router.refresh()
    })

    const handleCopyDraft = async (p: ProspectDTO) => {
        const full = `To: ${draftTo || "(no email on file)"}\nSubject: ${draftSubject}\n\n${draftBody}`
        await navigator.clipboard.writeText(full)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleCopyAndLog = (p: ProspectDTO) => withBusy(p.id, async () => {
        await handleCopyDraft(p)
        const res = await logProspectContactAction(p.id, "email", `Email draft sent: "${draftSubject}"`, draftBody)
        if (!res.success) { alert(res.error); return }
        applyUpdated(res.data)
        router.refresh()
    })

    const handleLogOutcome = (p: ProspectDTO) => withBusy(p.id, async () => {
        if (!callOutcome.trim()) { alert("Describe the outcome first."); return }
        const res = await logProspectContactAction(p.id, callMethod, callOutcome.trim())
        if (!res.success) { alert(res.error); return }
        applyUpdated(res.data)
        setCallOutcome("")
        router.refresh()
    })

    const handleSaveNotes = (p: ProspectDTO) => withBusy(p.id, async () => {
        const res = await saveProspectNotesAction(p.id, noteDraft)
        if (!res.success) { alert(res.error); return }
        applyUpdated(res.data)
        router.refresh()
    })

    const handleDelete = (p: ProspectDTO) => {
        if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
        withBusy(p.id, async () => {
            const res = await deleteProspectAction(p.id)
            if (!res.success) { alert(res.error); return }
            setProspects(prev => prev.filter(x => x.id !== p.id))
            if (expandedId === p.id) setExpandedId(null)
            router.refresh()
        })
    }

    const openAddForm = () => {
        setEditingId(null)
        setForm(EMPTY_FORM)
        setFormOpen(true)
    }

    const openEditForm = (p: ProspectDTO) => {
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
        if (!form.name?.trim()) { alert("Building name is required."); return }
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
            console.error(err)
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
        a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // ---- Daily briefing stats ----
    const briefing = useMemo(() => {
        const dueToday = prospects.filter(isFollowupDue)
        const contactedThisWeek = prospects.filter(p => {
            const d = daysSince(p.lastContactDate)
            return d !== null && d <= 7
        })
        const interestedThisWeek = contactedThisWeek.filter(p => p.status === "interested")
        const newFable = prospects.filter(p => p.source === "fable_37" && p.status === "new")
        const awaitingFollowup = prospects.filter(p => p.status === "follow_up_pending" && !isFollowupDue(p))
        return { dueToday, contactedThisWeek, interestedThisWeek, newFable, awaitingFollowup }
    }, [prospects])

    // ---- Filtering + urgency sort ----
    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase()
        return prospects
            .filter(p => {
                const textMatch = !q ||
                    p.name.toLowerCase().includes(q) ||
                    (p.location || "").toLowerCase().includes(q) ||
                    (p.ownersEntity || "").toLowerCase().includes(q) ||
                    (p.propertyManagerName || "").toLowerCase().includes(q)

                const categoryMatch = categoryFilter === "all" || p.category === categoryFilter
                const statusMatch = statusFilter === "all"
                    ? true
                    : statusFilter === "due_today"
                        ? isFollowupDue(p)
                        : p.status === statusFilter
                const sourceMatch = sourceFilter === "all" || p.source === sourceFilter
                const valueMatch = valueFilter === "all" || p.estimatedValue === valueFilter

                let recencyMatch = true
                const d = daysSince(p.lastContactDate)
                if (recencyFilter === "never") recencyMatch = d === null
                else if (recencyFilter === "0-7") recencyMatch = d !== null && d <= 7
                else if (recencyFilter === "8-30") recencyMatch = d !== null && d >= 8 && d <= 30
                else if (recencyFilter === "30+") recencyMatch = d !== null && d > 30

                return textMatch && categoryMatch && statusMatch && sourceMatch && valueMatch && recencyMatch
            })
            .sort((a, b) => {
                const rank = urgencyRank(a) - urgencyRank(b)
                if (rank !== 0) return rank
                // within same rank: oldest contact (or never) first
                const da = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0
                const db = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0
                return da - db
            })
    }, [prospects, searchQuery, categoryFilter, statusFilter, sourceFilter, valueFilter, recencyFilter])

    const selectClass = "flex h-10 w-full rounded-md border border-white/5 bg-[#0d0d15] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"

    const ACCENTS: Record<string, { card: string; num: string; sub: string }> = {
        red: { card: "hover:border-red-500/30", num: "group-hover:text-red-400", sub: "text-red-500/80" },
        violet: { card: "hover:border-violet-500/30", num: "group-hover:text-violet-400", sub: "text-violet-500/80" },
        sky: { card: "hover:border-sky-500/30", num: "group-hover:text-sky-400", sub: "text-sky-500/80" },
        amber: { card: "hover:border-amber-500/30", num: "group-hover:text-amber-400", sub: "text-amber-500/80" }
    }

    const briefingCard = (label: string, count: number, sub: string, accent: string, onClick: () => void) => {
        const a = ACCENTS[accent] || ACCENTS.sky
        return (
            <button onClick={onClick} className="text-left w-full">
                <Card className={`bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl ${a.card} transition-all group cursor-pointer h-full`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-black text-white ${a.num} transition-colors`}>{count}</div>
                        <span className={`text-[10px] font-bold ${a.sub} uppercase`}>{sub}</span>
                    </CardContent>
                </Card>
            </button>
        )
    }

    return (
        <div className="space-y-6 pb-10">
            {/* Daily Briefing */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {briefingCard("Calls Due Today", briefing.dueToday.length, "Follow-ups due now", "red", () => { setStatusFilter("due_today"); setSourceFilter("all"); setCategoryFilter("all") })}
                {briefingCard("Contacted This Week", briefing.contactedThisWeek.length, `${briefing.interestedThisWeek.length} interested`, "violet", () => { setStatusFilter("contacted"); setRecencyFilter("0-7") })}
                {briefingCard("Fable-37 Untouched", briefing.newFable.length, "Ready for first contact", "sky", () => { setStatusFilter("new"); setSourceFilter("fable_37"); setRecencyFilter("all") })}
                {briefingCard("Awaiting Follow-up", briefing.awaitingFollowup.length, "Scheduled for later", "amber", () => { setStatusFilter("follow_up_pending"); setSourceFilter("all"); setRecencyFilter("all") })}
            </div>

            {/* Toolbar */}
            <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <CardTitle className="text-lg font-black uppercase text-white tracking-wide">Prospect Pipeline</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {prospects.filter(p => p.source === "fable_37").length} Fable-37 core prospects · {prospects.filter(p => p.source !== "fable_37").length} discoveries
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={openAddForm}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] rounded-xl h-9"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Discover New Property
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={handleExportCsv}
                                className="text-white hover:bg-white/5 font-black uppercase text-[10px] rounded-xl h-9 border border-white/10"
                            >
                                <Download className="h-3.5 w-3.5 mr-1" /> CSV
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Search + Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                        <div className="relative sm:col-span-2">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search building, suburb, owner, contact..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-[#0d0d15] border-white/5 focus-visible:ring-emerald-500"
                            />
                        </div>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={selectClass}>
                            <option value="all">All Categories</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
                            <option value="all">All Statuses</option>
                            <option value="due_today">⚠ Follow-up Due</option>
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="interested">Interested</option>
                            <option value="not_interested">Not Interested</option>
                            <option value="follow_up_pending">Follow-up Pending</option>
                            <option value="won">Won</option>
                            <option value="passed">Passed</option>
                        </select>
                        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className={selectClass}>
                            <option value="all">All Sources</option>
                            <option value="fable_37">Fable 37</option>
                            <option value="user_discovery">My Discoveries</option>
                            <option value="web_research">Web Research</option>
                            <option value="referral">Referral</option>
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                            <select value={valueFilter} onChange={e => setValueFilter(e.target.value)} className={selectClass}>
                                <option value="all">Value</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                                <option value="strategic_multiplier">Multiplier</option>
                            </select>
                            <select value={recencyFilter} onChange={e => setRecencyFilter(e.target.value)} className={selectClass}>
                                <option value="all">Contact</option>
                                <option value="never">Never</option>
                                <option value="0-7">0–7d</option>
                                <option value="8-30">8–30d</option>
                                <option value="30+">30d+</option>
                            </select>
                        </div>
                    </div>

                    {/* Prospect list */}
                    <div className="space-y-2">
                        {filtered.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground italic border border-white/5 rounded-xl bg-[#0d0d15]/50">
                                No prospects match your filters.
                            </div>
                        )}
                        {filtered.map(p => {
                            const due = isFollowupDue(p)
                            const expanded = expandedId === p.id
                            const isBusy = !!busy[p.id]
                            const grayed = p.status === "not_interested" || p.status === "passed"
                            const log: ContactLogEntry[] = Array.isArray(p.contactLog) ? p.contactLog : []
                            const dSince = daysSince(p.lastContactDate)

                            return (
                                <div
                                    key={p.id}
                                    className={`rounded-xl border transition-all ${expanded ? "border-emerald-500/30 bg-[#0d0d15]" : "border-white/5 bg-[#0d0d15]/50 hover:border-white/15"} ${grayed && !expanded ? "opacity-50" : ""}`}
                                >
                                    {/* Collapsed row — one tap opens everything */}
                                    <button className="w-full text-left p-3 sm:p-4" onClick={() => openProspect(p)}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-white truncate">{p.name}</span>
                                                    {statusBadge(p.status)}
                                                    {due && (
                                                        <Badge className="bg-red-600/90 text-white border-red-500 font-black uppercase text-[8px] animate-pulse">
                                                            Due {fmtDate(p.nextFollowupDate)}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    {categoryBadge(p.category)}
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" /> {p.location || "—"}
                                                    </span>
                                                    {p.ownersEntity && (
                                                        <span className="text-[10px] text-zinc-500 truncate">{p.ownersEntity}</span>
                                                    )}
                                                    {p.source === "fable_37" && (
                                                        <Badge className="bg-indigo-950 text-indigo-400 border-indigo-800 text-[8px] font-black uppercase">F37</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex flex-col items-end gap-1">
                                                {expanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                                                <span className="text-[9px] text-zinc-500 font-bold uppercase">
                                                    {dSince === null ? "Never contacted" : `${dSince}d ago`}
                                                </span>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Expanded detail */}
                                    {expanded && (
                                        <div className="px-3 sm:px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                                            {/* Contact cascade + moat */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="bg-[#14141e]/60 rounded-xl p-3 border border-white/[0.03] space-y-1.5">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Contact Cascade</span>
                                                    <div className="text-xs text-zinc-300 space-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-zinc-500 w-20 shrink-0">Manager:</span>
                                                            <span className="text-white font-semibold">{p.propertyManagerName || "Unknown"}</span>
                                                        </div>
                                                        {p.propertyManagerEmail && (
                                                            <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-emerald-400" /><span>{p.propertyManagerEmail}</span></div>
                                                        )}
                                                        {p.propertyManagerPhone && (
                                                            <a href={`tel:${p.propertyManagerPhone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-emerald-400 hover:underline">
                                                                <Phone className="h-3 w-3" /><span>{p.propertyManagerPhone}</span>
                                                            </a>
                                                        )}
                                                        {p.receptionistEmail && (
                                                            <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-zinc-500" /><span>{p.receptionistEmail} <span className="text-zinc-500">(reception)</span></span></div>
                                                        )}
                                                        {p.companyMainPhone && (
                                                            <a href={`tel:${p.companyMainPhone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-zinc-400 hover:underline">
                                                                <Phone className="h-3 w-3" /><span>{p.companyMainPhone} <span className="text-zinc-500">(switchboard)</span></span>
                                                            </a>
                                                        )}
                                                        {!p.propertyManagerEmail && !p.receptionistEmail && !p.propertyManagerPhone && !p.companyMainPhone && (
                                                            <span className="text-amber-500 font-bold text-[10px] uppercase">⚠ Contact details incomplete</span>
                                                        )}
                                                    </div>
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.location || ""} Cape Town`)}`}
                                                        target="_blank" rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:underline font-bold uppercase mt-1"
                                                    >
                                                        <ExternalLink className="h-3 w-3" /> Google Maps
                                                    </a>
                                                </div>
                                                <div className="bg-[#14141e]/60 rounded-xl p-3 border border-white/[0.03] space-y-1.5">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Access Moat</span>
                                                    <p className="text-xs text-zinc-300">{p.accessMoat || "—"}</p>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block pt-1">Why Drones Matter</span>
                                                    <p className="text-xs text-zinc-300">{p.whyDronesMatter || "—"}</p>
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <span className="text-[9px] font-black uppercase text-zinc-500">Value:</span>
                                                        <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[9px] font-black uppercase">{p.estimatedValue.replace("_", " ")}</Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* One-tap status buttons */}
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {[
                                                    { key: "contacted", label: "Contacted", cls: "border-violet-700 text-violet-400 hover:bg-violet-950" },
                                                    { key: "interested", label: "Interested", cls: "border-pink-700 text-pink-400 hover:bg-pink-950" },
                                                    { key: "not_interested", label: "Not Interested", cls: "border-zinc-700 text-zinc-400 hover:bg-zinc-900" },
                                                    { key: "won", label: "Won 🎉", cls: "border-emerald-700 text-emerald-400 hover:bg-emerald-950" }
                                                ].map(s => (
                                                    <Button
                                                        key={s.key}
                                                        variant="ghost"
                                                        disabled={isBusy}
                                                        onClick={() => handleStatus(p, s.key)}
                                                        className={`h-8 px-3 rounded-lg border bg-transparent font-black uppercase text-[10px] ${s.cls} ${p.status === s.key ? "ring-1 ring-white/30" : ""}`}
                                                    >
                                                        {p.status === s.key && <Check className="h-3 w-3 mr-1" />}{s.label}
                                                    </Button>
                                                ))}
                                                <div className="flex items-center gap-1.5 ml-auto">
                                                    <CalendarClock className="h-3.5 w-3.5 text-amber-500" />
                                                    <input
                                                        type="date"
                                                        value={followupDate}
                                                        onChange={e => setFollowupDate(e.target.value)}
                                                        className="h-8 rounded-lg border border-white/10 bg-[#14141e] px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        disabled={isBusy}
                                                        onClick={() => handleSetFollowup(p)}
                                                        className="h-8 px-3 rounded-lg border border-amber-700 text-amber-400 hover:bg-amber-950 font-black uppercase text-[10px] bg-transparent"
                                                    >
                                                        Set Follow-up
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Email draft */}
                                            <div className="bg-[#14141e]/60 rounded-xl p-3 border border-white/[0.03] space-y-2">
                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                                        Email Draft — {generateProspectEmail(p, prospects, sender).toLabel}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => handleCopyDraft(p)}
                                                            className="h-7 px-2.5 rounded-lg border border-white/10 text-white hover:bg-white/5 font-black uppercase text-[9px] bg-transparent"
                                                        >
                                                            {copied ? <Check className="h-3 w-3 mr-1 text-emerald-400" /> : <Copy className="h-3 w-3 mr-1" />}
                                                            Copy
                                                        </Button>
                                                        <Button
                                                            disabled={isBusy}
                                                            onClick={() => handleCopyAndLog(p)}
                                                            className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[9px]"
                                                        >
                                                            {isBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                                                            Copy + Log as Sent
                                                        </Button>
                                                    </div>
                                                </div>
                                                <Input
                                                    value={draftSubject}
                                                    onChange={e => setDraftSubject(e.target.value)}
                                                    className="bg-[#0d0d15] border-white/5 text-sm font-semibold focus-visible:ring-emerald-500"
                                                />
                                                <Textarea
                                                    value={draftBody}
                                                    onChange={e => setDraftBody(e.target.value)}
                                                    rows={10}
                                                    className="bg-[#0d0d15] border-white/5 text-sm leading-relaxed focus-visible:ring-emerald-500 font-mono"
                                                />
                                            </div>

                                            {/* Log an outcome */}
                                            <div className="bg-[#14141e]/60 rounded-xl p-3 border border-white/[0.03] space-y-2">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Log Contact Outcome</span>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <select
                                                        value={callMethod}
                                                        onChange={e => setCallMethod(e.target.value as any)}
                                                        className={`${selectClass} sm:w-32`}
                                                    >
                                                        <option value="call">Call</option>
                                                        <option value="email">Email</option>
                                                        <option value="whatsapp">WhatsApp</option>
                                                    </select>
                                                    <Input
                                                        placeholder="e.g. Spoke to reception, PM is Jaco, call back Tuesday"
                                                        value={callOutcome}
                                                        onChange={e => setCallOutcome(e.target.value)}
                                                        onKeyDown={e => { if (e.key === "Enter") handleLogOutcome(p) }}
                                                        className="bg-[#0d0d15] border-white/5 focus-visible:ring-emerald-500 flex-1"
                                                    />
                                                    <Button
                                                        disabled={isBusy}
                                                        onClick={() => handleLogOutcome(p)}
                                                        className="bg-white hover:bg-gray-200 text-black font-black uppercase text-[10px] rounded-lg h-10 px-4"
                                                    >
                                                        Log
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Notes + history + edit/delete */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Notes</span>
                                                        <Button
                                                            variant="ghost"
                                                            disabled={isBusy}
                                                            onClick={() => handleSaveNotes(p)}
                                                            className="h-6 px-2 rounded text-emerald-400 hover:bg-emerald-950 font-black uppercase text-[9px]"
                                                        >
                                                            <Save className="h-3 w-3 mr-1" /> Save
                                                        </Button>
                                                    </div>
                                                    <Textarea
                                                        value={noteDraft}
                                                        onChange={e => setNoteDraft(e.target.value)}
                                                        rows={4}
                                                        placeholder="Objections, price discussion, decision timeline..."
                                                        className="bg-[#0d0d15] border-white/5 text-xs focus-visible:ring-emerald-500"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <button
                                                        className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-white"
                                                        onClick={() => setShowLog(v => !v)}
                                                    >
                                                        <History className="h-3 w-3" /> Contact Log ({log.length}) {showLog ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                    </button>
                                                    {showLog && (
                                                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                                            {log.length === 0 && <p className="text-xs text-zinc-600 italic">No interactions logged yet.</p>}
                                                            {[...log].reverse().map((entry, i) => (
                                                                <div key={i} className="bg-[#0d0d15] rounded-lg p-2 border border-white/[0.03]">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[9px] font-black uppercase text-zinc-400">{entry.method}</span>
                                                                        <span className="text-[9px] text-zinc-600">{fmtDate(entry.date)}</span>
                                                                    </div>
                                                                    <p className="text-xs text-zinc-300 mt-0.5">{entry.outcome}</p>
                                                                    {entry.draft_sent && (
                                                                        <details className="mt-1">
                                                                            <summary className="text-[9px] text-emerald-500 cursor-pointer font-bold uppercase">View sent draft</summary>
                                                                            <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap mt-1 max-h-32 overflow-y-auto">{entry.draft_sent}</pre>
                                                                        </details>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => openEditForm(p)}
                                                            className="h-7 px-2.5 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 font-black uppercase text-[9px] bg-transparent"
                                                        >
                                                            <Pencil className="h-3 w-3 mr-1" /> Edit Details
                                                        </Button>
                                                        {p.source !== "fable_37" && (
                                                            <Button
                                                                variant="ghost"
                                                                disabled={isBusy}
                                                                onClick={() => handleDelete(p)}
                                                                className="h-7 px-2.5 rounded-lg border border-red-900 text-red-400 hover:bg-red-950 font-black uppercase text-[9px] bg-transparent"
                                                            >
                                                                <Trash2 className="h-3 w-3 mr-1" /> Delete
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Add / Edit prospect dialog */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="bg-[#14141E] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-wide">
                            {editingId ? "Edit Prospect" : "Discover New Property"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-zinc-400">
                            {editingId
                                ? "Update building and contact details."
                                : "Found a building that matches the moat? Verify contact details, then save it as a discovery."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1 sm:col-span-2">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Building Name *</Label>
                            <Input value={form.name} onChange={e => setField("name", e.target.value)} className="bg-[#0d0d15] border-white/5" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Location / Suburb</Label>
                            <Input value={form.location} onChange={e => setField("location", e.target.value)} className="bg-[#0d0d15] border-white/5" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Owner / Entity</Label>
                            <Input value={form.ownersEntity} onChange={e => setField("ownersEntity", e.target.value)} className="bg-[#0d0d15] border-white/5" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Category</Label>
                            <select value={form.category} onChange={e => setField("category", e.target.value)} className={selectClass}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Estimated Value</Label>
                            <select value={form.estimatedValue} onChange={e => setField("estimatedValue", e.target.value)} className={selectClass}>
                                {VALUES.map(v => <option key={v} value={v}>{v.replace("_", " ")}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Property Manager Name</Label>
                            <Input value={form.propertyManagerName} onChange={e => setField("propertyManagerName", e.target.value)} className="bg-[#0d0d15] border-white/5" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Property Manager Email</Label>
                            <Input value={form.propertyManagerEmail} onChange={e => setField("propertyManagerEmail", e.target.value)} className="bg-[#0d0d15] border-white/5" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Property Manager Phone</Label>
                            <Input value={form.propertyManagerPhone} onChange={e => setField("propertyManagerPhone", e.target.value)} className="bg-[#0d0d15] border-white/5" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Reception / General Email</Label>
                            <Input value={form.receptionistEmail} onChange={e => setField("receptionistEmail", e.target.value)} className="bg-[#0d0d15] border-white/5" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Company Main Phone</Label>
                            <Input value={form.companyMainPhone} onChange={e => setField("companyMainPhone", e.target.value)} className="bg-[#0d0d15] border-white/5" />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Access Moat (why rope/scaffold fails)</Label>
                            <Textarea rows={2} value={form.accessMoat} onChange={e => setField("accessMoat", e.target.value)} className="bg-[#0d0d15] border-white/5 text-sm" />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                            <Label className="text-[10px] font-black uppercase text-zinc-400">Why Drones Matter (property-specific pitch)</Label>
                            <Textarea rows={2} value={form.whyDronesMatter} onChange={e => setField("whyDronesMatter", e.target.value)} className="bg-[#0d0d15] border-white/5 text-sm" />
                        </div>
                        {form.name && !editingId && (
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.name} ${form.location || ""} Cape Town`)}`}
                                target="_blank" rel="noreferrer"
                                className="sm:col-span-2 inline-flex items-center gap-1 text-[10px] text-blue-400 hover:underline font-bold uppercase"
                            >
                                <ExternalLink className="h-3 w-3" /> Verify on Google Maps
                            </a>
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setFormOpen(false)} className="text-zinc-400 hover:bg-white/5 font-black uppercase text-[10px]">
                            Cancel
                        </Button>
                        <Button
                            disabled={formSaving}
                            onClick={handleSubmitForm}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] rounded-xl"
                        >
                            {formSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                            {editingId ? "Save Changes" : "Add Prospect"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
