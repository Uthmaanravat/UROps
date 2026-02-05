"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Users, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createMeeting, deleteMeeting } from "@/app/(dashboard)/calendar/actions"
import { useRouter } from "next/navigation"

interface CalendarViewProps {
    meetings: any[]
    projects: any[]
    clients: any[]
}

export function CalendarView({ meetings, projects, clients }: CalendarViewProps) {
    const router = useRouter()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Form Stats
    const [newMeeting, setNewMeeting] = useState({
        title: "",
        date: "",
        time: "09:00",
        duration: "60",
        location: "",
        notes: "",
        clientId: "",
        projectId: ""
    })

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }

    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()
    const startingDayOfWeek = firstDayOfMonth.getDay()

    const monthName = currentDate.toLocaleString('default', { month: 'long' })
    const year = currentDate.getFullYear()

    const days = []
    // Padding for starting day
    for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i)
    }

    const handleAddMeeting = async () => {
        setLoading(true)
        const dateObj = new Date(`${newMeeting.date}T${newMeeting.time}`)
        const res = await createMeeting({
            ...newMeeting,
            date: dateObj,
            duration: parseInt(newMeeting.duration)
        })
        if (res.success) {
            setIsAddOpen(false)
            setNewMeeting({
                title: "", date: "", time: "09:00", duration: "60", location: "", notes: "", clientId: "", projectId: ""
            })
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">{monthName} {year}</h2>
                    <div className="flex border rounded-md shadow-sm">
                        <Button variant="ghost" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Schedule Meeting</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Schedule Meeting</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={newMeeting.title} onChange={e => setNewMeeting({ ...newMeeting, title: e.target.value })} placeholder="e.g. Site Inspection" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input type="date" value={newMeeting.date} onChange={e => setNewMeeting({ ...newMeeting, date: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Time</Label>
                                    <Input type="time" value={newMeeting.time} onChange={e => setNewMeeting({ ...newMeeting, time: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Client (Optional)</Label>
                                    <select className="flex h-9 w-full rounded-md border px-3 text-sm" value={newMeeting.clientId} onChange={e => setNewMeeting({ ...newMeeting, clientId: e.target.value })}>
                                        <option value="">None</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Project (Optional)</Label>
                                    <select className="flex h-9 w-full rounded-md border px-3 text-sm" value={newMeeting.projectId} onChange={e => setNewMeeting({ ...newMeeting, projectId: e.target.value })}>
                                        <option value="">None</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Location</Label>
                                <Input value={newMeeting.location} onChange={e => setNewMeeting({ ...newMeeting, location: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddMeeting} disabled={loading || !newMeeting.title || !newMeeting.date}>Save Meeting</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-card border rounded-lg overflow-hidden shadow-sm overflow-x-auto">
                <div className="min-w-[600px] md:min-w-0">
                    {/* Weekdays */}
                    <div className="grid grid-cols-7 bg-muted/30 border-b font-bold">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="py-3 text-center text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">{d}</div>
                        ))}
                    </div>
                    {/* Days Grid */}
                    <div className="grid grid-cols-7 auto-rows-[110px] md:auto-rows-[130px]">
                        {days.map((day, idx) => {
                            if (day === null) return <div key={`empty-${idx}`} className="border-b border-r bg-muted/5 group-hover:bg-muted/10 transition-colors" />

                            const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

                            const dayMeetings = meetings.filter(m => new Date(m.date).toISOString().startsWith(dateStr))
                            const dayProjects = projects.filter(p => p.endDate && new Date(p.endDate).toISOString().startsWith(dateStr))

                            return (
                                <div key={day} className="border-b border-r p-1 md:p-3 hover:bg-muted/10 transition-colors group">
                                    <div className="flex justify-between items-start">
                                        <span className={cn(
                                            "text-xs md:text-sm font-bold h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded-full transition-all",
                                            new Date().toISOString().startsWith(dateStr)
                                                ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                                                : "text-foreground group-hover:scale-110"
                                        )}>{day}</span>
                                    </div>
                                    <div className="mt-2 space-y-1.5 overflow-hidden">
                                        {dayMeetings.map(m => (
                                            <div key={m.id} className="text-[9px] md:text-[11px] p-1 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 truncate flex items-center gap-1 border border-blue-500/20 font-medium">
                                                <CalendarIcon className="h-2.5 w-2.5 shrink-0" /> {m.title}
                                            </div>
                                        ))}
                                        {dayProjects.map(p => (
                                            <div key={p.id} className="text-[9px] md:text-[11px] p-1 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 truncate flex items-center gap-1 border border-purple-500/20 font-medium">
                                                <Briefcase className="h-2.5 w-2.5 shrink-0" /> {p.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Summary / Legend */}
            <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-blue-100 border border-blue-200" /> Meetings</div>
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-purple-100 border border-purple-200" /> Project Deadlines</div>
            </div>
        </div>
    )
}
