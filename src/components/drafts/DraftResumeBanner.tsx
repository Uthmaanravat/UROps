"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    Clock, 
    ArrowRight, 
    Trash2, 
    FileText, 
    Layers, 
    DollarSign, 
    Sparkles, 
    ChevronRight,
    RotateCcw
} from "lucide-react";
import { listDrafts, clearDraft, formatRelativeTime, DraftMetadata } from "@/lib/drafts";

interface DraftResumeBannerProps {
    filterType?: 'ALL' | 'INVOICE_OR_QUOTE' | 'SOW_OR_WBP';
    title?: string;
    subtitle?: string;
    className?: string;
}

export function DraftResumeBanner({
    filterType = 'ALL',
    title = "Continue Where You Left Off",
    subtitle = "You have unsaved working drafts stored locally in your browser session",
    className = ""
}: DraftResumeBannerProps) {
    const [drafts, setDrafts] = useState<DraftMetadata[]>([]);
    const [isMounted, setIsMounted] = useState(false);

    const refreshDrafts = useCallback(() => {
        const typeFilter = filterType === 'ALL' ? undefined : filterType;
        const current = listDrafts(typeFilter);
        setDrafts(current);
    }, [filterType]);

    useEffect(() => {
        setIsMounted(true);
        refreshDrafts();

        const handleUpdate = () => refreshDrafts();
        window.addEventListener('urops_draft_updated', handleUpdate);
        window.addEventListener('storage', handleUpdate);

        return () => {
            window.removeEventListener('urops_draft_updated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [refreshDrafts]);

    if (!isMounted || drafts.length === 0) {
        return null;
    }

    const handleDiscard = (e: React.MouseEvent, key: string, draftTitle: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Are you sure you want to discard the unsaved draft for "${draftTitle}"? This cannot be undone.`)) {
            clearDraft(key);
            refreshDrafts();
        }
    };

    const getBadgeConfig = (type: DraftMetadata['type']) => {
        switch (type) {
            case 'QUOTATION':
                return { label: 'Quotation Draft', bg: 'bg-primary/10 text-primary border-primary/30', icon: FileText };
            case 'INVOICE':
                return { label: 'Invoice Draft', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30', icon: DollarSign };
            case 'SOW':
                return { label: 'SOW Draft', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30', icon: Layers };
            case 'WBP':
                return { label: 'Pricing Draft', bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30', icon: Layers };
            default:
                return { label: 'Draft', bg: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30', icon: FileText };
        }
    };

    return (
        <Card className={`bg-gradient-to-r from-[#141424] via-[#10101C] to-[#141424] border border-primary/30 shadow-[0_0_30px_rgba(163,230,53,0.08)] rounded-2xl overflow-hidden ${className}`}>
            <div className="p-4 sm:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.01]">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0 border border-primary/30 shadow-[0_0_15px_rgba(163,230,53,0.25)]">
                        <RotateCcw className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                                {title}
                            </h3>
                            <Badge variant="outline" className="bg-primary/20 border-primary/40 text-primary font-black text-[10px] px-2 py-0.5 uppercase">
                                {drafts.length} {drafts.length === 1 ? 'Pending Draft' : 'Pending Drafts'}
                            </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-medium">{subtitle}</p>
                    </div>
                </div>
            </div>

            <CardContent className="p-3 sm:p-4 space-y-2.5">
                {drafts.map((draft) => {
                    const badge = getBadgeConfig(draft.type);
                    const Icon = badge.icon;

                    return (
                        <div
                            key={draft.key}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-primary/30 transition-all gap-3 group"
                        >
                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-300 shrink-0 border border-white/10 group-hover:text-primary group-hover:border-primary/30 transition-colors">
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-sm text-white group-hover:text-primary transition-colors truncate">
                                            {draft.title}
                                        </span>
                                        <Badge variant="outline" className={`text-[9px] font-black uppercase px-2 py-0.5 ${badge.bg}`}>
                                            {badge.label}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                                        <span className="flex items-center gap-1 font-medium">
                                            <Clock className="h-3 w-3 text-zinc-500" />
                                            Edited {formatRelativeTime(draft.updatedAt)}
                                        </span>
                                        {draft.itemCount !== undefined && (
                                            <span>• {draft.itemCount} line item{draft.itemCount === 1 ? '' : 's'}</span>
                                        )}
                                        {draft.total !== undefined && draft.total > 0 && (
                                            <span className="text-zinc-300 font-bold">• R {draft.total.toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleDiscard(e, draft.key, draft.title)}
                                    className="h-8 px-2.5 text-[11px] font-bold text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Discard unsaved draft"
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    Discard
                                </Button>
                                <Link href={draft.url}>
                                    <Button
                                        size="sm"
                                        className="h-8 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 font-black text-xs uppercase tracking-wider rounded-lg shadow-md shadow-primary/10 transition-all group-hover:scale-105 active:scale-95 flex items-center gap-1.5"
                                    >
                                        Resume Work
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
