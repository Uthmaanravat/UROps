"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Wand2, Loader2, FileText, ClipboardPaste, Sparkles, Building2, Briefcase, FileCheck, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle } from "lucide-react"
import { createInvoiceAction, getQuoteSequenceAction, getInvoiceSequenceAction } from "@/app/(dashboard)/invoices/actions"
import { getPricingSuggestionsAction } from "@/app/(dashboard)/invoices/pricing-actions"
import { formatCurrency, cn } from "@/lib/utils"
import { BulkItemImportDialog, ParsedBulkItem } from "@/components/invoices/BulkItemImportDialog"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { parseClauses, buildNumberedClauses } from "@/lib/terms-utils"
import { saveCustomTermsAsTemplateAction } from "@/app/(dashboard)/settings/terms/actions"

import { parseScopeAction } from "@/app/(dashboard)/invoices/ai-actions"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { getFixedPriceItemsAction } from "@/app/(dashboard)/knowledge/fixed-actions"
import { VoiceRecorder } from "@/components/voice/VoiceRecorder"
import { InfoTooltip } from "@/components/ui/InfoTooltip"
import { saveDraft, getDraft, clearDraft } from "@/lib/drafts"
import { EditorDraftBanner, AutoSaveIndicator } from "@/components/drafts/EditorDraftBanner"
import { LineItemEditor, LineItem } from "@/components/invoices/LineItemEditor"
import { AeroWashQuoteBuilder } from "@/components/invoices/AeroWashQuoteBuilder"
import { CatalogSidePanel } from "@/components/invoices/CatalogSidePanel"
import { calculateTenderRateYear } from "@/lib/tender-utils"

interface QuoteFormProps {
    clients: {
        id: string;
        name: string;
        codePrefix?: string | null;
        attentionTo?: string | null;
        defaultTermsTemplateId?: string | null;
        defaultCustomTerms?: string | null;
        contacts?: {
            id: string;
            clientId: string;
            name: string;
            email: string | null;
            phone: string | null;
            role: string | null;
        }[];
    }[]
    projects: { id: string; name: string, clientId: string }[]
    tenders?: any[]
    termsTemplates?: {
        id: string;
        name: string;
        body: string;
        isDefault: boolean;
        version: number;
    }[]
    initialClientId?: string
    initialProjectId?: string
    initialScope?: string
    initialType?: 'QUOTE' | 'INVOICE'
    initialTenderId?: string
    initialSite?: string
    initialProspectId?: string
    tendersEnabled?: boolean
    aiEnabled?: boolean
    isAdmin?: boolean
    isAeroWashWorkspace?: boolean
    surveyCameraEnabled?: boolean
    thermalCameraEnabled?: boolean
    hasVatRegistration?: boolean
}

export function QuoteForm({
    clients,
    projects,
    tenders = [],
    termsTemplates = [],
    initialClientId,
    initialProjectId,
    initialScope,
    initialType = 'QUOTE',
    initialTenderId,
    initialSite,
    initialProspectId,
    tendersEnabled = false,
    aiEnabled = true,
    isAdmin = true,
    isAeroWashWorkspace = false,
    surveyCameraEnabled = false,
    thermalCameraEnabled = false,
    hasVatRegistration = false
}: QuoteFormProps) {
    const isTendersEnabled = tendersEnabled
    const router = useRouter()
    const [isMounted, setIsMounted] = useState(false)
    useEffect(() => { setIsMounted(true) }, [])
    const docType = initialType
    const [aeroWashPayload, setAeroWashPayload] = useState<{
        items: any[];
        metadata: any;
        subtotal: number;
        total: number;
        validationErrors: string[];
    } | null>(null);
    const STORAGE_KEY = `urops_draft_${docType.toLowerCase()}_new`
    const isRestoring = useRef(false)
    const initialLoaded = useRef(false)
    const [pendingDraft, setPendingDraft] = useState<any | null>(null)
    const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null)
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const [loading, setLoading] = useState(false)
    const [scopeOpen, setScopeOpen] = useState(!!initialScope)
    const [scopeText, setScopeText] = useState(initialScope || "")
    const [isProcessingScope, setIsProcessingScope] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null)

    // Work Type and Tender selection
    const defaultTender = isTendersEnabled && tenders.length > 0 ? (initialTenderId ? tenders.find(t => t.id === initialTenderId) : tenders[0]) : null
    const [workType, setWorkType] = useState<"GENERAL" | "TENDER">(isTendersEnabled && initialTenderId ? "TENDER" : "GENERAL")

    useEffect(() => {
        if (!isTendersEnabled && workType === "TENDER") {
            setWorkType("GENERAL")
        }
    }, [isTendersEnabled, workType])
    const [selectedTenderId, setSelectedTenderId] = useState<string>(initialTenderId || defaultTender?.id || "")

    const activeTender = useMemo(() => {
        return tenders.find(t => t.id === selectedTenderId) || defaultTender
    }, [tenders, selectedTenderId, defaultTender])

    // Date state
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])

    // Rate Year: Default to Year 1 (persists user choice so it stays on Year 1 until changed)
    const [rateYear, setRateYear] = useState<1 | 2 | 3>(1)

    useEffect(() => {
        try {
            const saved = localStorage.getItem("tender_preferred_rate_year")
            if (saved === "1" || saved === "2" || saved === "3") {
                setRateYear(Number(saved) as 1 | 2 | 3)
            }
        } catch {}
    }, [])

    const effectiveRateYear = rateYear

    const handleRateYearChange = (newYear: 1 | 2 | 3) => {
        setRateYear(newYear)
        try {
            localStorage.setItem("tender_preferred_rate_year", String(newYear))
        } catch {}

        // Immediately update any tender line items already on the quote to the selected year's rate
        setItems((prevItems) =>
            prevItems.map((item) => {
                if (!item.code || !item.isLocked) return item
                const catItem = rawCatalog.find(
                    (c: any) => c.code?.trim().toUpperCase() === item.code?.trim().toUpperCase()
                )
                if (!catItem) return item
                let newPrice = catItem.unitPrice || 0
                if (newYear === 1) newPrice = catItem.year1Price ?? catItem.unitPrice ?? 0
                else if (newYear === 2) newPrice = catItem.year2Price ?? catItem.year1Price ?? catItem.unitPrice ?? 0
                else if (newYear === 3) newPrice = catItem.year3Price ?? catItem.year2Price ?? catItem.year1Price ?? catItem.unitPrice ?? 0

                const qty = item.quantity || 1
                return {
                    ...item,
                    unitPrice: newPrice,
                    total: qty * newPrice,
                    rateYear: newYear
                }
            })
        )
    }

    // Client & Project selection
    const [clientId, setClientId] = useState(
        initialClientId || (initialTenderId && activeTender?.clientId ? activeTender.clientId : (clients.length > 0 ? clients[0].id : ""))
    )
    const [projectId, setProjectId] = useState(initialProjectId || "")

    // Line items
    const [items, setItems] = useState<LineItem[]>(
        initialScope ? [] : [{ code: "", description: "", quantity: 1, unit: "each", unitPrice: 0, total: 0, area: "", reason: "", isLocked: false }]
    )
    const [highlightIndex, setHighlightIndex] = useState<number | null>(null)

    const [site, setSite] = useState(initialSite || "")
    const [quoteNumber, setQuoteNumber] = useState("")
    const [reference, setReference] = useState("")
    const [projectName, setProjectName] = useState("")
    const [isProjectNameManual, setIsProjectNameManual] = useState(false)
    const [paymentNotes, setPaymentNotes] = useState("")
    const [showPaymentNotes, setShowPaymentNotes] = useState(true)
    const [firstPaymentOption, setFirstPaymentOption] = useState<string>("none")
    const [customFirstPaymentPercentage, setCustomFirstPaymentPercentage] = useState<string>("")

    // Contacts state
    const [contactId, setContactId] = useState("")
    const [attentionTo, setAttentionTo] = useState("")

    // Pricing Intelligence state
    const [pricingSuggestions, setPricingSuggestions] = useState<Record<string, { typicalPrice: number; source: string }>>({})
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

    // Quotation Terms & Conditions state
    const defaultCompanyTemplate = useMemo(() => {
        return termsTemplates.find(t => t.isDefault) || (termsTemplates.length > 0 ? termsTemplates[0] : null)
    }, [termsTemplates])

    const initialClientObj = clients.find(c => c.id === (initialClientId || (clients.length > 0 ? clients[0].id : "")))
    const [availableTemplates, setAvailableTemplates] = useState(termsTemplates)
    const [selectedTermsTemplateId, setSelectedTermsTemplateId] = useState<string>(
        initialClientObj?.defaultTermsTemplateId || defaultCompanyTemplate?.id || ""
    )
    const [customTermsText, setCustomTermsText] = useState<string>(
        initialClientObj?.defaultCustomTerms || ""
    )
    const [isTermsCollapsed, setIsTermsCollapsed] = useState<boolean>(true)
    const [isSaveNewTemplateOpen, setIsSaveNewTemplateOpen] = useState(false)
    const [newTemplateName, setNewTemplateName] = useState("")
    const [isSavingNewTemplate, setIsSavingNewTemplate] = useState(false)

    const activeTermsTemplate = useMemo(() => {
        return availableTemplates.find(t => t.id === selectedTermsTemplateId) || null
    }, [availableTemplates, selectedTermsTemplateId])

    const numberedClausesPreview = useMemo(() => {
        return buildNumberedClauses(activeTermsTemplate?.body, customTermsText)
    }, [activeTermsTemplate, customTermsText])

    // Full catalog from database
    const [rawCatalog, setRawCatalog] = useState<any[]>([])

    // Load full catalog once
    useEffect(() => {
        const loadCatalog = async () => {
            try {
                const data = await getFixedPriceItemsAction()
                setRawCatalog(data)
            } catch (err) {
                console.error("Failed to load catalog", err)
            }
        }
        loadCatalog()
    }, [])

    // Filter catalog strictly based on workType
    // Tender: ONLY that tender's items
    // General: ONLY general items (no tenderId), global + this client's general items
    const activeCatalog = useMemo(() => {
        if (workType === "TENDER") {
            return rawCatalog.filter((item: any) => item.tenderId === selectedTenderId)
        }
        return rawCatalog.filter((item: any) => !item.tenderId && (!item.clientId || item.clientId === clientId))
    }, [rawCatalog, workType, selectedTenderId, clientId])

    const isDiscardedRef = useRef(false)
    const hasUserEditedRef = useRef(false)

    // Load draft on mount: silently restore if genuine unsaved work exists
    useEffect(() => {
        if (initialLoaded.current) return
        initialLoaded.current = true
        const draft = getDraft<any>(STORAGE_KEY)
        if (draft && draft.data) {
            const d = draft.data
            const draftHasContent = Boolean(
                (d.items && d.items.some((i: any) => (i.code && i.code.trim()) || (i.description && i.description.trim()) || (i.unitPrice && i.unitPrice > 0))) ||
                Boolean(d.site && d.site.trim()) ||
                Boolean(d.reference && d.reference.trim())
            )
            if (draftHasContent) {
                isRestoring.current = true
                if (d.clientId) setClientId(d.clientId)
                if (d.projectId) setProjectId(d.projectId)
                if (d.date) setDate(d.date)
                if (d.items && d.items.length > 0) setItems(d.items)
                if (d.site) setSite(d.site)
                if (d.quoteNumber) setQuoteNumber(d.quoteNumber)
                if (d.reference) setReference(d.reference)
                if (d.projectName) {
                    setProjectName(d.projectName)
                    setIsProjectNameManual(true)
                }
                if (d.workType) setWorkType(d.workType)
                if (d.selectedTenderId) setSelectedTenderId(d.selectedTenderId)
                if (d.rateYear || d.manualRateYear) setRateYear(Number(d.rateYear || d.manualRateYear) as 1 | 2 | 3)
                if (d.paymentNotes) setPaymentNotes(d.paymentNotes)
                if (d.firstPaymentOption) setFirstPaymentOption(d.firstPaymentOption)
                if (d.customFirstPaymentPercentage) setCustomFirstPaymentPercentage(d.customFirstPaymentPercentage)
                if (d.showPaymentNotes !== undefined) setShowPaymentNotes(d.showPaymentNotes)
                if (d.contactId) setContactId(d.contactId)
                if (d.attentionTo) setAttentionTo(d.attentionTo)
                setLastSavedTimestamp(draft.updatedAt || Date.now())
                hasUserEditedRef.current = true
                setTimeout(() => {
                    isRestoring.current = false
                }, 200)
            } else {
                clearDraft(STORAGE_KEY)
                clearDraft('quote-form-draft')
            }
        }
    }, [STORAGE_KEY])

    // Permanently discard draft and clear form back to fresh blank state
    const handleDiscardDraft = () => {
        isDiscardedRef.current = true
        hasUserEditedRef.current = false
        clearDraft(STORAGE_KEY)
        clearDraft('quote-form-draft')
        setPendingDraft(null)
        setLastSavedTimestamp(null)
        setItems([{ code: "", description: "", quantity: 1, unit: "each", unitPrice: 0, total: 0 }])
        setSite("")
        setReference("")
        setProjectName("")
        setIsProjectNameManual(false)
        setPaymentNotes("")
        setFirstPaymentOption("none")
        setCustomFirstPaymentPercentage("")
    }

    // Auto-save draft quietly in background ONLY when user actually edits meaningful content
    useEffect(() => {
        if (submitted || isRestoring.current || isDiscardedRef.current || !hasUserEditedRef.current) return

        const hasContent = (
            items.some((i) => (i.code && i.code.trim()) || (i.description && i.description.trim()) || (i.unitPrice && i.unitPrice > 0)) ||
            Boolean(site && site.trim()) ||
            Boolean(reference && reference.trim())
        )
        if (!hasContent) return

        setIsSavingDraft(true)
        const timer = setTimeout(() => {
            saveDraft({
                key: STORAGE_KEY,
                type: docType === 'INVOICE' ? 'INVOICE' : 'QUOTATION',
                title: `${docType === 'INVOICE' ? 'Invoice' : 'Quote'} Draft - ${clients.find(c => c.id === clientId)?.name || 'New'}`,
                url: `/invoices/new?type=${docType}`,
                itemCount: items.length,
                total: items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * 1.15,
                data: {
                    clientId,
                    projectId,
                    date,
                    workType,
                    selectedTenderId,
                    rateYear,
                    items,
                    site,
                    quoteNumber,
                    reference,
                    projectName,
                    paymentNotes,
                    firstPaymentOption,
                    customFirstPaymentPercentage,
                    showPaymentNotes,
                    contactId,
                    attentionTo
                }
            })
            setIsSavingDraft(false)
            setLastSavedTimestamp(Date.now())
        }, 800)

        return () => clearTimeout(timer)
    }, [
        clientId, projectId, date, workType, selectedTenderId, rateYear, items,
        site, quoteNumber, reference, projectName, paymentNotes, firstPaymentOption,
        customFirstPaymentPercentage, showPaymentNotes, contactId, attentionTo,
        submitted, STORAGE_KEY, clients, docType
    ])

    // Load sequence number whenever client or workType or tender changes
    useEffect(() => {
        const loadSequence = async () => {
            if (isRestoring.current) return
            try {
                const docNumber = docType === 'INVOICE'
                    ? await getInvoiceSequenceAction(clientId, workType, selectedTenderId)
                    : await getQuoteSequenceAction(clientId, workType, selectedTenderId)
                if (docNumber) setQuoteNumber(docNumber)
            } catch (e) {
                console.error("Failed to get document sequence:", e)
            }
        }
        loadSequence()
    }, [clientId, workType, selectedTenderId, docType])

    // Sync contacts and default terms when clientId changes
    useEffect(() => {
        if (isRestoring.current) return
        const selectedClient = clients.find(c => c.id === clientId)
        const contacts = selectedClient?.contacts || []
        if (contacts.length > 0) {
            setContactId(contacts[0].id)
            setAttentionTo(contacts[0].name)
        } else {
            setContactId("")
            setAttentionTo(selectedClient?.attentionTo || "")
        }

        if (selectedClient?.defaultTermsTemplateId) {
            setSelectedTermsTemplateId(selectedClient.defaultTermsTemplateId)
        } else if (defaultCompanyTemplate) {
            setSelectedTermsTemplateId(defaultCompanyTemplate.id)
        }

        if (selectedClient?.defaultCustomTerms) {
            setCustomTermsText(selectedClient.defaultCustomTerms)
        }
    }, [clientId, clients, defaultCompanyTemplate])

    // Sync Project Name with Reference
    useEffect(() => {
        if (isRestoring.current) return
        if (!isProjectNameManual) {
            setProjectName(reference)
        }
    }, [reference, isProjectNameManual])

    // Handle Work Type Change
    const handleWorkTypeChange = (newType: "GENERAL" | "TENDER") => {
        setWorkType(newType)
        if (newType === "TENDER" && activeTender) {
            if (activeTender.clientId) {
                setClientId(activeTender.clientId)
            }
        }
    }

    // Add item from Catalog side panel
    const handleAddFromCatalog = (catItem: any) => {
        const isTender = workType === "TENDER" || Boolean(catItem.tenderId)
        let price = catItem.unitPrice || 0
        if (isTender) {
            if (effectiveRateYear === 1) price = catItem.year1Price ?? catItem.unitPrice ?? 0
            else if (effectiveRateYear === 2) price = catItem.year2Price ?? catItem.year1Price ?? catItem.unitPrice ?? 0
            else if (effectiveRateYear === 3) price = catItem.year3Price ?? catItem.year2Price ?? catItem.year1Price ?? catItem.unitPrice ?? 0
        }

        const newItem: LineItem = {
            code: catItem.code || "",
            description: catItem.description || "",
            quantity: 1,
            unit: catItem.unit || "each",
            unitPrice: price,
            total: price,
            area: "",
            reason: "",
            isLocked: isTender,
            rateYear: isTender ? effectiveRateYear : undefined
        }

        if (items.length === 1 && !items[0].description && items[0].unitPrice === 0) {
            setItems([newItem])
            setHighlightIndex(0)
        } else {
            const next = [...items, newItem]
            setItems(next)
            setHighlightIndex(next.length - 1)
        }
    }

    // Bulk Import Dialog
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
    const handleBulkImport = (newParsedItems: ParsedBulkItem[]) => {
        const mapped: LineItem[] = newParsedItems.map(item => ({
            code: "",
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || "each",
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            area: item.area || "",
            reason: item.reason || "",
            isLocked: false
        }))

        if (items.length === 1 && !items[0].description && items[0].unitPrice === 0) {
            setItems(mapped)
            setHighlightIndex(0)
        } else {
            const startIdx = items.length
            setItems([...items, ...mapped])
            setHighlightIndex(startIdx)
        }
    }

    // Calculations
    const subtotal = isAeroWashWorkspace && aeroWashPayload ? aeroWashPayload.subtotal : items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0)
    const tax = hasVatRegistration ? subtotal * 0.15 : 0
    const total = isAeroWashWorkspace && aeroWashPayload ? aeroWashPayload.total : (subtotal + tax)

    const selectedClient = clients.find(c => c.id === clientId)
    const clientContacts = selectedClient?.contacts || []

    const parseAttentionToNames = (attn: string | null | undefined): string[] => {
        if (!attn) return []
        const names = attn.split(/[/,;|]+/).map(n => n.trim()).filter(Boolean)
        return names.length > 1 ? names : []
    }
    const attentionToNames = parseAttentionToNames(selectedClient?.attentionTo)
    const hasMultipleContacts = clientContacts.length > 0 || attentionToNames.length > 0

    // Submit handler
    const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
        if (e) e.preventDefault()
        setLoading(true)

        let finalFirstPaymentPercentage: number | undefined = undefined
        if (firstPaymentOption === "20") finalFirstPaymentPercentage = 20
        else if (firstPaymentOption === "50") finalFirstPaymentPercentage = 50
        else if (firstPaymentOption === "75") finalFirstPaymentPercentage = 75
        else if (firstPaymentOption === "custom") {
            const parsed = parseFloat(customFirstPaymentPercentage)
            if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
                finalFirstPaymentPercentage = parsed
            }
        }

        try {
            if (isAeroWashWorkspace && aeroWashPayload?.validationErrors && aeroWashPayload.validationErrors.length > 0) {
                alert("Please resolve compliance errors before creating quote:\n" + aeroWashPayload.validationErrors.join("\n"));
                setLoading(false);
                return;
            }

            const formattedItems = isAeroWashWorkspace && aeroWashPayload
                ? aeroWashPayload.items.map(i => ({
                    code: undefined,
                    description: i.description,
                    quantity: 1,
                    unit: "LOT",
                    unitPrice: i.unitPrice,
                    area: i.area,
                    reason: undefined,
                    isLocked: false,
                    rateYear: 1,
                    metadata: i.metadata
                }))
                : items.map(i => ({
                    code: i.code || undefined,
                    description: i.description,
                    quantity: i.quantity || 1,
                    unit: i.unit || "each",
                    unitPrice: i.unitPrice || 0,
                    area: i.area,
                    reason: i.reason,
                    isLocked: Boolean(i.isLocked),
                    rateYear: i.rateYear || (workType === "TENDER" ? effectiveRateYear : undefined),
                    metadata: undefined
                }));

            const invoiceId = await createInvoiceAction({
                clientId,
                projectId: projectId || undefined,
                date,
                items: formattedItems,
                metadata: isAeroWashWorkspace && aeroWashPayload ? aeroWashPayload.metadata : undefined,
                site,
                quoteNumber,
                reference,
                projectName,
                type: docType,
                paymentNotes: showPaymentNotes ? paymentNotes : undefined,
                firstPaymentPercentage: finalFirstPaymentPercentage,
                contactId: contactId || null,
                attentionTo: attentionTo || null,
                workType,
                tenderId: workType === "TENDER" ? selectedTenderId : null,
                rateYear: workType === "TENDER" ? effectiveRateYear : 1,
                termsTemplateId: docType === 'QUOTE' ? (selectedTermsTemplateId || null) : null,
                customTermsBody: docType === 'QUOTE' ? (customTermsText.trim() || null) : null,
                prospectId: initialProspectId || undefined
            })

            clearDraft(STORAGE_KEY)
            clearDraft('quote-form-draft')
            isDiscardedRef.current = true
            hasUserEditedRef.current = false
            setSubmitted(true)
            setLastInvoiceId(invoiceId)
            router.push(`/invoices/${invoiceId}`)
        } catch (error) {
            console.error(error)
            alert(error instanceof Error ? error.message : "Failed to create document")
            setLoading(false)
        }
    }

    if (!isMounted) {
        return (
            <div className="p-12 text-center text-gray-400 font-sans flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Loading quotation builder...</span>
            </div>
        )
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 w-full space-y-6">
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} action="#" className="space-y-6">
                    {/* WORK TYPE SELECTOR BAR (Requirement 1 & 2) - Only if tendersEnabled */}
                    {isTendersEnabled && (
                    <div className="p-4 rounded-2xl bg-[#14141E] border border-white/10 shadow-lg space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    Work Classification:
                                </Label>
                                <div className="inline-flex rounded-xl bg-black/40 p-1 border border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => handleWorkTypeChange("GENERAL")}
                                        className={cn(
                                            "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                                            workType === "GENERAL"
                                                ? "bg-primary text-black shadow-md"
                                                : "text-muted-foreground hover:text-white"
                                        )}
                                    >
                                        <Briefcase className="w-3.5 h-3.5" /> General Work
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleWorkTypeChange("TENDER")}
                                        className={cn(
                                            "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                                            workType === "TENDER"
                                                ? "bg-amber-400 text-black shadow-md"
                                                : "text-muted-foreground hover:text-white"
                                        )}
                                    >
                                        <Building2 className="w-3.5 h-3.5" /> Tender Work
                                    </button>
                                </div>
                            </div>

                            {/* Tender Details & Rate Year Selector */}
                            {workType === "TENDER" && (
                                <div className="flex flex-wrap items-center gap-3">
                                    {tenders.length > 1 && (
                                        <select
                                            value={selectedTenderId}
                                            onChange={(e) => setSelectedTenderId(e.target.value)}
                                            className="h-8 rounded-lg bg-[#0F0F1A] border border-amber-500/30 text-amber-300 px-2 text-xs font-bold"
                                        >
                                            {tenders.map(t => (
                                                <option key={t.id} value={t.id}>{t.tenderNumber} - {t.name}</option>
                                            ))}
                                        </select>
                                    )}

                                    {/* 3-Year Rate Label & Selector */}
                                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                                            Rate Period:
                                        </span>
                                        <select
                                            value={rateYear}
                                            onChange={(e) => handleRateYearChange(Number(e.target.value) as 1 | 2 | 3)}
                                            className="bg-transparent text-amber-400 font-black text-xs border-none focus:outline-none cursor-pointer"
                                        >
                                            <option value={1} className="bg-[#14141E] text-white">Year 1 Rate (2025/26)</option>
                                            <option value={2} className="bg-[#14141E] text-white">Year 2 Rate (2026/27)</option>
                                            <option value={3} className="bg-[#14141E] text-white">Year 3 Rate (2027/28)</option>
                                        </select>
                                    </div>

                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                        <FileCheck className="w-3 h-3" /> TENDER 152G
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Header Details Card */}
                    <div className="grid gap-6 md:grid-cols-2 p-6 rounded-2xl bg-[#14141E] border border-white/5 shadow-xl">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    Client <span className="text-primary">*</span>
                                </Label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-[#0F0F1A] px-3 py-1 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={clientId}
                                    onChange={(e) => {
                                        setClientId(e.target.value)
                                        setProjectId("")
                                    }}
                                    required
                                >
                                    <option value="" disabled>Select a client</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {hasMultipleContacts && (
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground">
                                        Select Contact (Optional)
                                    </Label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-input bg-[#0F0F1A] px-3 py-1 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={contactId || (attentionToNames.includes(attentionTo) ? attentionTo : "")}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            const contact = clientContacts.find(c => c.id === val)
                                            if (contact) {
                                                setContactId(contact.id)
                                                setAttentionTo(contact.name)
                                            } else {
                                                setContactId("")
                                                setAttentionTo(val || selectedClient?.attentionTo || "")
                                            }
                                        }}
                                    >
                                        <option value="">-- Select Contact --</option>
                                        {selectedClient?.attentionTo && (
                                            <option value={selectedClient.attentionTo}>
                                                [Default] {selectedClient.attentionTo}
                                            </option>
                                        )}
                                        {attentionToNames.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                        {clientContacts.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} {c.role ? `(${c.role})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    Attention To
                                </Label>
                                <Input
                                    placeholder="e.g. Mr. Smith"
                                    value={attentionTo}
                                    onChange={(e) => setAttentionTo(e.target.value)}
                                    className="bg-[#0F0F1A]"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    Date
                                </Label>
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="bg-[#0F0F1A]"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    {docType === 'INVOICE' ? 'Tax Invoice #' : 'Quote #'}
                                    <InfoTooltip content="Auto-generated sequence number, customized per client or tender." />
                                </Label>
                                <Input
                                    placeholder="Auto-generated or custom"
                                    value={quoteNumber}
                                    onChange={(e) => setQuoteNumber(e.target.value)}
                                    className="bg-[#0F0F1A] font-mono font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    Project / Reference
                                </Label>
                                <Input
                                    placeholder="e.g. Wynberg Park Play Equipment"
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                    className="bg-[#0F0F1A]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    Site / Location
                                </Label>
                                <Input
                                    placeholder="e.g. Wynberg Park, Corner of Main & River"
                                    value={site}
                                    onChange={(e) => setSite(e.target.value)}
                                    className="bg-[#0F0F1A]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Line Items Card with AI & Bulk buttons */}
                    <div className="p-6 rounded-2xl bg-[#14141E] border border-white/5 shadow-xl space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                            <div>
                                <h3 className="text-base font-black uppercase tracking-wider text-white">
                                    Line Items
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {workType === "TENDER"
                                        ? "Tender items have fixed contract prices. Descriptions, units, and rates are locked."
                                        : "General work line items are fully customizable."}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsBulkImportOpen(true)}
                                    className="border-white/10 text-xs font-bold"
                                >
                                    <ClipboardPaste className="mr-1.5 h-3.5 w-3.5 text-primary" /> Bulk Paste Items
                                </Button>

                                {aiEnabled && (
                                    <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
                                        <DialogTrigger asChild>
                                            <Button type="button" variant="secondary" size="sm" className="text-xs font-bold">
                                                <Wand2 className="mr-1.5 h-3.5 w-3.5" /> AI Scope Extractor
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md bg-[#1A1A2E] text-white">
                                            <DialogHeader>
                                                <DialogTitle>Paste Scope of Work</DialogTitle>
                                                <DialogDescription className="text-gray-300 text-xs">
                                                    Paste the email or document text. The AI will extract line items.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <Textarea
                                                placeholder="Paste email scope here..."
                                                value={scopeText}
                                                onChange={(e) => setScopeText(e.target.value)}
                                                className="min-h-[140px] bg-[#14141E] text-xs"
                                            />
                                            <DialogFooter>
                                                <Button
                                                    type="button"
                                                    disabled={isProcessingScope || !scopeText.trim()}
                                                    onClick={async () => {
                                                        setIsProcessingScope(true)
                                                        try {
                                                            const newItems = await parseScopeAction(scopeText)
                                                            if (newItems && newItems.length > 0) {
                                                                const mapped: LineItem[] = newItems.map((i: any) => ({
                                                                    description: i.description,
                                                                    quantity: i.quantity || 1,
                                                                    unit: "each",
                                                                    unitPrice: i.unitPrice || 0,
                                                                    total: (i.quantity || 1) * (i.unitPrice || 0),
                                                                    area: "",
                                                                    reason: ""
                                                                }))
                                                                setItems(mapped)
                                                                setScopeOpen(false)
                                                            }
                                                        } catch (e) {
                                                            alert("AI extraction failed.")
                                                        } finally {
                                                            setIsProcessingScope(false)
                                                        }
                                                    }}
                                                    className="bg-primary text-black font-bold text-xs"
                                                >
                                                    {isProcessingScope ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                                                    Generate Items
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        </div>

                        {/* AeroWash Catalogue & Elevation Quote Builder OR Standard LineItemEditor */}
                        {isAeroWashWorkspace && docType === 'QUOTE' ? (
                            <AeroWashQuoteBuilder
                                currencySymbol={selectedClient?.codePrefix ? "R" : "R"}
                                surveyCameraEnabled={surveyCameraEnabled}
                                thermalCameraEnabled={thermalCameraEnabled}
                                hasVatRegistration={hasVatRegistration}
                                termsTemplates={termsTemplates}
                                onChange={setAeroWashPayload}
                            />
                        ) : (
                            <LineItemEditor
                                items={items}
                                onChange={setItems}
                                catalog={activeCatalog}
                                workType={workType}
                                rateYear={effectiveRateYear}
                                isAdmin={isAdmin}
                                highlightIndex={highlightIndex}
                            />
                        )}
                    </div>

                    {/* Quotation Terms & Conditions Section (Quotes only) */}
                    {docType === 'QUOTE' && (
                        <div className="space-y-4">
                            {/* Warning if business has no default template set */}
                            {!defaultCompanyTemplate && (
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                                    <div className="text-xs space-y-1">
                                        <p className="font-bold">No Default Quotation Terms Configured</p>
                                        <p className="text-amber-300/80">
                                            This business has no default terms template set. This quotation will render without a terms section unless you select a template below or configure one under Settings &gt; Quotation Terms.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Collapsible Terms and Conditions Block */}
                            <div className="rounded-2xl bg-[#14141E] border border-white/10 shadow-lg overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setIsTermsCollapsed(!isTermsCollapsed)}
                                    className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                                            <ShieldCheck className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-black uppercase tracking-wider text-white">Terms and Conditions</span>
                                                {activeTermsTemplate ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                                                        {activeTermsTemplate.name}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-gray-400 border border-white/10">
                                                        None Selected
                                                    </span>
                                                )}
                                                {numberedClausesPreview.length > 0 && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10">
                                                        {numberedClausesPreview.length} {numberedClausesPreview.length === 1 ? 'clause' : 'clauses'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {isTermsCollapsed ? "Click to expand, switch template, or add custom client clauses" : "Configure quotation terms and client-specific conditions"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-muted-foreground pr-2">
                                        {isTermsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                    </div>
                                </button>

                                {!isTermsCollapsed && (
                                    <div className="p-5 border-t border-white/5 space-y-5 bg-black/20">
                                        {/* Template Switcher */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="quoteTermsTemplate" className="text-xs font-bold text-gray-300">
                                                    Terms Template
                                                </Label>
                                                <Link 
                                                    href="/settings/terms" 
                                                    target="_blank"
                                                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                                                >
                                                    Manage Templates ↗
                                                </Link>
                                            </div>
                                            <select
                                                id="quoteTermsTemplate"
                                                value={selectedTermsTemplateId}
                                                onChange={(e) => setSelectedTermsTemplateId(e.target.value)}
                                                className="flex h-10 w-full rounded-xl border border-white/10 bg-[#0F172A] px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                            >
                                                <option value="">None (Omit terms section)</option>
                                                {availableTemplates.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.name} {t.isDefault ? "(Business Default)" : ""} (v{t.version})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Custom Terms Textarea */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="quoteCustomTerms" className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                                    Add Custom Terms
                                                    <InfoTooltip content="Add clauses specific to this client or job. Custom terms are appended after the template terms and numbered on sequentially from the last template clause." />
                                                </Label>
                                                {customTermsText.trim() && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setNewTemplateName("")
                                                            setIsSaveNewTemplateOpen(true)
                                                        }}
                                                        className="h-7 px-2 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                                                    >
                                                        <Sparkles className="h-3 w-3 mr-1" />
                                                        Save as New Template
                                                    </Button>
                                                )}
                                            </div>
                                            <Textarea
                                                id="quoteCustomTerms"
                                                rows={3}
                                                value={customTermsText}
                                                onChange={(e) => setCustomTermsText(e.target.value)}
                                                placeholder="Enter any client or job-specific clauses (one per line). These will append after the template clauses..."
                                                className="bg-[#0F172A] border-white/10 text-xs font-sans text-gray-200 min-h-[80px]"
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                Custom terms are saved against this quote only and never modify the template.
                                            </p>
                                        </div>

                                        {/* Live Sequential Preview */}
                                        {numberedClausesPreview.length > 0 && (
                                            <div className="space-y-2 pt-2 border-t border-white/5">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                                                    <span>Sequential Clauses Preview (As Rendered On Quote)</span>
                                                </div>
                                                <div className="p-4 rounded-xl bg-[#090D16] border border-white/5 space-y-2 max-h-48 overflow-y-auto font-sans">
                                                    {numberedClausesPreview.map((clause) => (
                                                        <div key={clause.clauseNumber} className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed">
                                                            <span className="font-mono font-bold text-primary shrink-0 w-6">
                                                                {clause.clauseNumber}.
                                                            </span>
                                                            <span className={clause.source === 'custom' ? 'text-cyan-200' : 'text-gray-300'}>
                                                                {clause.text}
                                                                {clause.source === 'custom' && (
                                                                    <span className="ml-1.5 text-[9px] font-mono text-cyan-400 uppercase tracking-widest">[Custom]</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Totals & Submit */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 p-6 rounded-2xl bg-[#14141E] border border-white/5">
                        <div className="space-y-2 text-xs text-muted-foreground">
                            <p>All prices exclude 15% VAT until total.</p>
                            <div className="flex items-center gap-3">
                                <AutoSaveIndicator isSavingDraft={isSavingDraft} lastSavedTimestamp={lastSavedTimestamp} />
                                {lastSavedTimestamp && (
                                    <button
                                        type="button"
                                        onClick={handleDiscardDraft}
                                        className="text-[11px] text-red-400 hover:text-red-300 underline font-semibold transition-colors"
                                    >
                                        Discard Draft
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="w-full md:w-80 space-y-2 text-right">
                            <div className="flex justify-between text-sm text-gray-300">
                                <span>Subtotal:</span>
                                <span className="font-mono font-bold text-white">{formatCurrency(subtotal)}</span>
                            </div>
                            {hasVatRegistration && (
                                <div className="flex justify-between text-sm text-gray-400">
                                    <span>VAT (15%):</span>
                                    <span className="font-mono font-bold">{formatCurrency(tax)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-black text-white pt-2 border-t border-white/10">
                                <span>Total:</span>
                                <span className="font-mono text-primary text-xl">{formatCurrency(total)}</span>
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        clearDraft(STORAGE_KEY)
                                        router.back()
                                    }}
                                    className="border-white/10 text-xs"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={loading || (isAeroWashWorkspace ? (!aeroWashPayload || aeroWashPayload.items.length === 0) : items.length === 0)}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs px-6"
                                >
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {docType === 'INVOICE' ? 'Save Tax Invoice' : 'Save Quotation'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* Catalog Side Panel (Shared Component) */}
            <CatalogSidePanel
                catalog={activeCatalog}
                items={items}
                onAddItem={handleAddFromCatalog}
                workType={workType}
                selectedTender={activeTender}
                clientName={selectedClient?.name}
                rateYear={effectiveRateYear}
            />

            <BulkItemImportDialog
                open={isBulkImportOpen}
                onOpenChange={setIsBulkImportOpen}
                onImport={handleBulkImport}
                currentCount={items.length}
            />

            {/* Save Custom Terms as Template Dialog */}
            <Dialog open={isSaveNewTemplateOpen} onOpenChange={setIsSaveNewTemplateOpen}>
                <DialogContent className="max-w-md bg-[#0F172A] border border-white/10 text-white shadow-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black text-white flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-cyan-400" />
                            Save Custom Terms as New Template
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Create a reusable terms template from these custom clauses so recurring variations can be applied to future quotes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="newTemplateNameInput" className="text-xs font-bold text-gray-300">
                                Template Name *
                            </Label>
                            <Input
                                id="newTemplateNameInput"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                                placeholder="e.g. Specialized Rigging Terms"
                                className="bg-black/40 border-white/10 text-white text-xs h-10"
                            />
                        </div>
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-gray-300 max-h-32 overflow-y-auto">
                            <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Clauses to be saved:</p>
                            {parseClauses(customTermsText).map((c, i) => (
                                <div key={i} className="flex gap-1.5 text-[11px]">
                                    <span className="text-muted-foreground">{i + 1}.</span>
                                    <span>{c}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter className="pt-2 border-t border-white/10 flex items-center justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsSaveNewTemplateOpen(false)}
                            className="text-xs text-gray-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={isSavingNewTemplate || !newTemplateName.trim()}
                            onClick={async () => {
                                setIsSavingNewTemplate(true)
                                try {
                                    const created = await saveCustomTermsAsTemplateAction({
                                        name: newTemplateName.trim(),
                                        body: customTermsText.trim()
                                    })
                                    setAvailableTemplates(prev => [...prev, created])
                                    setSelectedTermsTemplateId(created.id)
                                    setCustomTermsText("")
                                    setIsSaveNewTemplateOpen(false)
                                    alert(`Template "${created.name}" created and selected!`)
                                } catch (err: any) {
                                    alert(err.message || "Failed to save template")
                                } finally {
                                    setIsSavingNewTemplate(false)
                                }
                            }}
                            className="bg-primary text-black font-bold text-xs"
                        >
                            {isSavingNewTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                            Save Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
