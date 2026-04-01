"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Plus, Search, FileText, Trash2, Loader2, Calendar as CalendarIcon, User, Briefcase, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createReport, deleteReport } from "@/app/actions/reports"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ReportsListProps {
    reports: any[]
    clients: { id: string; name: string }[]
    projects: { id: string; name: string; clientId: string }[]
    companyId: string
}

export function ReportsList({ reports, clients, projects, companyId }: ReportsListProps) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // New Report Form State
    const [title, setTitle] = useState("")
    const [clientId, setClientId] = useState("")
    const [projectId, setProjectId] = useState("")

    const filteredReports = reports.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.project?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleCreateReport = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title) return
        
        setIsSubmitting(true)
        try {
            const result = await createReport({
                title,
                clientId: clientId || undefined,
                projectId: projectId || undefined,
                companyId,
                date: new Date()
            })
            
            if (result.success && result.report) {
                setIsCreateOpen(false)
                setTitle("")
                setClientId("")
                setProjectId("")
                router.push(`/reports/${result.report.id}`)
            } else {
                alert("Failed to create report")
            }
        } catch (error) {
            console.error(error)
            alert("An error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteReport = async (id: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        if (!confirm("Are you sure you want to delete this report?")) return
        
        try {
            const result = await deleteReport(id)
            if (result.success) {
                router.refresh()
            } else {
                alert("Failed to delete report")
            }
        } catch (error) {
            console.error(error)
            alert("An error occurred")
        }
    }

    const filteredProjects = projects.filter(p => !clientId || p.clientId === clientId)

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase">Site & Progress Reports</h1>
                    <p className="text-muted-foreground font-medium">Generate professional reports with pictures and progress updates.</p>
                </div>
                
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest shadow-lg shadow-primary/20 h-11 px-6 rounded-xl">
                            <Plus className="mr-2 h-4 w-4" /> New Report
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] border-white/5 bg-[#0F0F1A] text-white">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black uppercase tracking-wider text-primary">Initialize Report</DialogTitle>
                            <DialogDescription className="text-muted-foreground font-medium">
                                Create a new report shell. You can add images and notes in the next step.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateReport} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Report Title</Label>
                                <Input 
                                    id="title" 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)} 
                                    placeholder="e.g. COMPLETED SITE INSPECTION" 
                                    required 
                                    className="bg-white/5 border-white/10 uppercase font-bold"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Client (Optional)</Label>
                                <select 
                                    value={clientId} 
                                    onChange={(e) => {
                                        setClientId(e.target.value)
                                        setProjectId("")
                                    }}
                                    className="flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                >
                                    <option value="">No Client Linked</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Project (Optional)</Label>
                                <select 
                                    value={projectId} 
                                    onChange={(e) => setProjectId(e.target.value)}
                                    className="flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                >
                                    <option value="">No Project Linked</option>
                                    {filteredProjects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <DialogFooter className="pt-4">
                                <Button type="submit" disabled={isSubmitting} className="w-full font-black uppercase tracking-widest h-11 rounded-xl">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                    Create Report
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search reports by title, client or project..." 
                    className="pl-10 h-12 bg-card border-white/5 font-medium rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {filteredReports.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredReports.map((report) => (
                        <Link href={`/reports/${report.id}`} key={report.id} className="group cursor-pointer">
                            <Card className="h-full bg-card border-white/5 hover:border-primary/50 transition-all duration-300 shadow-xl hover:shadow-primary/5 rounded-2xl overflow-hidden flex flex-col">
                                <CardHeader className="pb-3 px-6 pt-6">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20">
                                            <CalendarIcon className="h-3 w-3" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">{new Date(report.date).toLocaleDateString('en-GB')}</span>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={(e) => handleDeleteReport(report.id, e)}
                                            className="h-8 w-8 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                    <CardTitle className="text-lg font-black text-white group-hover:text-primary transition-colors leading-snug uppercase tracking-tight">
                                        {report.title}
                                    </CardTitle>
                                    <div className="flex flex-col gap-1.5 mt-3">
                                        {report.client && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                <User className="h-3 w-3 text-primary/50" />
                                                <span>{report.client.name}</span>
                                            </div>
                                        )}
                                        {report.project && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                <Briefcase className="h-3 w-3 text-primary/50" />
                                                <span>{report.project.name}</span>
                                            </div>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 px-6 pb-6 mt-auto">
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-white text-xs font-black">
                                                {report._count?.items || 0}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Items</span>
                                        </div>
                                        <div className="text-primary group-hover:translate-x-1 transition-transform">
                                            <ChevronRight className="h-5 w-5" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed border-white/10 space-y-4">
                    <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground/30">
                        <FileText className="h-8 w-8" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-white">No reports found</h3>
                        <p className="text-muted-foreground font-medium">Create your first site report to start tracking progress.</p>
                    </div>
                    <Button 
                        onClick={() => setIsCreateOpen(true)}
                        variant="outline" 
                        className="mt-2 border-primary/20 text-primary hover:bg-primary/10 rounded-xl"
                    >
                        Create Report
                    </Button>
                </div>
            )}
        </div>
    )
}
