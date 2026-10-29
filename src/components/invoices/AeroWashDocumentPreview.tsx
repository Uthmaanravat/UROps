"use client";

import React, { useState } from "react";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Edit3, Check, FileText, CheckCircle2 } from "lucide-react";
import { parseClauses } from "@/lib/terms-utils";
import { AEROWASH_STANDARD_TERMS_BODY } from "@/lib/aerowash-catalogue";

interface AeroWashDocumentPreviewProps {
    invoice: any;
    company: any;
    companySettings?: any;
    items: any[];
    subtotal: number;
    total: number;
    taxAmount: number;
    isVatRegistered: boolean;
    vatRate: number;
    currencySymbol: string;
    quoteNumber?: string | null;
    date: string | Date;
    site?: string | null;
    reference?: string | null;
    notes?: string | null;
    attentionTo?: string | null;
    isLocked?: boolean;
    onEditItems?: () => void;
}

export function AeroWashDocumentPreview({
    invoice,
    company,
    companySettings,
    items,
    subtotal,
    total,
    taxAmount,
    isVatRegistered,
    vatRate,
    currencySymbol,
    quoteNumber,
    date,
    site,
    reference,
    notes,
    attentionTo,
    isLocked = false,
    onEditItems
}: AeroWashDocumentPreviewProps) {
    const isInvoice = invoice.type === 'INVOICE';
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();

    const numberLabel = quoteNumber
        ? quoteNumber
        : (isInvoice
            ? `INV-${year}-${invoice.number.toString().padStart(3, '0')}`
            : `AW-${year}-${invoice.number.toString().padStart(3, '0')}`);

    const docHeading = isInvoice
        ? (isVatRegistered ? 'TAX INVOICE' : 'INVOICE')
        : 'QUOTATION';

    const validityDays = companySettings?.validityDays || 45;
    const validUntilDate = new Date(dateObj);
    validUntilDate.setDate(validUntilDate.getDate() + validityDays);

    const formattedDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const formattedValidDate = validUntilDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const clientName = invoice.client?.companyName || invoice.client?.name || "Client";
    const attentionName = attentionTo || invoice.client?.attentionTo || invoice.client?.name || "Client Contact";
    const siteRaw = site || reference || invoice.site || invoice.reference || "Site address as agreed";
    const siteClean = siteRaw.replace(/^site:\s*/i, '');

    const scopeOfWorksText = invoice.metadata?.scopeOfWorks || notes || (
        `Exterior maintenance cleaning of the exposed building elevations at ${siteClean}, delivered by drone with no scaffolding, cradles, ladders or rope access and no obstruction of trading or parking.`
    );

    const allowanceAmount = invoice.metadata?.allowanceAmount || 0;
    const allowanceName = invoice.metadata?.allowanceName || "Introductory allowance";
    const subtotalStandardRates = subtotal + allowanceAmount;

    const siteVisitCompleted = Boolean(
        invoice.metadata?.siteVisitDone || 
        invoice.metadata?.siteVisitCompleted ||
        (invoice.metadata?.siteVisitPhotos && invoice.metadata.siteVisitPhotos.length > 0) ||
        (invoice.metadata?.conditionFlags && invoice.metadata.conditionFlags.length > 0)
    );
    const siteVisitDateRaw = invoice.metadata?.siteVisitDate;
    const siteVisitDateFormatted = siteVisitDateRaw 
        ? new Date(siteVisitDateRaw).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date(invoice.date || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const siteVisitRequired = !siteVisitCompleted && (
        invoice.metadata?.siteVisitRequired ?? (
            total >= 50000 || items.some(i => i.description?.toLowerCase().includes('site visit') || i.description?.toLowerCase().includes('pre-treatment'))
        )
    );

    const clientRef = invoice.client?.codePrefix || invoice.metadata?.clientCodePrefix;

    const prepName = companySettings?.preparedByName || "Uthmaan Ravat";
    const prepPhone = companySettings?.preparedByPhone || "067 829 3350";

    // Numbered terms clauses
    const termsBody = invoice.terms && invoice.terms.length > 0
        ? invoice.terms.map((t: any) => t.bodySnapshot || t.template?.body).join('\n\n')
        : AEROWASH_STANDARD_TERMS_BODY;

    const parsedClauses = parseClauses(termsBody);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Action Bar */}
            <div className="flex justify-between items-center print:hidden">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                    AeroWash Client Document View
                </span>
                {!isLocked && onEditItems && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onEditItems}
                        className="h-8 text-xs font-bold gap-2 bg-white/5 text-amber-300 border border-amber-500/30 hover:bg-amber-500/10"
                    >
                        <Edit3 className="h-3.5 w-3.5 text-amber-400" />
                        Edit Line Items
                    </Button>
                )}
            </div>

            {/* Document Sheet */}
            <div className="rounded-2xl shadow-2xl overflow-hidden border border-white/10 bg-white text-zinc-900 font-sans">
                {/* 1. Black Header Band */}
                <div className="bg-[#0A0A0A] text-white p-6 sm:p-8 border-b-[2px] border-[#D05E00] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    {/* Brand Logo */}
                    <div className="flex items-center">
                        {((companySettings?.layoutPreferences as any)?.darkHeaderLogoUrl || companySettings?.logoUrl || company?.logoUrl || "/aerowash_header_logo.png") ? (
                            <img
                                src={(companySettings?.layoutPreferences as any)?.darkHeaderLogoUrl || "/aerowash_header_logo.png"}
                                alt={company?.name || "AeroWash"}
                                className="h-14 sm:h-16 w-auto max-w-[240px] object-contain"
                            />
                        ) : (
                            <div className="text-xl font-black tracking-[0.2em] text-white">
                                {company?.name || "AEROWASH"}
                            </div>
                        )}
                    </div>

                    {/* Document Title & Meta */}
                    <div className="text-left sm:text-right space-y-1">
                        <h1 className="text-xl sm:text-2xl font-black tracking-[0.2em] text-white">
                            {docHeading}
                        </h1>
                        <div className="text-xs font-medium space-y-0.5">
                            <div>
                                <span className="text-gray-400">{isInvoice ? "Invoice No. " : "Quote No. "}</span>
                                <span className="font-bold text-[#D05E00]">{numberLabel}</span>
                            </div>
                            <div>
                                <span className="text-gray-400">Date: </span>
                                <span className="font-bold text-[#D05E00]">{formattedDate}</span>
                            </div>
                            {!isInvoice && (
                                <div>
                                    <span className="text-gray-400">Valid until: </span>
                                    <span className="font-bold text-[#D05E00]">{formattedValidDate}</span>
                                </div>
                            )}
                            {clientRef && (
                                <div>
                                    <span className="text-gray-400">Client ref: </span>
                                    <span className="font-bold text-gray-200">{clientRef}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. White Body Content */}
                <div className="p-6 sm:p-8 space-y-8">
                    {/* FROM and ATTENTION Columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        {/* FROM Column */}
                        <div className="space-y-2">
                            <div className="text-[10px] font-black tracking-[0.25em] text-[#D05E00] uppercase border-b border-gray-200 pb-1">
                                F R O M
                            </div>
                            <div className="text-xs space-y-1 text-gray-600">
                                <div className="font-bold text-sm text-zinc-900">
                                    {company.name || "AeroWash (Pty) Ltd"}
                                </div>
                                <div>Drone Cleaning Solutions</div>
                                <div>{company.address || "15 Culemborg Street, Parow, Cape Town, 7500"}</div>
                                <div>{company.phone || "067 829 3350"}  ·  {company.email || "info@aerowash.co.za"}</div>
                                <div>
                                    {(company.website || "www.aerowash.co.za")}{company.registrationNumber ? `  ·  Reg. ${company.registrationNumber}` : (company.id === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' ? "  ·  Reg. 2026/475172/07" : "")}
                                </div>
                                {company.vatNumber && isVatRegistered && (
                                    <div className="font-semibold text-zinc-800">VAT No. {company.vatNumber}</div>
                                )}
                            </div>
                        </div>

                        {/* ATTENTION Column */}
                        <div className="space-y-2">
                            <div className="text-[10px] font-black tracking-[0.25em] text-[#D05E00] uppercase border-b border-gray-200 pb-1">
                                A T T E N T I O N
                            </div>
                            <div className="text-xs space-y-1 text-gray-600">
                                <div className="font-bold text-sm text-zinc-900">
                                    {attentionName}
                                </div>
                                {clientRef && (
                                    <div className="font-bold text-zinc-800">Client ref: {clientRef}</div>
                                )}
                                {invoice.client?.email && <div>{invoice.client.email}</div>}
                                {invoice.client?.phone && <div>{invoice.client.phone}</div>}
                                {invoice.client?.companyName && invoice.client.companyName !== attentionName && (
                                    <div className="font-medium text-zinc-800">{invoice.client.companyName}</div>
                                )}
                                {invoice.client?.vatNumber && (
                                    <div>VAT No. {invoice.client.vatNumber}</div>
                                )}
                                <div className="pt-1 text-zinc-800">
                                    <span className="font-bold text-zinc-900">Site: </span>
                                    <span>{siteClean}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SCOPE OF WORKS */}
                    <div className="space-y-2">
                        <div className="text-[10px] font-black tracking-[0.25em] text-[#D05E00] uppercase border-b border-gray-200 pb-1">
                            S C O P E   O F   W O R K S
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">
                            {scopeOfWorksText}
                        </p>
                    </div>

                    {/* ITEMS TABLE (ITEM | AMOUNT only) */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-[#F3F4F6] text-gray-700 uppercase font-black text-[10px] tracking-wider border-y border-gray-200">
                                    <th className="py-2.5 px-4 w-3/4">ITEM</th>
                                    <th className="py-2.5 px-4 text-right w-1/4">AMOUNT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(() => {
                                    const conditionFlags: any[] = invoice.metadata?.conditionFlags || invoice.conditionFlags || [];
                                    const sequentialGroups: { area: string; items: any[] }[] = [];
                                    items.forEach(item => {
                                        const area = (item.area || item.metadata?.area || '').trim();
                                        const last = sequentialGroups[sequentialGroups.length - 1];
                                        if (last && last.area === area) {
                                            last.items.push(item);
                                        } else {
                                            sequentialGroups.push({ area, items: [item] });
                                        }
                                    });

                                    const isGroupedByElevation = sequentialGroups.length > 1 && sequentialGroups.some(g => Boolean(g.area));
                                    let itemIndexCounter = 0;

                                    return sequentialGroups.map((group, gIdx) => {
                                        const matchingFlags = conditionFlags.filter(f =>
                                            f.elevation && (
                                                f.elevation.toLowerCase() === group.area.toLowerCase() ||
                                                (!isGroupedByElevation && sequentialGroups.length === 1)
                                            )
                                        );

                                        return (
                                            <React.Fragment key={gIdx}>
                                                {isGroupedByElevation && group.area && (
                                                    <tr className="bg-gray-50/80 border-y border-gray-200">
                                                        <td colSpan={2} className="py-2 px-4 font-black text-[11px] text-[#D05E00] uppercase tracking-wider">
                                                            {group.area}
                                                        </td>
                                                    </tr>
                                                )}
                                                {group.items.map((item: any, iIdx: number) => {
                                                    itemIndexCounter++;
                                                    const isIncluded = item.isIncluded || item.metadata?.isIncluded || (item.unitPrice === 0 && item.originalPrice && item.originalPrice > 0);
                                                    const originalAmount = item.originalPrice || (item.total !== undefined ? item.total : item.quantity * item.unitPrice) || 0;
                                                    const amount = (item.total !== undefined ? item.total : item.quantity * item.unitPrice) || 0;

                                                    const rawDesc = item.description || "";
                                                    let title = rawDesc;
                                                    let subDesc = "";

                                                    if (rawDesc.includes("\n")) {
                                                        const parts = rawDesc.split("\n");
                                                        title = parts[0].trim();
                                                        subDesc = parts.slice(1).join(" ").trim();
                                                    } else if (rawDesc.includes(" – ")) {
                                                        const parts = rawDesc.split(" – ");
                                                        title = parts[0].trim();
                                                        subDesc = parts.slice(1).join(" – ").trim();
                                                    } else if (rawDesc.includes(" - ")) {
                                                        const parts = rawDesc.split(" - ");
                                                        title = parts[0].trim();
                                                        subDesc = parts.slice(1).join(" - ").trim();
                                                    }

                                                    const cleanTitle = `${itemIndexCounter}. ${title.replace(/^\d+[\.\)]\s*/, '')}`;

                                                    return (
                                                        <tr key={item.id || `${gIdx}-${iIdx}`} className="hover:bg-gray-50/60 transition-colors">
                                                            <td className="py-3 px-4 align-top space-y-1">
                                                                <div className="font-bold text-zinc-900 text-[13px]">
                                                                    {cleanTitle}
                                                                </div>
                                                                {subDesc && (
                                                                    <div className="text-gray-600 text-xs leading-relaxed">
                                                                        {subDesc}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-4 text-right align-top">
                                                                {isIncluded ? (
                                                                    <div className="space-y-0.5">
                                                                        <div className="line-through text-gray-400 font-normal">
                                                                            {formatCurrency(originalAmount, currencySymbol)}
                                                                        </div>
                                                                        <div className="text-emerald-600 font-black tracking-wider text-[11px]">
                                                                            INCLUDED
                                                                        </div>
                                                                    </div>
                                                                ) : amount === 0 ? (
                                                                    <div className="text-emerald-600 font-black tracking-wider text-[11px]">
                                                                        INCLUDED
                                                                    </div>
                                                                ) : (
                                                                    <div className="font-bold text-zinc-900 text-sm">
                                                                        {formatCurrency(amount, currencySymbol)}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}

                                                {/* Orange Notice Box for Condition Flags under this elevation */}
                                                {matchingFlags.map(flag => (
                                                    <tr key={flag.id} className="bg-[#FFF7ED]">
                                                        <td colSpan={2} className="py-3 px-4 border-l-4 border-[#D05E00] space-y-1">
                                                            <div className="font-bold text-xs text-[#9A3412] uppercase tracking-wider">
                                                                Existing condition noted
                                                            </div>
                                                            <div className="text-[11px] text-[#7C2D12] leading-relaxed">
                                                                {flag.wording}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>

                    {/* TOTALS BLOCK */}
                    <div className="flex flex-col items-end space-y-2 pt-2">
                        <div className="w-full sm:w-80 space-y-2 text-xs">
                            {allowanceAmount > 0 ? (
                                <>
                                    <div className="flex justify-between items-center text-gray-600">
                                        <span>Subtotal — full scope at standard rates</span>
                                        <span className="font-bold text-zinc-900">{formatCurrency(subtotalStandardRates, currencySymbol)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-emerald-600 font-bold">
                                        <span>{allowanceName}</span>
                                        <span>− {formatCurrency(allowanceAmount, currencySymbol)}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-between items-center text-gray-600">
                                    <span>Subtotal</span>
                                    <span className="font-bold text-zinc-900">{formatCurrency(subtotal, currencySymbol)}</span>
                                </div>
                            )}

                            {isVatRegistered && taxAmount > 0 && (
                                <div className="flex justify-between items-center text-gray-600">
                                    <span>VAT ({vatRate}%)</span>
                                    <span className="font-bold text-zinc-900">{formatCurrency(taxAmount, currencySymbol)}</span>
                                </div>
                            )}

                            {/* Black TOTAL DUE Bar */}
                            <div className="bg-[#0A0A0A] text-white p-3.5 rounded-lg border-t-[2px] border-[#D05E00] flex justify-between items-center shadow-lg">
                                <span className="font-black text-xs tracking-[0.2em]">TOTAL DUE</span>
                                <span className="font-black text-xl tracking-tight text-white">{formatCurrency(total, currencySymbol)}</span>
                            </div>
                        </div>
                    </div>

                    {/* NOTICE BOX (Completed vs Required) */}
                    {siteVisitCompleted ? (
                        <div className="bg-[#F0FDF4] border-l-4 border-emerald-600 p-3.5 rounded-r-xl space-y-1">
                            <div className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Measurements and condition confirmed on site on {siteVisitDateFormatted}.</span>
                            </div>
                        </div>
                    ) : siteVisitRequired ? (
                        <div className="bg-[#FFF7ED] border-l-4 border-[#D05E00] p-4 rounded-r-xl space-y-1">
                            <div className="font-bold text-xs text-[#9A3412]">
                                Site visit required to confirm this quotation
                            </div>
                            <div className="text-[11px] text-[#7C2D12] leading-relaxed">
                                Measurements are taken from aerial survey data. Before this quotation is confirmed, AeroWash will attend site at no charge to verify dimensions, assess condition, confirm water and power points and identify access constraints. A revised figure will be issued if verified measurements differ materially.
                            </div>
                        </div>
                    ) : null}

                    {/* BANKING DETAILS (Invoices only) */}
                    {isInvoice && (
                        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1 text-xs">
                            <div className="font-bold text-zinc-900 uppercase tracking-wider text-[10px]">
                                Banking Details (EFT Settlement)
                            </div>
                            <div className="text-gray-600 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                                <div><span className="font-semibold text-zinc-800">Bank:</span> Standard Bank</div>
                                <div><span className="font-semibold text-zinc-800">Account Name:</span> {company.name || "AeroWash (Pty) Ltd"}</div>
                                <div><span className="font-semibold text-zinc-800">Account Number:</span> 070 829 335</div>
                                <div><span className="font-semibold text-zinc-800">Branch Code:</span> 051001</div>
                            </div>
                            <div className="text-[#D05E00] font-bold pt-1">
                                Payment Reference: {numberLabel}
                            </div>
                        </div>
                    )}

                    {/* ACCEPTANCE BLOCK (Quotes only) */}
                    {!isInvoice && (
                        <div className="border-t border-gray-200 pt-6 space-y-4 text-xs">
                            <div className="font-bold text-zinc-900">
                                Accepted on behalf of {clientName}:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-600 font-mono text-[11px]">
                                <div>Name: ____________________________________</div>
                                <div>Signature: ____________________________________</div>
                                <div>Date:   ____________________________________</div>
                                <div>PO number: ____________________________________</div>
                            </div>
                            <div className="text-[10px] text-gray-500 italic">
                                Please sign and return, or reply to accept by email.
                            </div>
                        </div>
                    )}

                    {/* TERMS AND CONDITIONS (Page 2 style matching reference) */}
                    <div className="rounded-2xl overflow-hidden border border-gray-200 mt-12 shadow-lg">
                        {/* Terms Header Band */}
                        <div className="bg-[#0A0A0A] text-white p-6 border-b-[2.5px] border-[#D05E00] flex justify-between items-center">
                            <img
                                src={(companySettings?.layoutPreferences as any)?.darkHeaderLogoUrl || "/aerowash_header_logo.png"}
                                alt="AeroWash Drone Cleaning Solutions"
                                className="h-12 w-auto object-contain"
                            />
                            <div className="text-right space-y-0.5">
                                <h2 className="text-lg font-black tracking-[0.25em] text-white">TERMS</h2>
                                <div className="text-xs">
                                    <span className="text-gray-400">{isInvoice ? "Invoice No. " : "Quote No. "}</span>
                                    <span className="font-bold text-[#D05E00]">{numberLabel}</span>
                                </div>
                                <div className="text-[11px] text-gray-300 font-medium">
                                    {invoice.site ? invoice.site.split(',')[0].replace(/^Site:\s*/i, '') : ''}
                                    {clientRef ? ` · Client ref: ${clientRef}` : ''}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 sm:p-8 space-y-6 bg-white">
                        {/* 1. INCLUDED & EXCLUDED */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* INCLUDED */}
                            <div className="space-y-3">
                                <div className="border-b border-gray-200 pb-1.5">
                                    <span className="font-black text-xs uppercase tracking-[0.2em] text-[#D05E00]">
                                        INCLUDED
                                    </span>
                                </div>
                                <ul className="space-y-1.5 text-xs text-gray-700">
                                    {Array.from(new Set(items.map(i => i.description.split('\n')[0].trim()))).map((name, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="text-[#D05E00] font-bold">•</span>
                                            <span>{name}</span>
                                        </li>
                                    ))}
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>Pre- and post-clean photographic record</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>All labour, equipment and remote pilot crew</span>
                                    </li>
                                </ul>
                            </div>

                            {/* EXCLUDED */}
                            <div className="space-y-3">
                                <div className="border-b border-gray-200 pb-1.5">
                                    <span className="font-black text-xs uppercase tracking-[0.2em] text-[#D05E00]">
                                        EXCLUDED
                                    </span>
                                </div>
                                <ul className="space-y-1.5 text-xs text-gray-700">
                                    {(invoice.metadata?.elevations || []).map((e: any, idx: number) => e.exclusions ? (
                                        <li key={`elev-ex-${idx}`} className="flex items-start gap-2 font-bold text-zinc-900">
                                            <span className="text-[#D05E00]">•</span>
                                            <span>{e.name ? `${e.name}: ` : ''}{e.exclusions}</span>
                                        </li>
                                    ) : null)}
                                    {(invoice.metadata?.conditionFlags || invoice.conditionFlags || []).map((f: any, idx: number) => (
                                        <li key={`flag-ex-${idx}`} className="flex items-start gap-2 font-bold text-zinc-900">
                                            <span className="text-[#D05E00]">•</span>
                                            <span>{f.elevation || 'Elevation'} ({f.location || 'defect area'}) — existing {(f.conditionType || 'defect').replace(/_/g, ' ').toLowerCase()} excluded from warranty</span>
                                        </li>
                                    ))}
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>Internal faces of glass, unless separately agreed</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>Hardened cement, paint and adhesive residue</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>Repair of existing damage, failed sealant or penetrated staining</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* 2. CONDITIONS OF ACCESS */}
                        <div className="space-y-3">
                            <div className="border-b border-gray-200 pb-1.5">
                                <span className="font-black text-xs uppercase tracking-[0.2em] text-[#D05E00]">
                                    CONDITIONS OF ACCESS
                                </span>
                            </div>
                            <ul className="space-y-1.5 text-xs text-gray-700">
                                <li className="flex items-start gap-2">
                                    <span className="text-[#D05E00] font-bold">•</span>
                                    <span>The client provides access to the work area and a water supply point within reach of it (unless Water Supply – Site Provision is quoted), and notifies tenants where required.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-[#D05E00] font-bold">•</span>
                                    <span>All flight operations are conducted in line with South African Civil Aviation Authority (SACAA) regulations, during daylight hours only.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-[#D05E00] font-bold">•</span>
                                    <span>Work is weather-dependent. Where wind, rain or visibility make flying unsafe, AeroWash will reschedule at no charge to the next available date.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-[#D05E00] font-bold">•</span>
                                    <span>The standard service area is within 50 km of Parow, Cape Town. Sites beyond this carry an Extended Travel provision.</span>
                                </li>
                            </ul>
                        </div>

                        {/* 3. COMMERCIAL TERMS */}
                        <div className="space-y-3">
                            <div className="border-b border-gray-200 pb-1.5">
                                <span className="font-black text-xs uppercase tracking-[0.2em] text-[#D05E00]">
                                    COMMERCIAL TERMS
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-gray-700">
                                <ul className="space-y-1.5">
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>Quotations are fixed price for the scope and elevations stated.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>A 60% deposit is payable on acceptance to secure the booking.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>The balance is payable on completion.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>This quotation is valid for 45 days from the date of issue.</span>
                                    </li>
                                </ul>
                                <ul className="space-y-1.5">
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>Any variation or additional work is quoted separately before it is carried out.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>Prices exclude VAT. If AeroWash becomes VAT-registered, VAT will be added at the prevailing rate on invoices issued on or after the registration date.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>Where work cannot start, continue or be completed for reasons outside AeroWash&apos;s control, including site access not being available or work being stopped at the client&apos;s request, a standby or return attendance charge applies, agreed with you before it is invoiced.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[#D05E00] font-bold">•</span>
                                        <span>Existing damage, failed sealant, staining that has penetrated the substrate and other pre-existing defects are recorded before work starts and are not the responsibility of AeroWash.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* 4. NOTE BOX (grey, only shown when quote has included/waived item or allowance line) */}
                        {(() => {
                            const allowanceAmt = invoice.metadata?.allowanceAmount || 0;
                            const waived = items.filter(i => i.unitPrice === 0 || i.isIncluded || (i.metadata && (i.metadata.label === 'No charge' || i.metadata.label === 'Included')));
                            if (allowanceAmt === 0 && waived.length === 0) return null;
                            const waivedNames = waived.map(i => i.description.split('\n')[0].trim()).join(' and ') || invoice.metadata?.allowanceName || "Introductory scope items";
                            return (
                                <div className="p-3.5 bg-gray-50 border-l-4 border-gray-400 rounded-r-lg text-xs text-gray-700 leading-relaxed">
                                    <strong className="text-zinc-900 font-semibold">Note on the introductory allowance.</strong> {waivedNames} are shown above at their standard value and are included at no charge on this first engagement only, as an introduction to our service. They will be quoted at standard rates on subsequent works.
                                </div>
                            );
                        })()}

                        {/* 5. ACCEPTANCE */}
                        <div className="space-y-4 pt-2">
                            <div className="border-b border-gray-200 pb-1.5">
                                <span className="font-black text-xs uppercase tracking-[0.2em] text-[#D05E00]">
                                    ACCEPTANCE
                                </span>
                            </div>
                            <p className="text-xs text-gray-600">
                                To proceed, sign below and return, or confirm by email to info@aerowash.co.za.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                                <div className="space-y-2 border-t border-gray-300 pt-2">
                                    <div className="text-[11px] text-gray-500 font-medium">Client signature · Name, position, date</div>
                                </div>
                                <div className="space-y-2 border-t border-gray-300 pt-2">
                                    <div className="text-[11px] text-gray-500 font-medium">For AeroWash (Pty) Ltd · Date</div>
                                </div>
                            </div>
                            <div className="pt-2 text-xs text-gray-500">
                                Purchase order no. (if applicable): <span className="border-b border-gray-300 inline-block w-48">&nbsp;</span>
                            </div>
                        </div>
                        </div>
                    </div>

                    {/* APPENDIX: SITE INSPECTION PHOTOGRAPHS (Page 3 style) */}
                    {(() => {
                        const siteVisitPhotosRaw: any[] = invoice.metadata?.siteVisitPhotos || invoice.siteVisitPhotos || [];
                        const flags: any[] = invoice.metadata?.conditionFlags || invoice.conditionFlags || [];
                        const referencedRefs = new Set<string>();
                        flags.forEach((f: any) => (f.photoRefs || []).forEach((r: string) => referencedRefs.add(String(r).trim())));

                        const siteVisitPhotos = siteVisitPhotosRaw.filter((p: any) => {
                            if (referencedRefs.size > 0) return referencedRefs.has(String(p.photoNumber).trim());
                            return p.isSelected !== false && p.selected !== false;
                        });
                        if (!siteVisitPhotos || siteVisitPhotos.length === 0) return null;

                        return (
                            <div className="border-t-[2px] border-gray-300 pt-8 mt-12 space-y-4">
                                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                    <span className="font-black text-xs uppercase tracking-[0.2em] text-[#D05E00]">
                                        Appendix: Site Inspection Photographs
                                    </span>
                                    <span className="text-[10px] font-mono text-gray-400">
                                        {siteVisitPhotos.length} Photographs Attached
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {siteVisitPhotos.map(photo => (
                                        <div key={photo.id} className="border border-gray-200 rounded-lg p-2.5 bg-gray-50/60 space-y-2">
                                            <div className="aspect-[4/3] bg-gray-100 rounded overflow-hidden flex items-center justify-center border border-gray-200">
                                                {photo.url ? (
                                                    <img src={photo.url} alt={`Photo ${photo.photoNumber}`} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-gray-400 text-xs">No image</div>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-[#D05E00] font-mono">Photo {photo.photoNumber}</span>
                                                <span className="text-gray-600 font-medium text-[11px] truncate max-w-[130px]">{photo.elevation}</span>
                                            </div>
                                            {photo.caption && (
                                                <p className="text-[11px] text-gray-700 leading-tight">{photo.caption}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Footer Bar */}
                <div className="bg-[#0A0A0A] text-gray-400 text-[10px] p-4 flex justify-between items-center border-t border-white/10">
                    <span>AeroWash (Pty) Ltd  ·  {isInvoice ? "Invoice " : "Quotation "}{numberLabel}</span>
                    <span>Document View</span>
                </div>
            </div>
        </div>
    );
}
