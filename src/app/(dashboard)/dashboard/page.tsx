import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Users, FileText, CreditCard, AlertTriangle, Briefcase, Calendar, Settings } from "lucide-react";
import Link from "next/link";
import { RejectScopeButton } from "./RejectScopeButton";
import { ensureAuth } from "@/lib/auth-actions";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const companyId = await ensureAuth();
    let clientCount = 0;
    let invoiceCount = 0;
    let unpaidCount = 0;
    let totalRevenue = 0;
    let unpaidTotal = 0;
    let projectCount = 0;
    let activeProjects: any[] = [];
    let recentInvoices: any[] = [];
    let upcomingMeetings: any[] = [];
    let recentInteractions: any[] = [];
    let pendingScopes: any[] = [];
    let unpaidInvoices: any[] = [];
    let trackingCounts = { sow: 0, quotation: 0, invoice: 0, payment: 0 };

    try {
        const [clients, invoices, payments, unpaidInvs, recent, meetings, interactions, projects, scopes, sowCount, quoteCount, invoicedCount, paidCount, allUnpaidInvoices] = await Promise.all([
            prisma.client.count({ where: { companyId } }),
            prisma.invoice.count({ where: { companyId } }),
            // Optimized: Use aggregate for revenue instead of fetching all payments
            // prisma.payment.findMany({ where: { companyId } }), 
            prisma.payment.aggregate({
                where: { companyId },
                _sum: { amount: true }
            }),
            prisma.invoice.findMany({
                where: {
                    companyId,
                    type: 'INVOICE',
                    status: { notIn: ['PAID', 'CANCELLED'] }
                },
                include: { payments: true },
                orderBy: { date: 'desc' }, // Add ordering
                take: 50 // Limit to 50 unpaid invoices for display list to prevent crash
            }),
            prisma.invoice.findMany({
                where: { companyId },
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { client: true }
            }),
            (prisma as any).meeting.findMany({
                where: { companyId, date: { gte: new Date() } },
                orderBy: { date: 'asc' },
                take: 5,
                include: { client: true }
            }),
            (prisma as any).interaction.findMany({
                where: { companyId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { client: true }
            }),
            (prisma as any).project.findMany({
                where: {
                    companyId,
                    status: {
                        in: ['IN_PROGRESS', 'PLANNING', 'SCHEDULED', 'QUOTED', 'INVOICED', 'SOW_SUBMITTED']
                    }
                },
                include: { client: true },
                orderBy: { updatedAt: 'desc' },
                take: 5
            }),
            (prisma as any).invoice.findMany({
                where: { companyId, type: 'QUOTE', status: 'DRAFT' },
                include: { client: true, project: true },
                orderBy: { createdAt: 'desc' }
            }),

            (prisma as any).scopeOfWork?.count({ where: { companyId } }) || 0, // Total Scopes
            (prisma as any).invoice.count({ where: { companyId, type: 'QUOTE' } }), // Total Quotes
            (prisma as any).invoice.count({ where: { companyId, type: 'INVOICE', status: { notIn: ['DRAFT', 'CANCELLED'] } } }), // Count Issued Invoices
            (prisma as any).invoice.count({ where: { companyId, status: 'PAID' } }), // Count Paid
            prisma.invoice.findMany({
                where: { companyId, type: 'INVOICE', status: { notIn: ['PAID', 'CANCELLED'] } },
                select: { total: true, payments: { select: { amount: true } } }
            })
        ]);
        unpaidInvoices = unpaidInvs;

        allUnpaidInvoices.forEach(inv => {
            const paid = inv.payments.reduce((acc, p) => acc + p.amount, 0);
            if (paid < inv.total) {
                unpaidTotal += (inv.total - paid);
                // We count total unpaid count from here to be accurate
            }
        });
        unpaidCount = allUnpaidInvoices.filter(i => {
            const p = i.payments.reduce((a, b) => a + b.amount, 0);
            return p < i.total - 0.01;
        }).length;

        // Assign the limited list to the UI variable
        unpaidInvoices = unpaidInvs; // This is the detailed list (limit 50)
        // projectCount is now a list
        activeProjects = projects;
        projectCount = await (prisma as any).project.count({
            where: {
                companyId,
                status: {
                    in: ['IN_PROGRESS', 'PLANNING', 'SCHEDULED', 'QUOTED', 'INVOICED', 'SOW_SUBMITTED']
                }
            }
        });
        pendingScopes = scopes;

        // ... existing codes ...

        trackingCounts = {
            sow: sowCount,
            quotation: quoteCount,
            invoice: invoicedCount,
            payment: paidCount
        };

        // Logic moved above for optimization
        /* 
         * Previous logic removed to prevent double calculation
         */
    } catch (e) {
        console.error("Dashboard DB Error:", e);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/payments" className="block cursor-pointer">
                    <Card className="hover:bg-accent transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue (Unpaid)</CardTitle>
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(unpaidTotal)}</div>
                            <p className="text-xs text-muted-foreground">Outstanding balance</p>
                        </CardContent>
                    </Card>
                </Link>

                <Card className="col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Progress Projects</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 mt-2">
                            {/* @ts-ignore */}
                            {activeProjects.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No active projects.</p>
                            ) : (
                                // @ts-ignore
                                activeProjects.map((proj: any) => (
                                    <Link key={proj.id} href={`/projects/${proj.id}`} className="block">
                                        <div className="flex items-center justify-between p-2 rounded-md border bg-muted/40 hover:bg-muted transition-colors">
                                            <div>
                                                <div className="font-semibold text-sm">{proj.name}</div>
                                            </div>
                                            <div className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                                {proj.workflowStage}
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className={unpaidCount > 0 ? "border-yellow-500/50" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${unpaidCount > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${unpaidCount > 0 ? "text-yellow-500" : ""}`}>{unpaidCount} Unpaid Invoices</div>
                        {unpaidInvoices.map(inv => (
                            <Link key={inv.id} href={`/invoices/${inv.id}`} className="block text-xs font-bold text-primary hover:underline">
                                INV-{String(inv.number).padStart(4, '0')}
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Awaiting Pricing Scopes */}
            {pendingScopes.length > 0 && (
                <Card className="border-yellow-500/50 bg-yellow-500/5">
                    <CardHeader className="py-3 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Scopes Awaiting Pricing</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">Submitted by PMs for quotation generation.</p>
                        </div>
                        <div className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                            {pendingScopes.length} ACTION REQUIRED
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 py-3">
                        {pendingScopes.map((scope: any) => (
                            <Link key={scope.id} href={scope.isQuote ? `/invoices/${scope.id}` : `/projects/${scope.id}`}>
                                <Card className="p-3 border-yellow-500/20 hover:border-yellow-500 transition-colors shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-sm">#{scope.number}</p>
                                            <p className="text-xs font-medium">{scope.client?.name}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <RejectScopeButton id={scope.id} />
                                            <Button size="icon" variant="ghost" className="h-6 w-6">
                                                <FileText className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-2 truncate">{scope.site || "No site specified"}</p>
                                </Card>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            )}


            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Column 1: Main Feed */}
                <div className="col-span-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Upcoming Meetings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {upcomingMeetings.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No upcoming meetings.</p>
                                ) : (
                                    upcomingMeetings.map(m => (
                                        <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-blue-50/50">
                                            <div className="flex gap-3 items-center">
                                                <div className="bg-white p-2 rounded shadow-sm text-center min-w-[50px]">
                                                    <div className="text-[10px] uppercase text-muted-foreground font-bold">{new Date(m.date).toLocaleString('default', { month: 'short' })}</div>
                                                    <div className="text-xl font-bold">{new Date(m.date).getDate()}</div>
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{m.title}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {m.client?.name}
                                                    </div>
                                                </div>
                                            </div>
                                            <Link href="/calendar">
                                                <Button variant="ghost" size="sm">View</Button>
                                            </Link>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Navigation</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <Link href="/projects" className="block">
                                    <div className="rounded-lg border p-4 hover:bg-accent transition-colors">
                                        <Briefcase className="h-8 w-8 mb-2 text-primary" />
                                        <div className="font-medium">Projects</div>
                                        <div className="text-sm text-muted-foreground">{projectCount} active</div>
                                    </div>
                                </Link>
                                <Link href="/calendar" className="block">
                                    <div className="rounded-lg border p-4 hover:bg-accent transition-colors">
                                        <Calendar className="h-8 w-8 mb-2 text-primary" />
                                        <div className="font-medium">Calendar</div>
                                        <div className="text-sm text-muted-foreground">Meetings & Deadlines</div>
                                    </div>
                                </Link>
                                <Link href="/clients" className="block">
                                    <div className="rounded-lg border p-4 hover:bg-accent transition-colors">
                                        <Users className="h-8 w-8 mb-2 text-primary" />
                                        <div className="font-medium">CRM</div>
                                        <div className="text-sm text-muted-foreground">Client Management</div>
                                    </div>
                                </Link>
                                <Link href="/settings" className="block">
                                    <div className="rounded-lg border p-4 hover:bg-accent transition-colors">
                                        <Settings className="h-8 w-8 mb-2 text-primary" />
                                        <div className="font-medium">Settings</div>
                                        <div className="text-sm text-muted-foreground">Company Branding</div>
                                    </div>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Column 2: Side Feed */}
                <div className="col-span-3 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent CRM Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {recentInteractions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No recent interactions.</p>
                                ) : (
                                    recentInteractions.map(int => (
                                        <div key={int.id} className="border-l-2 border-primary/30 pl-3 py-1">
                                            <div className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                                {!int.read && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                                                {int.type} • {new Date(int.date).toLocaleDateString()}
                                            </div>
                                            <div className="text-sm line-clamp-2">{int.content}</div>
                                            <div className="text-[10px] text-primary">{int.client?.name}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Invoices</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {recentInvoices.map(inv => (
                                    <Link key={inv.id} href={`/invoices/${inv.id}`} className="block">
                                        <div className="flex items-center justify-between p-2 rounded hover:bg-accent transition-colors text-xs">
                                            <div>
                                                <div className="font-medium">#{inv.number} - {inv.client?.name}</div>
                                                <div className="text-muted-foreground">{inv.type} • {inv.status}</div>
                                            </div>
                                            <div className="font-bold">{formatCurrency(inv.total)}</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
