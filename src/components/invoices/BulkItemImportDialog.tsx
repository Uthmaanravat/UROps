"use client"

import React, { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, LINE_ITEM_REASONS } from "@/lib/utils"
import { ClipboardPaste, Check, AlertCircle, FileSpreadsheet, Trash2 } from "lucide-react"

export interface ParsedBulkItem {
    id?: string;
    area: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    reason: string;
    total: number;
}

export function parseBulkLineItems(text: string): ParsedBulkItem[] {
    if (!text || !text.trim()) return [];

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const parsed: ParsedBulkItem[] = [];
    let currentArea = "";

    const parseNumber = (val: string): number => {
        if (!val) return 0;
        let cleaned = val.replace(/[^0-9.,-]/g, '').trim();
        if (cleaned.includes(',') && cleaned.includes('.')) {
            cleaned = cleaned.replace(/,/g, '');
        } else if (cleaned.includes(',') && !cleaned.includes('.')) {
            const parts = cleaned.split(',');
            if (parts.length === 2 && parts[1].length <= 2) {
                cleaned = cleaned.replace(',', '.');
            } else {
                cleaned = cleaned.replace(/,/g, '');
            }
        }
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        // Skip table header row if detected
        const lower = line.toLowerCase();
        if (
            lineIndex === 0 && 
            (lower.includes('desc') || lower.includes('item') || lower.includes('service')) && 
            (lower.includes('qty') || lower.includes('quantity') || lower.includes('price') || lower.includes('rate') || lower.includes('unit') || lower.includes('amount'))
        ) {
            continue;
        }

        // Section / Heading row prefix
        if (line.startsWith('#') || line.startsWith('SECTION:') || line.startsWith('AREA:')) {
            currentArea = line.replace(/^[#:]+\s*|^(SECTION|AREA):\s*/i, '').trim();
            continue;
        }

        let parts: string[] = [];
        if (line.includes('\t')) {
            parts = line.split('\t').map(p => p.trim());
        } else if (line.includes(';') && (line.match(/;/g) || []).length >= 2) {
            parts = line.split(';').map(p => p.trim());
        } else if (line.includes(',')) {
            // Respect CSV quotes if needed, or basic split
            const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            parts = matches ? matches.map(m => m.replace(/^"|"$/g, '').trim()) : line.split(',').map(p => p.trim());
        } else {
            if (isNaN(parseNumber(line))) {
                currentArea = line;
                continue;
            }
            parts = [line];
        }

        if (parts.length === 1) {
            // Text-only single line is considered a heading
            if (isNaN(parseNumber(parts[0]))) {
                currentArea = parts[0];
                continue;
            }
        }

        let area = currentArea;
        let description = "";
        let quantity = 1;
        let unit = "ea";
        let unitPrice = 0;
        let reason = "";

        if (parts.length >= 6) {
            area = parts[0] || currentArea;
            description = parts[1];
            quantity = parseNumber(parts[2]) || 1;
            unit = parts[3] || "ea";
            unitPrice = parseNumber(parts[4]);
            reason = parts[5] || "";
        } else if (parts.length === 5) {
            if (isNaN(parseNumber(parts[2])) && !isNaN(parseNumber(parts[3]))) {
                area = parts[0];
                description = parts[1];
                quantity = parseNumber(parts[2]) || 1;
                unit = parts[3] || "ea";
                unitPrice = parseNumber(parts[4]);
            } else {
                description = parts[0];
                quantity = parseNumber(parts[1]) || 1;
                unit = parts[2] || "ea";
                unitPrice = parseNumber(parts[3]);
                reason = parts[4] || "";
            }
        } else if (parts.length === 4) {
            description = parts[0];
            quantity = parseNumber(parts[1]) || 1;
            unit = parts[2] || "ea";
            unitPrice = parseNumber(parts[3]);
        } else if (parts.length === 3) {
            description = parts[0];
            quantity = parseNumber(parts[1]) || 1;
            unitPrice = parseNumber(parts[2]);
        } else if (parts.length === 2) {
            description = parts[0];
            unitPrice = parseNumber(parts[1]);
        }

        if (description.trim().length > 0) {
            parsed.push({
                area: area || "",
                description: description.trim(),
                quantity: quantity <= 0 ? 1 : quantity,
                unit: unit.trim() || "ea",
                unitPrice: unitPrice < 0 ? 0 : unitPrice,
                reason: reason.trim(),
                total: (quantity <= 0 ? 1 : quantity) * (unitPrice < 0 ? 0 : unitPrice)
            });
        }
    }

    return parsed;
}

interface BulkItemImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ParsedBulkItem[], replaceMode: boolean) => void;
    currentCount?: number;
}

export function BulkItemImportDialog({
    open,
    onOpenChange,
    onImport,
    currentCount = 0
}: BulkItemImportDialogProps) {
    const [rawText, setRawText] = useState("")
    const [replaceMode, setReplaceMode] = useState(false)

    const parsedItems = useMemo(() => {
        return parseBulkLineItems(rawText);
    }, [rawText]);

    const totalValue = useMemo(() => {
        return parsedItems.reduce((acc, item) => acc + item.total, 0);
    }, [parsedItems]);

    const handleConfirmImport = () => {
        if (parsedItems.length === 0) return;
        onImport(parsedItems, replaceMode);
        setRawText("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 bg-[#101018] border-white/10 text-white shadow-2xl">
                <DialogHeader className="shrink-0 pb-3 border-b border-white/10">
                    <DialogTitle className="flex items-center gap-2 text-lg font-black text-white">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                        Bulk Line-Item Entry (Paste from Excel / CSV)
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-400">
                        Copy rows directly from Excel, Google Sheets, or CSV files and paste below. Columns are automatically mapped (Description, Quantity, Unit, Unit Price, Justification).
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-3">
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-300">Paste Clipboard Text:</span>
                            {rawText && (
                                <button
                                    type="button"
                                    onClick={() => setRawText("")}
                                    className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                                >
                                    <Trash2 className="h-3 w-3" /> Clear Text
                                </button>
                            )}
                        </div>
                        <Textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder={`Example (tab or comma separated):\nTorch-on waterproofing membrane\t150\tm2\t380.00\tWear and Tear\nParapet wall counter flashing\t45\tm\t210.00\tDamage\nHigh-pressure roof wash\t1\tjob\t4500.00\tPreventative Maintenance`}
                            className="bg-[#14141E] border-white/10 focus:border-primary/50 text-white font-mono text-xs min-h-[140px] resize-y"
                        />
                    </div>

                    {/* Live Parsed Preview */}
                    {parsedItems.length > 0 ? (
                        <div className="space-y-2 bg-white/[0.02] p-4 rounded-xl border border-white/10">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                        ✓ Parsed {parsedItems.length} {parsedItems.length === 1 ? 'item' : 'items'}
                                    </span>
                                    <span className="text-xs text-gray-400 font-medium">
                                        Total Value: <strong className="text-white">{formatCurrency(totalValue)}</strong>
                                    </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                    <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white">
                                        <input
                                            type="radio"
                                            name="importMode"
                                            checked={!replaceMode}
                                            onChange={() => setReplaceMode(false)}
                                            className="accent-primary"
                                        />
                                        <span>Append to existing ({currentCount})</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white">
                                        <input
                                            type="radio"
                                            name="importMode"
                                            checked={replaceMode}
                                            onChange={() => setReplaceMode(true)}
                                            className="accent-primary"
                                        />
                                        <span className="text-amber-400">Replace current items</span>
                                    </label>
                                </div>
                            </div>

                            <div className="max-h-[220px] overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-wider text-gray-500">
                                            <th className="py-1 px-2 w-8">#</th>
                                            <th className="py-1 px-2">Heading</th>
                                            <th className="py-1 px-2">Description</th>
                                            <th className="py-1 px-2 text-center w-14">Qty</th>
                                            <th className="py-1 px-2 text-center w-14">Unit</th>
                                            <th className="py-1 px-2 text-right w-20">Price</th>
                                            <th className="py-1 px-2 text-right w-20">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                                        {parsedItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-white/[0.02]">
                                                <td className="py-1 px-2 text-gray-500">{idx + 1}</td>
                                                <td className="py-1 px-2 text-primary font-bold text-[10px] uppercase truncate max-w-[100px]">
                                                    {item.area || "-"}
                                                </td>
                                                <td className="py-1 px-2 text-white font-sans max-w-[240px] truncate" title={item.description}>
                                                    {item.description}
                                                    {item.reason && (
                                                        <span className="ml-1.5 text-[9px] font-mono text-amber-400/90 bg-amber-400/10 px-1 py-0.2 rounded border border-amber-400/20">
                                                            {item.reason}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-1 px-2 text-center text-gray-300">{item.quantity}</td>
                                                <td className="py-1 px-2 text-center text-gray-400 italic">{item.unit}</td>
                                                <td className="py-1 px-2 text-right text-gray-200">{formatCurrency(item.unitPrice)}</td>
                                                <td className="py-1 px-2 text-right text-emerald-400 font-bold">{formatCurrency(item.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : rawText.trim() ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>Could not parse any valid line items. Check that rows have at least a description and price/qty.</span>
                        </div>
                    ) : null}
                </div>

                <DialogFooter className="shrink-0 pt-3 border-t border-white/10 flex justify-between sm:justify-between items-center">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-gray-400 hover:text-white"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirmImport}
                        disabled={parsedItems.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                        <ClipboardPaste className="mr-2 h-4 w-4" />
                        Import {parsedItems.length} {parsedItems.length === 1 ? 'Item' : 'Items'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
