"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
    FileText, 
    Plus, 
    Check, 
    Trash2, 
    Edit3, 
    History, 
    AlertTriangle, 
    Loader2, 
    ShieldCheck, 
    Sparkles, 
    Eye,
    RotateCcw,
    CheckCircle2
} from "lucide-react"
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
    DialogTitle 
} from "@/components/ui/dialog"
import { parseClauses } from "@/lib/terms-utils"
import { 
    saveTermsTemplateAction, 
    deleteTermsTemplateAction, 
    setDefaultTermsTemplateAction, 
    getTermsTemplateVersionsAction, 
    restoreTermsTemplateVersionAction 
} from "@/app/(dashboard)/settings/terms/actions"

export interface TermsTemplateItem {
    id: string
    companyId: string
    name: string
    body: string
    isDefault: boolean
    version: number
    createdAt: Date | string
    updatedAt: Date | string
    _count?: {
        versions: number
        quoteTerms: number
    }
}

interface QuotationTermsManagerProps {
    initialTemplates: TermsTemplateItem[]
}

export function QuotationTermsManager({ initialTemplates }: QuotationTermsManagerProps) {
    const router = useRouter()
    const [templates, setTemplates] = useState<TermsTemplateItem[]>(initialTemplates)
    const [loading, setLoading] = useState(false)
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

    // Edit / Create Dialog State
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<TermsTemplateItem | null>(null)
    const [formName, setFormName] = useState("")
    const [formBody, setFormBody] = useState("")
    const [formIsDefault, setFormIsDefault] = useState(false)
    const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit")

    // Version History Dialog State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [historyTemplate, setHistoryTemplate] = useState<TermsTemplateItem | null>(null)
    const [versionsList, setVersionsList] = useState<any[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    // Confirmation Toast
    const [toastMessage, setToastMessage] = useState<string | null>(null)

    const showToast = (msg: string) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(null), 4000)
    }

    const openCreate = () => {
        setEditingTemplate(null)
        setFormName("")
        setFormBody(
            "All quotations are valid for 30 calendar days from the date of issue.\n" +
            "A 50% deposit is required upon approval before work commences, with the balance due on completion.\n" +
            "Any additional work outside the agreed scope will be quoted separately before execution.\n" +
            "Materials remain the property of the company until payment has cleared in full.\n" +
            "Site access must be provided during normal working hours unless otherwise agreed."
        )
        setFormIsDefault(templates.length === 0)
        setEditorTab("edit")
        setIsEditorOpen(true)
    }

    const openEdit = (tmpl: TermsTemplateItem) => {
        setEditingTemplate(tmpl)
        setFormName(tmpl.name)
        setFormBody(tmpl.body)
        setFormIsDefault(tmpl.isDefault)
        setEditorTab("edit")
        setIsEditorOpen(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formName.trim() || !formBody.trim()) {
            alert("Please provide both a template name and terms text.")
            return
        }

        setLoading(true)
        try {
            await saveTermsTemplateAction({
                id: editingTemplate?.id,
                name: formName,
                body: formBody,
                isDefault: formIsDefault
            })
            setIsEditorOpen(false)
            showToast(editingTemplate ? `Template "${formName}" updated to next version.` : `Template "${formName}" created successfully.`)
            router.refresh()
        } catch (err: any) {
            console.error(err)
            alert(err.message || "Failed to save template")
        } finally {
            setLoading(false)
        }
    }

    const handleSetDefault = async (tmpl: TermsTemplateItem) => {
        if (tmpl.isDefault) return
        setActionLoadingId(tmpl.id)
        try {
            await setDefaultTermsTemplateAction(tmpl.id)
            showToast(`"${tmpl.name}" is now the default terms template.`)
            router.refresh()
        } catch (err: any) {
            console.error(err)
            alert(err.message || "Failed to update default template")
        } finally {
            setActionLoadingId(null)
        }
    }

    const handleDelete = async (tmpl: TermsTemplateItem) => {
        if (!window.confirm(`Are you sure you want to delete template "${tmpl.name}"? Quotes already issued with this template will not be affected.`)) {
            return
        }
        setActionLoadingId(tmpl.id)
        try {
            await deleteTermsTemplateAction(tmpl.id)
            showToast(`Template "${tmpl.name}" deleted.`)
            router.refresh()
        } catch (err: any) {
            console.error(err)
            alert(err.message || "Failed to delete template")
        } finally {
            setActionLoadingId(null)
        }
    }

    const openHistory = async (tmpl: TermsTemplateItem) => {
        setHistoryTemplate(tmpl)
        setIsHistoryOpen(true)
        setLoadingHistory(true)
        try {
            const versions = await getTermsTemplateVersionsAction(tmpl.id)
            setVersionsList(versions)
        } catch (err: any) {
            console.error(err)
            alert(err.message || "Failed to load version history")
        } finally {
            setLoadingHistory(false)
        }
    }

    const handleRestoreVersion = async (versionNumber: number) => {
        if (!historyTemplate) return
        if (!window.confirm(`Restore version ${versionNumber}? This will create a new current version with that text.`)) {
            return
        }
        setLoading(true)
        try {
            await restoreTermsTemplateVersionAction(historyTemplate.id, versionNumber)
            setIsHistoryOpen(false)
            showToast(`Restored version ${versionNumber} of "${historyTemplate.name}".`)
            router.refresh()
        } catch (err: any) {
            console.error(err)
            alert(err.message || "Failed to restore version")
        } finally {
            setLoading(false)
        }
    }

    const parsedClauses = parseClauses(formBody)
    const hasDefault = templates.some(t => t.isDefault)

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#14141E] border border-white/10 shadow-xl">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl font-black tracking-tight text-white">Quotation Terms & Conditions</h2>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        Define reusable terms templates for your quotations. When a quote is sent or approved, its terms are snapshotted permanently to guarantee document immutability.
                    </p>
                </div>
                <Button 
                    onClick={openCreate}
                    className="font-bold bg-primary text-black hover:bg-primary/90 h-11 px-5 rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    New Terms Template
                </Button>
            </div>

            {/* Warning if no default is configured */}
            {!hasDefault && templates.length > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                        <p className="font-bold">No default terms template selected</p>
                        <p className="text-amber-300/80">
                            New quotes will render without terms and conditions unless you designate one of the templates below as the business default.
                        </p>
                    </div>
                </div>
            )}

            {/* Templates List */}
            {templates.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 space-y-4">
                    <div className="inline-flex p-4 rounded-2xl bg-white/5 border border-white/10 text-muted-foreground">
                        <FileText className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-base font-bold text-white">No terms templates created yet</h3>
                        <p className="text-xs text-muted-foreground max-w-md mx-auto">
                            Create your first terms template to automatically protect and standardize every quotation issued by your business.
                        </p>
                    </div>
                    <Button onClick={openCreate} variant="outline" className="font-bold border-white/20 hover:bg-white/5">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Standard Terms
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {templates.map((tmpl) => {
                        const clauses = parseClauses(tmpl.body)
                        const isActionBusy = actionLoadingId === tmpl.id

                        return (
                            <div 
                                key={tmpl.id} 
                                className={`p-5 rounded-2xl border transition-all ${tmpl.isDefault ? 'bg-[#121824] border-primary/40 shadow-lg shadow-primary/5' : 'bg-[#14141E] border-white/10 hover:border-white/20'}`}
                            >
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/5">
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-black text-white tracking-tight">{tmpl.name}</h3>
                                            {tmpl.isDefault && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                                                    <Check className="h-3 w-3" /> Default Template
                                                </span>
                                            )}
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/5 text-gray-400 border border-white/10">
                                                v{tmpl.version}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/5 text-gray-400 border border-white/10">
                                                {clauses.length} {clauses.length === 1 ? 'clause' : 'clauses'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground font-mono">
                                            Last modified: {new Date(tmpl.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {!tmpl.isDefault && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleSetDefault(tmpl)}
                                                disabled={isActionBusy || loading}
                                                className="text-xs font-bold border-white/10 hover:border-primary/40 hover:text-primary h-9"
                                            >
                                                {isActionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                                                Set as Default
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openHistory(tmpl)}
                                            className="text-xs font-bold border-white/10 hover:border-white/20 h-9 flex items-center gap-1.5 text-gray-300"
                                        >
                                            <History className="h-3.5 w-3.5 text-cyan-400" />
                                            History ({tmpl._count?.versions ?? 1})
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openEdit(tmpl)}
                                            className="text-xs font-bold border-white/10 hover:border-white/20 h-9 flex items-center gap-1.5 text-white"
                                        >
                                            <Edit3 className="h-3.5 w-3.5 text-primary" />
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDelete(tmpl)}
                                            disabled={isActionBusy || loading}
                                            className="text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 h-9 px-2.5"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Clauses numbered preview */}
                                <div className="mt-4 space-y-2">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                        <span>Numbered Clauses Preview</span>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2 max-h-44 overflow-y-auto font-sans">
                                        {clauses.map((clause, idx) => (
                                            <div key={idx} className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed">
                                                <span className="font-mono font-bold text-primary shrink-0 w-5">{idx + 1}.</span>
                                                <span className="text-gray-300">{clause}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create / Edit Template Dialog */}
            <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
                <DialogContent className="max-w-3xl bg-[#0F172A] border border-white/10 text-white shadow-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            {editingTemplate ? `Edit Template: ${editingTemplate.name}` : "Create Quotation Terms Template"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Numbered clauses will appear in sequential order on both web quotations and generated PDFs.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Tabs: Edit vs Quote Preview */}
                    <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <button
                            type="button"
                            onClick={() => setEditorTab("edit")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${editorTab === 'edit' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            Edit Clauses
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditorTab("preview")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${editorTab === 'preview' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Eye className="h-3.5 w-3.5" />
                            Quote Preview ({parsedClauses.length} {parsedClauses.length === 1 ? 'clause' : 'clauses'})
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4 pt-2">
                        {editorTab === "edit" ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="templateName" className="text-xs font-bold text-gray-300">
                                        Template Name *
                                    </Label>
                                    <Input
                                        id="templateName"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. Standard Terms, Tender 152G Terms, or Commercial SOW"
                                        className="bg-black/40 border-white/10 text-white text-sm h-11"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="templateBody" className="text-xs font-bold text-gray-300">
                                            Clauses Text * (One clause per line or paragraph)
                                        </Label>
                                        <span className="text-[10px] font-mono text-muted-foreground">
                                            {parsedClauses.length} active clauses detected
                                        </span>
                                    </div>
                                    <Textarea
                                        id="templateBody"
                                        rows={10}
                                        value={formBody}
                                        onChange={(e) => setFormBody(e.target.value)}
                                        placeholder="Enter clauses here. Each line or paragraph becomes a sequentially numbered clause..."
                                        className="bg-black/40 border-white/10 text-gray-200 text-xs font-sans leading-relaxed min-h-[220px]"
                                        required
                                    />
                                    <p className="text-[11px] text-muted-foreground italic">
                                        Tip: You don&apos;t need to type &quot;1.&quot; or &quot;2.&quot; — clauses are automatically numbered sequentially in quotes. If you do include numbers or bullets, they will be cleanly formatted.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="formIsDefault"
                                        checked={formIsDefault}
                                        onChange={(e) => setFormIsDefault(e.target.checked)}
                                        className="h-4 w-4 rounded border-white/20 bg-black/40 text-primary focus:ring-primary"
                                    />
                                    <Label htmlFor="formIsDefault" className="text-xs font-semibold text-gray-200 cursor-pointer">
                                        Set as the default quotation terms template for this business
                                    </Label>
                                </div>
                            </>
                        ) : (
                            /* Live Quote Preview Representation */
                            <div className="space-y-3 p-6 rounded-2xl bg-[#090D16] border border-white/10">
                                <div className="space-y-1">
                                    <div className="text-[11px] font-black uppercase tracking-[0.25em] text-lime-400">
                                        TERMS AND CONDITIONS
                                    </div>
                                    <div className="h-0.5 w-12 bg-lime-400 rounded-full" />
                                </div>
                                <div className="mt-4 space-y-2.5">
                                    {parsedClauses.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">No clauses typed yet.</p>
                                    ) : (
                                        parsedClauses.map((clause, idx) => (
                                            <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-300 leading-relaxed font-sans">
                                                <span className="font-mono font-bold text-lime-400 shrink-0 w-6">{idx + 1}.</span>
                                                <span className="text-gray-200">{clause}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        <DialogFooter className="pt-4 border-t border-white/10 flex items-center justify-between">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => setIsEditorOpen(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={loading || !formName.trim() || !formBody.trim()}
                                className="font-bold bg-primary text-black hover:bg-primary/90 px-6"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                                    </span>
                                ) : (
                                    editingTemplate ? `Save New Version (v${editingTemplate.version + 1})` : "Create Template"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Version History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-2xl bg-[#0F172A] border border-white/10 text-white shadow-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                            <History className="h-5 w-5 text-cyan-400" />
                            Version History: {historyTemplate?.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Every time a template is edited, a complete version snapshot is permanently recorded. You can inspect or restore prior versions at any time.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4 space-y-3 max-h-[460px] overflow-y-auto pr-1">
                        {loadingHistory ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-xs">Loading version log...</span>
                            </div>
                        ) : versionsList.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-6">No previous versions recorded.</p>
                        ) : (
                            versionsList.map((ver) => {
                                const isCurrent = historyTemplate && ver.version === historyTemplate.version
                                const clauses = parseClauses(ver.body)

                                return (
                                    <div 
                                        key={ver.id}
                                        className={`p-4 rounded-xl border space-y-2 ${isCurrent ? 'bg-primary/5 border-primary/30' : 'bg-black/30 border-white/5'}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/10 text-white">
                                                    Version {ver.version}
                                                </span>
                                                {isCurrent && (
                                                    <span className="text-[10px] font-black uppercase text-primary tracking-wider">
                                                        (Current Active)
                                                    </span>
                                                )}
                                                <span className="text-[11px] text-gray-400 font-mono">
                                                    {new Date(ver.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            {!isCurrent && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleRestoreVersion(ver.version)}
                                                    disabled={loading}
                                                    className="text-xs font-bold border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 h-8 flex items-center gap-1.5"
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    Restore
                                                </Button>
                                            )}
                                        </div>

                                        <div className="p-3 rounded-lg bg-black/40 text-xs text-gray-300 space-y-1.5 max-h-32 overflow-y-auto font-sans">
                                            {clauses.map((c, i) => (
                                                <div key={i} className="flex items-start gap-2">
                                                    <span className="font-mono text-gray-500 shrink-0">{i + 1}.</span>
                                                    <span>{c}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <DialogFooter className="pt-4 border-t border-white/10">
                        <Button variant="ghost" onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-white">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Persistent Toast Feedback */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#091e14] border-2 border-emerald-500/70 text-emerald-200 shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold">{toastMessage}</span>
                </div>
            )}
        </div>
    )
}
