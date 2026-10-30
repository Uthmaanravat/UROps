"use client"

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Sidebar } from "@/components/layout/Sidebar";
import { UserCircle, Menu, X, LogOut, Rocket, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CompanySettings, User } from "@prisma/client";
import { signOutAction, updateUserRoleAction } from "@/app/actions/auth";
import { Role } from "@prisma/client";
import { useTheme } from "@/components/theme-provider";
import { setActiveCompanyId, clearDraftStateOnLogout } from "@/lib/drafts";

export default function DashboardLayoutClient({
    children,
    user,
    settings,
    pendingApprovals = [],
    changesRequestedQuotes = [],
    standbyApprovals = [],
}: {
    children: React.ReactNode;
    user: User;
    settings: CompanySettings | null;
    pendingApprovals?: any[];
    changesRequestedQuotes?: any[];
    standbyApprovals?: any[];
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUpdatingRole, setIsUpdatingRole] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { setTheme } = useTheme();
    const pathname = usePathname();
    const router = useRouter();

    // Client-side defense-in-depth for CREW role
    useEffect(() => {
        if ((user?.role as string) === 'CREW' && pathname && pathname !== '/my-jobs' && !pathname.startsWith('/my-jobs/')) {
            router.replace('/my-jobs');
        }
    }, [user?.role, pathname, router]);

    // Ensure company theme is applied on load and workspace switch, isolated per business ID
    useEffect(() => {
        if (settings?.theme && user?.companyId) {
            setTheme(settings.theme, user.companyId);
        }
    }, [settings?.theme, user?.companyId, setTheme]);

    console.log("DashboardLayoutClient rendering for role:", user.role);

    const handleRoleSwitch = async () => {
        if (isUpdatingRole) return;
        setIsUpdatingRole(true);
        try {
            const newRole = user.role === 'ADMIN' ? 'MANAGER' : 'ADMIN';
            console.log("Switching role to:", newRole);
            const result = await updateUserRoleAction(user.id, newRole);
            if (result.success) {
                window.location.reload();
            }
        } catch (error) {
            console.error("Failed to switch role:", error);
        } finally {
            setIsUpdatingRole(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col md:flex-row bg-background text-foreground">
            {/* Desktop Sidebar */}
            <aside className="hidden w-64 border-r bg-[#0F0F1A] p-4 md:flex flex-col gap-6 sticky top-0 h-screen overflow-x-hidden">
                <div className="flex items-center gap-3 px-2">
                    <div className="shrink-0 relative">
                        {settings?.logoUrl ? (
                            <img
                                src={settings.logoUrl}
                                alt="Logo"
                                width={48}
                                height={48}
                                style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                                className="h-12 w-12 rounded-xl object-contain bg-white/5 p-1.5 border border-white/5 shadow-2xl"
                            />
                        ) : (
                            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20 shadow-lg shadow-primary/10">
                                <Rocket className="h-6 w-6" />
                            </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-primary rounded-full border-2 border-[#0F0F1A] shadow-lg" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 truncate">Network Dashboard</span>
                        <span className="text-sm font-bold text-white truncate leading-tight">{settings?.name || "UROps"}</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <Sidebar role={user.role} settings={settings} />
                </div>
                <div className="border-t border-white/5 pt-6 space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                            <UserCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-bold text-white truncate">{user.name || user.email}</span>
                            <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground/50">Active Session</span>
                        </div>
                    </div>
                    {(user as any).isOwner && (
                    <div className="px-1">
                        <button
                            onClick={handleRoleSwitch}
                            disabled={isUpdatingRole}
                            className={cn(
                                "group relative flex items-center justify-between w-full rounded-xl px-3 py-2.5 transition-all",
                                user.role === 'ADMIN'
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                    : "bg-white/[0.03] text-muted-foreground border border-white/5 hover:bg-white/[0.05]",
                                isUpdatingRole && "opacity-50 cursor-wait"
                            )}
                        >
                            <div className="flex flex-col items-start leading-none text-left">
                                <span className="text-[7px] uppercase tracking-widest opacity-60 mb-1">Current Workspace</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">{isUpdatingRole ? "Updating..." : user.role}</span>
                            </div>
                            <Rocket className={cn("h-3.5 w-3.5", isUpdatingRole && "animate-spin")} />
                        </button>
                    </div>
                    )}
                    <button
                        onClick={async () => {
                            setIsLoggingOut(true);
                            await signOutAction();
                        }}
                        disabled={isLoggingOut}
                        className="flex w-full items-center justify-center gap-2 h-10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-red-400 hover:bg-red-400/5 transition-all disabled:opacity-50"
                    >
                        {isLoggingOut ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                        <span>{isLoggingOut ? "Ending..." : "End Session"}</span>
                    </button>
                    <div className="px-2 pt-2 border-t border-white/5 flex flex-col items-center">
                        <p className="text-[7px] text-muted-foreground/30 uppercase tracking-[0.3em] font-black">Build MVP-FEBRUARY-V6.2</p>
                    </div>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="flex h-14 items-center border-b px-4 md:hidden bg-card/80 backdrop-blur-md justify-between sticky top-0 z-50">
                <div className="font-bold flex items-center gap-2.5">
                    {settings?.logoUrl ? (
                        <img
                            src={settings.logoUrl}
                            alt="Logo"
                            width={32}
                            height={32}
                            style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                            className="h-8 w-8 rounded-lg object-contain"
                        />
                    ) : (
                        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                            <Rocket className="h-4 w-4" />
                        </div>
                    )}
                    <div className="flex flex-col -gap-1">
                        <span className="text-xs font-black uppercase tracking-widest text-primary drop-shadow-sm">UROps</span>
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest truncate max-w-[80px]">{settings?.name || "Suite"}</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="text-primary hover:bg-primary/10 transition-colors"
                >
                    {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </Button>
            </header>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-64 bg-[#0F0F1A] p-0 border-r border-white/5 shadow-2xl transition-transform duration-300 ease-out md:hidden flex flex-col overflow-x-hidden",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="shrink-0 relative">
                            {settings?.logoUrl ? (
                                <img
                                    src={settings.logoUrl}
                                    alt="Logo"
                                    width={36}
                                    height={36}
                                    style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                                    className="h-9 w-9 rounded-xl object-contain bg-white/5 p-1 border border-white/5 shadow-xl"
                                />
                            ) : (
                                <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                                    <Rocket className="h-4.5 w-4.5" />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/80 truncate">Network Dashboard</span>
                            <span className="text-xs font-bold text-white truncate">{settings?.name || "UROps"}</span>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)} className="text-muted-foreground hover:bg-white/5 h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
                    <Sidebar role={user.role} settings={settings} onItemClick={() => setIsMobileMenuOpen(false)} />
                </div>
                <div className="p-4 border-t bg-white/[0.02] space-y-4">
                    {(user as any).isOwner && (
                    <button
                        onClick={handleRoleSwitch}
                        disabled={isUpdatingRole}
                        className={cn(
                            "group relative flex items-center justify-between w-full rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
                            user.role === 'ADMIN'
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "bg-white/5 text-muted-foreground border border-white/5",
                            isUpdatingRole && "opacity-50 cursor-wait"
                        )}
                    >
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-[8px] normal-case tracking-normal opacity-50 mb-1">Current Workspace</span>
                            <span>{isUpdatingRole ? "Switching..." : user.role === 'ADMIN' ? 'Administrator' : 'Project Manager'}</span>
                        </div>
                        <Rocket className={cn("h-4 w-4", isUpdatingRole && "animate-spin")} />
                    </button>
                    )}
                    <button
                        onClick={async () => {
                            setIsLoggingOut(true);
                            await signOutAction();
                        }}
                        disabled={isLoggingOut}
                        className="flex w-full items-center justify-center gap-2 px-4 h-12 rounded-xl bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-all font-black text-xs uppercase tracking-widest active:scale-95 disabled:opacity-50"
                    >
                        {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                        <span>{isLoggingOut ? "Ending Session..." : "Logout Session"}</span>
                    </button>
                    <p className="text-[8px] text-center font-bold text-muted-foreground/20 uppercase tracking-[0.2em] pb-1">
                        Build MVP-FEBRUARY-V6.2
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {pendingApprovals && pendingApprovals.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200 shadow-md">
                        <div className="flex items-center gap-2.5 font-medium">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                            </span>
                            <span className="font-black text-amber-400 uppercase tracking-widest text-[11px]">Owner Action Required:</span>
                            <span>{pendingApprovals.length} quotation(s) exceeding R{(settings?.approvalThreshold || 50000).toLocaleString()} awaiting your 1-click approval</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {pendingApprovals.slice(0, 3).map((q: any) => (
                                <Link
                                    key={q.id}
                                    href={`/invoices/${q.id}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/30 transition-all text-[11px]"
                                >
                                    <span>{q.quoteNumber || 'Quote'} ({q.clientName} – R{q.total.toLocaleString()})</span>
                                    <span>→</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
                {changesRequestedQuotes && changesRequestedQuotes.length > 0 && (
                    <div className="bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-rose-500/10 border-b border-rose-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-200 shadow-md">
                        <div className="flex items-center gap-2.5 font-medium">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                            </span>
                            <span className="font-black text-rose-400 uppercase tracking-widest text-[11px]">Changes Requested:</span>
                            <span>{changesRequestedQuotes.length} quotation(s) sent back by owner for revisions</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {changesRequestedQuotes.slice(0, 3).map((q: any) => (
                                <Link
                                    key={q.id}
                                    href={`/invoices/${q.id}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold border border-rose-500/30 transition-all text-[11px]"
                                    title={q.note}
                                >
                                    <span>{q.quoteNumber || 'Quote'} ({q.clientName}): &ldquo;{q.note.slice(0, 35)}...&rdquo;</span>
                                    <span>→</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
                {standbyApprovals && standbyApprovals.length > 0 && (
                    <div className="bg-gradient-to-r from-orange-500/20 via-amber-500/15 to-orange-500/10 border-b border-orange-500/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-orange-100 shadow-md">
                        <div className="flex items-center gap-2 font-semibold">
                            <span className="font-black text-orange-300 uppercase tracking-widest text-[11px]">Standby / Return Attendance Flagged:</span>
                            <span>{standbyApprovals.length} site job(s) paused due to client stop or restricted site access — review charge</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {standbyApprovals.slice(0, 3).map((s: any) => (
                                <Link
                                    key={s.jobSheetId}
                                    href={`/projects/${s.projectId}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/25 hover:bg-orange-500/35 text-orange-200 font-bold border border-orange-400/30 transition-all text-[11px]"
                                >
                                    <span>{s.projectName} ({s.reason.replace('_', ' ')}) →</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
                <main className="flex-1 p-3 md:p-4 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
