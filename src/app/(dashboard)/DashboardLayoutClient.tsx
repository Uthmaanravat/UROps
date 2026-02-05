"use client"

import { Sidebar } from "@/components/layout/Sidebar";
import { UserCircle, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { User } from "@prisma/client";
import { signOutAction } from "@/app/actions/auth";
import { LogOut } from "lucide-react";

export default function DashboardLayout({
    children,
    user,
}: {
    children: React.ReactNode;
    user: User;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex min-h-screen flex-col md:flex-row bg-background text-foreground">
            {/* Desktop Sidebar */}
            <aside className="hidden w-64 border-r bg-card p-4 md:flex flex-col gap-4 sticky top-0 h-screen">
                <div className="flex items-center gap-2 px-2 font-bold text-xl text-primary">
                    <div className="h-8 w-8 rounded-lg bg-primary " />
                    UROps
                </div>
                <Sidebar role={user.role} />
                <div className="mt-auto border-t pt-4 space-y-2">
                    <div className="flex items-center gap-2 px-2 text-sm text-white font-medium">
                        <UserCircle className="h-5 w-5 text-primary" />
                        <span className="truncate">{user.name || user.email}</span>
                    </div>
                    <div className="px-2">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                            {user.role}
                        </span>
                    </div>
                    <button
                        onClick={() => signOutAction()}
                        className="flex w-full items-center gap-2 px-2 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Log out</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="flex h-16 items-center border-b px-4 md:hidden bg-card justify-between sticky top-0 z-50">
                <div className="font-bold text-xl flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-primary" />
                    UROps
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
                    <div className="flex items-center gap-2 px-2 font-bold text-xl text-primary">
                        <div className="h-8 w-8 rounded-lg bg-primary " />
                        UROps
                    </div>
                    <button onClick={() => setIsMobileMenuOpen(false)}><X className="h-5 w-5" /></button>
                </div>
                <Sidebar role={user.role} onItemClick={() => setIsMobileMenuOpen(false)} />
                <div className="mt-auto border-t pt-4 space-y-2">
                    <div className="flex items-center gap-2 px-2 text-sm text-white font-medium">
                        <UserCircle className="h-5 w-5 text-primary" />
                        <span className="truncate">{user.name || user.email}</span>
                    </div>
                    <div className="px-2">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                            {user.role}
                        </span>
                    </div>
                    <button
                        onClick={() => signOutAction()}
                        className="flex w-full items-center gap-2 px-2 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Log out</span>
                    </button>
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
