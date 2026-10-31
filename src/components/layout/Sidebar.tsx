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
            { title: "All Projects / Jobs", href: "/projects" },
            { title: "Scope of Work", href: "/work-breakdown-pricing" },
        ]
    },
    {
        title: "Financials",
        icon: DollarSign,
        items: [
            { title: "Quotations", href: "/invoices?type=QUOTE" },
            { title: "Invoices", href: "/invoices?type=INVOICE" },
            { title: "Credit Notes", href: "/credit-notes" },
            { title: "Tender 152G", href: "/tenders" },
            { title: "Payments", href: "/payments" },
        ]
    },
    {
        title: "System",
        icon: Settings,
        items: [
            { title: "Settings", href: "/settings" },
            { title: "Quotation Terms", href: "/settings/terms" }
        ]
    }
];

export function Sidebar({
    role,
    settings,
    onItemClick,
    complianceAlertCount = 0,
}: {
    role: 'ADMIN' | 'MANAGER' | 'CREW'
    settings?: any
    onItemClick?: () => void
    complianceAlertCount?: number
}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const type = searchParams ? searchParams.get("type") : null;
    const [openGroups, setOpenGroups] = useState<string[]>(navigation.map(n => n.title));

    const toggleGroup = (title: string) => {
        setOpenGroups(prev => prev.includes(title) ? prev.filter(g => g !== title) : [...prev, title]);
    }

    const isAeroWash = Boolean(
        settings?.companyId === "70af7281-072d-4ed5-9f2e-af4d93e99ea9" ||
        settings?.theme === "dark-orange" ||
        settings?.name?.toLowerCase().includes("aerowash")
    );
    const isDroneEnabled = isAeroWash && settings?.layoutPreferences?.dashboardView === "drone";
    const isTendersEnabled = settings?.tendersEnabled === true;

    // CREW sees ONLY "My Jobs Today" — zero prices, zero quotes, zero invoices, zero client list
    if (role === "CREW") {
        const isActive = pathname === "/my-jobs" || pathname.startsWith("/my-jobs/");
        return (
            <div className="px-3 py-4 space-y-4">
                <div className="space-y-1">
                    <div className="px-2 py-1 text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                        Field Operations
                    </div>
                    <div className="mt-2 pl-2">
                        <Link
                            href="/my-jobs"
                            onClick={onItemClick}
                            className={cn(
                                "group flex items-center justify-between rounded-xl px-3 py-3 text-sm font-black transition-all duration-300 relative overflow-hidden",
                                isActive
                                    ? "bg-primary/15 text-primary border border-primary/30"
                                    : "text-white hover:bg-white/5"
                            )}
                        >
                            <span>My Jobs Today</span>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const dynamicNavigation = navigation.map(group => {
        if (group.title === "Dashboard" && isDroneEnabled) {
            const hasPipelineItem = group.items.some(item => item.title === "Sales Pipeline" || item.title === "Drone Operations");
            if (!hasPipelineItem) {
                return {
                    ...group,
                    items: [
                        { title: "Command Center", href: "/dashboard" },
                        { title: "Sales Pipeline", href: "/prospects" },
                        ...group.items.filter(item => item.title !== "Command Center" && item.title !== "Drone Operations" && item.title !== "Sales Pipeline")
                    ]
                };
            } else {
                return {
                    ...group,
                    items: group.items.map(item => (item.title === "Drone Operations" || item.title === "Sales Pipeline") ? { ...item, title: "Sales Pipeline", href: "/prospects" } : (item.href === "/drone" ? { ...item, href: "/prospects" } : item))
                };
            }
        }
        if (group.title === "Operations" && (isAeroWash || settings?.complianceEnabled)) {
            const extraOpsItems: Array<{ title: string; href: string }> = [];
            if (isAeroWash && !group.items.some(item => item.href === "/my-jobs")) {
                extraOpsItems.push({ title: "My Jobs Today", href: "/my-jobs" });
            }
            if (!group.items.some(item => item.href === "/compliance")) {
                extraOpsItems.push({ title: "Compliance & Fleet", href: "/compliance" });
            }
            if (extraOpsItems.length > 0) {
                return {
                    ...group,
                    items: [...extraOpsItems, ...group.items]
                };
            }
        }
        if (group.title === "Financials" && !isTendersEnabled) {
            return {
                ...group,
                items: group.items.filter(item => item.href !== "/tenders")
            };
        }
        if (group.title === "System") {

            if (isAeroWash && !group.items.some(item => item.title === "AeroWash Catalogue")) {
                return {
                    ...group,
                    items: [
                        { title: "Settings", href: "/settings" },
                        { title: "Quotation Terms", href: "/settings/terms" },
                        { title: "AeroWash Catalogue", href: "/settings/catalogue" }
                    ]
                };
            }
        }
        return group;
    });

    return (
        <div className="px-3 py-4 space-y-6">
            {dynamicNavigation.map((group) => {
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
                                            {item.href === "/compliance" && complianceAlertCount > 0 && (
                                                <span className="ml-2 shrink-0 px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black leading-none">
                                                    {complianceAlertCount}
                                                </span>
                                            )}
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
