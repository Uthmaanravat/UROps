"use client";

import React, { useState } from "react";
import { formatCurrency, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Edit3, Check, FileText } from "lucide-react";
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

    const validityDays = companySettings?.validityDays || 30;
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

    const siteVisitRequired = invoice.metadata?.siteVisitRequired ?? (
        total >= 50000 || items.some(i => i.description?.toLowerCase().includes('site visit') || i.description?.toLowerCase().includes('pre-treatment'))
    );

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
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex items-center justify-center relative">
                            {/* SVG stylised AW mark */}
                            <svg viewBox="0 0 40 40" className="h-10 w-10">
                                <polygon points="6,34 14,8 20,34" fill="#D05E00" />
                                <polygon points="20,34 26,14 32,34" fill="#D05E00" />
                                <polygon points="10,34 14,24 18,34" fill="#0A0A0A" />
                                <polygon points="24,34 26,26 28,34" fill="#0A0A0A" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-sm font-black tracking-[0.25em] text-white">
                                A E R O W A S H
                            </div>
                            <div className="text-[9px] font-black tracking-[0.2em] text-[#D05E00] mt-0.5">
                                DRONE CLEANING SOLUTIONS
                            </div>
                        </div>
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
                                    {(company.website || "www.aerowash.co.za")}  ·  Reg. {company.registrationNumber || "2026/475172/07"}
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
                                {items.map((item, idx) => {
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

                                    const cleanTitle = `${idx + 1}. ${title.replace(/^\d+[\.\)]\s*/, '')}`;

                                    return (
                                        <tr key={item.id || idx} className="hover:bg-gray-50/60 transition-colors">
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

                            <div className="text-[10px] text-gray-400 text-right italic pt-1">
                                Prepared by: {prepName}, {prepPhone}
                            </div>
                        </div>
                    </div>

                    {/* NOTICE BOX (Site visit required) */}
                    {siteVisitRequired && (
                        <div className="bg-[#FFF7ED] border-l-4 border-[#D05E00] p-4 rounded-r-xl space-y-1">
                            <div className="font-bold text-xs text-[#9A3412]">
                                Site visit required to confirm this quotation
                            </div>
                            <div className="text-[11px] text-[#7C2D12] leading-relaxed">
                                Measurements are taken from aerial survey data. Before this quotation is confirmed, AeroWash will attend site at no charge to verify dimensions, assess condition, confirm water and power points and identify access constraints. A revised figure will be issued if verified measurements differ materially.
                            </div>
                        </div>
                    )}

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

                    {/* TERMS AND CONDITIONS (Page 2 style) */}
                    <div className="border-t-[2px] border-gray-300 pt-8 mt-12 space-y-4">
                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="font-black text-xs uppercase tracking-[0.2em] text-[#D05E00]">
                                Standard Terms & Conditions
                            </span>
                            <span className="text-[10px] font-mono text-gray-400">
                                {parsedClauses.length} Clauses
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-gray-600 leading-relaxed">
                            {parsedClauses.map((clause, idx) => (
                                <div key={idx} className="bg-gray-50/70 p-3 rounded-lg border border-gray-100 space-y-1">
                                    <div className="font-bold text-zinc-900">
                                        Clause {idx + 1}
                                    </div>
                                    <div className="whitespace-pre-line">
                                        {clause}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
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
