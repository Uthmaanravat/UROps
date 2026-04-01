"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Loader2, Image as ImageIcon, Camera, FileDown, ArrowLeft, MoreVertical } from "lucide-react"
import { addReportItem, deleteReportItem, updateReportConclusion } from "@/app/actions/reports"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { drawReportPdf } from "@/lib/pdf-utils"
import jsPDF from "jspdf"

interface ReportEditorProps {
    report: any
    company: any
}

export function ReportEditor({ report, company }: ReportEditorProps) {
    const router = useRouter()
    const [isAdding, setIsAdding] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSavingConclusion, setIsSavingConclusion] = useState(false)
    const [conclusion, setConclusion] = useState(report.conclusion || "")
    
    // New Item Form State
    const [itemTitle, setItemTitle] = useState("")
    const [itemDescription, setItemDescription] = useState("")
    const [itemImage, setItemImage] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onloadend = () => {
            const img = new Image()
            img.onload = () => {
                // Compress image using canvas
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height
                
                // Max width/height of 1024px
                const maxDim = 1024
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height *= maxDim / width
                        width = maxDim
                    } else {
                        width *= maxDim / height
                        height = maxDim
                    }
                }
                
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(img, 0, 0, width, height)
                
                // Get compressed base64
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7)
                setItemImage(compressedBase64)
            }
            img.src = reader.result as string
        }
        reader.readAsDataURL(file)
    }

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!itemDescription) return
        
        setIsSubmitting(true)
        try {
            const result = await addReportItem({
                reportId: report.id,
                title: itemTitle || undefined,
                description: itemDescription,
                imageUrl: itemImage || undefined
            })
            
            if (result.success) {
                setItemTitle("")
                setItemDescription("")
                setItemImage(null)
                if (fileInputRef.current) fileInputRef.current.value = ""
                // Keep form open so user can add more items rapidly
                router.refresh()
            } else {
                alert("Failed to add item")
            }
        } catch (error) {
            console.error(error)
            alert("An error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteItem = async (itemId: string) => {
        if (!confirm("Remove this item from the report?")) return
        
        try {
            const result = await deleteReportItem(itemId, report.id)
            if (result.success) {
                router.refresh()
            }
        } catch (error) {
            console.error(error)
        }
    }

    const handleSaveConclusion = async () => {
        setIsSavingConclusion(true)
        try {
            await updateReportConclusion(report.id, conclusion)
            router.refresh()
        } catch (error) {
            console.error(error)
            alert("Failed to save conclusion")
        } finally {
            setIsSavingConclusion(false)
        }
    }

    const handleExportPDF = async () => {
        setIsExporting(true)
        try {
            const doc = new jsPDF()
            // Pass conclusion into the report object for PDF rendering
            await drawReportPdf(doc, company, { ...report, conclusion })
            doc.save(`Report_${report.number.toString().padStart(3, '0')}_${report.title.replace(/\s+/g, '_')}.pdf`)
        } catch (error) {
            console.error("PDF Export failed:", error)
            alert("Failed to generate PDF. Check if images are too large or inaccessible.")
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 bg-background/80 backdrop-blur-md py-4 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <Link href="/reports">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/5">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-white uppercase tracking-tight">{report.title}</h1>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-black border border-primary/20 uppercase tracking-widest">
                                REP-{report.number.toString().padStart(3, '0')}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">
                            {new Date(report.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button 
                        onClick={handleExportPDF}
                        disabled={isExporting || report.items.length === 0}
                        className="bg-white/5 hover:bg-white/10 text-white border-white/10 font-bold uppercase text-[10px] tracking-[0.2em] h-10 px-6 rounded-xl transition-all"
                    >
                        {isExporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-2 h-3.5 w-3.5" />}
                        Export PDF
                    </Button>
                    <Button 
                        onClick={() => setIsAdding(true)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-[0.2em] h-10 px-6 rounded-xl shadow-lg shadow-primary/20"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                </div>
            </div>

            {/* Metadata Badges */}
            {(report.client || report.project) && (
                <div className="flex flex-wrap gap-3 p-4 bg-card rounded-2xl border border-white/5 shadow-inner">
                    {report.client && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                <User className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Client</span>
                                <span className="text-xs font-bold text-white">{report.client.name}</span>
                            </div>
                        </div>
                    )}
                    {report.project && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <Briefcase className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Project</span>
                                <span className="text-xs font-bold text-white">{report.project.name}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* List of Items */}
            <div className="grid gap-8">
                {report.items.length > 0 ? (
                    report.items.map((item: any, idx: number) => (
                        <div key={item.id} className="relative group animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-primary/20 rounded-full group-hover:bg-primary transition-colors duration-500" />
                            
                            <Card className="bg-card border-white/5 overflow-hidden rounded-2xl shadow-2xl group-hover:border-primary/20 transition-all duration-300">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="p-8 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Update #{idx + 1}</span>
                                                {item.title && <h3 className="text-xl font-black text-white uppercase tracking-tight">{item.title}</h3>}
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleDeleteItem(item.id)}
                                                className="text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <p className="text-muted-foreground font-medium leading-relaxed whitespace-pre-wrap">
                                            {item.description}
                                        </p>
                                        <div className="pt-4 flex items-center gap-2 text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">
                                            <Camera className="h-3 w-3" />
                                            <span>Captured {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                    
                                    {item.imageUrl ? (
                                        <div className="relative aspect-video md:aspect-auto bg-black/40 flex items-center justify-center overflow-hidden">
                                            <img 
                                                src={item.imageUrl} 
                                                alt={item.title || "Report item"} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                            />
                                        </div>
                                    ) : (
                                        <div className="aspect-video md:aspect-auto bg-white/5 flex flex-col items-center justify-center text-muted-foreground/20 italic text-xs uppercase tracking-widest gap-2">
                                            <ImageIcon className="h-8 w-8 opacity-20" />
                                            No Image Attached
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    ))
                ) : !isAdding && (
                    <div className="flex flex-col items-center justify-center py-32 space-y-6">
                        <div className="h-24 w-24 rounded-3xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center text-muted-foreground/20">
                            <Plus className="h-12 w-12" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider">Empty Report</h3>
                            <p className="text-muted-foreground mt-2 max-w-sm">No items found. Capture descriptions and upload site photos to build your report.</p>
                        </div>
                        <Button 
                            onClick={() => setIsAdding(true)}
                            className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground font-black uppercase tracking-widest rounded-xl transition-all"
                        >
                            Add Your First Update
                        </Button>
                    </div>
                )}

                {/* Add Item Inline Form */}
                {isAdding && (
                    <Card className="bg-[#12121e] border-primary/20 shadow-[0_0_50px_rgba(140,255,51,0.05)] rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <CardHeader className="bg-primary/5 border-b border-primary/10 py-6">
                            <CardTitle className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <Plus className="h-5 w-5 text-primary" /> New Report Item
                            </CardTitle>
                        </CardHeader>
                        <form onSubmit={handleAddItem}>
                            <CardContent className="p-8 grid md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Short Title</Label>
                                        <Input 
                                            placeholder="e.g. FOUNDATION PROGRESS" 
                                            value={itemTitle}
                                            onChange={(e) => setItemTitle(e.target.value)}
                                            className="bg-white/5 border-white/10 uppercase font-black tracking-tight h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">What was done? (Description)</Label>
                                        <Textarea 
                                            placeholder="Describe the progress or issues found at this site location..."
                                            value={itemDescription}
                                            onChange={(e) => setItemDescription(e.target.value)}
                                            rows={6}
                                            required
                                            className="bg-white/5 border-white/10 font-medium leading-relaxed"
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Supporting Picture</Label>
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className={cn(
                                            "aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all gap-4 overflow-hidden group/img",
                                            itemImage ? "border-primary/50 bg-black/40" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
                                        )}
                                    >
                                        {itemImage ? (
                                            <img src={itemImage} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover/img:scale-110 transition-transform">
                                                    <Camera className="h-6 w-6" />
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-xs font-black text-white uppercase tracking-widest block">Choose Photo</span>
                                                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1 block">JPG or PNG (Auto-compressed)</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleImageUpload} 
                                        accept="image/*" 
                                        className="hidden" 
                                    />
                                    {itemImage && (
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            onClick={() => setItemImage(null)}
                                            className="w-full text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        >
                                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear Photo
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="bg-white/[0.02] border-t border-white/5 p-6 flex justify-between gap-4">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => setIsAdding(false)}
                                    className="font-bold uppercase text-xs tracking-widest"
                                >
                                    Done Adding
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest px-10 h-12 rounded-xl"
                                >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                    Save & Add Next
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                )}
            </div>

            {/* Conclusion Section */}
            <Card className="bg-card border-white/5 rounded-2xl shadow-xl overflow-hidden">
                <CardHeader className="bg-white/[0.02] border-b border-white/5 py-5">
                    <CardTitle className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileDown className="h-4 w-4 text-primary" /> Report Conclusion
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Summarize your findings or recommendations. This appears at the bottom of the PDF export.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <Textarea
                        placeholder="e.g. All works completed as per scope. Site left clean and tidy. Recommend follow-up inspection in 2 weeks..."
                        value={conclusion}
                        onChange={(e) => setConclusion(e.target.value)}
                        rows={5}
                        className="bg-white/5 border-white/10 font-medium leading-relaxed"
                    />
                    <div className="flex justify-end">
                        <Button
                            onClick={handleSaveConclusion}
                            disabled={isSavingConclusion}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-[0.2em] h-10 px-6 rounded-xl"
                        >
                            {isSavingConclusion ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                            Save Conclusion
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function User({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
    )
}

function Briefcase({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
    )
}
