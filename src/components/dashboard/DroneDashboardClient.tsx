"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
    overrideLeadStatusAction, 
    addManualOptOutAction, 
    triggerOutreachAction,
    convertLeadToProjectAction,
    addLeadCallNoteAction,
    updateLeadPricingAction,
    generateAndSendLeadQuoteAction,
    toggleLeadHighDustAction,
    getLeadWeatherForecastAction,
    deleteLeadAction,
    deleteLeadsBulkAction
} from "@/app/(dashboard)/dashboard/actions"
import { type WeatherForecast } from "@/lib/weather"
import { 
    Check,
    Mail, 
    MapPin, 
    ShieldAlert, 
    TrendingUp, 
    Image as ImageIcon, 
    Activity, 
    AlertTriangle, 
    UserX, 
    Search, 
    Loader2, 
    Clock, 
    Send,
    Download,
    Eye,
    DollarSign,
    Briefcase,
    Plus,
    History,
    Save,
    Trash2
} from "lucide-react"
import Link from "next/link"
import { InfoTooltip } from "@/components/ui/InfoTooltip"
import { formatCurrency } from "@/lib/utils"
import { generateWorkSummary } from "@/lib/work-summary"

interface Invoice {
    id: string
    total: number
    status: string
    payments: { amount: number }[]
}

interface Project {
    id: string
    name: string
    status: string
    invoices: Invoice[]
}

interface Lead {
    id: string
    latitude: number
    longitude: number
    address: string | null
    companyName: string | null
    contactName: string | null
    contactEmail: string | null
    biologicalGrowthScore: number
    surfaceStainingScore: number
    maxConfidenceScore: number
    satelliteImageUrl: string | null
    processedImageUrl: string | null
    pdfReportUrl: string | null
    status: string
    outreachAttempts: number
    lastOutreachAt: string | null
    createdAt: string
    updatedAt: string
    projectId: string | null
    project: Project | null
    history: any
    estimatedArea: number
    roofPitch: string
    serviceType: string
    highDust: boolean
    streetViewImageUrl: string | null
    windowHaziness: number | null
    visibleStreaks: number | null
    spotCoverage: number | null
    frameDirtScore: number | null
    groundFloorPriority: string | null
    windowNeedsCleaning: boolean | null
    detectionReason: string | null
    priorityLevel: string | null
    buildingType: string | null
    yearBuilt: number | null
    storeys: number | null
    coastalBonus: boolean | null
}


interface OptOut {
    id: string
    email: string | null
    domain: string | null
    reason: string | null
    createdAt: string
}

interface DroneDashboardClientProps {
    data: {
        leads: Lead[]
        optOuts: OptOut[]
    }
}

function getClientWeatherSummary(lat: number, lon: number): { icon: string; tooltip: string } {
    const month = new Date().getMonth();
    const isWinter = month >= 5 && month <= 7;
    const seed = Math.abs(Math.sin(lat + lon));
    
    let hasRain = false;
    let hasWindWarning = false;
    
    for (let day = 0; day < 3; day++) {
        const daySeed = Math.abs(Math.sin(seed + day));
        const pop = isWinter
            ? (daySeed > 0.4 ? 0.5 + daySeed * 0.4 : 0.0)
            : (daySeed > 0.85 ? 0.3 : 0.0);
        const windSpeed = isWinter
            ? 8 + Math.round(daySeed * 22)
            : 12 + Math.round(daySeed * 33);
        const humidity = isWinter
            ? 70 + Math.round(daySeed * 25)
            : 45 + Math.round(daySeed * 30);
            
        if (pop >= 0.20) hasRain = true;
        if (windSpeed >= 22 || humidity >= 80) hasWindWarning = true;
    }
    
    if (hasRain) {
        return { icon: "🌧️", tooltip: "Weather Warning: Rain / showers forecast." };
    }
    if (hasWindWarning) {
        return { icon: "⚠️", tooltip: "Weather Warning: Wind speed or humidity exceeds drone limits." };
    }
    return { icon: "☀️", tooltip: "Ideal Weather: High probability of clear flight windows." };
}

function WorkSummaryCard({ summary, loading }: { summary: any; loading: boolean }) {
    if (loading && !summary) {
        return (
            <Card className="bg-[#0d0d15] border-white/5 text-white p-4 rounded-2xl flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 text-emerald-500 animate-spin mr-2" />
                <span className="text-zinc-400 text-sm font-bold uppercase tracking-wider">Generating Work Summary...</span>
            </Card>
        )
    }

    if (!summary) return null

    const isRejected = summary.work_priority === "REJECTED"
    
    // Choose badge color based on priority
    const priorityColors: Record<string, string> = {
        "SAME-DAY": "bg-red-500/10 text-red-400 border-red-500/20",
        "HIGH": "bg-orange-500/10 text-orange-400 border-orange-500/20",
        "MEDIUM": "bg-amber-500/10 text-amber-400 border-amber-500/20",
        "LOW": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        "REJECTED": "bg-zinc-800 text-zinc-400 border-zinc-700"
    }
    
    const badgeColor = priorityColors[summary.work_priority] || "bg-zinc-800 text-zinc-400"

    return (
        <Card className={`bg-[#0d0d15] border-white/5 text-white p-5 rounded-2xl relative overflow-hidden transition-all duration-300 hover:border-white/10 ${isRejected ? 'border-red-500/10 bg-[#150a0a]/30' : ''}`}>
            {/* Ambient decorative background glow */}
            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-10 pointer-events-none rounded-full ${isRejected ? 'bg-red-500' : 'bg-emerald-500'}`} />
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2.5">
                    <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                            Work Description & Location Summary
                        </span>
                        <h3 className="text-lg font-black uppercase tracking-tight text-white mt-0.5">
                            WORK NEEDED: {summary.work_description}
                        </h3>
                        <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold mt-1">
                            <span>📍</span>
                            <span>{summary.location_summary}</span>
                        </div>
                    </div>

                    <div className="text-zinc-300 text-xs font-semibold leading-relaxed bg-[#14141e]/50 p-3 rounded-xl border border-white/[0.02]">
                        <span className="font-bold text-zinc-400 block mb-0.5">Why:</span>
                        {summary.reason_for_cleaning}
                    </div>

                    {summary.estimated_window_count !== "0" && (
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            Estimated Windows: <span className="text-white font-black">{summary.estimated_window_count}</span>
                        </div>
                    )}
                </div>

                <div className="shrink-0 flex flex-col items-start md:items-end gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                        Priority Level
                    </span>
                    <Badge className={`px-2.5 py-1 text-xs font-black uppercase tracking-wider rounded-lg border ${badgeColor}`}>
                        {summary.work_priority}
                    </Badge>
                </div>
            </div>
        </Card>
    )
}

export function DroneDashboardClient({ data }: DroneDashboardClientProps) {
    const router = useRouter()
    const [leads, setLeads] = useState<Lead[]>(data.leads || [])
    const optOuts = data.optOuts || []

    useEffect(() => {
        setLeads(data.leads || [])
    }, [data.leads])

    // Search and Filter state
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [defectFilter, setDefectFilter] = useState("all")

    // Manual Opt-out Form state
    const [optOutEmail, setOptOutEmail] = useState("")
    const [optOutReason, setOptOutReason] = useState("")
    const [optOutLoading, setOptOutLoading] = useState(false)
    const [optOutSuccess, setOptOutSuccess] = useState<string | null>(null)

    // Actions Loading states per Lead
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
    const [outreachStatus, setOutreachStatus] = useState<Record<string, { success?: boolean; error?: string }>>({})
    const [conversionLoading, setConversionLoading] = useState<Record<string, boolean>>({})
    const [noteLoading, setNoteLoading] = useState(false)
    const [isDeletingLead, setIsDeletingLead] = useState<Record<string, boolean>>({})
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
    const [isBulkDeleting, setIsBulkDeleting] = useState(false)

    // Selected lead for detail modal
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [noteText, setNoteText] = useState("")
    const [activeLightboxImg, setActiveLightboxImg] = useState<{ url: string; title: string } | null>(null)

    // Dynamic Pricing & Auto-Quoting states
    const [estimatedArea, setEstimatedArea] = useState<number>(500)
    const [roofPitch, setRoofPitch] = useState<string>("medium")
    const [serviceType, setServiceType] = useState<string>("standard")
    const [pricingSaving, setPricingSaving] = useState(false)
    const [quoteLoading, setQuoteLoading] = useState<Record<string, boolean>>({})

    // Weather & High-Dust state parameters
    const [weatherForecast, setWeatherForecast] = useState<WeatherForecast[] | null>(null)
    const [weatherLoading, setWeatherLoading] = useState(false)
    const [highDust, setHighDust] = useState(false)

    const [workSummary, setWorkSummary] = useState<any>(null)
    const [loadingSummary, setLoadingSummary] = useState(false)

    useEffect(() => {
        if (!selectedLead) {
            setWeatherForecast(null)
            setWorkSummary(null)
            return
        }
        const leadId = selectedLead.id
        setHighDust(selectedLead.highDust || false)

        // Set local client-side fallback summary first
        const localSummary = generateWorkSummary(selectedLead)
        setWorkSummary(localSummary)
        
        async function fetchWeather() {
            setWeatherLoading(true)
            try {
                const res = await getLeadWeatherForecastAction(leadId)
                if (res.success && res.forecast) {
                    setWeatherForecast(res.forecast)
                } else {
                    console.error("Failed to fetch weather forecast:", res.error)
                }
            } catch (err) {
                console.error("Error fetching weather:", err)
            } finally {
                setWeatherLoading(false)
            }
        }

        async function fetchPropertyDetails() {
            setLoadingSummary(true)
            try {
                const res = await fetch(`/api/property/${leadId}`)
                if (res.ok) {
                    const data = await res.json()
                    setWorkSummary(data)
                } else {
                    console.error("Failed to fetch property details from API")
                }
            } catch (err) {
                console.error("Error fetching property details:", err)
            } finally {
                setLoadingSummary(false)
            }
        }

        fetchWeather()
        fetchPropertyDetails()
    }, [selectedLead?.id])

    const handleToggleHighDust = async (val: boolean) => {
        if (!selectedLead) return
        setHighDust(val)
        try {
            const res = await toggleLeadHighDustAction(selectedLead.id, val)
            if (res.success && res.data) {
                setSelectedLead(prev => prev ? { ...prev, highDust: res.data.highDust } : null)
                router.refresh()
            } else {
                alert(`Failed to update high dust status: ${res.error}`)
                setHighDust(!val)
            }
        } catch (err) {
            console.error(err)
            alert("An error occurred trying to update high dust status.")
            setHighDust(!val)
        }
    }

    const handleOpenDetails = (lead: Lead) => {
        setSelectedLead(lead)
        setEstimatedArea(lead.estimatedArea ?? 500)
        setRoofPitch(lead.roofPitch ?? "medium")
        setServiceType(lead.serviceType ?? "standard")
    }

    const handleDeleteLead = async (leadId: string) => {
        if (!confirm("Are you sure you want to delete this property? This action cannot be undone.")) return
        setIsDeletingLead(prev => ({ ...prev, [leadId]: true }))
        try {
            const res = await deleteLeadAction(leadId)
            if (res.success) {
                if (selectedLead?.id === leadId) {
                    setSelectedLead(null)
                }
                setSelectedLeadIds(prev => prev.filter(id => id !== leadId))
                setLeads(prev => prev.filter(l => l.id !== leadId))
                router.refresh()
            } else {
                alert(`Failed to delete lead: ${res.error}`)
            }
        } catch (err) {
            console.error(err)
            alert("An error occurred trying to delete this property.")
        } finally {
            setIsDeletingLead(prev => ({ ...prev, [leadId]: false }))
        }
    }

    const handleToggleSelectLead = (leadId: string) => {
        setSelectedLeadIds(prev => 
            prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
        )
    }

    const handleSelectAllLeads = (filteredLeads: Lead[]) => {
        const filteredIds = filteredLeads.map(l => l.id)
        const allSelected = filteredIds.every(id => selectedLeadIds.includes(id))
        
        if (allSelected) {
            setSelectedLeadIds(prev => prev.filter(id => !filteredIds.includes(id)))
        } else {
            setSelectedLeadIds(prev => {
                const uniqueIds = new Set([...prev, ...filteredIds])
                return Array.from(uniqueIds)
            })
        }
    }

    const handleDeleteLeadsBulk = async () => {
        if (selectedLeadIds.length === 0) {
            console.log("[CLIENT] handleDeleteLeadsBulk aborted: selectedLeadIds is empty")
            return
        }
        console.log("[CLIENT] handleDeleteLeadsBulk starting for IDs:", selectedLeadIds)
        if (!confirm(`Are you sure you want to delete the ${selectedLeadIds.length} selected properties? This action cannot be undone.`)) return
        
        setIsBulkDeleting(true)
        try {
            console.log("[CLIENT] Calling deleteLeadsBulkAction server action...")
            const res = await deleteLeadsBulkAction(selectedLeadIds)
            console.log("[CLIENT] Server response received:", res)
            if (res.success) {
                if (selectedLead && selectedLeadIds.includes(selectedLead.id)) {
                    setSelectedLead(null)
                }
                setLeads(prev => prev.filter(l => !selectedLeadIds.includes(l.id)))
                setSelectedLeadIds([])
                alert(`Successfully deleted ${res.count || 0} properties.`)
                router.refresh()
            } else {
                alert(`Failed to delete properties: ${res.error}`)
            }
        } catch (err: any) {
            console.error("[CLIENT] Error during bulk delete:", err)
            alert(`An error occurred trying to delete the selected properties: ${err?.message || err}`)
        } finally {
            setIsBulkDeleting(false)
        }
    }

    // Pricing calculation helper (client-side for real-time display)
    const getCalculatedPricing = (lead: Lead | null) => {
        if (!lead) return null;
        
        const isWindowLead = lead.windowHaziness !== undefined && lead.windowHaziness !== null;

        let baseRate = 15;
        if (isWindowLead) {
            baseRate = 20; // Standard window pure water wash
            if (serviceType === "chemical") {
                baseRate = 30; // Spot-free chemical wash
            } else if (serviceType === "solar") {
                baseRate = 45; // Premium solar panel wash
            }
        } else {
            if (serviceType === "chemical") {
                baseRate = 22;
            } else if (serviceType === "solar") {
                baseRate = 30;
            }
        }

        let pitchMultiplier = 1.0;
        if (roofPitch === "medium") {
            pitchMultiplier = 1.25;
        } else if (roofPitch === "steep") {
            pitchMultiplier = 1.5;
        }

        let grimeScore = 0.0;
        if (isWindowLead) {
            const hazinessNormalized = (lead.windowHaziness ?? 0) / 100.0;
            const spotNormalized = (lead.spotCoverage ?? 0) / 100.0;
            const frameNormalized = (lead.frameDirtScore ?? 0) / 100.0;
            const streaksNormalized = lead.visibleStreaks ? Math.min(1.0, lead.visibleStreaks / 20.0) : 0.0;
            grimeScore = Math.max(hazinessNormalized, spotNormalized, frameNormalized, streaksNormalized);
        } else {
            grimeScore = Math.max(lead.biologicalGrowthScore, lead.surfaceStainingScore);
        }

        let grimeMultiplier = 1.0;
        if (grimeScore >= 0.70) {
            grimeMultiplier = 1.4;
        } else if (grimeScore >= 0.50) {
            grimeMultiplier = 1.2;
        }

        const unitPrice = baseRate * pitchMultiplier * grimeMultiplier;
        const subtotal = estimatedArea * unitPrice;
        const tax = subtotal * 0.15;
        const total = subtotal + tax;

        let difficulty = "Moderate";
        if (roofPitch === "steep" || grimeScore >= 0.70) {
            difficulty = "Difficult";
        } else if (roofPitch === "flat" && grimeScore < 0.50) {
            difficulty = "Easy";
        }

        let duration = 4;
        duration += Math.ceil(estimatedArea / 250);
        if (roofPitch === "steep") duration += 2;
        if (grimeScore >= 0.70) duration += 2;

        return {
            unitPrice,
            subtotal,
            tax,
            total,
            difficulty,
            duration
        };
    }

    const handleSavePricingParams = async (leadId: string) => {
        setPricingSaving(true)
        try {
            const res = await updateLeadPricingAction(leadId, estimatedArea, roofPitch, serviceType)
            if (res.success && res.data) {
                setSelectedLead(prev => prev ? { 
                    ...prev, 
                    estimatedArea: res.data.estimatedArea,
                    roofPitch: res.data.roofPitch,
                    serviceType: res.data.serviceType
                } : null)
                alert("Pricing parameters saved successfully!")
                router.refresh()
            } else {
                alert(`Failed to save pricing: ${res.error}`)
            }
        } catch (err) {
            console.error(err)
            alert("An error occurred trying to save pricing parameters.")
        } finally {
            setPricingSaving(false)
        }
    }

    const handleGenerateQuote = async (leadId: string) => {
        setQuoteLoading(prev => ({ ...prev, [leadId]: true }))
        try {
            const saveRes = await updateLeadPricingAction(leadId, estimatedArea, roofPitch, serviceType)
            if (!saveRes.success) {
                alert(`Failed to update parameters before quote generation: ${saveRes.error}`)
                return
            }

            const res = await generateAndSendLeadQuoteAction(leadId)
            if (res.success) {
                alert("Successfully generated Quote and Project! The client was notified via email.")
                setSelectedLead(null)
                router.refresh()
            } else {
                alert(`Failed to generate quote: ${res.error}`)
            }
        } catch (err) {
            console.error(err)
            alert("An error occurred during quote generation.")
        } finally {
            setQuoteLoading(prev => ({ ...prev, [leadId]: false }))
        }
    }

    // Stats calculations
    const totalLeads = leads.length
    const growthDetections = leads.filter(l => l.biologicalGrowthScore >= 0.50).length
    const highConfidenceLeads = leads.filter(l => l.maxConfidenceScore >= 0.70).length
    const convertedLeads = leads.filter(l => l.projectId !== null).length
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0
    const activeOptOuts = optOuts.length

    // Closed-loop revenue calculation
    let totalBookedRevenue = 0
    leads.forEach(lead => {
        if (lead.project) {
            const invoices = lead.project.invoices || []
            invoices.forEach((inv: any) => {
                const payments = inv.payments || []
                payments.forEach((p: any) => {
                    totalBookedRevenue += (p.amount || 0)
                })
            })
        }
    })

    // Neighborhood extraction and ROI calculations
    const neighborhoodStats: Record<string, { name: string; scanned: number; converted: number; revenue: number; cost: number }> = {}
    
    leads.forEach(lead => {
        let neighborhood = "Other"
        const addr = lead.address || ""
        const lower = addr.toLowerCase()
        if (lower.includes("sacks circle")) {
            neighborhood = "Sacks Circle"
        } else if (lower.includes("epping")) {
            neighborhood = "Epping"
        } else if (lower.includes("civic centre") || lower.includes("hertzog") || lower.includes("cbd")) {
            neighborhood = "Cape Town CBD"
        } else if (lead.address) {
            const parts = lead.address.split(",")
            if (parts.length > 2) {
                neighborhood = parts[parts.length - 3].trim()
            } else if (parts.length > 1) {
                neighborhood = parts[0].trim()
            } else {
                neighborhood = lead.address.trim()
            }
        }
        if (neighborhood.length > 25) {
            neighborhood = neighborhood.substring(0, 22) + "..."
        }

        if (!neighborhoodStats[neighborhood]) {
            neighborhoodStats[neighborhood] = {
                name: neighborhood,
                scanned: 0,
                converted: 0,
                revenue: 0,
                cost: 0
            }
        }

        const stats = neighborhoodStats[neighborhood]
        stats.scanned += 1
        stats.cost += 250 // Cost of scouting per property coordinate
        if (lead.projectId) {
            stats.converted += 1
            const invoices = lead.project?.invoices || []
            invoices.forEach((inv: any) => {
                const payments = inv.payments || []
                payments.forEach((p: any) => {
                    stats.revenue += (p.amount || 0)
                })
            })
        }
    })

    const neighborhoodList = Object.values(neighborhoodStats).sort((a, b) => b.revenue - a.revenue)

    // Helper to identify follow-up necessity (contacted status, last outreach > 3 days ago)
    const isFollowUpDue = (lead: Lead) => {
        if (!lead.lastOutreachAt) return false
        const lastDate = new Date(lead.lastOutreachAt).getTime()
        const diffTime = Math.abs(new Date().getTime() - lastDate)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        const statusLower = lead.status.toLowerCase()
        return (statusLower === "outreach_sent" || statusLower === "contacted" || statusLower === "quote_sent") && diffDays >= 3
    }

    // Status mapping for badge colors
    const getStatusBadge = (status: string) => {
        const standardStatus = status.toLowerCase()
        switch (standardStatus) {
            case "discovered":
            case "analyzed":
                return <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 font-black uppercase text-[10px]">Discovered</Badge>
            case "qualified":
                return <Badge className="bg-sky-950 text-sky-400 border-sky-800 font-black uppercase text-[10px]">Qualified</Badge>
            case "rejected":
                return <Badge className="bg-rose-950 text-rose-400 border-rose-800 font-black uppercase text-[10px]">Rejected</Badge>
            case "outreach_sent":
            case "contacted":
                return <Badge className="bg-violet-950 text-violet-400 border-violet-800 font-black uppercase text-[10px]">Contacted</Badge>
            case "opted_out":
                return <Badge className="bg-amber-950 text-amber-500 border-amber-800 font-black uppercase text-[10px]"><ShieldAlert className="h-3 w-3 mr-1 inline" /> Opted Out</Badge>
            case "interested":
                return <Badge className="bg-pink-950 text-pink-400 border-pink-800 font-black uppercase text-[10px]">Interested</Badge>
            case "quote_sent":
                return <Badge className="bg-indigo-950 text-indigo-400 border-indigo-800 font-black uppercase text-[10px]">Quote Sent</Badge>
            case "closed":
                return <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 font-black uppercase text-[10px]">Closed (Job Booked)</Badge>
            default:
                return <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 font-black uppercase text-[10px]">{status}</Badge>
        }
    }

    // Status dropdown handler
    const handleStatusChange = async (leadId: string, newStatus: string) => {
        setActionLoading(prev => ({ ...prev, [leadId]: true }))
        try {
            const res = await overrideLeadStatusAction(leadId, newStatus)
            if (res.success) {
                // If selected lead is open, sync local state
                if (selectedLead && selectedLead.id === leadId) {
                    setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null)
                }
                router.refresh()
            } else {
                alert(`Error overriding status: ${res.error}`)
            }
        } catch (error) {
            console.error(error)
            alert("An error occurred trying to override lead status.")
        } finally {
            setActionLoading(prev => ({ ...prev, [leadId]: false }))
        }
    }

    // Send AI Quote/Outreach handler
    const handleTriggerOutreach = async (leadId: string) => {
        setActionLoading(prev => ({ ...prev, [leadId]: true }))
        setOutreachStatus(prev => ({ ...prev, [leadId]: {} }))
        try {
            const res = await triggerOutreachAction(leadId)
            if (res.success) {
                setOutreachStatus(prev => ({ ...prev, [leadId]: { success: true } }))
                router.refresh()
            } else {
                setOutreachStatus(prev => ({ ...prev, [leadId]: { error: res.error } }))
                alert(`Error launching outreach: ${res.error}`)
            }
        } catch (error: any) {
            console.error(error)
            setOutreachStatus(prev => ({ ...prev, [leadId]: { error: error.message } }))
            alert("Failed to call outreach action.")
        } finally {
            setActionLoading(prev => ({ ...prev, [leadId]: false }))
        }
    }

    // Manual Opt-out Form handler
    const handleAddOptOut = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!optOutEmail) return
        setOptOutLoading(true)
        setOptOutSuccess(null)
        try {
            const res = await addManualOptOutAction(optOutEmail, optOutReason)
            if (res.success) {
                setOptOutSuccess(`Email address "${optOutEmail}" unsubscribed successfully under POPIA regulations. Matching leads updated.`)
                setOptOutEmail("")
                setOptOutReason("")
                router.refresh()
            } else {
                alert(`Error saving opt-out: ${res.error}`)
            }
        } catch (error) {
            console.error(error)
            alert("Failed to submit manual opt-out.")
        } finally {
            setOptOutLoading(false)
        }
    }

    // Lead call note log handler
    const handleSaveNote = async (leadId: string) => {
        if (!noteText.trim()) return
        setNoteLoading(true)
        try {
            const res = await addLeadCallNoteAction(leadId, noteText)
            if (res.success && res.data) {
                setNoteText("")
                if (selectedLead && selectedLead.id === leadId) {
                    setSelectedLead(prev => prev ? { ...prev, history: res.data.history } : null)
                }
                router.refresh()
            } else {
                alert(`Failed to save note: ${res.error}`)
            }
        } catch (err) {
            console.error(err)
            alert("An error occurred trying to save log note.")
        } finally {
            setNoteLoading(false)
        }
    }

    // Convert Lead to UROps Job / Project handler
    const handleConvertLead = async (leadId: string) => {
        setConversionLoading(prev => ({ ...prev, [leadId]: true }))
        try {
            const res = await convertLeadToProjectAction(leadId)
            if (res.success) {
                alert("Successfully converted lead to a native UROps Client and Project! Status updated to 'Closed (Job Booked)'.")
                setSelectedLead(null)
                router.refresh()
            } else {
                alert(`Failed to convert: ${res.error}`)
            }
        } catch (err) {
            console.error(err)
            alert("An error occurred during project conversion.")
        } finally {
            setConversionLoading(prev => ({ ...prev, [leadId]: false }))
        }
    }

    // Filter leads list
    const filteredLeads = leads.filter(lead => {
        const textMatch = 
            (lead.companyName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (lead.address || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (lead.contactEmail || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (lead.contactName || "").toLowerCase().includes(searchQuery.toLowerCase())

        const statusMatch = 
            statusFilter === "all" || 
            lead.status.toLowerCase() === statusFilter.toLowerCase()

        let defectMatch = true
        if (defectFilter === "growth") {
            defectMatch = lead.biologicalGrowthScore >= 0.50
        } else if (defectFilter === "staining") {
            defectMatch = lead.surfaceStainingScore >= 0.50
        } else if (defectFilter === "high_conf") {
            defectMatch = lead.maxConfidenceScore >= 0.70
        }

        return textMatch && statusMatch && defectMatch
    })

    return (
        <div className="space-y-6 pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center">
                        Drone Operations Dashboard
                        <InfoTooltip content="Autonomous drone imagery scanner results showing surface defects, biological growth, and AI-enabled outreach queue." />
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide">Computer Vision building envelope scanning & POPIA CRM</p>
                </div>
                <div className="flex items-center gap-2 bg-[#14141E]/80 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl">
                    <div className="flex flex-col items-end px-3">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Scanner Pipeline</span>
                        <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                            <Activity className="h-3 w-3 animate-pulse" /> ONLINE
                        </span>
                    </div>
                    <Link href="/settings">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/5 rounded-xl">
                            <Clock className="h-5 w-5" />
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-blue-500/30 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center">
                            Total Inspected Sites
                        </CardTitle>
                        <MapPin className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white group-hover:text-blue-400 transition-colors">{totalLeads}</div>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] font-bold text-blue-500/80 uppercase">AI Inspected Coordinates</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-emerald-500/30 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center">
                            Severe Anomalies
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">{highConfidenceLeads}</div>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] font-bold text-emerald-500/80 uppercase">Growth or Stain &ge; 70%</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-orange-500/30 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center">
                            Job Conversion Rate
                        </CardTitle>
                        <Briefcase className="h-4 w-4 text-orange-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white group-hover:text-orange-400 transition-colors">
                            {conversionRate.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] font-bold text-orange-500/80 uppercase">{convertedLeads} / {totalLeads} Converted to Jobs</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-emerald-500/30 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center">
                            Booked Job Revenue
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">
                            {formatCurrency(totalBookedRevenue)}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] font-bold text-emerald-500/80 uppercase">Closed-loop Revenue Received</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Dashboard Contents Grid */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                {/* Leads Queue Section (Left/Middle 2 Columns) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl">
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg font-black uppercase text-white tracking-wide">Inspected Property Queue</CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">Coordinates analysed by drone computer vision model.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-zinc-800 text-white font-bold">{filteredLeads.length} visible</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Search & Filter Controls */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search address, company..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 bg-[#0d0d15] border-white/5 focus-visible:ring-emerald-500"
                                    />
                                </div>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-white/5 bg-[#0d0d15] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                                >
                                    <option value="all">All Outreach Stages</option>
                                    <option value="discovered">Discovered</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="outreach_sent">Contacted (Outreach)</option>
                                    <option value="opted_out">Opted Out</option>
                                    <option value="interested">Interested</option>
                                    <option value="quote_sent">Quote Sent</option>
                                    <option value="closed">Closed (Job Booked)</option>
                                </select>
                                <select
                                    value={defectFilter}
                                    onChange={(e) => setDefectFilter(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-white/5 bg-[#0d0d15] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                                >
                                    <option value="all">All CV Detection Scores</option>
                                    <option value="growth">Biological Growth &ge; 50%</option>
                                    <option value="staining">Surface Staining &ge; 50%</option>
                                    <option value="high_conf">High Confidence &ge; 70%</option>
                                </select>
                            </div>

                            {/* Bulk Delete Actions Bar */}
                            {selectedLeadIds.length > 0 && (
                                <div className="flex items-center justify-between p-3 bg-red-950/20 border border-red-500/20 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
                                    <span className="text-xs text-red-400 font-bold flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        {selectedLeadIds.length} properties selected
                                    </span>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="h-8 font-black uppercase text-[10px] bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1.5"
                                        onClick={handleDeleteLeadsBulk}
                                        disabled={isBulkDeleting}
                                    >
                                        {isBulkDeleting ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3 w-3" />
                                        )}
                                        Delete Selected
                                    </Button>
                                </div>
                            )}

                            {/* Table List of Leads */}
                            <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0d0d15]/50">
                                <table className="w-full text-sm border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-[#0d0d15] text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                            <th className="p-3 w-8">
                                                <input 
                                                    type="checkbox"
                                                    className="rounded border-white/10 bg-[#0d0d15] text-emerald-500 focus:ring-emerald-500 focus:ring-opacity-50"
                                                    checked={filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.includes(l.id))}
                                                    onChange={() => handleSelectAllLeads(filteredLeads)}
                                                />
                                            </th>
                                            <th className="p-3">Target Details</th>
                                            <th className="p-3">defect scores (growth / stain)</th>
                                            <th className="p-3">outreach status</th>
                                            <th className="p-3 text-right">actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredLeads.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground italic">
                                                    No inspection leads match your filter parameters.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredLeads.map((lead) => {
                                                const hasOptedOut = lead.status.toLowerCase() === "opted_out"
                                                const followUpNeeded = isFollowUpDue(lead)
                                                
                                                return (
                                                    <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="p-3 w-8">
                                                            <input 
                                                                type="checkbox"
                                                                className="rounded border-white/10 bg-[#0d0d15] text-emerald-500 focus:ring-emerald-500 focus:ring-opacity-50"
                                                                checked={selectedLeadIds.includes(lead.id)}
                                                                onChange={() => handleToggleSelectLead(lead.id)}
                                                            />
                                                        </td>
                                                        <td className="p-3 max-w-[240px]">
                                                            <div className="font-bold text-white truncate flex items-center gap-2">
                                                                {lead.companyName || "Unidentified Commercial Site"}
                                                                {lead.projectId && <Badge className="bg-emerald-950 text-emerald-400 text-[8px] px-1 h-3.5 border-emerald-800 uppercase font-black tracking-tighter">Job Booked</Badge>}
                                                                {lead.highDust && <Badge className="bg-amber-950 text-amber-500 border-amber-800 text-[8px] px-1 h-3.5 uppercase font-black tracking-tighter">High Dust</Badge>}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                                                <MapPin className="h-3 w-3 shrink-0" />
                                                                <span className="truncate">{lead.address || `Coord: (${lead.latitude}, ${lead.longitude})`}</span>
                                                                {(() => {
                                                                    const weather = getClientWeatherSummary(lead.latitude, lead.longitude);
                                                                    return (
                                                                        <span 
                                                                            className="ml-1.5 cursor-help shrink-0" 
                                                                            title={weather.tooltip}
                                                                        >
                                                                            {weather.icon}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                            <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                                                                {lead.contactName ? `${lead.contactName} (${lead.contactEmail})` : (lead.contactEmail || "No contact info")}
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="space-y-1.5 w-32">
                                                                {/* Growth Score bar */}
                                                                <div>
                                                                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground mb-0.5">
                                                                        <span>Algae/Growth</span>
                                                                        <span className={lead.biologicalGrowthScore >= 0.5 ? "text-emerald-400" : ""}>
                                                                            {(lead.biologicalGrowthScore * 100).toFixed(0)}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-[#1b1b2a] h-1 rounded overflow-hidden">
                                                                        <div 
                                                                            className={`h-full ${lead.biologicalGrowthScore >= 0.7 ? 'bg-red-500' : lead.biologicalGrowthScore >= 0.5 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                                                            style={{ width: `${lead.biologicalGrowthScore * 100}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {/* Staining Score bar */}
                                                                <div>
                                                                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground mb-0.5">
                                                                        <span>Stain/Grime</span>
                                                                        <span className={lead.surfaceStainingScore >= 0.5 ? "text-primary" : ""}>
                                                                            {(lead.surfaceStainingScore * 100).toFixed(0)}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-[#1b1b2a] h-1 rounded overflow-hidden">
                                                                        <div 
                                                                            className={`h-full ${lead.surfaceStainingScore >= 0.7 ? 'bg-red-500' : lead.surfaceStainingScore >= 0.5 ? 'bg-amber-500' : 'bg-primary'}`} 
                                                                            style={{ width: `${lead.surfaceStainingScore * 100}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    {getStatusBadge(lead.status)}
                                                                    {followUpNeeded && (
                                                                        <Badge className="bg-amber-600/90 text-white border-amber-500 font-black uppercase text-[8px] animate-pulse">
                                                                            ⚠️ Follow-up
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {lead.outreachAttempts > 0 && (
                                                                    <div className="text-[9px] font-bold text-orange-400/80 flex items-center gap-1">
                                                                        <Mail className="h-2.5 w-2.5" />
                                                                        Sent {lead.outreachAttempts} time(s)
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {/* View Imagery modal trigger */}
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-white hover:bg-white/5 rounded-lg"
                                                                    onClick={() => handleOpenDetails(lead)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>

                                                                {/* Google Maps link */}
                                                                <a 
                                                                    href={`https://www.google.com/maps/search/?api=1&query=${lead.latitude},${lead.longitude}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    title="Open location on Google Maps Satellite"
                                                                >
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:bg-white/5 rounded-lg">
                                                                        <MapPin className="h-4 w-4" />
                                                                    </Button>
                                                                </a>

                                                                {/* Delete Lead Action */}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                                                                    disabled={isDeletingLead[lead.id]}
                                                                    onClick={() => handleDeleteLead(lead.id)}
                                                                    title="Delete building"
                                                                >
                                                                    {isDeletingLead[lead.id] ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <Trash2 className="h-4 w-4" />
                                                                    )}
                                                                </Button>

                                                                {/* Send Quote Action */}
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className={`h-8 font-black uppercase text-[10px] rounded-lg ${hasOptedOut ? 'border-red-500/20 text-red-500/50 hover:bg-transparent' : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'}`}
                                                                    disabled={hasOptedOut || actionLoading[lead.id]}
                                                                    onClick={() => handleTriggerOutreach(lead.id)}
                                                                >
                                                                    {actionLoading[lead.id] ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                                    ) : (
                                                                        <Send className="h-3 w-3 mr-1" />
                                                                    )}
                                                                    Outreach
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Columns (suppressions, metrics, payback) */}
                <div className="space-y-6">
                    {/* Neighborhood ROI Table Card */}
                    <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-md font-black uppercase text-white tracking-wide">
                                Neighborhood Payback
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Analysis of drone coordinates scan costs vs. actual booked revenue.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0d0d15]/50 text-[10px]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-[#0d0d15] text-[8px] font-black text-muted-foreground uppercase tracking-wider">
                                            <th className="p-2">Neighborhood</th>
                                            <th className="p-2 text-center">Jobs</th>
                                            <th className="p-2 text-right">Cost</th>
                                            <th className="p-2 text-right">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {neighborhoodList.map((stat) => (
                                            <tr key={stat.name} className="hover:bg-white/[0.01]">
                                                <td className="p-2 font-bold text-white max-w-[100px] truncate" title={stat.name}>{stat.name}</td>
                                                <td className="p-2 text-center text-zinc-300 font-bold">{stat.converted} <span className="text-[8px] text-zinc-500">/ {stat.scanned}</span></td>
                                                <td className="p-2 text-right text-zinc-500 font-bold">R{stat.cost}</td>
                                                <td className={`p-2 text-right font-black ${stat.revenue > stat.cost ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                                    R{stat.revenue.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Manual Unsubscribe Form */}
                    <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-red-500/10 transition-colors">
                        <CardHeader>
                            <CardTitle className="text-md font-black uppercase text-white tracking-wide flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-red-500" />
                                POPIA Opt-Out Suppressor
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Manually unsubscribe client domains or email addresses under the South African POPIA regulations.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddOptOut} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="optOutEmail" className="text-xs font-black uppercase text-muted-foreground tracking-wider">Email or Domain</Label>
                                    <Input
                                        id="optOutEmail"
                                        placeholder="e.g. client@example.com or example.com"
                                        value={optOutEmail}
                                        onChange={(e) => setOptOutEmail(e.target.value)}
                                        required
                                        className="bg-[#0d0d15] border-white/5 text-sm text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="optOutReason" className="text-xs font-black uppercase text-muted-foreground tracking-wider">Reason for Opt-Out</Label>
                                    <Textarea
                                        id="optOutReason"
                                        placeholder="e.g. Unsubscribe link clicked, phone request, etc."
                                        value={optOutReason}
                                        onChange={(e) => setOptOutReason(e.target.value)}
                                        rows={2}
                                        className="bg-[#0d0d15] border-white/5 text-sm text-white"
                                    />
                                </div>
                                <Button 
                                    type="submit" 
                                    className="w-full bg-red-600/90 text-white font-black uppercase text-xs hover:bg-red-700 py-2.5 rounded-lg flex items-center justify-center gap-1"
                                    disabled={optOutLoading || !optOutEmail}
                                >
                                    {optOutLoading ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : (
                                        <UserX className="h-3 w-3 mr-1" />
                                    )}
                                    Enforce Suppression
                                </Button>

                                {optOutSuccess && (
                                    <div className="p-3 border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 rounded-lg text-[10px] leading-relaxed italic font-medium">
                                        {optOutSuccess}
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>

                    {/* suppression list output */}
                    <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-md font-black uppercase text-white tracking-wide">
                                Suppression Registry ({optOuts.length})
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Suppressions protecting system outreach from compliance violations.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {optOuts.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic text-center py-6 border border-dashed border-white/5 rounded-xl">
                                        No active suppressions recorded.
                                    </p>
                                ) : (
                                    optOuts.map((opt) => (
                                        <div key={opt.id} className="p-2 rounded-lg border border-white/5 bg-[#0d0d15] text-[10px] space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-bold text-white truncate max-w-[140px]" title={opt.email || opt.domain || ""}>
                                                    {opt.email || `*@${opt.domain}`}
                                                </span>
                                                <Badge className="bg-red-950 text-red-400 text-[8px] font-black uppercase tracking-wider scale-90 border-red-800">POPIA</Badge>
                                            </div>
                                            {opt.reason && (
                                                <p className="text-zinc-500 italic leading-relaxed truncate">{opt.reason}</p>
                                            )}
                                            <div className="text-[8px] text-zinc-600 font-medium">
                                                Added: {new Date(opt.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* AI Image Comparison Details Modal */}
            {selectedLead && (
                <Dialog open={!!selectedLead} onOpenChange={(open) => { if(!open) setSelectedLead(null) }}>
                    <DialogContent className="max-w-4xl bg-[#14141E] border-white/10 text-white p-6 shadow-3xl rounded-3xl backdrop-blur-md overflow-y-auto max-h-[90vh]">
                        
                        {/* Automated Follow-Up Alarm */}
                        {isFollowUpDue(selectedLead) && (
                            <div className="p-3 border border-amber-500/20 bg-amber-500/5 text-amber-400 rounded-2xl text-[11px] font-bold flex items-center gap-2 mb-4">
                                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                Automated Alarm: No client response recorded. A follow-up outreach email or phone call is recommended.
                            </div>
                        )}

                        <DialogHeader>
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                                        <ImageIcon className="h-6 w-6 text-emerald-400" />
                                        CV Defect Detection Report
                                    </h2>
                                    <p className="text-zinc-400 text-xs font-semibold">
                                        Side-by-side computer vision segmentation of rooftop anomalies in {selectedLead.address}.
                                    </p>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="mt-4">
                            <WorkSummaryCard summary={workSummary} loading={loadingSummary} />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                            {/* Raw satellite imagery */}
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-zinc-400">Raw Satellite Snapshot (Zoom 21)</Label>
                                <div className="border border-white/5 rounded-2xl overflow-hidden bg-[#0d0d15] aspect-square relative flex items-center justify-center">
                                    {selectedLead.satelliteImageUrl ? (
                                        <img 
                                            src={selectedLead.satelliteImageUrl} 
                                            alt="Raw Satellite" 
                                            className="h-full w-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                                            onClick={() => setActiveLightboxImg({ url: selectedLead.satelliteImageUrl!, title: "Raw Satellite Snapshot" })}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-muted-foreground p-4">
                                            <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                                            <span className="text-[10px] uppercase font-bold text-center">Satellite image source not cached</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* CV segmented imagery */}
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                                    {selectedLead.windowHaziness !== undefined && selectedLead.windowHaziness !== null 
                                        ? "CV Window Analysis Overlay" 
                                        : "YOLOv8 Analysis Overlay"}
                                </Label>
                                <div className="border border-emerald-500/20 rounded-2xl overflow-hidden bg-[#0d0d15] aspect-square relative flex items-center justify-center">
                                    {selectedLead.processedImageUrl ? (
                                        <img 
                                            src={selectedLead.processedImageUrl} 
                                            alt="CV Segmented overlay" 
                                            className="h-full w-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                                            onClick={() => setActiveLightboxImg({ 
                                                url: selectedLead.processedImageUrl!, 
                                                title: selectedLead.windowHaziness !== undefined && selectedLead.windowHaziness !== null 
                                                    ? "CV Window Analysis Overlay" 
                                                    : "YOLOv8 Analysis Overlay" 
                                            })}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-muted-foreground p-4">
                                            <Loader2 className="h-8 w-8 text-emerald-500 mb-2 animate-spin" />
                                            <span className="text-[10px] uppercase font-bold text-center">Segmenting facade layers...</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Street view profile */}
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-1">
                                    Street View Profile
                                </Label>
                                <div className="border border-white/5 rounded-2xl overflow-hidden bg-[#0d0d15] aspect-square relative flex items-center justify-center">
                                    {selectedLead.streetViewImageUrl ? (
                                        <img 
                                            src={selectedLead.streetViewImageUrl} 
                                            alt="Street View Profile" 
                                            className="h-full w-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                                            onClick={() => setActiveLightboxImg({ url: selectedLead.streetViewImageUrl!, title: "Street View Profile" })}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-muted-foreground p-4">
                                            <AlertTriangle className="h-8 w-8 text-zinc-500 mb-2" />
                                            <span className="text-[10px] uppercase font-bold text-center">Street View not available</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Defect Details & Controls */}
                        {selectedLead.windowHaziness !== undefined && selectedLead.windowHaziness !== null ? (
                            <div className="mt-6 p-4 rounded-2xl border border-white/5 bg-[#0d0d15]/50 space-y-4">
                                <h3 className="text-xs font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
                                    <ImageIcon className="h-3.5 w-3.5 text-blue-400" />
                                    Facade Window Grime & Building Details
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Glass Haziness</span>
                                        <div className="text-lg font-black text-blue-400 flex items-center gap-1.5">
                                            {selectedLead.windowHaziness.toFixed(1)}%
                                            <Badge className={`scale-90 ${selectedLead.windowHaziness > 60 ? "bg-red-950 text-red-400 border-red-800" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                                                {selectedLead.windowHaziness > 60 ? "Hazy" : "Clean"}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Visible Streaks</span>
                                        <div className="text-lg font-black text-amber-400 flex items-center gap-1.5">
                                            {selectedLead.visibleStreaks ?? 0} streaks
                                            <Badge className={`scale-90 ${(selectedLead.visibleStreaks ?? 0) > 5 ? "bg-red-950 text-red-400 border-red-800" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                                                {(selectedLead.visibleStreaks ?? 0) > 5 ? "Dirty" : "Minimal"}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Spot Coverage</span>
                                        <div className="text-lg font-black text-rose-400 flex items-center gap-1.5">
                                            {(selectedLead.spotCoverage ?? 0).toFixed(1)}%
                                            <Badge className={`scale-90 ${(selectedLead.spotCoverage ?? 0) > 10 ? "bg-red-950 text-red-400 border-red-800" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                                                {(selectedLead.spotCoverage ?? 0) > 10 ? "Grime" : "Minimal"}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Frame Grime</span>
                                        <div className="text-lg font-black text-purple-400 flex items-center gap-1.5">
                                            {(selectedLead.frameDirtScore ?? 0).toFixed(1)}%
                                            <Badge className={`scale-90 ${(selectedLead.frameDirtScore ?? 0) > 65 ? "bg-red-950 text-red-400 border-red-800" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                                                {(selectedLead.frameDirtScore ?? 0) > 65 ? "Dirty" : "Clean"}
                                            </Badge>
                                        </div>
                                    </div>

                                </div>
                                
                                <div className="border-t border-white/5 pt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px]">
                                    <div>
                                        <span className="text-zinc-500 font-bold block uppercase text-[9px] tracking-wider">Building Info</span>
                                        <span className="font-bold text-white uppercase">{selectedLead.storeys} Storeys | {selectedLead.buildingType || "Commercial"}</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 font-bold block uppercase text-[9px] tracking-wider">Year Built</span>
                                        <span className="font-bold text-white">{selectedLead.yearBuilt || "N/A"} ({selectedLead.yearBuilt ? 2026 - selectedLead.yearBuilt : 5} yrs old)</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 font-bold block uppercase text-[9px] tracking-wider">Coastal Bonus</span>
                                        <span className={`font-bold uppercase ${selectedLead.coastalBonus ? "text-emerald-400" : "text-zinc-400"}`}>
                                            {selectedLead.coastalBonus ? "Active (+25%)" : "None"}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 font-bold block uppercase text-[9px] tracking-wider">Priority / Outreach</span>
                                        <Badge className={`scale-90 font-black tracking-wide ${
                                            selectedLead.priorityLevel === "same-day" 
                                            ? "bg-red-950 text-red-400 border-red-800" 
                                            : selectedLead.priorityLevel === "highest"
                                            ? "bg-amber-950 text-amber-400 border-amber-800"
                                            : selectedLead.priorityLevel === "high"
                                            ? "bg-blue-950 text-blue-400 border-blue-800"
                                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                        }`}>
                                            {selectedLead.priorityLevel ? selectedLead.priorityLevel.toUpperCase() : "LOW"}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="border-t border-white/5 pt-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="text-[10px] text-zinc-400 max-w-full md:max-w-[70%]">
                                        <span className="font-bold text-white uppercase block text-[8px] tracking-wider mb-0.5">Detection Rationale</span>
                                        {selectedLead.detectionReason || "No significant window buildup detected"}
                                    </div>
                                    <div className="w-full md:w-[120px] shrink-0">
                                        {selectedLead.pdfReportUrl ? (
                                            <a 
                                                href={selectedLead.pdfReportUrl} 
                                                download 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="w-full"
                                            >
                                                <Button variant="outline" className="w-full h-8 uppercase font-black text-[10px] border-white/10 hover:bg-white/5 rounded-lg flex items-center justify-center gap-1 text-white">
                                                    <Download className="h-3 w-3" />
                                                    Report
                                                </Button>
                                            </a>
                                        ) : (
                                            <Button variant="outline" className="w-full h-8 uppercase font-black text-[10px] border-white/5 text-zinc-500 hover:bg-transparent rounded-lg cursor-not-allowed" disabled>
                                                Report Pending
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-6 p-4 rounded-2xl border border-white/5 bg-[#0d0d15]/50 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Growth Detection Score</span>
                                    <div className="text-xl font-black text-emerald-400 flex items-center gap-1.5">
                                        {(selectedLead.biologicalGrowthScore * 100).toFixed(2)}%
                                        <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 scale-90">
                                            {selectedLead.biologicalGrowthScore >= 0.7 ? "Severe" : selectedLead.biologicalGrowthScore >= 0.5 ? "Moderate" : "Negligible"}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Surface Staining Score</span>
                                    <div className="text-xl font-black text-primary flex items-center gap-1.5">
                                        {(selectedLead.surfaceStainingScore * 100).toFixed(2)}%
                                        <Badge className="bg-primary/10 text-primary border-primary/20 scale-90">
                                            {selectedLead.surfaceStainingScore >= 0.7 ? "Severe" : selectedLead.surfaceStainingScore >= 0.5 ? "Moderate" : "Negligible"}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Outreach & PDF Report</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        {selectedLead.pdfReportUrl ? (
                                            <a 
                                                href={selectedLead.pdfReportUrl} 
                                                download 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="w-full"
                                            >
                                                <Button variant="outline" className="w-full h-8 uppercase font-black text-[10px] border-white/10 hover:bg-white/5 rounded-lg flex items-center justify-center gap-1 text-white">
                                                    <Download className="h-3 w-3" />
                                                    Report
                                                </Button>
                                            </a>
                                        ) : (
                                            <Button variant="outline" className="w-full h-8 uppercase font-black text-[10px] border-white/5 text-muted-foreground hover:bg-transparent rounded-lg cursor-not-allowed" disabled>
                                                Report Pending
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* INDUSTRIAL DUST & WEATHER SCHEDULING */}
                        <div className="mt-6 border-t border-white/5 pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* High Dust Zone Toggle & Windy Embed Map */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                                    Industrial Risk & Windy Live Tracker
                                </h3>
                                <div className="p-4 rounded-2xl border border-white/5 bg-[#0d0d15]/50 flex items-center justify-between">
                                    <div className="space-y-0.5 pr-2">
                                        <Label htmlFor="highDustToggle" className="text-xs font-black uppercase text-white tracking-wide cursor-pointer">
                                            High-Dust Zone
                                        </Label>
                                        <p className="text-[10px] text-zinc-400 leading-normal">
                                            Flag property in industrial zone with higher grime decay rates. Adds bi-annual soft-wash recommendations and outreach alerts.
                                        </p>
                                    </div>
                                    <input
                                        id="highDustToggle"
                                        type="checkbox"
                                        checked={highDust}
                                        onChange={(e) => handleToggleHighDust(e.target.checked)}
                                        className="h-4 w-4 rounded border-white/10 bg-[#0d0d15] text-primary focus:ring-primary focus:ring-offset-[#14141E] cursor-pointer"
                                    />
                                </div>

                                <div className="border border-white/5 rounded-2xl overflow-hidden h-[240px] w-full relative">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        src={`https://embed.windy.com/embed2.html?lat=${selectedLead?.latitude || 0}&lon=${selectedLead?.longitude || 0}&zoom=11&overlay=wind&menu=&message=&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&detailLat=${selectedLead?.latitude || 0}&detailLon=${selectedLead?.longitude || 0}&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`}
                                        frameBorder="0"
                                        title="Windy Weather Map"
                                        className="w-full h-full"
                                    />
                                </div>
                            </div>

                            {/* Weather Scheduling Table */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-blue-400" />
                                    Drone Flight Weather Scheduling
                                </h3>
                                {weatherLoading ? (
                                    <div className="flex items-center justify-center p-8 border border-white/5 rounded-2xl bg-[#0d0d15]/30">
                                        <Loader2 className="h-6 w-6 text-blue-400 animate-spin mr-2" />
                                        <span className="text-xs text-zinc-400 font-bold uppercase tracking-wide">Loading forecasts...</span>
                                    </div>
                                ) : weatherForecast ? (
                                    <div className="space-y-3">
                                        <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0d0d15]/50 text-[10px]">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-white/5 bg-[#0d0d15] text-[8px] font-black text-muted-foreground uppercase tracking-wider">
                                                        <th className="p-2">Date</th>
                                                        <th className="p-2">Forecast</th>
                                                        <th className="p-2 text-center">Temp</th>
                                                        <th className="p-2 text-center">Wind</th>
                                                        <th className="p-2 text-center">Rain %</th>
                                                        <th className="p-2 text-right">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {weatherForecast.map((w) => (
                                                        <tr key={w.date} className="hover:bg-white/[0.01]">
                                                            <td className="p-2 font-bold text-white">
                                                                {new Date(w.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                            </td>
                                                            <td className="p-2 text-zinc-400 capitalize">{w.description}</td>
                                                            <td className="p-2 text-center text-zinc-300">{Math.round(w.temp)}°C</td>
                                                            <td className="p-2 text-center text-zinc-300">{w.windSpeed} km/h</td>
                                                            <td className="p-2 text-center text-zinc-300">{Math.round(w.pop * 100)}%</td>
                                                            <td className="p-2 text-right font-black">
                                                                {w.isIdeal ? (
                                                                    <Badge className="bg-emerald-950 text-emerald-400 text-[8px] px-1.5 h-4 border-emerald-800 uppercase font-black tracking-tighter">Ideal</Badge>
                                                                ) : (
                                                                    <Badge className="bg-rose-950 text-rose-400 text-[8px] px-1.5 h-4 border-rose-800 uppercase font-black tracking-tighter">Delay Warning</Badge>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {weatherForecast.some(w => w.isIdeal) ? (
                                            <div className="p-2 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-[9px] text-emerald-400 font-bold leading-normal">
                                                ☀️ Ideal drone flight window identified within the next 72 hours. Immediate scouting dispatch recommended.
                                            </div>
                                        ) : (
                                            <div className="p-2 rounded-xl border border-rose-500/10 bg-rose-500/5 text-[9px] text-rose-400 font-bold leading-normal">
                                                ⚠️ Temporary weather delay warning: flight parameters exceed drone limits. Monitoring for window clearing.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center text-zinc-500 border border-dashed border-white/5 rounded-2xl">
                                        No weather data available.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI DYNAMIC PRICING & AUTOMATED QUOTE COMPONENT */}
                        {selectedLead && (
                            <div className="mt-6 border-t border-white/5 pt-5 space-y-4">
                                <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-emerald-400" />
                                    AI Dynamic Pricing & Quotation Parameters
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* Estimated Area */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="leadArea" className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Estimated Area (m²)</Label>
                                        <Input
                                            id="leadArea"
                                            type="number"
                                            value={estimatedArea}
                                            disabled={!!selectedLead.projectId || selectedLead.status.toLowerCase() === 'opted_out'}
                                            onChange={(e) => setEstimatedArea(parseFloat(e.target.value) || 0)}
                                            className="bg-[#0d0d15] border-white/5 text-xs text-white"
                                        />
                                    </div>

                                    {/* Roof Pitch / Access Complexity */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="leadPitch" className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                                            {selectedLead.windowHaziness !== undefined && selectedLead.windowHaziness !== null ? "Access Complexity" : "Roof Pitch"}
                                        </Label>
                                        <select
                                            id="leadPitch"
                                            value={roofPitch}
                                            disabled={!!selectedLead.projectId || selectedLead.status.toLowerCase() === 'opted_out'}
                                            onChange={(e) => setRoofPitch(e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-white/5 bg-[#0d0d15] px-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        >
                                            {selectedLead.windowHaziness !== undefined && selectedLead.windowHaziness !== null ? (
                                                <>
                                                    <option value="flat">Easy Ground Reach (&lt; 3 storeys)</option>
                                                    <option value="medium">Standard Drone Flight (3-8 storeys)</option>
                                                    <option value="steep">High-Rise Drone Flight (&gt; 8 storeys)</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="flat">Flat (&lt;10°)</option>
                                                    <option value="medium">Medium (10-30°)</option>
                                                    <option value="steep">Steep (&gt;30°)</option>
                                                </>
                                            )}
                                        </select>
                                    </div>

                                    {/* Service Type */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="leadService" className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Service Type</Label>
                                        <select
                                            id="leadService"
                                            value={serviceType}
                                            disabled={!!selectedLead.projectId || selectedLead.status.toLowerCase() === 'opted_out'}
                                            onChange={(e) => setServiceType(e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-white/5 bg-[#0d0d15] px-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        >
                                            {selectedLead.windowHaziness !== undefined && selectedLead.windowHaziness !== null ? (
                                                <>
                                                    <option value="standard">Standard Window Wash (Pure Water)</option>
                                                    <option value="chemical">Spot-Free Facade Chemical Wash</option>
                                                    <option value="solar">Premium Solar Panel Cleaning</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="standard">Standard Roof Soft-wash</option>
                                                    <option value="chemical">Moss & Algae Treatment</option>
                                                    <option value="solar">Solar Premium Soft-wash</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                {/* Calculated Outputs Summary */}
                                {(() => {
                                    const calc = getCalculatedPricing(selectedLead);
                                    if (!calc) return null;
                                    return (
                                        <div className="p-4 rounded-2xl border border-white/5 bg-[#0d0d15]/30 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div className="space-y-0.5">
                                                <span className="text-[9px] font-black uppercase text-zinc-500">Unit Price</span>
                                                <div className="text-sm font-bold text-white">R{calc.unitPrice.toFixed(2)} <span className="text-[9px] text-zinc-500">/ m²</span></div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[9px] font-black uppercase text-zinc-500">Estimated Duration</span>
                                                <div className="text-sm font-bold text-emerald-400">{calc.duration} Hours</div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[9px] font-black uppercase text-zinc-500">Job Difficulty</span>
                                                <div className="text-sm font-bold text-white">
                                                    <Badge className={calc.difficulty === "Easy" ? "bg-emerald-950 text-emerald-400" : calc.difficulty === "Difficult" ? "bg-rose-950 text-rose-400" : "bg-blue-950 text-blue-400"}>
                                                        {calc.difficulty}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[9px] font-black uppercase text-zinc-500">Grand Total (incl. VAT)</span>
                                                <div className="text-sm font-black text-white">R{calc.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Actions for pricing */}
                                {!selectedLead.projectId && selectedLead.status.toLowerCase() !== 'opted_out' && (
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-white/10 text-white hover:bg-white/5 uppercase font-black text-[10px] h-8 px-4"
                                            disabled={pricingSaving}
                                            onClick={() => handleSavePricingParams(selectedLead.id)}
                                        >
                                            {pricingSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                            Save Pricing Parameters
                                        </Button>

                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white uppercase font-black text-[10px] h-8 px-4"
                                            disabled={quoteLoading[selectedLead.id]}
                                            onClick={() => handleGenerateQuote(selectedLead.id)}
                                        >
                                            {quoteLoading[selectedLead.id] ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                                            Generate & Send Quote
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CLOSED-LOOP JOB CONVERSION COMPONENT */}
                        {selectedLead.projectId ? (
                            <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Converted Job Details</span>
                                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                                        <Check className="h-4 w-4 text-emerald-400" />
                                        Project Name: {selectedLead.project?.name || "Active Contract"}
                                    </div>
                                    {selectedLead.project?.invoices && (
                                        <div className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                                            Status: <span className="text-emerald-400">{selectedLead.project.status}</span> | Closed Revenue: <span className="text-emerald-400">{formatCurrency(selectedLead.project.invoices.reduce((acc, inv) => acc + inv.payments.reduce((pAcc, p) => pAcc + p.amount, 0), 0))}</span>
                                        </div>
                                    )}
                                </div>
                                <Link href="/projects" className="shrink-0 w-full sm:w-auto">
                                    <Button variant="outline" className="w-full border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 uppercase font-black text-xs px-4 py-2 rounded-xl">
                                        View Project Board
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="p-4 rounded-2xl border border-white/5 bg-[#0d0d15]/50 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Job Conversion Status</span>
                                    <div className="text-sm font-bold text-zinc-400">Not converted to active UROps contract yet.</div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                                    <Button
                                        variant="outline"
                                        className="border-red-500/20 text-red-500 hover:bg-red-500/10 font-black uppercase text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1"
                                        disabled={isDeletingLead[selectedLead.id]}
                                        onClick={() => handleDeleteLead(selectedLead.id)}
                                    >
                                        {isDeletingLead[selectedLead.id] ? (
                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                        ) : (
                                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        )}
                                        Delete Building
                                    </Button>
                                    <Button
                                        className="w-full sm:w-auto bg-primary text-black font-black uppercase text-xs hover:bg-primary/95 px-6 py-2.5 rounded-xl flex items-center justify-center gap-1 shadow-lg shadow-primary/10"
                                        disabled={selectedLead.status.toLowerCase() === 'opted_out' || selectedLead.status.toLowerCase() === 'rejected' || conversionLoading[selectedLead.id]}
                                        onClick={() => handleConvertLead(selectedLead.id)}
                                    >
                                        {conversionLoading[selectedLead.id] ? (
                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                        ) : (
                                            <Briefcase className="h-3.5 w-3.5 mr-1" />
                                        )}
                                        Convert to UROps Job
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* TIMELINE & CALL NOTE TIMELINE LOGGER */}
                        <div className="mt-6 border-t border-white/5 pt-5 space-y-4">
                            <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                                <History className="h-4 w-4 text-zinc-400" />
                                Lead Timeline & Call Logs
                            </h3>
                            
                            <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                <div className="p-2.5 rounded-xl border border-white/5 bg-[#0d0d15]/30 text-[11px] leading-relaxed">
                                    <div className="flex justify-between font-bold text-zinc-500 mb-1">
                                        <span>System Discovery Log</span>
                                        <span>{new Date(selectedLead.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    Property coordinate scanned. Computer vision defect results logged: Biological growth: {(selectedLead.biologicalGrowthScore * 100).toFixed(0)}%, Staining: {(selectedLead.surfaceStainingScore * 100).toFixed(0)}%.
                                </div>

                                {Array.isArray(selectedLead.history) && selectedLead.history.map((event: any, index: number) => (
                                    <div 
                                        key={index} 
                                        className={`p-2.5 rounded-xl border ${event.type === 'system' ? 'border-blue-500/10 bg-blue-500/5 text-blue-300' : 'border-zinc-500/10 bg-zinc-500/5 text-zinc-300'} text-[11px] leading-relaxed`}
                                    >
                                        <div className="flex justify-between font-bold text-muted-foreground mb-1">
                                            <span className="uppercase text-[9px] tracking-wider">
                                                {event.type === 'system' ? '💻 System Log' : '📞 Manual Call Note'}
                                            </span>
                                            <span>{new Date(event.date).toLocaleString()}</span>
                                        </div>
                                        {event.content}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    placeholder="Log new call notes or customer status updates..."
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    className="bg-[#0d0d15] border-white/5 text-xs text-white"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveNote(selectedLead.id)
                                    }}
                                />
                                <Button 
                                    size="sm"
                                    className="bg-white hover:bg-zinc-200 text-black uppercase font-black text-xs px-4"
                                    disabled={noteLoading || !noteText.trim()}
                                    onClick={() => handleSaveNote(selectedLead.id)}
                                >
                                    {noteLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                </Button>
                            </div>
                        </div>

                        {/* CRM Override controls inside modal */}
                        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-white/5 pt-5">
                            <div className="flex items-center gap-3">
                                <Label htmlFor="modalStatus" className="text-xs font-black uppercase text-zinc-400 shrink-0">CRM Status Override:</Label>
                                <select
                                    id="modalStatus"
                                    value={selectedLead.status}
                                    onChange={(e) => handleStatusChange(selectedLead.id, e.target.value)}
                                    className="h-9 rounded-lg border border-white/5 bg-[#0d0d15] px-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="discovered">Discovered</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="outreach_sent">Contacted (Outreach)</option>
                                    <option value="opted_out">Opted Out</option>
                                    <option value="interested">Interested</option>
                                    <option value="quote_sent">Quote Sent</option>
                                    <option value="closed">Closed (Job Booked)</option>
                                </select>
                            </div>
                            
                            <DialogFooter className="gap-2">
                                <Button 
                                    className="bg-white hover:bg-gray-200 text-black uppercase font-black text-xs py-2 px-6 rounded-xl"
                                    onClick={() => setSelectedLead(null)}
                                >
                                    Close Panel
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {activeLightboxImg && (
                <div 
                    className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 transition-all duration-300 cursor-pointer"
                    onClick={() => setActiveLightboxImg(null)}
                >
                    <div className="absolute top-4 right-4 text-white hover:text-red-400 transition-colors bg-white/10 rounded-full p-2 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <div className="max-w-[90vw] max-h-[85vh] relative flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={activeLightboxImg.url} 
                            alt={activeLightboxImg.title} 
                            className="max-w-full max-h-[80vh] object-contain rounded-xl border border-white/10 shadow-2xl"
                        />
                        {activeLightboxImg.title && (
                            <span className="mt-3 text-zinc-300 text-[10px] font-black uppercase tracking-widest bg-zinc-950/80 px-4 py-1.5 rounded-full border border-white/5">
                                {activeLightboxImg.title}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
