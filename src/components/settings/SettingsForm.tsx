"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateCompanySettings } from "@/app/(dashboard)/settings/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Save } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

interface SettingsFormProps {
    initialSettings: any
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: initialSettings?.name || "",
        address: initialSettings?.address || "",
        phone: initialSettings?.phone || "",
        email: initialSettings?.email || "",
        website: initialSettings?.website || "",
        logoUrl: initialSettings?.logoUrl || "",
        taxId: initialSettings?.taxId || "",
        bankDetails: initialSettings?.bankDetails || "",
        paymentTerms: initialSettings?.paymentTerms || "",
        currency: initialSettings?.currency || "R",
        theme: initialSettings?.theme || "dark",
        aiEnabled: initialSettings?.aiEnabled ?? true,
        layoutPreferences: initialSettings?.layoutPreferences || {
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
            }
        },
    })

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
            const result = await updateCompanySettings(formData)
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
                            <div className="flex items-center gap-4">
                                {formData.logoUrl && (
                                    <div className="relative h-20 w-20 rounded-md border overflow-hidden bg-white">
                                        <img
                                            src={formData.logoUrl}
                                            alt="Logo Preview"
                                            className="h-full w-full object-contain"
                                        />
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
                                                    setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
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
            </div>
        </form>
    )
}
