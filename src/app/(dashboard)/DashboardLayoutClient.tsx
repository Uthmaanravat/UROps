"use client"

import { Sidebar } from "@/components/layout/Sidebar";
import { UserCircle, Menu, X, LogOut, Rocket, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CompanySettings, User } from "@prisma/client";
import { signOutAction, updateUserRoleAction } from "@/app/actions/auth";
import { Role } from "@prisma/client";

export default function DashboardLayoutClient({
    children,
    user,
    settings,
}: {
    children: React.ReactNode;
    user: User;
    settings: CompanySettings | null;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUpdatingRole, setIsUpdatingRole] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

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
                <div className="flex-1 overflow-hidden">
                    <Sidebar role={user.role} />
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
                        <p className="text-[7px] text-muted-foreground/30 uppercase tracking-[0.3em] font-black">Build v2.1.0-alpha</p>
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
                <div className="flex-1 overflow-hidden py-2">
                    <Sidebar role={user.role} onItemClick={() => setIsMobileMenuOpen(false)} />
                </div>
                <div className="p-4 border-t bg-white/[0.02] space-y-4">
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
                <main className="flex-1 p-3 md:p-4 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
