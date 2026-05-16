"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { 
    Users, 
    FileText, 
    CreditCard, 
    AlertTriangle, 
    Briefcase, 
    Calendar, 
    Settings, 
    TrendingUp, 
    TrendingDown, 
    ArrowUpRight, 
    Activity,
    DollarSign,
    Clock,
    CheckCircle2
} from "lucide-react"
import Link from "next/link"
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    AreaChart, 
    Area,
    PieChart,
    Pie,
    Cell
} from 'recharts'

interface DashboardClientProps {
    data: {
        clientCount: number
        invoiceCount: number
        unpaidCount: number
        unpaidTotal: number
        projectCount: number
        activeProjects: any[]
        recentInvoices: any[]
        upcomingMeetings: any[]
        recentInteractions: any[]
        pendingScopes: any[]
        unpaidInvoices: any[]
        trackingCounts: {
            sow: number
            quotation: number
            invoice: number
            payment: number
        }
    }
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export function DashboardClient({ data }: DashboardClientProps) {
    const {
        unpaidTotal,
        projectCount,
        activeProjects,
        unpaidCount,
        unpaidInvoices,
        pendingScopes,
        upcomingMeetings,
        recentInteractions,
        recentInvoices
    } = data;

    // Mock financial data for the chart (in a real app, this would come from the server)
    const chartData = [
        { name: 'Jan', revenue: 4000, expenses: 2400 },
        { name: 'Feb', revenue: 3000, expenses: 1398 },
        { name: 'Mar', revenue: 2000, expenses: 9800 },
        { name: 'Apr', revenue: 2780, expenses: 3908 },
        { name: 'May', revenue: 1890, expenses: 4800 },
        { name: 'Jun', revenue: 2390, expenses: 3800 },
    ];

    const invoiceStatusData = [
        { name: 'Paid', value: data.trackingCounts.payment },
        { name: 'Unpaid', value: data.unpaidCount },
        { name: 'Quotes', value: data.trackingCounts.quotation },
        { name: 'Scopes', value: data.trackingCounts.sow },
    ].filter(item => item.value > 0);

    return (
        <div className="space-y-6 pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">Command Center</h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide">Operational oversight and financial intelligence</p>
                </div>
                <div className="flex items-center gap-2 bg-[#14141E]/80 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl">
                    <div className="flex flex-col items-end px-3">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">System Health</span>
                        <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                            <Activity className="h-3 w-3" /> ONLINE
                        </span>
                    </div>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/5 rounded-xl">
                        <Settings className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-emerald-500/30 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Outstanding Revenue</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">{formatCurrency(unpaidTotal)}</div>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] font-bold text-emerald-500/80 uppercase">+{unpaidCount} Pending Invoices</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-primary/30 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Operations</CardTitle>
                        <Briefcase className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white group-hover:text-primary transition-colors">{projectCount}</div>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] font-bold text-primary/80 uppercase">Ongoing Projects</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-orange-500/30 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Recent Sales</CardTitle>
                        <FileText className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white group-hover:text-orange-400 transition-colors">{data.trackingCounts.quotation}</div>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] font-bold text-orange-500/80 uppercase">Quotes Generated</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl hover:border-red-500/30 transition-all group">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Urgent Actions</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white group-hover:text-red-400 transition-colors">{pendingScopes.length}</div>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] font-bold text-red-500/80 uppercase">Scopes Awaiting Pricing</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Financial Performance Section */}
            <div className="grid gap-6 md:grid-cols-7">
                <Card className="md:col-span-4 bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-black text-white uppercase tracking-tight">Revenue Insights</CardTitle>
                                <CardDescription className="text-xs font-medium uppercase tracking-widest">Projected vs Actual Revenue</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-[10px] font-black uppercase">Export Report</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    stroke="#ffffff40" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false}
                                />
                                <YAxis 
                                    stroke="#ffffff40" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tickFormatter={(value) => `R${value/1000}k`}
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0F0F1A', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="md:col-span-3 bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-white uppercase tracking-tight">Document Distribution</CardTitle>
                        <CardDescription className="text-xs font-medium uppercase tracking-widest">Workflow Stage Analysis</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex flex-col items-center justify-center">
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart>
                                <Pie
                                    data={invoiceStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {invoiceStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0F0F1A', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4">
                            {invoiceStatusData.map((item, index) => (
                                <div key={item.name} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{item.name} ({item.value})</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Section: Activities and Projects */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Active Projects List */}
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-black text-white uppercase tracking-widest">Active Operations</CardTitle>
                        </div>
                        <Link href="/projects">
                            <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-primary">View All</Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(activeProjects || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-10">No active projects.</p>
                        ) : (
                            (activeProjects || []).map((proj: any) => (
                                <Link key={proj.id} href={`/projects/${proj.id}`} className="block group">
                                    <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-primary/30 transition-all">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <div className="font-bold text-sm text-white truncate group-hover:text-primary transition-colors">{proj.name}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase">{proj.client?.name}</span>
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex flex-col items-end">
                                            <Badge className="bg-primary/20 text-primary text-[8px] font-black uppercase border-primary/20">
                                                {proj.status.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Upcoming Schedule */}
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-black text-white uppercase tracking-widest">Upcoming Schedule</CardTitle>
                        <Link href="/calendar">
                            <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-primary">Open Calendar</Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(upcomingMeetings || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-10">No upcoming meetings.</p>
                        ) : (
                            (upcomingMeetings || []).map(m => {
                                const meetDate = m.date ? new Date(m.date) : new Date();
                                return (
                                    <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/5">
                                        <div className="bg-primary p-2 rounded-lg text-center min-w-[45px] shadow-lg shadow-primary/20">
                                            <div className="text-[8px] uppercase text-black font-black">{meetDate.toLocaleString('default', { month: 'short' })}</div>
                                            <div className="text-lg font-black text-black leading-none">{meetDate.getDate()}</div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm text-white truncate">{m.title}</div>
                                            <div className="text-[10px] font-black text-muted-foreground uppercase mt-0.5">
                                                {meetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {m.client?.name}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>

                {/* Recent Interaction Log */}
                <Card className="bg-[#14141E]/80 backdrop-blur-md border-white/5 shadow-2xl">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-black text-white uppercase tracking-widest">CRM Intelligence</CardTitle>
                        <Link href="/clients">
                            <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-primary">View CRM</Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(recentInteractions || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-10">No recent activity.</p>
                        ) : (
                            (recentInteractions || []).map(int => (
                                <div key={int.id} className="relative pl-4 border-l-2 border-primary/30 py-1">
                                    {!int.read && <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />}
                                    <div className="text-[10px] font-black text-muted-foreground uppercase flex items-center justify-between">
                                        <span>{int.type}</span>
                                        <span>{int.date ? new Date(int.date).toLocaleDateString() : 'Today'}</span>
                                    </div>
                                    <div className="text-xs font-medium text-white mt-1 line-clamp-2">{int.content}</div>
                                    <div className="text-[10px] font-black text-primary uppercase mt-1">{int.client?.name}</div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
