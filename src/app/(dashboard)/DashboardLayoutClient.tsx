"use client"

import { Sidebar } from "@/components/layout/Sidebar";
import { UserCircle, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LogOut, Rocket } from "lucide-react";
import { CompanySettings, User } from "@prisma/client";
import { signOutAction, updateUserRoleAction } from "@/app/actions/auth";
import { Role } from "@prisma/client";

export default function DashboardLayout({
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
            <aside className="hidden w-64 border-r bg-card p-4 md:flex flex-col gap-4 sticky top-0 h-screen">
                <div className="flex items-center gap-3 px-2 font-bold text-primary">
                    {settings?.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo" className="h-14 w-14 rounded-lg object-contain" />
                    ) : (
                        <div className="h-14 w-14 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                            <Rocket className="h-8 w-8" />
                        </div>
                    )}
                    <span className="text-sm leading-tight opacity-70">{settings?.name || "UROps"}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                    <Sidebar role={user.role} />
                </div>
                <div className="border-t pt-4 space-y-2">
                    <div className="flex items-center gap-2 px-2 text-sm text-white font-medium">
                        <UserCircle className="h-5 w-5 text-primary" />
                        <span className="truncate">{user.name || user.email}</span>
                    </div>
                    <div className="px-1">
                        <button
                            onClick={handleRoleSwitch}
                            disabled={isUpdatingRole}
                            className={cn(
                                "group relative flex items-center justify-between w-full rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                user.role === 'ADMIN'
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                    : "bg-white/5 text-muted-foreground border border-white/5",
                                isUpdatingRole && "opacity-50 cursor-wait"
                            )}
                        >
                            <div className="flex flex-col items-start leading-none">
                                <span className="text-[8px] normal-case tracking-normal opacity-50 mb-1">Current Role</span>
                                <span>{isUpdatingRole ? "Updating..." : user.role}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-50">
                                <span className="text-[8px] normal-case tracking-normal">Switch</span>
                                <Rocket className={cn("h-3 w-3", isUpdatingRole && "animate-spin")} />
                            </div>
                        </button>
                    </div>
                    <button
                        onClick={async () => {
                            setIsLoggingOut(true);
                            await signOutAction();
                        }}
                        disabled={isLoggingOut}
                        className="flex w-full items-center gap-2 px-2 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                        <LogOut className={cn("h-4 w-4", isLoggingOut && "animate-spin")} />
                        <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
                    </button>
                    <div className="px-2 pb-1">
                        <p className="text-[8px] text-muted-foreground uppercase tracking-widest opacity-30 italic">Build: FEB 05 V1.0.1</p>
                    </div>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="flex h-16 items-center border-b px-4 md:hidden bg-card justify-between sticky top-0 z-50">
                <div className="font-bold flex items-center gap-3">
                    {settings?.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo" className="h-12 w-12 rounded-lg object-contain" />
                    ) : (
                        <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                            <Rocket className="h-6 w-6" />
                        </div>
                    )}
                    <span className="text-sm leading-tight opacity-70">{settings?.name || "UROps"}</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 rounded-md hover:bg-muted transition-colors"
                >
                    {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
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
                "fixed inset-y-0 left-0 z-50 w-64 bg-card p-4 border-r shadow-lg transition-transform duration-300 ease-in-out md:hidden flex flex-col gap-4",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 px-2 font-bold text-primary">
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="h-14 w-14 rounded-lg object-contain" />
                        ) : (
                            <div className="h-14 w-14 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                                <Rocket className="h-8 w-8" />
                            </div>
                        )}
                        <span className="text-sm leading-tight opacity-70">{settings?.name || "UROps"}</span>
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)}><X className="h-5 w-5" /></button>
                </div>
                <div className="flex-1 overflow-hidden py-2">
                    <Sidebar role={user.role} onItemClick={() => setIsMobileMenuOpen(false)} />
                </div>
                <div className="border-t pt-4 space-y-2">
                    <div className="flex items-center gap-2 px-2 text-sm text-white font-medium">
                        <UserCircle className="h-5 w-5 text-primary" />
                        <span className="truncate">{user.name || user.email}</span>
                    </div>
                    <div className="px-1">
                        <button
                            onClick={handleRoleSwitch}
                            disabled={isUpdatingRole}
                            className={cn(
                                "group relative flex items-center justify-between w-full rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                user.role === 'ADMIN'
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                    : "bg-white/5 text-muted-foreground border border-white/5",
                                isUpdatingRole && "opacity-50 cursor-wait"
                            )}
                        >
                            <div className="flex flex-col items-start leading-none">
                                <span className="text-[8px] normal-case tracking-normal opacity-50 mb-1">Current Role</span>
                                <span>{isUpdatingRole ? "Updating..." : user.role}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-50">
                                <span className="text-[8px] normal-case tracking-normal">Switch</span>
                                <Rocket className={cn("h-3 w-3", isUpdatingRole && "animate-spin")} />
                            </div>
                        </button>
                    </div>
                    <button
                        onClick={async () => {
                            setIsLoggingOut(true);
                            await signOutAction();
                        }}
                        disabled={isLoggingOut}
                        className="flex w-full items-center gap-2 px-2 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                        <LogOut className={cn("h-4 w-4", isLoggingOut && "animate-spin")} />
                        <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
                    </button>
                    <div className="px-2 pb-1 text-right">
                        <p className="text-[8px] text-muted-foreground uppercase tracking-widest opacity-30 italic">Build: FEB 05 V1.0.1</p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <main className="flex-1 p-4 md:p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
