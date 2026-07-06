"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { updateCompanySettings } from "@/app/(dashboard)/settings/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save, Trash2, AlertTriangle } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { resetAppDataAction } from "@/app/(dashboard)/settings/actions"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
// import { toast } from "sonner" // Removed as not in package.json

function trimImageMargins(img: HTMLImageElement): string {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return img.src;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = 0;
        let maxY = 0;

        // Scan pixels for transparent or white background
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const index = (y * canvas.width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                const a = data[index + 3];

                const isTransparent = a < 15;
                const isWhite = r > 240 && g > 240 && b > 240;

                if (!isTransparent && !isWhite) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        // If no non-background pixels found (entire image is white/transparent), return original
        if (maxX < minX || maxY < minY) {
            return img.src;
        }

        // Add padding (5 pixels)
        const padding = 5;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(canvas.width - 1, maxX + padding);
        maxY = Math.min(canvas.height - 1, maxY + padding);

        const croppedWidth = maxX - minX + 1;
        const croppedHeight = maxY - minY + 1;

        // Downscale logo to prevent 413 Payload Too Large error in Next.js Server Actions
        const maxDimension = 400;
        let targetWidth = croppedWidth;
        let targetHeight = croppedHeight;

        if (croppedWidth > maxDimension || croppedHeight > maxDimension) {
            if (croppedWidth > croppedHeight) {
                targetWidth = maxDimension;
                targetHeight = Math.round((croppedHeight * maxDimension) / croppedWidth);
            } else {
                targetHeight = maxDimension;
                targetWidth = Math.round((croppedWidth * maxDimension) / croppedHeight);
            }
        }

        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = targetWidth;
        croppedCanvas.height = targetHeight;
        const croppedCtx = croppedCanvas.getContext('2d');
        if (!croppedCtx) return img.src;

        croppedCtx.imageSmoothingEnabled = true;
        croppedCtx.imageSmoothingQuality = 'high';

        croppedCtx.drawImage(
            canvas,
            minX, minY, croppedWidth, croppedHeight,
            0, 0, targetWidth, targetHeight
        );

        return croppedCanvas.toDataURL('image/png');
    } catch (err) {
        console.warn("Could not crop image margins", err);
        return img.src;
    }
}

function downscaleBase64Image(base64Str: string): Promise<string> {
    return new Promise((resolve) => {
        if (!base64Str || !base64Str.startsWith('data:image/') || base64Str.length < 100000) {
            resolve(base64Str);
            return;
        }

        const img = new Image();
        img.onload = () => {
            try {
                const maxDimension = 400;
                let targetWidth = img.naturalWidth;
                let targetHeight = img.naturalHeight;

                if (targetWidth > maxDimension || targetHeight > maxDimension) {
                    if (targetWidth > targetHeight) {
                        targetWidth = maxDimension;
                        targetHeight = Math.round((img.naturalHeight * maxDimension) / img.naturalWidth);
                    } else {
                        targetHeight = maxDimension;
                        targetWidth = Math.round((img.naturalWidth * maxDimension) / img.naturalHeight);
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(base64Str);
                    return;
                }

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) {
                console.error("Error downscaling on submit", e);
                resolve(base64Str);
            }
        };
        img.onerror = () => {
            resolve(base64Str);
        };
        img.src = base64Str;
    });
}

interface SettingsFormProps {
    initialSettings: any
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [confirmText, setConfirmText] = useState("")
    const [previewAspectRatio, setPreviewAspectRatio] = useState(1);
    const [formData, setFormData] = useState({
        name: initialSettings?.name || "",
        address: initialSettings?.address || "",
        phone: initialSettings?.phone || "",
        email: initialSettings?.email || "",
        website: initialSettings?.website || "",
        slogan: initialSettings?.slogan || "",
        logoUrl: initialSettings?.logoUrl || "",
        taxId: initialSettings?.taxId || "",
        bankDetails: initialSettings?.bankDetails || "",
        paymentTerms: initialSettings?.paymentTerms || "",
        currency: initialSettings?.currency || "R",
        theme: initialSettings?.theme || "dark",
        aiEnabled: initialSettings?.aiEnabled ?? true,
        layoutPreferences: initialSettings?.layoutPreferences ? {
            logoSize: 80,
            logoScale: 1.0,
            logoTranslateX: 0,
            logoTranslateY: 0,
            logoWidthFactor: 1.0,
            logoContainerTranslateX: 0,
            businessNameTranslateX: 0,
            businessNameTranslateY: 0,
            ...initialSettings.layoutPreferences
        } : {
            sidebar: [
                "/dashboard",
                "/manager",
                "/clients",
                "/projects",
                "/work-breakdown-pricing",
                "/invoices?type=QUOTE",
                "/invoices?type=INVOICE",
                "/payments",
                "/knowledge",
                "/settings"
            ],
            dashboard: {
                widgets: [
                    { id: "stats_revenue", label: "Total Revenue", visible: true },
                    { id: "stats_projects", label: "In Progress Projects", visible: true },
                    { id: "stats_unpaid", label: "Unpaid Invoices", visible: true },
                    { id: "pending_scopes", label: "Pending Scopes", visible: true },
                    { id: "tracking", label: "Tracker (SOW/Quotes)", visible: true },
                    { id: "feed_main", label: "Main Feed (Meetings)", visible: true },
                    { id: "feed_side", label: "Side Feed (Activity)", visible: true }
                ]
            },
            logoSize: 80,
            logoScale: 1.0,
            logoTranslateX: 0,
            logoTranslateY: 0,
            logoWidthFactor: 1.0,
            logoContainerTranslateX: 0,
            businessNameTranslateX: 0,
            businessNameTranslateY: 0
        },
    })

    useEffect(() => {
        if (!formData.logoUrl) {
            setPreviewAspectRatio(1);
            return;
        }
        const img = new Image();
        img.onload = () => {
            if (img.naturalHeight > 0) {
                setPreviewAspectRatio(img.naturalWidth / img.naturalHeight);
            }
        };
        img.src = formData.logoUrl;
    }, [formData.logoUrl]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSidebarMove = (index: number, direction: 'up' | 'down') => {
        const newSidebar = [...formData.layoutPreferences.sidebar]
        if (direction === 'up' && index > 0) {
            [newSidebar[index], newSidebar[index - 1]] = [newSidebar[index - 1], newSidebar[index]]
        } else if (direction === 'down' && index < newSidebar.length - 1) {
            [newSidebar[index], newSidebar[index + 1]] = [newSidebar[index + 1], newSidebar[index]]
        }
        setFormData(prev => ({ ...prev, layoutPreferences: { ...prev.layoutPreferences, sidebar: newSidebar } }))
    }

    const handleWidgetMove = (index: number, direction: 'up' | 'down') => {
        const newWidgets = [...formData.layoutPreferences.dashboard.widgets]
        if (direction === 'up' && index > 0) {
            [newWidgets[index], newWidgets[index - 1]] = [newWidgets[index - 1], newWidgets[index]]
        } else if (direction === 'down' && index < newWidgets.length - 1) {
            [newWidgets[index], newWidgets[index + 1]] = [newWidgets[index + 1], newWidgets[index]]
        }
        setFormData(prev => ({ ...prev, layoutPreferences: { ...prev.layoutPreferences, dashboard: { ...prev.layoutPreferences.dashboard, widgets: newWidgets } } }))
    }

    const handleWidgetToggle = (index: number) => {
        const newWidgets = [...formData.layoutPreferences.dashboard.widgets]
        newWidgets[index].visible = !newWidgets[index].visible
        setFormData(prev => ({ ...prev, layoutPreferences: { ...prev.layoutPreferences, dashboard: { ...prev.layoutPreferences.dashboard, widgets: newWidgets } } }))
    }

    const { setTheme } = useTheme()
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            // Downscale logo if it is a large base64 string
            let finalFormData = formData;
            if (formData.logoUrl && formData.logoUrl.startsWith('data:image/') && formData.logoUrl.length > 100000) {
                const smallLogo = await downscaleBase64Image(formData.logoUrl);
                finalFormData = { ...formData, logoUrl: smallLogo };
                // Also update local state so the preview is updated
                setFormData(finalFormData);
            }

            const result = await updateCompanySettings(finalFormData)
            if (result.success) {
                setTheme(formData.theme)
                router.refresh()
                // You might want to show a toast here
                alert("Settings saved successfully!")
            } else {
                alert("Failed to save settings")
            }
        } catch (error) {
            console.error(error)
            alert("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Company Details</CardTitle>
                        <CardDescription>
                            These details will appear on your quotes and invoices.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Company Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Public Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                                <p className="text-[10px] text-muted-foreground italic">
                                    Used as the &quot;From&quot; address for sent documents. To send to any recipient, verify this domain at <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="text-primary hover:underline">resend.com/domains</a>.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="website">Website</Label>
                                <Input
                                    id="website"
                                    name="website"
                                    value={formData.website}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="slogan">Company Slogan</Label>
                                <Input
                                    id="slogan"
                                    name="slogan"
                                    value={formData.slogan}
                                    onChange={handleChange}
                                    placeholder="e.g. SEE MORE. KNOW MORE. SOLVE MORE."
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-4">
                            <Label>Company Logo</Label>
                            <div className="flex items-start gap-4">
                                {formData.logoUrl && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="relative h-20 w-20 rounded-md border overflow-hidden bg-white">
                                            <img
                                                src={formData.logoUrl}
                                                alt="Logo Preview"
                                                className="h-full w-full object-contain"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="text-[9px] h-6 px-1.5 bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary uppercase font-bold tracking-wider"
                                            onClick={() => {
                                                const img = new Image();
                                                img.crossOrigin = "Anonymous";
                                                img.onload = () => {
                                                    const cropped = trimImageMargins(img);
                                                    setFormData(prev => ({ ...prev, logoUrl: cropped }));
                                                };
                                                img.src = formData.logoUrl;
                                            }}
                                        >
                                            Autocrop margins
                                        </Button>
                                    </div>
                                )}
                                <div className="flex-1 space-y-2">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const img = new Image();
                                                    img.onload = () => {
                                                        const cropped = trimImageMargins(img);
                                                        setFormData(prev => ({ ...prev, logoUrl: cropped }));
                                                    };
                                                    img.src = reader.result as string;
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                    <p className="text-[10px] text-muted-foreground">Upload your company logo (PNG, JPG). It will be saved as a data URL for now.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="logoUrl">Or Logo URL</Label>
                            <Input
                                id="logoUrl"
                                name="logoUrl"
                                value={formData.logoUrl}
                                onChange={handleChange}
                                placeholder="https://example.com/logo.png"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="logoSize">Logo Bounding Box Height</Label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    id="logoSize"
                                    name="logoSize"
                                    min="30"
                                    max="300"
                                    value={formData.layoutPreferences?.logoSize ?? 80}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        setFormData(prev => ({
                                            ...prev,
                                            layoutPreferences: {
                                                ...prev.layoutPreferences,
                                                logoSize: val
                                            }
                                        }));
                                    }}
                                    className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <span className="text-sm font-bold bg-[#14141E] px-3 py-1 rounded-md border border-white/5 w-16 text-center text-white">
                                    {formData.layoutPreferences?.logoSize ?? 80}px
                                </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Adjust the height of the logo container box (default 80px).</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="logoWidthFactor">Logo Container Width Adjust</Label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    id="logoWidthFactor"
                                    name="logoWidthFactor"
                                    min="0.5"
                                    max="5.0"
                                    step="0.05"
                                    value={formData.layoutPreferences?.logoWidthFactor ?? 1.0}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setFormData(prev => ({
                                            ...prev,
                                            layoutPreferences: {
                                                ...prev.layoutPreferences,
                                                logoWidthFactor: val
                                            }
                                        }));
                                    }}
                                    className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <span className="text-sm font-bold bg-[#14141E] px-3 py-1 rounded-md border border-white/5 w-16 text-center text-white">
                                    {Math.round((formData.layoutPreferences?.logoWidthFactor ?? 1.0) * 100)}%
                                </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Adjust the width of the logo container box (50% to 500% of original aspect ratio width).</p>
                        </div>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                            <Label className="text-xs font-black uppercase tracking-widest text-primary block">Logo Zoom & Positioning (Crop Margins)</Label>
                            
                            <div className="space-y-2">
                                <Label htmlFor="logoScale">Zoom / Scale Factor</Label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        id="logoScale"
                                        name="logoScale"
                                        min="1"
                                        max="15"
                                        step="0.1"
                                        value={formData.layoutPreferences?.logoScale ?? 1.0}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setFormData(prev => ({
                                                ...prev,
                                                layoutPreferences: {
                                                    ...prev.layoutPreferences,
                                                    logoScale: val
                                                }
                                            }));
                                        }}
                                        className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <span className="text-sm font-bold bg-[#14141E] px-3 py-1 rounded-md border border-white/5 w-16 text-center text-white">
                                        {Math.round((formData.layoutPreferences?.logoScale ?? 1.0) * 100)}%
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Zoom into the logo graphic to crop empty white space margins (100% to 1500%).</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="logoTranslateX">Horizontal Position (Shift X)</Label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            id="logoTranslateX"
                                            name="logoTranslateX"
                                            min="-600"
                                            max="600"
                                            step="1"
                                            value={formData.layoutPreferences?.logoTranslateX ?? 0}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value, 10);
                                                setFormData(prev => ({
                                                    ...prev,
                                                    layoutPreferences: {
                                                        ...prev.layoutPreferences,
                                                        logoTranslateX: val
                                                    }
                                                }));
                                            }}
                                            className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <span className="text-sm font-bold bg-[#14141E] px-3 py-1 rounded-md border border-white/5 w-16 text-center text-white">
                                            {formData.layoutPreferences?.logoTranslateX ?? 0}px
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="logoTranslateY">Vertical Position (Shift Y)</Label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            id="logoTranslateY"
                                            name="logoTranslateY"
                                            min="-600"
                                            max="600"
                                            step="1"
                                            value={formData.layoutPreferences?.logoTranslateY ?? 0}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value, 10);
                                                setFormData(prev => ({
                                                    ...prev,
                                                    layoutPreferences: {
                                                        ...prev.layoutPreferences,
                                                        logoTranslateY: val
                                                    }
                                                }));
                                            }}
                                            className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <span className="text-sm font-bold bg-[#14141E] px-3 py-1 rounded-md border border-white/5 w-16 text-center text-white">
                                            {formData.layoutPreferences?.logoTranslateY ?? 0}px
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 border-t border-white/5 pt-4 mt-4">
                                <Label htmlFor="logoContainerTranslateX">Logo Container Shift X</Label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        id="logoContainerTranslateX"
                                        name="logoContainerTranslateX"
                                        min="-600"
                                        max="600"
                                        step="1"
                                        value={formData.layoutPreferences?.logoContainerTranslateX ?? 0}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10);
                                            setFormData(prev => ({
                                                ...prev,
                                                layoutPreferences: {
                                                    ...prev.layoutPreferences,
                                                    logoContainerTranslateX: val
                                                }
                                            }));
                                        }}
                                        className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <span className="text-sm font-bold bg-[#14141E] px-3 py-1 rounded-md border border-white/5 w-16 text-center text-white">
                                        {formData.layoutPreferences?.logoContainerTranslateX ?? 0}px
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Shift the entire logo container block left or right (adds spacing or adjusts layout).</p>
                            </div>

                            <div className="space-y-4 border-t border-white/5 pt-4 mt-4">
                                <Label className="text-xs font-black uppercase tracking-widest text-primary block">Business Details Positioning (Fix Overlaps)</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="businessNameTranslateX">Business Details Shift X</Label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                id="businessNameTranslateX"
                                                name="businessNameTranslateX"
                                                min="-600"
                                                max="600"
                                                step="1"
                                                value={formData.layoutPreferences?.businessNameTranslateX ?? 0}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value, 10);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        layoutPreferences: {
                                                            ...prev.layoutPreferences,
                                                            businessNameTranslateX: val
                                                        }
                                                    }));
                                                }}
                                                className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                            <span className="text-sm font-bold bg-[#14141E] px-3 py-1 rounded-md border border-white/5 w-16 text-center text-white">
                                                {formData.layoutPreferences?.businessNameTranslateX ?? 0}px
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="businessNameTranslateY">Business Details Shift Y</Label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                id="businessNameTranslateY"
                                                name="businessNameTranslateY"
                                                min="-600"
                                                max="600"
                                                step="1"
                                                value={formData.layoutPreferences?.businessNameTranslateY ?? 0}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value, 10);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        layoutPreferences: {
                                                            ...prev.layoutPreferences,
                                                            businessNameTranslateY: val
                                                        }
                                                    }));
                                                }}
                                                className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                            <span className="text-sm font-bold bg-[#14141E] px-3 py-1 rounded-md border border-white/5 w-16 text-center text-white">
                                                {formData.layoutPreferences?.businessNameTranslateY ?? 0}px
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Live Document Header Preview */}
                        <div className="mt-4 p-4 rounded-xl border border-white/5 bg-[#09090F]/50 space-y-2 animate-in fade-in duration-200">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Live Document Header Preview</span>
                            <div className="p-4 bg-white rounded-lg border border-gray-200 flex justify-between items-center text-[#1E293B] min-h-[100px] overflow-hidden">
                                <div className="flex items-center gap-4">
                                    {formData.logoUrl ? (
                                        <div 
                                            style={{ 
                                                height: `${formData.layoutPreferences?.logoSize ?? 80}px`,
                                                width: `${(formData.layoutPreferences?.logoSize ?? 80) * previewAspectRatio * (formData.layoutPreferences?.logoWidthFactor ?? 1.0)}px`,
                                                marginLeft: `${formData.layoutPreferences?.logoContainerTranslateX ?? 0}px`,
                                                overflow: 'hidden',
                                                position: 'relative',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            className="max-w-full bg-transparent shrink-0 transition-[margin-left] duration-75"
                                        >
                                            <img
                                                src={formData.logoUrl}
                                                alt="Live Logo Preview"
                                                onLoad={(e) => {
                                                    const img = e.currentTarget;
                                                    setPreviewAspectRatio(img.naturalWidth / img.naturalHeight);
                                                }}
                                                style={{ 
                                                    height: '100%',
                                                    width: '100%',
                                                    objectFit: 'contain',
                                                    transform: `scale(${formData.layoutPreferences?.logoScale ?? 1.0}) translate(${formData.layoutPreferences?.logoTranslateX ?? 0}px, ${formData.layoutPreferences?.logoTranslateY ?? 0}px)`,
                                                    transformOrigin: 'center'
                                                }}
                                                className="transition-transform duration-75"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-12 w-12 bg-primary flex items-center justify-center font-black text-[#0F172A] text-lg rounded-lg shadow-lg rotate-3">LR</div>
                                    )}
                                    <div 
                                        style={{ 
                                            transform: `translate(${formData.layoutPreferences?.businessNameTranslateX ?? 0}px, ${formData.layoutPreferences?.businessNameTranslateY ?? 0}px)`,
                                            position: 'relative'
                                        }}
                                        className="text-left transition-transform duration-75"
                                    >
                                        <h4 className="text-sm font-black tracking-tight text-[#1E293B] leading-none">{formData.name || "Company Name"}</h4>
                                        <p className="text-[8px] text-gray-400 mt-1 font-semibold uppercase">{formData.phone || "000 000 0000"}</p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-[10px] font-black tracking-wider text-gray-300">QUOTATION</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Financial Details</CardTitle>
                        <CardDescription>
                            Tax and banking information for invoices.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="taxId">Tax ID / VAT Number</Label>
                                <Input
                                    id="taxId"
                                    name="taxId"
                                    value={formData.taxId}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="paymentTerms">Payment Terms</Label>
                                <Input
                                    id="paymentTerms"
                                    name="paymentTerms"
                                    value={formData.paymentTerms}
                                    onChange={handleChange}
                                    placeholder="e.g. Net 30, Due on Receipt"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currency">Currency Symbol</Label>
                                <Input
                                    id="currency"
                                    name="currency"
                                    value={formData.currency}
                                    onChange={handleChange}
                                    placeholder="e.g. R, $, £"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="theme">Application Theme</Label>
                                <select
                                    id="theme"
                                    name="theme"
                                    value={formData.theme}
                                    onChange={(e) => setFormData(prev => ({ ...prev, theme: e.target.value }))}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="dark">Dark (Lime - Default)</option>
                                    <option value="dark-blue">Dark (Blue)</option>
                                    <option value="dark-orange">Dark (Orange)</option>
                                    <option value="dark-violet">Dark (Violet)</option>
                                    <option value="light">Light (Lime)</option>
                                    <option value="light-blue">Light (Blue)</option>
                                    <option value="light-orange">Light (Orange)</option>
                                    <option value="light-violet">Light (Violet)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dashboardView">Default Dashboard View</Label>
                                <select
                                    id="dashboardView"
                                    name="dashboardView"
                                    value={formData.layoutPreferences?.dashboardView || "maintenance"}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        layoutPreferences: {
                                            ...prev.layoutPreferences,
                                            dashboardView: e.target.value
                                        }
                                    }))}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="maintenance">Maintenance Command Center</option>
                                    <option value="drone">Drone Operations Dashboard</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 p-4 border rounded-lg bg-primary/5">
                            <input
                                type="checkbox"
                                id="aiEnabled"
                                checked={formData.aiEnabled}
                                onChange={(e) => setFormData(prev => ({ ...prev, aiEnabled: e.target.checked }))}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="aiEnabled" className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Enable AI Assistant & Features
                                </Label>
                                <p className="text-[10px] text-muted-foreground italic">
                                    Enables AI-powered pricing extraction, quotation analysis, and side panel helpers.
                                    (Voice recording in Scope of Work remains active).
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bankDetails">Bank Account Details</Label>
                            <Textarea
                                id="bankDetails"
                                name="bankDetails"
                                value={formData.bankDetails}
                                onChange={handleChange}
                                rows={3}
                                placeholder="Bank Name, Account Number, Branch Code, etc."
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Settings
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>

                {/* Danger Zone */}
                <Card className="border-destructive/20 bg-destructive/5">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Danger Zone
                        </CardTitle>
                        <CardDescription>
                            Destructive actions that cannot be undone.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h4 className="font-bold text-white">Reset App Data</h4>
                                <p className="text-sm text-muted-foreground">
                                    This will delete all projects, invoices, quotes, and interactions.
                                    Your <strong>Company Settings</strong> and <strong>Clients</strong> will be preserved.
                                </p>
                            </div>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" className="shrink-0">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Reset All Data
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px] border-destructive/20">
                                    <DialogHeader>
                                        <DialogTitle className="text-destructive flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5" />
                                            Are you absolutely sure?
                                        </DialogTitle>
                                        <DialogDescription className="text-muted-foreground pt-2">
                                            This action <strong>cannot be undone</strong>. This will permanently delete your:
                                            <ul className="list-disc list-inside mt-2 space-y-1">
                                                <li>Projects & Scopes of Work</li>
                                                <li>Quotes & Invoices</li>
                                                <li>Payments & Interactions</li>
                                                <li>AI Training Knowledge</li>
                                            </ul>
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Label htmlFor="confirmReset" className="text-white mb-2 block">
                                            Type <span className="text-destructive font-black">RESET</span> to confirm
                                        </Label>
                                        <Input
                                            id="confirmReset"
                                            placeholder="RESET"
                                            className="uppercase border-destructive/20 focus-visible:ring-destructive"
                                            onChange={(e) => {
                                                if (e.target.value === "RESET") {
                                                    setConfirmText("RESET")
                                                }
                                            }}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            variant="destructive"
                                            className="w-full"
                                            disabled={confirmText !== "RESET" || loading}
                                            onClick={async () => {
                                                setLoading(true)
                                                const res = await resetAppDataAction()
                                                if (res.success) {
                                                    alert("All transactional data has been cleared.")
                                                    router.refresh()
                                                } else {
                                                    alert(res.error || "Failed to reset data.")
                                                }
                                                setLoading(false)
                                            }}
                                        >
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                            I understand, reset all data
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </form>
    )
}
