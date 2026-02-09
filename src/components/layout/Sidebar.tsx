"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, FileText, FileCheck, CreditCard, Brain, LayoutDashboard, Briefcase, Calendar, Settings, Mic, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";
import { getSidebarNotifications } from "@/app/(dashboard)/notification-actions";

const items = [
    {
        title: "Admin Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["ADMIN"]
    },
    {
        title: "PM Dashboard",
        href: "/manager",
        icon: Mic,
        roles: ["ADMIN", "MANAGER"]
    },
    {
        title: "CRM",
        href: "/clients",
        icon: Users,
    },
    {
        title: "Projects",
        href: "/projects",
        icon: Briefcase,
    },
    {
        title: "Work Breakdown & Pricing",
        href: "/work-breakdown-pricing",
        icon: ClipboardList,
    },
    {
        title: "Quotations",
        href: "/invoices?type=QUOTE",
        icon: FileText,
    },
    {
        title: "Invoices",
        href: "/invoices?type=INVOICE",
        icon: FileCheck,
    },
    {
        title: "Payments",
        href: "/payments",
        icon: CreditCard,
    },
    {
        title: "AI Knowledge",
        href: "/knowledge",
        icon: Brain,
    },
    {
        title: "Settings",
        href: "/settings",
        icon: Settings,
    },
];

function NavItem({
    item,
    isActive,
    role,
    handleItemClick,
    notificationCount
}: {
    item: any,
    isActive: boolean,
    role: string,
    handleItemClick: () => void,
    notificationCount: number
}) {
    const Icon = item.icon;

    let displayTitle = item.title;
    if (item.title === 'Work Breakdown & Pricing' && role === 'MANAGER') {
        displayTitle = 'Scope of Work';
    }

    const showDot = notificationCount > 0 && role === 'ADMIN';

    return (
        <Link
            href={item.href}
            onClick={handleItemClick}
            className={cn(
                "group flex items-center justify-between rounded-xl px-4 py-2 text-[13px] font-bold transition-all duration-300 relative overflow-hidden",
                isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground/70 hover:bg-white/[0.03] hover:text-white"
            )}
        >
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            )}
            <div className="flex items-center min-w-0 flex-1">
                <Icon className={cn("mr-3 h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} />
                <span className="truncate">{displayTitle}</span>
            </div>
            {showDot && (
                <div className="flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-red-500 text-[10px] font-black text-white px-1 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse border border-white/10 shrink-0 ml-2">
                    {notificationCount}
                </div>
            )}
        </Link>
    );
}

export function Sidebar({ role, onItemClick }: { role: 'ADMIN' | 'MANAGER', onItemClick?: () => void }) {
    const pathname = usePathname();
    const [notifications, setNotifications] = React.useState<Record<string, number>>({});

    const fetchNotifications = async () => {
        // Don't poll if document is hidden or if we are likely logged out
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

        try {
            const counts = await getSidebarNotifications();
            setNotifications({
                'Projects': counts.projects,
                'Work Breakdown & Pricing': counts.wbp,
                'Quotations': counts.quotations,
                'Invoices': counts.invoices
            });
        } catch (err) {
            console.error("Error fetching notifications:", err);
        }
    }

    React.useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchNotifications();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    const handleItemClick = () => {
        if (onItemClick) onItemClick();
    };

    return (

        <div className="flex-1 overflow-y-auto scrollbar-hide px-2">
            <nav className="grid items-start gap-1">
                {items.map((item, index) => {
                    // @ts-ignore
                    if (item.roles && !item.roles.includes(role)) {
                        return null;
                    }
                    if (role === 'MANAGER' && (item.title === 'AI Knowledge' || item.title === 'Settings')) {
                        return null;
                    }

                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const notificationCount = notifications[item.title] || 0;

                    return (
                        <NavItem
                            key={index}
                            item={item}
                            isActive={isActive}
                            role={role}
                            handleItemClick={handleItemClick}
                            notificationCount={notificationCount}
                        />
                    );
                })}
            </nav>
        </div>
    );
}
