"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, RotateCcw, Trash2, CheckCircle2 } from "lucide-react";
import { formatRelativeTime, DraftMetadata, getDraft } from "@/lib/drafts";

interface EditorDraftBannerProps {
    draftTimestamp?: number;
    itemCount?: number;
    draft?: DraftMetadata | null;
    onRestore: () => void;
    onDiscard: () => void;
    documentType?: string; // e.g. "Quotation", "Invoice", "Scope of Work"
}

export function EditorDraftBanner({
    draftTimestamp,
    itemCount,
    draft,
    onRestore,
    onDiscard,
    documentType
}: EditorDraftBannerProps) {
    const timestamp = draftTimestamp || draft?.updatedAt || Date.now();
    const count = itemCount !== undefined ? itemCount : draft?.itemCount;
    const docType = documentType || (
        draft?.type === 'QUOTATION' ? 'Quotation' :
        draft?.type === 'INVOICE' ? 'Invoice' :
        draft?.type === 'SOW' ? 'Scope of Work' :
        draft?.type === 'WBP' ? 'Work Breakdown & Pricing' :
        'Document'
    );

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl animate-in slide-in-from-bottom-5 duration-300">
            <Card className="bg-[#14141E]/95 border-2 border-primary/50 shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(163,230,53,0.2)] p-4 backdrop-blur-xl rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0 border border-primary/30 shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                        <RotateCcw className="h-5 w-5 animate-spin-reverse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Unsaved Draft Recovered</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-mono">Local Auto-Save</span>
                        </div>
                        <p className="text-xs font-bold text-white mt-0.5">
                            Resume your {docType} session from {formatRelativeTime(timestamp)}
                            {count !== undefined ? ` • ${count} line item${count === 1 ? '' : 's'}` : ''}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 justify-end shrink-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onDiscard}
                        className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 text-xs font-bold h-9 px-3 rounded-xl transition-colors"
                    >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Discard
                    </Button>
                    <Button
                        size="sm"
                        onClick={onRestore}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-black text-xs uppercase tracking-wider h-9 px-4 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                    >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Restore Draft
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export function AutoSaveIndicator({
    lastSavedTimestamp,
    isSaving = false,
    draftKey,
    className = ""
}: {
    lastSavedTimestamp?: number | null;
    isSaving?: boolean;
    draftKey?: string;
    className?: string;
}) {
    const [keyTimestamp, setKeyTimestamp] = React.useState<number | null>(null);

    React.useEffect(() => {
        if (!draftKey) return;
        const update = () => {
            const d = getDraft(draftKey);
            if (d?.updatedAt) {
                setKeyTimestamp(d.updatedAt);
            } else {
                setKeyTimestamp(null);
            }
        };
        update();
        window.addEventListener('urops_draft_updated', update);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener('urops_draft_updated', update);
            window.removeEventListener('storage', update);
        };
    }, [draftKey]);

    const effectiveTimestamp = lastSavedTimestamp !== undefined ? lastSavedTimestamp : keyTimestamp;

    if (!effectiveTimestamp && !isSaving) return null;

    return (
        <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground transition-all ${className}`}>
            {isSaving ? (
                <>
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
                    <span>Auto-saving draft...</span>
                </>
            ) : (
                <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-white/80">Draft saved locally <span className="text-zinc-400">({formatRelativeTime(effectiveTimestamp!)})</span></span>
                </>
            )}
        </div>
    );
}
