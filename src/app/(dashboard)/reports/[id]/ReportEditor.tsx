"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Loader2, Image as ImageIcon, Camera, FileDown, ArrowLeft, Settings } from "lucide-react"
import { addReportItem, deleteReportItem, updateReportConclusion, updateReportMetadata } from "@/app/actions/reports"
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
    const [reportType, setReportType] = useState(report.type || "BASIC")
    const [metadata, setMetadata] = useState<any>(report.metadata || { customFields: [] })
    const defaultFieldSettings = {
        showLocation: true, locationLabel: "Location",
        showSeverity: true, severityLabel: "Severity",
        showRecommendation: true, recommendationLabel: "Recommendation",
        showPropertyAddress: true, propertyAddressLabel: "Property Address",
        showPropertyType: true, propertyTypeLabel: "Property Type",
        showInspectionType: true, inspectionTypeLabel: "Report Type",
        showWeather: true, weatherLabel: "Weather Conditions",
        showPilotName: true, pilotNameLabel: "Pilot Name",
        showInspectorName: true, inspectorNameLabel: "Inspector Name",
        showEquipmentUsed: true, equipmentUsedLabel: "Equipment Used",
        showFlightTime: true, flightTimeLabel: "Flight Time",
        showProjectPhase: true, projectPhaseLabel: "Project Phase",
    }
    const [fieldSettings, setFieldSettings] = useState<any>({
        ...defaultFieldSettings,
        ...(report.metadata?.fieldSettings || {})
    })
    const updateFieldSettings = (key: string, value: any) => {
        const updated = { ...fieldSettings, [key]: value }
        setFieldSettings(updated)
        setMetadata((prev: any) => ({ ...prev, fieldSettings: updated }))
    }
    
    // New Item Form State
    const [itemTitle, setItemTitle] = useState("")
    const [itemDescription, setItemDescription] = useState("")
    const [itemLocation, setItemLocation] = useState("")
    const [itemSeverity, setItemSeverity] = useState("LOW")
    const [itemRecommendation, setItemRecommendation] = useState("")
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
                imageUrl: itemImage || undefined,
                location: itemLocation || undefined,
                severity: reportType === "ADVANCED" ? itemSeverity : undefined,
                recommendation: reportType === "ADVANCED" ? itemRecommendation : undefined
            })
            
            if (result.success) {
                setItemTitle("")
                setItemDescription("")
                setItemLocation("")
                setItemSeverity("LOW")
                setItemRecommendation("")
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
            await updateReportMetadata(report.id, reportType, { ...metadata, fieldSettings })
            router.refresh()
        } catch (error) {
            console.error(error)
            alert("Failed to save")
        } finally {
            setIsSavingConclusion(false)
        }
    }

    const handleSaveSettings = async () => {
        setIsSavingConclusion(true)
        try {
            await updateReportMetadata(report.id, reportType, { ...metadata, fieldSettings })
            router.refresh()
        } catch (error) {
            console.error(error)
            alert("Failed to save settings")
        } finally {
            setIsSavingConclusion(false)
        }
    }

    const handleExportPDF = async () => {
        setIsExporting(true)
        try {
            const doc = new jsPDF()
            // Pass live state into the report object for PDF rendering
            await drawReportPdf(doc, company, { ...report, conclusion, type: reportType, metadata })
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

            {/* Advanced Settings */}
            {(reportType === "ADVANCED" || reportType === "CONSTRUCTION") && (
                <Card className="bg-card border-white/5 shadow-inner p-4 rounded-2xl grid md:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="col-span-full mb-2 border-b border-white/5 pb-2">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Cover Page Information</h3>
                        <p className="text-[10px] text-muted-foreground">Add fields that will appear on the report&apos;s front page.</p>
                    </div>
                    {fieldSettings.showPropertyAddress !== false && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">{fieldSettings.propertyAddressLabel || "Property Address"}</Label>
                            <Input value={metadata.propertyAddress || ""} onChange={e => setMetadata({...metadata, propertyAddress: e.target.value})} className="bg-white/5 border-white/10" placeholder="e.g. 12 Greenway Close" />
                        </div>
                    )}
                    {fieldSettings.showPropertyType !== false && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">{fieldSettings.propertyTypeLabel || "Property Type"}</Label>
                            <Input value={metadata.propertyType || ""} onChange={e => setMetadata({...metadata, propertyType: e.target.value})} className="bg-white/5 border-white/10" placeholder="e.g. Residential" />
                        </div>
                    )}
                    {fieldSettings.showInspectionType !== false && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">{fieldSettings.inspectionTypeLabel || "Report Type"}</Label>
                            <Input value={metadata.inspectionType || ""} onChange={e => setMetadata({...metadata, inspectionType: e.target.value})} className="bg-white/5 border-white/10" placeholder="e.g. Plumbing Inspection" />
                        </div>
                    )}
                    {fieldSettings.showWeather !== false && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">{fieldSettings.weatherLabel || "Weather Conditions"}</Label>
                            <Input value={metadata.weather || ""} onChange={e => setMetadata({...metadata, weather: e.target.value})} className="bg-white/5 border-white/10" placeholder="e.g. Clear, 18°C" />
                        </div>
                    )}
                    {reportType === "ADVANCED" && (
                        <>
                            {fieldSettings.showEquipmentUsed !== false && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">{fieldSettings.equipmentUsedLabel || "Equipment Used"}</Label>
                                    <Input value={metadata.equipmentUsed || ""} onChange={e => setMetadata({...metadata, equipmentUsed: e.target.value})} className="bg-white/5 border-white/10" placeholder="e.g. DJI Mavic 3" />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Total Images</Label>
                                <Input type="number" value={metadata.totalImages || ""} onChange={e => setMetadata({...metadata, totalImages: parseInt(e.target.value) || 0})} className="bg-white/5 border-white/10" placeholder="e.g. 87" />
                            </div>
                            {fieldSettings.showFlightTime !== false && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">{fieldSettings.flightTimeLabel || "Flight Time (min)"}</Label>
                                    <Input type="number" value={metadata.flightTime || ""} onChange={e => setMetadata({...metadata, flightTime: parseInt(e.target.value) || 0})} className="bg-white/5 border-white/10" placeholder="e.g. 24" />
                                </div>
                            )}
                            {fieldSettings.showPilotName !== false && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">{fieldSettings.pilotNameLabel || "Pilot Name"}</Label>
                                    <Input value={metadata.pilotName || ""} onChange={e => setMetadata({...metadata, pilotName: e.target.value})} className="bg-white/5 border-white/10" placeholder="e.g. John Doe" />
                                </div>
                            )}
                        </>
                    )}
                    {reportType === "CONSTRUCTION" && (
                        <>
                            {fieldSettings.showInspectorName !== false && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">{fieldSettings.inspectorNameLabel || "Inspector Name"}</Label>
                                    <Input value={metadata.inspectorName || ""} onChange={e => setMetadata({...metadata, inspectorName: e.target.value})} className="bg-white/5 border-white/10" placeholder="e.g. John Doe" />
                                </div>
                            )}
                            {fieldSettings.showProjectPhase !== false && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">{fieldSettings.projectPhaseLabel || "Project Phase"}</Label>
                                    <Input value={metadata.projectPhase || ""} onChange={e => setMetadata({...metadata, projectPhase: e.target.value})} className="bg-white/5 border-white/10" placeholder="e.g. Rough-in" />
                                </div>
                            )}
                        </>
                    )}

                    <div className="col-span-full mt-4 border-t border-white/5 pt-4">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block">Custom Info Fields</Label>
                        <div className="grid gap-2 mb-3">
                            {(metadata.customFields || []).map((field: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <Input 
                                        value={field.key} 
                                        onChange={e => {
                                            const newFields = [...(metadata.customFields || [])];
                                            newFields[idx].key = e.target.value;
                                            setMetadata({...metadata, customFields: newFields});
                                        }} 
                                        className="bg-white/5 border-white/10 flex-1 font-bold" 
                                        placeholder="e.g. Contractor" 
                                    />
                                    <Input 
                                        value={field.value} 
                                        onChange={e => {
                                            const newFields = [...(metadata.customFields || [])];
                                            newFields[idx].value = e.target.value;
                                            setMetadata({...metadata, customFields: newFields});
                                        }} 
                                        className="bg-white/5 border-white/10 flex-[2]" 
                                        placeholder="e.g. ABC Construction" 
                                    />
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => {
                                            const newFields = [...(metadata.customFields || [])];
                                            newFields.splice(idx, 1);
                                            setMetadata({...metadata, customFields: newFields});
                                        }}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                                const newFields = [...(metadata.customFields || []), { key: '', value: '' }];
                                setMetadata({...metadata, customFields: newFields});
                            }}
                            className="bg-transparent border-white/10 hover:bg-white/5 text-xs font-bold uppercase tracking-widest"
                        >
                            <Plus className="mr-2 h-3.5 w-3.5" /> Add Custom Field
                        </Button>
                    </div>
                    <div className="space-y-2 flex items-center gap-2 col-span-full mt-2">
                        <input 
                            type="checkbox" 
                            id="showFooterText"
                            checked={metadata.showFooterText !== false} 
                            onChange={e => setMetadata({...metadata, showFooterText: e.target.checked})} 
                            className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary focus:ring-offset-0" 
                        />
                        <Label htmlFor="showFooterText" className="text-xs font-bold text-muted-foreground cursor-pointer">
                            Show &quot;Professional Inspection Services&quot; in PDF footer
                        </Label>
                    </div>
                    <div className="space-y-2 col-span-full mt-4 pt-4 border-t border-white/5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Cover / Overview Image</Label>
                        <div className="flex items-center gap-4">
                            {metadata.propertyImage && (
                                <img src={metadata.propertyImage} alt="Property Overview" className="h-16 w-16 object-cover rounded-md border border-white/10" />
                            )}
                            <div className="flex-1">
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            const img = new Image();
                                            img.onload = () => {
                                                const canvas = document.createElement('canvas');
                                                let width = img.width;
                                                let height = img.height;
                                                const maxDim = 1024;
                                                if (width > maxDim || height > maxDim) {
                                                    if (width > height) { height *= maxDim / width; width = maxDim; } 
                                                    else { width *= maxDim / height; height = maxDim; }
                                                }
                                                canvas.width = width;
                                                canvas.height = height;
                                                const ctx = canvas.getContext('2d');
                                                ctx?.drawImage(img, 0, 0, width, height);
                                                setMetadata({...metadata, propertyImage: canvas.toDataURL('image/jpeg', 0.7)});
                                            };
                                            img.src = reader.result as string;
                                        };
                                        reader.readAsDataURL(file);
                                    }}
                                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white/5 file:text-white hover:file:bg-white/10 cursor-pointer"
                                />
                            </div>
                            {metadata.propertyImage && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setMetadata({...metadata, propertyImage: null})}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl"
                                >
                                    Clear Image
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>
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
                                        {(reportType === "ADVANCED" || reportType === "CONSTRUCTION") && (fieldSettings.showLocation || fieldSettings.showSeverity) && (
                                            <div className="grid grid-cols-2 gap-4 text-xs font-medium pb-2 border-b border-white/5">
                                                {fieldSettings.showLocation && (
                                                    <div><span className="text-muted-foreground/50 uppercase text-[9px] block">{fieldSettings.locationLabel || "Location"}</span> {item.location || "-"}</div>
                                                )}
                                                {fieldSettings.showSeverity && (
                                                    <div>
                                                        <span className="text-muted-foreground/50 uppercase text-[9px] block">{fieldSettings.severityLabel || "Severity"}</span> 
                                                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", 
                                                            item.severity === 'HIGH' ? 'bg-red-500/20 text-red-500' : 
                                                            item.severity === 'MEDIUM' ? 'bg-orange-500/20 text-orange-500' : 
                                                            'bg-blue-500/20 text-blue-500'
                                                        )}>{item.severity || "LOW"}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <p className="text-muted-foreground font-medium leading-relaxed whitespace-pre-wrap">
                                            {item.description}
                                        </p>
                                        {(reportType === "ADVANCED" || reportType === "CONSTRUCTION") && fieldSettings.showRecommendation && item.recommendation && (
                                            <div className="bg-primary/5 border border-primary/10 rounded p-3 text-xs">
                                                <span className="text-primary font-bold uppercase tracking-wider text-[10px] block mb-1">{fieldSettings.recommendationLabel || "Recommendation"}</span>
                                                {item.recommendation}
                                            </div>
                                        )}
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
                                    {(reportType === "ADVANCED" || reportType === "CONSTRUCTION") && (
                                        <>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Location</Label>
                                                <Input 
                                                    placeholder="e.g. Front Roof Slope" 
                                                    value={itemLocation}
                                                    onChange={(e) => setItemLocation(e.target.value)}
                                                    className="bg-white/5 border-white/10 font-bold h-12"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Severity</Label>
                                                <select
                                                    value={itemSeverity}
                                                    onChange={(e) => setItemSeverity(e.target.value)}
                                                    className="flex h-12 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                                                >
                                                    <option value="LOW">LOW</option>
                                                    <option value="MEDIUM">MEDIUM</option>
                                                    <option value="HIGH">HIGH</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Recommendation</Label>
                                                <Textarea 
                                                    placeholder="e.g. Replace damaged tile to prevent water ingress."
                                                    value={itemRecommendation}
                                                    onChange={(e) => setItemRecommendation(e.target.value)}
                                                    rows={3}
                                                    className="bg-white/5 border-white/10 font-medium"
                                                />
                                            </div>
                                        </>
                                    )}
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
                <CardHeader className="bg-white/[0.02] border-b border-white/5 py-5 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                            <FileDown className="h-4 w-4 text-primary" /> Report Settings & Conclusion
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">Summarize your findings or recommendations. This appears at the bottom of the PDF export.</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <Label className="text-xs font-bold text-muted-foreground">Report Type:</Label>
                        <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setReportType("BASIC")}
                                className={cn("text-[10px] uppercase font-black tracking-widest", reportType === "BASIC" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                            >
                                Basic
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setReportType("ADVANCED")}
                                className={cn("text-[10px] uppercase font-black tracking-widest", reportType === "ADVANCED" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                            >
                                Advanced
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setReportType("CONSTRUCTION")}
                                className={cn("text-[10px] uppercase font-black tracking-widest", reportType === "CONSTRUCTION" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                            >
                                Construction
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Field Visibility & Labels — only shown for Advanced/Construction */}
                    {(reportType === "ADVANCED" || reportType === "CONSTRUCTION") && (
                        <div className="border border-white/5 rounded-xl p-4 space-y-4 bg-white/[0.02]">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Field Visibility &amp; Labels</h4>
                            <p className="text-[10px] text-muted-foreground -mt-2">Toggle which fields appear on the report and rename their headings.</p>
                            
                            <div className="grid md:grid-cols-2 gap-6 pt-2">
                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-white/5 pb-1">Report Item Fields</h5>
                                    <div className="space-y-3">
                                        {/* Location */}
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="showLocation" checked={fieldSettings.showLocation !== false} onChange={e => updateFieldSettings('showLocation', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                            <Label htmlFor="showLocation" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Location</Label>
                                            <Input
                                                value={fieldSettings.locationLabel || "Location"}
                                                onChange={e => updateFieldSettings('locationLabel', e.target.value)}
                                                className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                placeholder="Heading label..."
                                            />
                                        </div>
                                        {/* Severity */}
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="showSeverity" checked={fieldSettings.showSeverity !== false} onChange={e => updateFieldSettings('showSeverity', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                            <Label htmlFor="showSeverity" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Severity</Label>
                                            <Input
                                                value={fieldSettings.severityLabel || "Severity"}
                                                onChange={e => updateFieldSettings('severityLabel', e.target.value)}
                                                className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                placeholder="Heading label..."
                                            />
                                        </div>
                                        {/* Recommendation */}
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="showRecommendation" checked={fieldSettings.showRecommendation !== false} onChange={e => updateFieldSettings('showRecommendation', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                            <Label htmlFor="showRecommendation" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Recommendation</Label>
                                            <Input
                                                value={fieldSettings.recommendationLabel || "Recommendation"}
                                                onChange={e => updateFieldSettings('recommendationLabel', e.target.value)}
                                                className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                placeholder="Heading label..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-white/5 pb-1">Cover Page Fields</h5>
                                    <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                                        {/* Address */}
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="showPropertyAddress" checked={fieldSettings.showPropertyAddress !== false} onChange={e => updateFieldSettings('showPropertyAddress', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                            <Label htmlFor="showPropertyAddress" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Address</Label>
                                            <Input
                                                value={fieldSettings.propertyAddressLabel || "Property Address"}
                                                onChange={e => updateFieldSettings('propertyAddressLabel', e.target.value)}
                                                className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                placeholder="Address label..."
                                            />
                                        </div>
                                        {/* Property Type */}
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="showPropertyType" checked={fieldSettings.showPropertyType !== false} onChange={e => updateFieldSettings('showPropertyType', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                            <Label htmlFor="showPropertyType" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Prop Type</Label>
                                            <Input
                                                value={fieldSettings.propertyTypeLabel || "Property Type"}
                                                onChange={e => updateFieldSettings('propertyTypeLabel', e.target.value)}
                                                className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                placeholder="Prop Type label..."
                                            />
                                        </div>
                                        {/* Report Type */}
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="showInspectionType" checked={fieldSettings.showInspectionType !== false} onChange={e => updateFieldSettings('showInspectionType', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                            <Label htmlFor="showInspectionType" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Rep Type</Label>
                                            <Input
                                                value={fieldSettings.inspectionTypeLabel || "Report Type"}
                                                onChange={e => updateFieldSettings('inspectionTypeLabel', e.target.value)}
                                                className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                placeholder="Report Type label..."
                                            />
                                        </div>
                                        {/* Weather */}
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="showWeather" checked={fieldSettings.showWeather !== false} onChange={e => updateFieldSettings('showWeather', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                            <Label htmlFor="showWeather" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Weather</Label>
                                            <Input
                                                value={fieldSettings.weatherLabel || "Weather Conditions"}
                                                onChange={e => updateFieldSettings('weatherLabel', e.target.value)}
                                                className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                placeholder="Weather label..."
                                            />
                                        </div>

                                        {/* Advanced Specific: Pilot Name, Equipment Used, Flight Time */}
                                        {reportType === "ADVANCED" && (
                                            <>
                                                <div className="flex items-center gap-3">
                                                    <input type="checkbox" id="showPilotName" checked={fieldSettings.showPilotName !== false} onChange={e => updateFieldSettings('showPilotName', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                                    <Label htmlFor="showPilotName" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Pilot Name</Label>
                                                    <Input
                                                        value={fieldSettings.pilotNameLabel || "Pilot Name"}
                                                        onChange={e => updateFieldSettings('pilotNameLabel', e.target.value)}
                                                        className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                        placeholder="Pilot label..."
                                                    />
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <input type="checkbox" id="showEquipmentUsed" checked={fieldSettings.showEquipmentUsed !== false} onChange={e => updateFieldSettings('showEquipmentUsed', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                                    <Label htmlFor="showEquipmentUsed" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Equip Used</Label>
                                                    <Input
                                                        value={fieldSettings.equipmentUsedLabel || "Equipment Used"}
                                                        onChange={e => updateFieldSettings('equipmentUsedLabel', e.target.value)}
                                                        className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                        placeholder="Equipment label..."
                                                    />
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <input type="checkbox" id="showFlightTime" checked={fieldSettings.showFlightTime !== false} onChange={e => updateFieldSettings('showFlightTime', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                                    <Label htmlFor="showFlightTime" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Flight Time</Label>
                                                    <Input
                                                        value={fieldSettings.flightTimeLabel || "Flight Time"}
                                                        onChange={e => updateFieldSettings('flightTimeLabel', e.target.value)}
                                                        className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                        placeholder="Flight Time label..."
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Construction Specific: Inspector Name, Project Phase */}
                                        {reportType === "CONSTRUCTION" && (
                                            <>
                                                <div className="flex items-center gap-3">
                                                    <input type="checkbox" id="showInspectorName" checked={fieldSettings.showInspectorName !== false} onChange={e => updateFieldSettings('showInspectorName', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                                    <Label htmlFor="showInspectorName" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Inspector</Label>
                                                    <Input
                                                        value={fieldSettings.inspectorNameLabel || "Inspector Name"}
                                                        onChange={e => updateFieldSettings('inspectorNameLabel', e.target.value)}
                                                        className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                        placeholder="Inspector label..."
                                                    />
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <input type="checkbox" id="showProjectPhase" checked={fieldSettings.showProjectPhase !== false} onChange={e => updateFieldSettings('showProjectPhase', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary cursor-pointer" />
                                                    <Label htmlFor="showProjectPhase" className="text-xs font-bold text-muted-foreground w-28 cursor-pointer">Show Phase</Label>
                                                    <Input
                                                        value={fieldSettings.projectPhaseLabel || "Project Phase"}
                                                        onChange={e => updateFieldSettings('projectPhaseLabel', e.target.value)}
                                                        className="bg-white/5 border-white/10 h-8 text-xs flex-1"
                                                        placeholder="Phase label..."
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2 border-t border-white/5">
                                <Button
                                    onClick={handleSaveSettings}
                                    disabled={isSavingConclusion}
                                    size="sm"
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase text-[10px] tracking-[0.2em] h-8 px-4 rounded-lg"
                                >
                                    {isSavingConclusion ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                                    Save Settings
                                </Button>
                            </div>
                        </div>
                    )}
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
