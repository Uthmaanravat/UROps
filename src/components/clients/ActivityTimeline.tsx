"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Briefcase, FileCheck, DollarSign, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { markActivityReadAction } from "@/app/(dashboard)/clients/actions"
import { useRouter } from "next/navigation"

interface ActivityItem {
    id: string
    type: 'PROJECT' | 'INVOICE' | 'PAYMENT' | 'INTERACTION'
    date: Date
    title: string
    status?: string
    amount?: number
    description?: string
    read?: boolean
}

export function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
    const router = useRouter()

    const handleMarkRead = async (id: string) => {
        await markActivityReadAction(id)
        router.refresh()
    }

    if (activities.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground italic">No activity recorded for this client yet.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {activities.map((item) => (
                        <div key={item.id} className={`relative pl-6 border-l-2 border-muted pb-1 last:pb-0 ${item.type === 'INTERACTION' && !item.read ? 'bg-blue-50/50 -mx-2 px-2 py-2 rounded' : ''}`}>
                            <div className={`absolute top-0 left-[-9px] h-4 w-4 rounded-full border-2 border-background 
                                ${item.type === 'PROJECT' ? 'bg-blue-500' :
                                    item.type === 'INVOICE' ? 'bg-orange-500' :
                                        item.type === 'PAYMENT' ? 'bg-green-500' :
                                            item.type === 'INTERACTION' && !item.read ? 'bg-red-500 animate-pulse' :
                                                'bg-gray-500'}`} />

                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                <div>
                                    <div className="flex items-center gap-2 font-semibold">
                                        {item.type === 'PROJECT' && <Briefcase className="h-4 w-4 text-blue-500" />}
                                        {item.type === 'INVOICE' && <FileText className="h-4 w-4 text-orange-500" />}
                                        {item.type === 'PAYMENT' && <DollarSign className="h-4 w-4 text-green-500" />}
                                        {item.type === 'INTERACTION' && <MessageSquare className="h-4 w-4 text-gray-500" />}
                                        <span>{item.title}</span>
                                        {item.type === 'INTERACTION' && !item.read && (
                                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded-full">NEW</span>
                                        )}
                                    </div>
                                    {item.description && (
                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                                        {new Date(item.date).toLocaleDateString()}
                                    </div>
                                    {item.type === 'INTERACTION' && !item.read && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs text-blue-600 hover:text-blue-800 p-0"
                                            onClick={() => handleMarkRead(item.id)}
                                        >
                                            Mark as Seen
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 mt-2">
                                {item.status && <Badge variant="outline">{item.status.replace('_', ' ')}</Badge>}
                                {item.amount !== undefined && (
                                    <span className={`text-sm font-bold ${item.type === 'PAYMENT' ? 'text-green-600' : ''}`}>
                                        {item.type === 'PAYMENT' ? '+' : ''}
                                        {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(item.amount)}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
