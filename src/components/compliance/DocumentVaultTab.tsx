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
    Archive,
    Download,
    Eye,
    FileCheck2,
    Loader2,
    PackageCheck,
    Plus,
    Trash2,
    Upload,
} from "lucide-react"
import {
    archiveComplianceDocumentAction,
    deleteComplianceDocumentAction,
    getComplianceDocumentSignedUrlAction,
    toggleVendorPackInclusionAction,
} from "@/app/(dashboard)/compliance/actions"
import {
    ALL_COMPLIANCE_CATEGORY_META,
    type AllComplianceCategory,
    evaluateComplianceDocument,
} from "@/lib/compliance-status"

interface DocumentVaultTabProps {
    isAdmin: boolean
    documents: any[]
    onOpenUploadModal: (presetCategory?: AllComplianceCategory) => void
}

export function DocumentVaultTab({
    isAdmin,
    documents,
    onOpenUploadModal,
}: DocumentVaultTabProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [categoryFilter, setCategoryFilter] = useState("ALL")
    const [showArchived, setShowArchived] = useState(false)
    const [loadingDocId, setLoadingDocId] = useState<string | null>(null)

    const filteredDocs = useMemo(() => {
        return (documents || []).filter(d => {
            if (!showArchived && d.isArchived) return false
            if (categoryFilter !== "ALL" && d.category !== categoryFilter) return false
            return true
        })
    }, [documents, showArchived, categoryFilter])

    const handleOpenDoc = async (docId: string, download = false) => {
        setLoadingDocId(docId)
        try {
            const res = await getComplianceDocumentSignedUrlAction(docId, download)
            if (!res.success || !res.url) {
                alert(res.error || "Unable to open document.")
                return
            }
            window.open(res.url, "_blank", "noopener,noreferrer")
        } finally {
            setLoadingDocId(null)
        }
    }

    const handleTogglePack = (docId: string, nextVal: boolean) => {
        startTransition(async () => {
            await toggleVendorPackInclusionAction(docId, nextVal)
            router.refresh()
        })
    }

    const handleArchiveToggle = (docId: string, nextVal: boolean) => {
        startTransition(async () => {
            const res = await archiveComplianceDocumentAction(docId, nextVal)
            if (!res.success) alert(res.error)
            else router.refresh()
        })
    }

    const handleDelete = (docId: string) => {
        if (!confirm("Permanently delete this compliance document and file from storage?")) return
        startTransition(async () => {
            const res = await deleteComplianceDocumentAction(docId)
            if (!res.success) alert(res.error)
            else router.refresh()
        })
    }

    return (
        <div className="space-y-4">
            <Card className="border-white/10 bg-[#141424]">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            className="h-9 rounded-md bg-black/30 border border-white/10 px-3 text-xs text-white"
                        >
                            <option value="ALL">All Document Categories</option>
                            {Object.entries(ALL_COMPLIANCE_CATEGORY_META).map(([key, meta]) => (
                                <option key={key} value={key}>
                                    {meta.label}
                                </option>
                            ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer ml-2">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={e => setShowArchived(e.target.checked)}
                            />
                            Show superseded / archived renewals
                        </label>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => onOpenUploadModal()}
                        className="font-bold gap-1.5"
                    >
                        <Upload className="h-4 w-4" />
                        Upload Certificate / Agreement
                    </Button>
                </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#141424] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/10 bg-black/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                                <th className="py-3 px-4">Category</th>
                                <th className="py-3 px-4">Document & Reference</th>
                                <th className="py-3 px-4">Pilot / Scope</th>
                                <th className="py-3 px-4">Expiry</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4 text-center">Vendor Pack</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredDocs.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="py-12 text-center text-muted-foreground"
                                    >
                                        No compliance documents uploaded yet. Upload your ABEOD Agreement, Insurance, COIDA, Tax Clearance, and Pilot RPLs to enable 1-click Vendor Pack downloads.
                                    </td>
                                </tr>
                            ) : (
                                filteredDocs.map(doc => {
                                    const meta =
                                        ALL_COMPLIANCE_CATEGORY_META[
                                            doc.category as AllComplianceCategory
                                        ] || ALL_COMPLIANCE_CATEGORY_META.OTHER
                                    const ev = evaluateComplianceDocument(doc)

                                    const badgeStyle = doc.isArchived
                                        ? "bg-white/10 text-muted-foreground border-white/15"
                                        : ev.severity === "EXPIRED"
                                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                        : ev.severity === "CRITICAL"
                                        ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                                        : ev.severity === "DUE_SOON"
                                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"

                                    return (
                                        <tr
                                            key={doc.id}
                                            className={`hover:bg-white/[0.02] ${
                                                doc.isArchived ? "opacity-55" : ""
                                            }`}
                                        >
                                            <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                                                {meta.shortLabel}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-white">
                                                    {doc.title}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    {doc.referenceNumber
                                                        ? `Ref: ${doc.referenceNumber}`
                                                        : "No reference #"}
                                                    {doc.issuingAuthority
                                                        ? ` · ${doc.issuingAuthority}`
                                                        : ""}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {doc.pilotUser
                                                    ? doc.pilotUser.name || doc.pilotUser.email
                                                    : doc.drone
                                                    ? doc.drone.name
                                                    : "Company-wide"}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-white/90 whitespace-nowrap">
                                                {doc.expiryDate
                                                    ? String(doc.expiryDate).split("T")[0]
                                                    : "No expiry"}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeStyle}`}
                                                >
                                                    {doc.isArchived ? "Archived" : ev.label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {!doc.isArchived && (
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(doc.includeInVendorPack)}
                                                        disabled={isPending}
                                                        onChange={e =>
                                                            handleTogglePack(
                                                                doc.id,
                                                                e.target.checked
                                                            )
                                                        }
                                                        title="Include in 1-Click Vendor Pack ZIP"
                                                        className="cursor-pointer h-4 w-4 accent-orange-500"
                                                    />
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={loadingDocId === doc.id}
                                                        onClick={() => handleOpenDoc(doc.id, false)}
                                                        className="h-7 w-7 text-muted-foreground hover:text-white"
                                                        title="View document"
                                                    >
                                                        {loadingDocId === doc.id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Eye className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={loadingDocId === doc.id}
                                                        onClick={() => handleOpenDoc(doc.id, true)}
                                                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                        title="Download file"
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                    </Button>
                                                    {isAdmin && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() =>
                                                                    handleArchiveToggle(
                                                                        doc.id,
                                                                        !doc.isArchived
                                                                    )
                                                                }
                                                                className="h-7 w-7 text-muted-foreground hover:text-amber-300"
                                                                title={
                                                                    doc.isArchived
                                                                        ? "Restore document"
                                                                        : "Archive document"
                                                                }
                                                            >
                                                                <Archive className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete(doc.id)}
                                                                className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                                                                title="Delete permanently"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
