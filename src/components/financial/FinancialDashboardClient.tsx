"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { Upload, Plus, TrendingUp, TrendingDown, DollarSign, Brain, Loader2, ArrowUpRight, ArrowDownRight, Briefcase, Activity, Calendar, AlertCircle, PieChart as PieChartIcon } from "lucide-react"
import { processBankStatementAction, addManualTransactionAction } from "@/app/(dashboard)/financial-dashboard/actions"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Badge } from "@/components/ui/badge"
import { Check, Copy, ChevronRight, Building2, Mail } from "lucide-react"

const COLORS = ['#10b981', '#f43f5e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function FinancialDashboardClient({ invoices, transactions, projects = [], businessName }: { invoices: any[], transactions: any[], projects?: any[], businessName?: string }) {
    const [isUploading, setIsUploading] = useState(false)
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    
    // Manual Transaction State
    const [isAddingTransaction, setIsAddingTransaction] = useState(false)
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [description, setDescription] = useState("")
    const [amount, setAmount] = useState("")
    const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
    const [category, setCategory] = useState("Materials")

    // Drill Down States
    const [drillDownType, setDrillDownType] = useState<string | null>(null);

    // Time Period State
    const [timePeriod, setTimePeriod] = useState<'3M' | '6M' | '1Y' | 'ALL'>('3M');

    // Supplier Intelligence States
    const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
    const [copiedSupplierId, setCopiedSupplierId] = useState<string | null>(null);

    const handleCopyText = (text: string, supplierName: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSupplierId(supplierName);
        setTimeout(() => setCopiedSupplierId(null), 2000);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadSuccess(null);
        setUploadError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const result = await processBankStatementAction(formData);
            if (result.success) {
                setUploadSuccess(`Successfully processed ${result.count} transactions.`);
            } else {
                setUploadError(result.error || "Failed to process statement.");
            }
        } catch (error: any) {
            setUploadError(error.message || "An unexpected error occurred.");
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAddingTransaction(true);
        try {
            await addManualTransactionAction({
                date,
                description,
                amount: parseFloat(amount),
                type,
                category
            });
            setDescription("");
            setAmount("");
        } catch (error) {
            console.error(error);
        } finally {
            setIsAddingTransaction(false);
        }
    };

    // --- Calculations ---
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // From Invoices
    const totalInvoiced = invoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);
    const totalPaid = invoices.reduce((acc, inv) => acc + (inv.payments?.reduce((pAcc: number, p: any) => pAcc + (Number(p.amount) || 0), 0) || 0), 0);
    const outstandingInvoices = totalInvoiced - totalPaid;
    
    const unpaidInvoices = invoices.filter(inv => {
        const paid = inv.payments?.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0) || 0;
        return paid < inv.total && inv.status !== 'CANCELLED' && inv.status !== 'DRAFT';
    });

    const activeProjectsList = projects.filter(p => !['COMPLETED', 'PAID', 'CANCELLED'].includes(p.status));

    // From Transactions
    const now = new Date();
    const filteredTransactions = transactions.filter(t => {
        if (timePeriod === 'ALL') return true;
        const d = new Date(t.date);
        const diffTime = Math.abs(now.getTime() - d.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (timePeriod === '3M') return diffDays <= 90;
        if (timePeriod === '6M') return diffDays <= 180;
        if (timePeriod === '1Y') return diffDays <= 365;
        return true;
    });

    const periodRevenue = filteredTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const periodExpenses = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const netProfit = periodRevenue - periodExpenses;

    const totalRevenue = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    // Calculate Top 5 Suppliers by Spend (Dynamic based on timePeriod)
    const expenseTransactions = filteredTransactions.filter(t => t.type === 'EXPENSE');
    const supplierSpendMap: { [key: string]: { totalSpend: number; categoryDistribution: { [cat: string]: number }; transactions: any[] } } = {};
    
    let totalAllExpenses = 0;
    expenseTransactions.forEach((t: any) => {
        const name = t.description.trim() || 'Unknown Supplier';
        if (!supplierSpendMap[name]) {
            supplierSpendMap[name] = { totalSpend: 0, categoryDistribution: {}, transactions: [] };
        }
        const amount = Number(t.amount) || 0;
        supplierSpendMap[name].totalSpend += amount;
        totalAllExpenses += amount;
        
        supplierSpendMap[name].transactions.push({
            id: t.id,
            date: t.date,
            description: t.description,
            category: t.category,
            amount: amount
        });
        
        const cat = t.category || 'Miscellaneous';
        supplierSpendMap[name].categoryDistribution[cat] = (supplierSpendMap[name].categoryDistribution[cat] || 0) + amount;
    });

    const topSuppliers = Object.entries(supplierSpendMap)
        .map(([name, info]) => {
            const dominantCategory = Object.entries(info.categoryDistribution)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Miscellaneous';
            return {
                name,
                spend: info.totalSpend,
                category: dominantCategory,
                percentage: totalAllExpenses > 0 ? (info.totalSpend / totalAllExpenses) * 100 : 0,
                transactions: info.transactions.slice(0, 10)
            };
        })
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);

    // Expense Categories
    const expenseCategories = transactions.filter(t => t.type === 'EXPENSE').reduce((acc: Record<string, number>, t) => {
        const cat = t.category || 'Miscellaneous';
        acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
        return acc;
    }, {});

    const pieChartData = Object.entries(expenseCategories).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Monthly Trend (Last 6 Months)
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const m = d.getMonth();
        const y = d.getFullYear();

        const mIncome = transactions.filter(t => {
            const td = new Date(t.date);
            return td.getMonth() === m && td.getFullYear() === y && t.type === 'INCOME';
        }).reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        const mExpense = transactions.filter(t => {
            const td = new Date(t.date);
            return td.getMonth() === m && td.getFullYear() === y && t.type === 'EXPENSE';
        }).reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

        trendData.push({ month: months[m], Income: mIncome, Expenses: mExpense, Profit: mIncome - mExpense });
    }

    // Custom Tooltip for Charts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#0f0f1a]/90 border border-white/10 p-3 rounded-lg shadow-xl backdrop-blur-md">
                    <p className="text-white font-black text-xs mb-2 uppercase tracking-widest">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-muted-foreground">{entry.name}:</span>
                            <span className="font-bold text-white">{formatCurrency(Number(entry.value) || 0)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">Financial Command Center</h1>
                    <p className="text-muted-foreground text-sm font-medium tracking-wide">Live business analytics & operations tracking</p>
                </div>
                <div className="flex flex-col items-end gap-4 w-full md:w-auto">
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 self-start md:self-end">
                        {(['3M', '6M', '1Y', 'ALL'] as const).map(p => (
                            <button key={p} onClick={() => setTimePeriod(p)} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${timePeriod === p ? 'bg-primary text-black shadow-lg' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}>
                                {p === '3M' ? '3 Months' : p === '6M' ? '6 Months' : p === '1Y' ? '1 Year' : 'All Time'}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="flex-1 md:flex-none border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-white font-bold backdrop-blur-sm">
                                    <Plus className="mr-2 h-4 w-4" /> Add Record
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] border-primary/20 bg-[#0F0F1A]/95 backdrop-blur-xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black uppercase text-primary">Add Transaction</DialogTitle>
                                <DialogDescription>Manual entry for income or expense.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddTransaction} className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Type</Label>
                                        <select value={type} onChange={(e) => setType(e.target.value as 'INCOME' | 'EXPENSE')} className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                                            <option value="INCOME">Income</option>
                                            <option value="EXPENSE">Expense</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input placeholder="e.g. Paint Supplies" value={description} onChange={e => setDescription(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Amount (R)</Label>
                                        <Input type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required className="bg-white/5 border-white/10 font-black text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                                            {type === 'EXPENSE' ? (
                                                <><option value="Materials">Materials</option><option value="Salaries/Wages">Salaries/Wages</option><option value="Subcontractors">Subcontractors</option><option value="Equipment">Equipment</option><option value="Fuel/Transport">Fuel/Transport</option><option value="Office/Admin">Office/Admin</option><option value="Utilities">Utilities</option><option value="Miscellaneous">Miscellaneous</option></>
                                            ) : (
                                                <><option value="Project Revenue">Project Revenue</option><option value="Consulting">Consulting</option><option value="Other Income">Other Income</option></>
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isAddingTransaction} className="w-full bg-primary text-black font-black hover:bg-primary/90 mt-4 shadow-[0_0_20px_rgba(163,230,53,0.3)]">
                                        {isAddingTransaction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        Save Transaction
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <div className="relative flex-1 md:flex-none group">
                        <input type="file" accept=".pdf,.csv,.txt,.xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isUploading} />
                        <Button className="w-full bg-gradient-to-r from-primary to-emerald-400 text-black hover:opacity-90 font-black shadow-[0_0_20px_rgba(163,230,53,0.4)] transition-all group-hover:scale-105">
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                            AI Statement Upload
                        </Button>
                    </div>
                </div>
                </div>
            </div>

            {/* AI Warning / Messages */}
            {uploadError && <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2">❌ {uploadError}</div>}
            {uploadSuccess && <div className="bg-primary/10 border border-primary/50 text-primary px-4 py-3 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2">✅ {uploadSuccess}</div>}

            {/* INTERACTIVE KPI CARDS */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-[#14141E]/80 backdrop-blur-md border border-white/5 shadow-2xl hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all cursor-pointer group" onClick={() => setDrillDownType('REVENUE')}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-widest group-hover:text-emerald-400 transition-colors">Period Revenue</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(periodRevenue)}</div>
                        <div className="flex items-center text-[10px] text-emerald-400 font-bold mt-1 uppercase tracking-wider">
                            <Activity className="h-3 w-3 mr-1" /> View Breakdown
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E]/80 backdrop-blur-md border border-white/5 shadow-2xl hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)] transition-all cursor-pointer group" onClick={() => setDrillDownType('EXPENSES')}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-widest group-hover:text-red-400 transition-colors">Period Expenses</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 group-hover:bg-red-500/20 transition-colors">
                            <TrendingDown className="h-4 w-4 text-red-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(periodExpenses)}</div>
                        <div className="flex items-center text-[10px] text-red-400 font-bold mt-1 uppercase tracking-wider">
                            <Activity className="h-3 w-3 mr-1" /> Expense Analysis
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-[#1A1A2E] to-[#14141E] border border-primary/20 shadow-[0_0_30px_rgba(163,230,53,0.1)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
                        <CardTitle className="text-[11px] font-black text-primary uppercase tracking-widest">Net Profit Margin</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                            <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className={`text-3xl font-black tracking-tight ${netProfit >= 0 ? 'text-white' : 'text-red-500'}`}>
                            {formatCurrency(netProfit)}
                        </div>
                        <p className="text-[10px] text-primary/70 font-bold mt-1 uppercase tracking-wider">Selected Period</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E]/80 backdrop-blur-md border border-white/5 shadow-2xl hover:border-orange-500/50 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] transition-all cursor-pointer group" onClick={() => setDrillDownType('OUTSTANDING')}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-widest group-hover:text-orange-400 transition-colors">Outstanding Payments</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 group-hover:bg-orange-500/20 transition-colors">
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(outstandingInvoices)}</div>
                        <div className="flex items-center text-[10px] text-orange-400 font-bold mt-1 uppercase tracking-wider">
                            <Activity className="h-3 w-3 mr-1" /> View {unpaidInvoices.length} Unpaid Invoices
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="bg-[#14141E]/80 backdrop-blur-md border border-white/5 shadow-2xl hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all cursor-pointer group lg:col-span-2" onClick={() => setDrillDownType('PROJECTS')}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[11px] font-black text-muted-foreground uppercase tracking-widest group-hover:text-blue-400 transition-colors">Active Projects Overview</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                            <Briefcase className="h-4 w-4 text-blue-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-4">
                            <div className="text-3xl font-black text-white tracking-tight">{activeProjectsList.length}</div>
                            <div className="flex items-center text-[10px] text-blue-400 font-bold mb-1 uppercase tracking-wider bg-blue-500/10 px-2 py-1 rounded">
                                Live Projects Tracking
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-3">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((activeProjectsList.length / 20) * 100, 100)}%`}} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-[#14141E]/80 backdrop-blur-md border border-white/5 shadow-2xl md:col-span-2">
                    <CardHeader className="border-b border-white/5 pb-4">
                        <CardTitle className="uppercase tracking-widest text-white text-sm font-black flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Performance Over Time
                        </CardTitle>
                        <CardDescription className="text-muted-foreground/70 font-medium">Income, Expenses, and Profit margins over the last 6 months</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="month" stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `R${value/1000}k`} />
                                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#ffffff05'}} />
                                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }} iconType="circle" />
                                    <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E]/80 backdrop-blur-md border border-white/5 shadow-2xl">
                    <CardHeader className="border-b border-white/5 pb-4">
                        <CardTitle className="uppercase tracking-widest text-white text-sm font-black flex items-center gap-2">
                            <PieChartIcon className="h-4 w-4 text-primary" /> Expense Distribution
                        </CardTitle>
                        <CardDescription className="text-muted-foreground/70 font-medium">All Time Breakdown</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 flex flex-col items-center">
                        <div className="h-[200px] w-full mb-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full space-y-3 max-h-[150px] overflow-y-auto pr-2 scrollbar-thin">
                            {pieChartData.map((entry, index) => (
                                <div key={entry.name} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <span className="text-white font-medium truncate max-w-[120px]">{entry.name}</span>
                                    </div>
                                    <span className="font-bold text-muted-foreground">{formatCurrency(Number(entry.value) || 0)}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Supplier Intelligence */}
            <Card className="bg-[#14141E]/80 backdrop-blur-md border border-white/5 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Building2 className="h-24 w-24 text-white" />
                </div>
                <CardHeader className="border-b border-white/5 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-primary" /> Supplier Intelligence
                            </CardTitle>
                            <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Top 5 suppliers by expenditure for the selected period</CardDescription>
                        </div>
                        <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase">
                            Actionable Statement Reviews
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {topSuppliers.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-xs text-muted-foreground italic">No expense transactions recorded in this period.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            {topSuppliers.map((supplier: any) => {
                                const emailDraft = `Subject: Strategic Vendor Account Review - ${businessName || 'Our Company'}\n\nDear ${supplier.name} Sales Team,\n\nI hope this email finds you well.\n\nWe are conducting our financial audit and strategic partner reviews. According to our internal records at ${businessName || 'our company'}, our recent total expenditure with ${supplier.name} is ${formatCurrency(supplier.spend)}.\n\nGiven the scale of our partnership and our consistent payment history, we would love to discuss options to optimize our transaction structure. Specifically, we would like to explore:\n1. Preferred loyalty discount rates or volume rebates.\n2. Dedicated pricing tiers for upcoming bulk construction projects.\n3. Extended payment term opportunities.\n\nWe value our relationship and look forward to scaling our business with you in our next phase of projects. Please let us know when we can hop on a brief call to align on this.\n\nBest regards,\nOperations Manager\n${businessName || 'Management'} Team`;

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

            {/* Drill Down Dialog */}
            <Dialog open={drillDownType !== null} onOpenChange={(open) => !open && setDrillDownType(null)}>
                <DialogContent className="max-w-4xl border-white/10 bg-[#0F0F1A]/95 backdrop-blur-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                            {drillDownType === 'OUTSTANDING' && <><AlertCircle className="text-orange-500" /> Outstanding Payments</>}
                            {drillDownType === 'REVENUE' && <><TrendingUp className="text-emerald-500" /> Revenue Breakdown</>}
                            {drillDownType === 'EXPENSES' && <><TrendingDown className="text-red-500" /> Expense Analysis</>}
                            {drillDownType === 'PROJECTS' && <><Briefcase className="text-blue-500" /> Active Projects</>}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="mt-4">
                        {drillDownType === 'OUTSTANDING' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Total Outstanding</p>
                                        <p className="text-2xl font-black text-orange-500">{formatCurrency(outstandingInvoices)}</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Unpaid Invoices</p>
                                        <p className="text-2xl font-black text-white">{unpaidInvoices.length}</p>
                                    </div>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="[&_tr]:border-b border-white/10">
                                        <tr className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                                            <th className="py-3 px-4">Client</th>
                                            <th className="py-3 px-4">Invoice #</th>
                                            <th className="py-3 px-4">Date</th>
                                            <th className="py-3 px-4 text-right">Owes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unpaidInvoices.map(inv => {
                                            const paid = inv.payments?.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0) || 0;
                                            const owes = inv.total - paid;
                                            return (
                                                <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                    <td className="py-3 px-4 font-bold text-white">{inv.client?.name || 'Unknown'}</td>
                                                    <td className="py-3 px-4 text-muted-foreground">#{inv.number}</td>
                                                    <td className="py-3 px-4 text-muted-foreground">{new Date(inv.date).toLocaleDateString()}</td>
                                                    <td className="py-3 px-4 text-right font-black text-orange-400">{formatCurrency(owes)}</td>
                                                </tr>
                                            )
                                        })}
                                        {unpaidInvoices.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No outstanding invoices.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {drillDownType === 'PROJECTS' && (
                            <div className="space-y-4">
                                <table className="w-full text-sm text-left">
                                    <thead className="[&_tr]:border-b border-white/10">
                                        <tr className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                                            <th className="py-3 px-4">Project</th>
                                            <th className="py-3 px-4">Client</th>
                                            <th className="py-3 px-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeProjectsList.map(p => (
                                            <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                                                <td className="py-3 px-4 text-muted-foreground">{p.client?.name}</td>
                                                <td className="py-3 px-4">
                                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{p.status.replace('_', ' ')}</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {(drillDownType === 'REVENUE' || drillDownType === 'EXPENSES') && (
                            <div className="space-y-4">
                                <p className="text-muted-foreground text-sm">Showing transactions for the selected period ({timePeriod === '3M' ? '3 Months' : timePeriod === '6M' ? '6 Months' : timePeriod === '1Y' ? '1 Year' : 'All Time'}).</p>
                                <table className="w-full text-sm text-left">
                                    <thead className="[&_tr]:border-b border-white/10">
                                        <tr className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                                            <th className="py-3 px-4">Date</th>
                                            <th className="py-3 px-4">Description</th>
                                            <th className="py-3 px-4">Category</th>
                                            <th className="py-3 px-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions.filter(t => drillDownType === 'REVENUE' ? t.type === 'INCOME' : t.type === 'EXPENSE').map(t => (
                                            <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                <td className="py-3 px-4 text-muted-foreground">{new Date(t.date).toLocaleDateString()}</td>
                                                <td className="py-3 px-4 font-medium text-white">{t.description}</td>
                                                <td className="py-3 px-4"><Badge variant="outline" className="bg-white/5 border-white/10">{t.category}</Badge></td>
                                                <td className={`py-3 px-4 text-right font-black ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(Number(t.amount) || 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

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
