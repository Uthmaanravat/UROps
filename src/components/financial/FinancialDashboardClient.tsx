"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { Upload, Plus, TrendingUp, TrendingDown, DollarSign, Brain, Loader2, ArrowUpRight, ArrowDownRight, Briefcase } from "lucide-react"
import { processBankStatementAction, addManualTransactionAction } from "@/app/(dashboard)/financial-dashboard/actions"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function FinancialDashboardClient({ invoices, transactions }: { invoices: any[], transactions: any[] }) {
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
            // Reset form
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
    const totalInvoiced = invoices.reduce((acc, inv) => acc + inv.total, 0);
    const totalPaid = invoices.reduce((acc, inv) => acc + inv.payments.reduce((pAcc: number, p: any) => pAcc + p.amount, 0), 0);
    const outstandingInvoices = totalInvoiced - totalPaid;

    // From Transactions
    const currentMonthTransactions = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyRevenue = currentMonthTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const monthlyExpenses = currentMonthTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    const netProfit = monthlyRevenue - monthlyExpenses;

    const totalRevenue = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);

    // Expense Categories
    const expenseCategories = transactions.filter(t => t.type === 'EXPENSE').reduce((acc: Record<string, number>, t) => {
        const cat = t.category || 'Miscellaneous';
        acc[cat] = (acc[cat] || 0) + t.amount;
        return acc;
    }, {});

    const sortedCategories = Object.entries(expenseCategories).sort((a, b) => b[1] - a[1]);
    const maxCategoryAmount = sortedCategories.length > 0 ? sortedCategories[0][1] : 1;

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
        }).reduce((acc, t) => acc + t.amount, 0);

        const mExpense = transactions.filter(t => {
            const td = new Date(t.date);
            return td.getMonth() === m && td.getFullYear() === y && t.type === 'EXPENSE';
        }).reduce((acc, t) => acc + t.amount, 0);

        trendData.push({ month: months[m], income: mIncome, expense: mExpense });
    }

    const maxTrendAmount = Math.max(...trendData.flatMap(d => [d.income, d.expense]), 1);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Financial Insights</h1>
                    <p className="text-muted-foreground text-sm font-medium">Business analytics & accounting preparation</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="flex-1 md:flex-none border-primary/20 hover:border-primary/50 text-white font-bold">
                                <Plus className="mr-2 h-4 w-4" /> Add Record
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] border-primary/20 bg-[#0F0F1A]">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black uppercase text-primary">Add Transaction</DialogTitle>
                                <DialogDescription>Manual entry for income or expense.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddTransaction} className="space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Type</Label>
                                        <select
                                            value={type}
                                            onChange={(e) => setType(e.target.value as 'INCOME' | 'EXPENSE')}
                                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="INCOME">Income</option>
                                            <option value="EXPENSE">Expense</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="bg-transparent" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input placeholder="e.g. Paint Supplies" value={description} onChange={e => setDescription(e.target.value)} required className="bg-transparent" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Amount (R)</Label>
                                        <Input type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required className="bg-transparent font-black" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background"
                                        >
                                            {type === 'EXPENSE' ? (
                                                <>
                                                    <option value="Materials">Materials</option>
                                                    <option value="Salaries/Wages">Salaries/Wages</option>
                                                    <option value="Subcontractors">Subcontractors</option>
                                                    <option value="Equipment">Equipment</option>
                                                    <option value="Fuel/Transport">Fuel/Transport</option>
                                                    <option value="Office/Admin">Office/Admin</option>
                                                    <option value="Utilities">Utilities</option>
                                                    <option value="Miscellaneous">Miscellaneous</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="Project Revenue">Project Revenue</option>
                                                    <option value="Consulting">Consulting</option>
                                                    <option value="Other Income">Other Income</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isAddingTransaction} className="w-full bg-primary text-black font-black hover:bg-primary/90 mt-4">
                                        {isAddingTransaction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        Save Transaction
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <div className="relative flex-1 md:flex-none">
                        <input
                            type="file"
                            accept=".pdf,.csv,.txt"
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isUploading}
                        />
                        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                            AI Statement Upload
                        </Button>
                    </div>
                </div>
            </div>

            {/* AI Warning / Messages */}
            {uploadError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2">
                    ❌ {uploadError}
                </div>
            )}
            {uploadSuccess && (
                <div className="bg-primary/10 border border-primary/50 text-primary px-4 py-3 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-2">
                    ✅ {uploadSuccess}
                </div>
            )}
            
            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-3 rounded-xl text-xs font-medium flex items-start gap-3">
                <Brain className="h-5 w-5 shrink-0 mt-0.5" />
                <p><strong>Disclaimer:</strong> This dashboard is an AI-assisted tool for internal business tracking and preparation. It does NOT replace a licensed accountant or official tax software. Verify all auto-categorized transactions.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-[#14141E] border-white/5 shadow-xl hover:border-primary/30 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Monthly Revenue</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-white">{formatCurrency(monthlyRevenue)}</div>
                        <p className="text-xs text-muted-foreground mt-1">This month</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E] border-white/5 shadow-xl hover:border-primary/30 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Monthly Expenses</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                            <TrendingDown className="h-4 w-4 text-red-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-white">{formatCurrency(monthlyExpenses)}</div>
                        <p className="text-xs text-muted-foreground mt-1">This month</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E] border-white/5 shadow-xl hover:border-primary/30 transition-colors relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-primary uppercase tracking-widest">Net Profit</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                            <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-black drop-shadow-md ${netProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                            {formatCurrency(netProfit)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">This month</p>
                    </CardContent>
                </Card>

                <Card className="bg-[#14141E] border-white/5 shadow-xl hover:border-primary/30 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Outstanding</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                            <Briefcase className="h-4 w-4 text-orange-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-white">{formatCurrency(outstandingInvoices)}</div>
                        <p className="text-xs text-muted-foreground mt-1">From Unpaid Invoices</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Visual Trend Chart */}
                <Card className="bg-[#14141E] border-white/5 shadow-2xl col-span-1 md:col-span-2 lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="uppercase tracking-widest text-primary/80 text-sm font-black">6-Month Trend</CardTitle>
                        <CardDescription>Income vs Expenses</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 flex items-end gap-2 sm:gap-4 pt-4">
                            {trendData.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                                    <div className="flex gap-1 w-full justify-center h-[200px] items-end relative">
                                        {/* Income Bar */}
                                        <div 
                                            className="w-1/3 bg-emerald-500/80 rounded-t-sm hover:bg-emerald-400 transition-all relative"
                                            style={{ height: `${Math.max((d.income / maxTrendAmount) * 100, 2)}%` }}
                                        >
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded font-bold pointer-events-none z-10 whitespace-nowrap border border-white/10">
                                                +{formatCurrency(d.income)}
                                            </div>
                                        </div>
                                        {/* Expense Bar */}
                                        <div 
                                            className="w-1/3 bg-red-500/80 rounded-t-sm hover:bg-red-400 transition-all relative"
                                            style={{ height: `${Math.max((d.expense / maxTrendAmount) * 100, 2)}%` }}
                                        >
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded font-bold pointer-events-none z-10 whitespace-nowrap border border-white/10">
                                                -{formatCurrency(d.expense)}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{d.month}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-emerald-500/80 rounded-sm" />
                                <span className="text-xs font-bold text-muted-foreground">Income</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500/80 rounded-sm" />
                                <span className="text-xs font-bold text-muted-foreground">Expenses</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Expense Categories Breakdown */}
                <Card className="bg-[#14141E] border-white/5 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="uppercase tracking-widest text-primary/80 text-sm font-black">Expense Breakdown</CardTitle>
                        <CardDescription>By Category (All Time)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-[280px] overflow-y-auto pr-2 scrollbar-thin">
                            {sortedCategories.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-10 italic">No expenses recorded yet.</p>
                            ) : (
                                sortedCategories.map(([cat, amt]) => {
                                    const percentage = (amt / totalExpenses) * 100;
                                    return (
                                        <div key={cat} className="space-y-2 group">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-white group-hover:text-primary transition-colors">{cat}</span>
                                                <div className="flex gap-3">
                                                    <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
                                                    <span className="text-white">{formatCurrency(amt)}</span>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-primary/70 rounded-full group-hover:bg-primary transition-all duration-500" 
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Transactions Table */}
            <Card className="bg-[#14141E] border-white/5 shadow-2xl">
                <CardHeader>
                    <CardTitle className="uppercase tracking-widest text-primary/80 text-sm font-black">Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="[&_tr]:border-b border-white/10">
                                <tr className="border-b transition-colors hover:bg-muted/50 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                                    <th className="h-10 px-4 align-middle">Date</th>
                                    <th className="h-10 px-4 align-middle">Description</th>
                                    <th className="h-10 px-4 align-middle">Category</th>
                                    <th className="h-10 px-4 align-middle">Source</th>
                                    <th className="h-10 px-4 align-middle text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-muted-foreground italic">No transactions found. Upload a bank statement or add manually.</td>
                                    </tr>
                                ) : (
                                    transactions.slice(0, 15).map((t) => (
                                        <tr key={t.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                                            <td className="p-3 align-middle text-muted-foreground">{new Date(t.date).toLocaleDateString()}</td>
                                            <td className="p-3 align-middle font-medium text-white">{t.description}</td>
                                            <td className="p-3 align-middle">
                                                <span className="bg-white/5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-primary/80">
                                                    {t.category || "Misc"}
                                                </span>
                                            </td>
                                            <td className="p-3 align-middle text-muted-foreground text-xs">{t.source}</td>
                                            <td className={`p-3 align-middle text-right font-black ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-white'}`}>
                                                {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
