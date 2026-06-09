"use client"

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Users, FileText, FileCheck, CreditCard, Brain, LayoutDashboard, Briefcase, Calendar, Settings, Mic, ClipboardList, ClipboardCheck, LineChart, ChevronDown, ChevronRight, Activity, DollarSign, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";
import { useState } from "react";

const navigation = [
    {
        title: "Dashboard",
        icon: LayoutDashboard,
        roles: ["ADMIN"],
        items: [
            { title: "Command Center", href: "/dashboard" },
            { title: "Financial Insights", href: "/financial-dashboard" },
            { title: "AI Knowledge", href: "/knowledge" },
        ]
    },
    {
        title: "Operations",
        icon: Activity,
        items: [
            { title: "PM Dashboard", href: "/manager", roles: ["ADMIN", "MANAGER"] },
            { title: "CRM & Clients", href: "/clients" },
            { title: "Reports", href: "/reports" },
            { title: "Calendar", href: "/calendar" },
        ]
    },
    {
        title: "Projects",
        icon: Briefcase,
        items: [
            { title: "Operations Board", href: "/projects" },
            { title: "Scope of Work", href: "/work-breakdown-pricing" },
        ]
    },
    {
        title: "Financials",
        icon: DollarSign,
        items: [
            { title: "Quotations", href: "/invoices?type=QUOTE" },
            { title: "Invoices", href: "/invoices?type=INVOICE" },
            { title: "Payments", href: "/payments" },
        ]
    },
    {
        title: "System",
        icon: Settings,
        items: [
            { title: "Settings", href: "/settings" }
        ]
    }
];

export function Sidebar({ role, onItemClick }: { role: 'ADMIN' | 'MANAGER', onItemClick?: () => void }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const type = searchParams ? searchParams.get("type") : null;
    const [openGroups, setOpenGroups] = useState<string[]>(navigation.map(n => n.title));

    const toggleGroup = (title: string) => {
        setOpenGroups(prev => prev.includes(title) ? prev.filter(g => g !== title) : [...prev, title]);
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-6">
            {navigation.map((group) => {
                if (group.roles && !group.roles.includes(role)) return null;

                const GroupIcon = group.icon;
                const isOpen = openGroups.includes(group.title);

                return (
                    <div key={group.title} className="space-y-1">
                        <button 
                            onClick={() => toggleGroup(group.title)}
                            className="w-full flex items-center justify-between px-2 py-1 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <GroupIcon className="h-3.5 w-3.5" />
                                {group.title}
                            </div>
                            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                        
                        {isOpen && (
                            <div className="mt-2 space-y-1 pl-2">
                                {group.items.map((item) => {
                                    // @ts-ignore
                                    if (item.roles && !item.roles.includes(role)) return null;
                                    if (role === 'MANAGER' && (item.title === 'AI Knowledge' || item.title === 'Settings')) return null;

                                    const hrefPath = item.href.split('?')[0];
                                    const hasQuery = item.href.includes('?');
                                    let isActive = false;

                                    if (hasQuery) {
                                        const urlParams = new URLSearchParams(item.href.split('?')[1]);
                                        const itemType = urlParams.get("type");
                                        isActive = pathname === hrefPath && type === itemType;
                                    } else {
                                        isActive = pathname === hrefPath || pathname.startsWith(hrefPath + "/");
                                    }

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={onItemClick}
                                            className={cn(
                                                "group flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold transition-all duration-300 relative overflow-hidden",
                                                isActive
                                                    ? "bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(163,230,53,0.05)] border border-primary/20"
                                                    : "text-muted-foreground/70 hover:bg-white/5 hover:text-white"
                                            )}
                                        >
                                            {isActive && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px_#8cff3380]" />
                                            )}
                                            <span className="truncate">{item.title}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
