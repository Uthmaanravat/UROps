"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { 
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
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
    CheckCircle2,
    Building2,
    Mail,
    Copy,
    Check,
    ChevronRight,
    TrendingUp as TrendIcon
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
    Cell,
    Legend
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
        trendData?: any[]
        topSuppliers?: any[]
    }
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export function DashboardClient({ data }: DashboardClientProps) {
    const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
    const [copiedSupplierId, setCopiedSupplierId] = useState<string | null>(null);

    const {
        unpaidTotal,
        projectCount,
        activeProjects,
        unpaidCount,
        unpaidInvoices,
        pendingScopes,
        upcomingMeetings,
        recentInteractions,
        recentInvoices,
        trendData = [],
        topSuppliers = []
    } = data;

    const handleCopyText = (text: string, supplierName: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSupplierId(supplierName);
        setTimeout(() => setCopiedSupplierId(null), 2000);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#0f0f1a]/95 border border-white/10 p-3 rounded-lg shadow-xl backdrop-blur-md">
                    <p className="text-white font-black text-[10px] mb-2 uppercase tracking-widest">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-xs font-bold">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || '#10b981' }} />
                            <span className="text-muted-foreground">{entry.name}:</span>
                            <span className="font-black text-white">{formatCurrency(Number(entry.value) || 0)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

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
                    <CardHeader className="border-b border-white/5 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-primary" /> Performance Over Time
                                </CardTitle>
                                <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Real-time Income vs Expenses (Last 6 Months)</CardDescription>
                            </div>
                            <Link href="/financial-dashboard">
                                <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-[10px] font-black uppercase text-primary">Financial Command</Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 h-[270px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="month" stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R${value/1000}k`} />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: '#ffffff05'}} />
                                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} iconType="circle" />
                                <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={30} />
                            </BarChart>
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

                <Card className="md:col-span-7 bg-[#14141E]/80 backdrop-blur-md border border-white/5 shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Building2 className="h-24 w-24 text-white" />
                    </div>
                    <CardHeader className="border-b border-white/5 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <CardTitle className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-primary" /> Supplier Intelligence
                                </CardTitle>
                                <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Top 5 suppliers by expenditure & loyalty terms</CardDescription>
                            </div>
                            <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase">
                                Actionable Statement Reviews
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {topSuppliers.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-xs text-muted-foreground italic">No expense transactions recorded yet.</p>
                                <Link href="/financial-dashboard" className="mt-4 inline-block">
                                    <Button size="sm" className="bg-primary text-black font-black uppercase text-[10px]">Upload Statement</Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {topSuppliers.map((supplier: any) => {
                                    const emailDraft = `Subject: Strategic Vendor Account Review - UROps\n\nDear ${supplier.name} Sales Team,\n\nI hope this email finds you well.\n\nWe are conducting our annual financial audit and strategic partner reviews. According to our internal records at UROps, our recent total expenditure with ${supplier.name} is ${formatCurrency(supplier.spend)}.\n\nGiven the scale of our partnership and our consistent payment history, we would love to discuss options to optimize our transaction structure. Specifically, we would like to explore:\n1. Preferred loyalty discount rates or volume rebates.\n2. Dedicated pricing tiers for upcoming bulk construction projects.\n3. Extended payment term opportunities.\n\nWe value our relationship and look forward to scaling our business with you in our next phase of projects. Please let us know when we can hop on a brief call to align on this.\n\nBest regards,\nOperations Manager\nUROps Management Team`;

                                    return (
                                        <div key={supplier.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/[0.08] hover:border-primary/20 transition-all gap-4 group">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-sm text-white group-hover:text-primary transition-colors">{supplier.name}</span>
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0.5 bg-white/5 border-white/10 text-muted-foreground">
                                                        {supplier.category}
                                                    </Badge>
                                                </div>
                                                
                                                <div className="space-y-1">
                                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full" style={{ width: `${supplier.percentage}%` }} />
                                                    </div>
                                                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                                                        <span>Expenditure Share</span>
                                                        <span>{supplier.percentage.toFixed(1)}% of total expenses</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                                                <div className="text-right">
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Total Spent</span>
                                                    <span className="text-lg font-black text-white">{formatCurrency(supplier.spend)}</span>
                                                </div>
                                                <Button 
                                                    onClick={() => setSelectedSupplier({ ...supplier, emailDraft })}
                                                    size="sm" 
                                                    className="bg-white/5 hover:bg-primary hover:text-black border border-white/10 text-white text-[10px] font-black uppercase rounded-xl transition-all h-10 px-4 flex items-center gap-2 shadow-lg hover:shadow-primary/20"
                                                >
                                                    Review <ChevronRight className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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

            {/* Supplier Statement & Partnership Review Dialog */}
            <Dialog open={selectedSupplier !== null} onOpenChange={(open) => !open && setSelectedSupplier(null)}>
                <DialogContent className="max-w-2xl border-white/10 bg-[#0F0F1A]/95 backdrop-blur-2xl shadow-2xl max-h-[85vh] overflow-y-auto rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                            <Building2 className="text-primary h-6 w-6" /> Supplier Review
                        </DialogTitle>
                        <DialogDescription className="text-xs uppercase tracking-wider text-muted-foreground">
                            Strategic partnership & rebate opportunities for {selectedSupplier?.name}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSupplier && (
                        <div className="space-y-6 mt-4">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block mb-1">Cumulative Spend</span>
                                    <span className="text-2xl font-black text-white">{formatCurrency(selectedSupplier.spend)}</span>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block mb-1">Dominant Category</span>
                                    <span className="text-2xl font-black text-primary uppercase">{selectedSupplier.category}</span>
                                </div>
                            </div>

                            {/* Recent Transactions List */}
                            <div className="space-y-2">
                                <h3 className="text-xs font-black text-white uppercase tracking-widest">Recent Transactions</h3>
                                <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02]">
                                    <table className="w-full text-xs text-left">
                                        <thead>
                                            <tr className="border-b border-white/10 text-[9px] uppercase font-black text-muted-foreground bg-white/5">
                                                <th className="py-3 px-4">Date</th>
                                                <th className="py-3 px-4">Description</th>
                                                <th className="py-3 px-4 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedSupplier.transactions.map((t: any) => (
                                                <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                                                    <td className="py-2.5 px-4 text-muted-foreground">{new Date(t.date).toLocaleDateString()}</td>
                                                    <td className="py-2.5 px-4 font-bold text-white truncate max-w-[250px]">{t.description}</td>
                                                    <td className="py-2.5 px-4 text-right font-black text-red-400">{formatCurrency(t.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Email Draft Generation */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                                        <Mail className="h-4 w-4 text-primary" /> Loyalty Discount Request Draft
                                    </h3>
                                    <Button
                                        onClick={() => handleCopyText(selectedSupplier.emailDraft, selectedSupplier.name)}
                                        size="sm"
                                        className="bg-primary hover:bg-primary/95 text-black font-black uppercase text-[9px] py-1 px-3.5 rounded-lg flex items-center gap-1 shadow-md shadow-primary/10 h-8"
                                    >
                                        {copiedSupplierId === selectedSupplier.name ? (
                                            <><Check className="h-3.5 w-3.5" /> Copied!</>
                                        ) : (
                                            <><Copy className="h-3.5 w-3.5" /> Copy Message</>
                                        )}
                                    </Button>
                                </div>
                                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 font-mono text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[220px] overflow-y-auto scrollbar-thin">
                                    {selectedSupplier.emailDraft}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="mt-4">
                        <Button 
                            onClick={() => setSelectedSupplier(null)} 
                            className="w-full bg-white/5 hover:bg-white/10 text-white font-black uppercase text-xs rounded-xl h-11 border border-white/10"
                        >
                            Close Statement Review
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
