"use client"
import React from 'react'

import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { Download, FileCheck, CreditCard, ArrowLeft, Trash2, Mail, FileText, Lock, Unlock } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import jsPDF from "jspdf"
import { drawPdfHeader } from "@/lib/pdf-utils"
import autoTable from "jspdf-autotable"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { convertToInvoiceAction, recordPaymentAction, deleteInvoiceAction } from "@/app/(dashboard)/invoices/actions"
import { sendInvoiceEmail } from "@/app/(dashboard)/invoices/email-actions"
import { updateInvoiceItemsAction, finalizeQuoteAction, approveQuoteAction, updateInvoiceNoteAction } from "@/app/(dashboard)/invoices/pricing-actions"
import { updateInvoiceProjectAction, updateProjectCommercialStatusAction, updateInvoiceDetailsAction } from "@/app/(dashboard)/invoices/project-actions"
import { useState, useEffect, Fragment } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function InvoiceViewer({ invoice, companySettings, availableProjects = [] }: { invoice: any, companySettings?: any, availableProjects?: any[] }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    // Use local state for items to allow instant UI updates for grouping/calculations
    const [items, setItems] = useState<any[]>(invoice.items);
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(invoice.type === 'QUOTE');

    // Header edit state
    const [site, setSite] = useState(invoice.site || "");
    const [reference, setReference] = useState(invoice.reference || "");
    const [quoteNumber, setQuoteNumber] = useState(invoice.quoteNumber || "");
    const [date, setDate] = useState(new Date(invoice.date).toISOString().split('T')[0]);
    const [projectId, setProjectId] = useState(invoice.projectId || "");
    const [projectName, setProjectName] = useState(invoice.project?.name || "");
    const [commercialStatus, setCommercialStatus] = useState<any>(invoice.project?.commercialStatus || "AWAITING_PO");

    // Add new Item Handler
    const handleAddItem = () => {
        const newItem = {
            id: `new-${Date.now()}`,
            description: "NEW ITEM",
            quantity: 1,
            unitPrice: 0,
            unit: "EA",
            area: "",
            total: 0
        };
        setItems([...items, newItem]);
    };

    const handleDeleteItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const [recipientEmails, setRecipientEmails] = useState(invoice.client.email || "");

    // Auto-fetch suggested quote number if missing
    useEffect(() => {
        if (invoice.type === 'QUOTE' && !invoice.quoteNumber && !quoteNumber) {
            const fetchSuggested = async () => {
                const { getQuoteSequenceAction } = await import("@/app/(dashboard)/invoices/actions");
                const suggested = await getQuoteSequenceAction();
                if (suggested) setQuoteNumber(suggested);
            };
            fetchSuggested();
        }
    }, [invoice.id, invoice.type, invoice.quoteNumber]);

    // Allow editing unless it's fully paid
    const isPricingMode = invoice.status !== 'PAID';

    const handleItemUpdate = (id: string, field: string, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                // Recalculate line total if price/qty changes
                if (field === 'unitPrice' || field === 'quantity') {
                    updated.total = updated.quantity * updated.unitPrice;
                }
                return updated;
            }
            return item;
        }));
    };

    const [note, setNote] = useState(invoice.notes || "");

    const saveChanges = async () => {
        setLoading(true);
        // Map local items to the format expected by the server action
        const updates = items.map(item => ({
            id: item.id,
            description: item.description,
            area: item.area,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice
        }));

        const promises = [];
        if (updates.length > 0) {
            promises.push(updateInvoiceItemsAction(invoice.id, updates));
        }

        // Always save note if it's different
        if (note !== invoice.notes) {
            promises.push(updateInvoiceNoteAction(invoice.id, note));
        }

        // Handle Project/Site/Ref/QuoteNumber updates
        if (site !== invoice.site || reference !== invoice.reference || quoteNumber !== invoice.quoteNumber || date !== new Date(invoice.date).toISOString().split('T')[0]) {
            promises.push(updateInvoiceDetailsAction(invoice.id, { site, reference, quoteNumber, date }));
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }

        setLoading(false);
        router.refresh();
    }

    const handleProjectChange = async (newProjectId: string) => {
        setLoading(true);
        setProjectId(newProjectId);
        await updateInvoiceProjectAction(invoice.id, newProjectId === "" ? null : newProjectId);
        setLoading(false);
        router.refresh();
    }

    const handleCommercialStatusChange = async (status: any) => {
        if (!invoice.projectId) {
            alert("No project linked to this document.");
            return;
        }
        setLoading(true);
        setCommercialStatus(status);
        await updateProjectCommercialStatusAction(invoice.projectId, status);
        setLoading(false);
        router.refresh();
    }

    const handleApprove = async () => {
        if (!confirm("Approve this Quote? This will lock it and generate a Draft Invoice.")) return;
        setLoading(true);
        await saveChanges();
        await convertToInvoiceAction(invoice.id);
        setLoading(false);
        router.refresh(); // Refresh to show new status
        // router.push(`/work-breakdown-pricing`); // Maybe stay on page or go to list?
        // Actually, flow says "Move project to Invoice stage".
        // The user might want to stay on the invoice page which is now an invoice.
    }

    // Default company details if not set
    const company = {
        name: companySettings?.name || "LR Builders & Maintenance Pty (Ltd)",
        address: companySettings?.address || "15 Culemborg Street, Avondale, Parow, Cape Town, 7500",
        email: companySettings?.email || "Loedvi@lrbuilders.co.za",
        phone: companySettings?.phone || "082 448 7490",
        logoUrl: companySettings?.logoUrl || "",
        vatNumber: companySettings?.taxId || "",
        paymentTerms: companySettings?.paymentTerms || "",
        bankDetails: companySettings?.bankDetails || "Name: LR Builders & Maintenance Pty (Ltd), Bank: FNB, Acc No.: 63114141714, Branch Code: 200510"
    };

    const handleSendEmail = async () => {
        if (!recipientEmails) {
            alert("Please provide at least one email address.");
            return;
        }

        const emails = recipientEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
        if (emails.length === 0) {
            alert("Invalid email format.");
            return;
        }

        setLoading(true);
        const res = await sendInvoiceEmail(invoice.id, emails);
        setLoading(false);
        if (res.success) {
            alert("Email sent successfully!");
            setIsEmailDialogOpen(false);
            router.refresh();
        } else {
            alert(res.error || "Failed to send email");
        }
    }

    const currencySymbol = companySettings?.currency || "R";

    const generatePDF = async () => {
        const doc = new jsPDF();
        const currencySymbol = companySettings?.currency || "R";

        // 1. Header Bar (Shared)
        const numberLabel = invoice.quoteNumber
            ? invoice.quoteNumber
            : (invoice.type === 'QUOTE' ? `Q-${new Date(invoice.date).getFullYear()}-${invoice.number.toString().padStart(3, '0')}` : `INV-${new Date(invoice.date).getFullYear()}-${invoice.number.toString().padStart(3, '0')}`);
        
        const badge = invoice.status === 'CHECKED' ? '✓ VERIFIED / CHECKED' : undefined;
        const nextY = await drawPdfHeader(doc, company, invoice.type === 'QUOTE' ? 'QUOTATION' : 'TAX INVOICE', numberLabel, badge);

        // 2. Metadata Section (3-Column Layout)
        const gridY = nextY + 5; // e.g., 53

        // Column 1: Document Details
        doc.setTextColor(163, 230, 53); // Lime 
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("DETAILS", 14, gridY);

        let detailY = gridY + 6;
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.setFont("helvetica", "normal");
        doc.text("Date Issued:", 14, detailY);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.text(new Date(invoice.date).toLocaleDateString('en-GB'), 36, detailY);
        detailY += 6;

        if (invoice.project?.name) {
            const projectLines = doc.splitTextToSize(invoice.project.name, 45);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.setFont("helvetica", "normal");
            doc.text("Project:", 14, detailY);
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.text(projectLines, 36, detailY);
            detailY += (projectLines.length * 4.5);
        }

        if (invoice.site) {
            const siteLines = doc.splitTextToSize(invoice.site, 45);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.setFont("helvetica", "normal");
            doc.text("Site:", 14, detailY);
            doc.setTextColor(30, 41, 59);
            doc.text(siteLines, 36, detailY);
            detailY += (siteLines.length * 4.5);
        }

        if (reference) {
            const refLines = doc.splitTextToSize(reference, 45);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.setFont("helvetica", "normal");
            doc.text("Ref:", 14, detailY);
            doc.setTextColor(30, 41, 59);
            doc.text(refLines, 36, detailY);
            detailY += (refLines.length * 4.5);
        }

        // Column 2: Bill To
        doc.setTextColor(163, 230, 53); // Lime 
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("BILL TO", 85, gridY);
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        const billToName = (invoice.client.companyName || invoice.client.name).toUpperCase();
        doc.text(billToName, 85, gridY + 6);
        
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        
        let clientLegalY = gridY + 11;
        // @ts-ignore
        if (invoice.client.attentionTo) {
            // @ts-ignore
            doc.text(`Attn: ${invoice.client.attentionTo}`, 85, clientLegalY);
            clientLegalY += 4.5;
        }

        const billToLines = doc.splitTextToSize(invoice.client.address || "", 55);
        doc.text(billToLines, 85, clientLegalY);
        clientLegalY += (billToLines.length * 4.5);

        doc.setFontSize(8);
        if (invoice.client.vatNumber) {
            doc.text(`VAT: ${invoice.client.vatNumber}`, 85, clientLegalY);
            clientLegalY += 4.5;
        }
        if (invoice.client.registrationNumber) {
            doc.text(`REG: ${invoice.client.registrationNumber}`, 85, clientLegalY);
            clientLegalY += 4.5;
        }

        // Column 3: From (Company Contact)
        doc.setTextColor(163, 230, 53); // Lime
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("FROM", 196, gridY, { align: 'right' });

        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        let fromY = gridY + 6;
        doc.text(company.name, 196, fromY, { align: 'right' });
        
        fromY += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);

        if (company.vatNumber) {
            doc.text(`VAT: ${company.vatNumber}`, 196, fromY, { align: 'right' });
            fromY += 4.5;
        }

        const compAddr = doc.splitTextToSize(company.address, 55);
        doc.text(compAddr, 196, fromY, { align: 'right' });
        fromY += (compAddr.length * 4.5);

        doc.setTextColor(163, 230, 53); // Lime
        doc.setFont("helvetica", "bold");
        doc.text(company.phone, 196, fromY, { align: 'right' });
        fromY += 4.5;
        
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text(company.email, 196, fromY, { align: 'right' });

        // Calculate dynamic table start Y
        const startTableY = Math.max(detailY, clientLegalY, fromY) + 10;

        // 3. Table with Sequential Grouping
        const tableBody: any[] = [];
        const sequentialGroups: { area: string, items: any[] }[] = [];
        items.forEach((item: any) => {
            const area = item.area?.trim() || "";
            const lastGroup = sequentialGroups[sequentialGroups.length - 1];
            if (lastGroup && lastGroup.area === area) {
                lastGroup.items.push(item);
            } else {
                sequentialGroups.push({ area, items: [item] });
            }
        });

        sequentialGroups.forEach((group: any, gIdx: number) => {
            // Calculate global start index for this group
            let globalStartIndex = 0;
            for (let i = 0; i < gIdx; i++) {
                globalStartIndex += sequentialGroups[i].items.length;
            }

            if (group.area) {
                tableBody.push([{ content: group.area.toUpperCase(), colSpan: 6, styles: { fillColor: [248, 250, 252], textColor: [20, 20, 30], fontStyle: 'bold', fontSize: 7.5, halign: 'left', cellPadding: 1.5 } }]);
            }
            group.items.forEach((item: any, iIdx: number) => {
                const desc = item.notes ? `${item.description}\n(Notes: ${item.notes})` : item.description;
                tableBody.push([
                    globalStartIndex + iIdx + 1,
                    desc,
                    item.quantity,
                    item.unit || '',
                    formatCurrency(item.unitPrice, currencySymbol),
                    formatCurrency(item.quantity * item.unitPrice, currencySymbol)
                ]);
            });
        });

        autoTable(doc, {
            head: [['#', 'DESCRIPTION', 'QTY', 'UNIT', 'PRICE', 'TOTAL']],
            body: tableBody,
            startY: startTableY,
            theme: 'striped',
            headStyles: {
                fillColor: [20, 20, 30],
                textColor: [163, 230, 53],
                fontStyle: 'bold',
                fontSize: 8.5,
                halign: 'left'
            },
            bodyStyles: {
                fontSize: 7.5,
                textColor: [20, 20, 30],
                cellPadding: 1.5
            },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 87 },
                2: { halign: 'center' },
                3: { halign: 'center' },
                4: { halign: 'right' },
                5: { halign: 'right', fontStyle: 'bold' }
            },
            alternateRowStyles: {
                fillColor: [252, 254, 255]
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 12;

        // Check if footer components will fit on current page
        const pageHeight = doc.internal.pageSize.getHeight();
        const footerEstimate = 60; // Estimated height for summary + notes + banking
        let currentY = finalY;

        if (currentY + footerEstimate > pageHeight - 15) {
            doc.addPage();
            currentY = 25; // Reset to top of new page
        }

        // 4. Summary (Standard Style)
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(135, currentY - 5, 196, currentY - 5);

        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "normal");
        doc.text(`Subtotal:`, 140, currentY);
        doc.text(formatCurrency(invoice.subtotal, currencySymbol), 196, currentY, { align: 'right' });

        doc.text(`VAT (15%):`, 140, currentY + 6);
        doc.text(formatCurrency(invoice.taxAmount, currencySymbol), 196, currentY + 6, { align: 'right' });

        doc.setFontSize(11);
        doc.setTextColor(20, 20, 30);
        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL DUE:`, 140, currentY + 14);
        doc.text(formatCurrency(invoice.total, currencySymbol), 196, currentY + 14, { align: 'right' });

        // 5. Notes & Banking (Professional Footer)
        currentY += 28;

        if (note) {
            const noteLines = doc.splitTextToSize(note, 180);
            const noteHeight = (noteLines.length * 4.5) + 10;

            if (currentY + noteHeight > pageHeight - 15) {
                doc.addPage();
                currentY = 25;
            }

            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(20, 20, 30);
            doc.text("TERMS & NOTES", 14, currentY);
            doc.setDrawColor(163, 230, 53); // Lime separator
            doc.line(14, currentY + 2, 40, currentY + 2);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            doc.text(noteLines, 14, currentY + 8);
            currentY += noteHeight + 5;
        }

        const bankLines = doc.splitTextToSize(company.bankDetails, 180);
        const bankHeight = (bankLines.length * 4.5) + 10;

        if (currentY + bankHeight > pageHeight - 15) {
            doc.addPage();
            currentY = 25;
        }

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 30);
        doc.text("BANKING DETAILS", 14, currentY);
        doc.setDrawColor(163, 230, 53);
        doc.line(14, currentY + 2, 40, currentY + 2);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(bankLines, 14, currentY + 8);

        doc.save(`${numberLabel}.pdf`);
    }

    const generateExcel = async () => {
        setLoading(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(invoice.type === 'QUOTE' ? 'Quote' : 'Invoice');

            const numberLabel = invoice.quoteNumber
                ? invoice.quoteNumber
                : (invoice.type === 'QUOTE' ? `Q-${new Date(invoice.date).getFullYear()}-${invoice.number.toString().padStart(3, '0')}` : `INV-${new Date(invoice.date).getFullYear()}-${invoice.number.toString().padStart(3, '0')}`);

            // 1. Set Column Widths
            worksheet.columns = [
                { width: 5 },  // #
                { width: 25 }, // Area / Meta Labels
                { width: 45 }, // Description
                { width: 8 },  // Qty
                { width: 8 },  // Unit
                { width: 15 }, // Price
                { width: 15 }  // Total
            ];

            // 2. Branding Bars (Navy and Lime)
            const navyBar = worksheet.getRow(1);
            navyBar.height = 12;
            worksheet.mergeCells('A1:G1');
            worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14141E' } };

            const limeBar = worksheet.getRow(2);
            limeBar.height = 3;
            worksheet.mergeCells('A2:G2');
            worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA3E635' } };

            // 3. Logo & Document Title
            worksheet.getRow(4).height = 40;
            if (company.logoUrl) {
                try {
                    const response = await fetch(company.logoUrl);
                    const buffer = await response.arrayBuffer();
                    const imageId = workbook.addImage({
                        buffer: buffer,
                        extension: 'png',
                    });
                    worksheet.addImage(imageId, {
                        tl: { col: 0, row: 3 },
                        ext: { width: 100, height: 50 }
                    });
                } catch (e) {
                    console.error("Logo fetch failed", e);
                }
            }

            worksheet.mergeCells('F4:G4');
            const titleCell = worksheet.getCell('F4');
            titleCell.value = invoice.type === 'QUOTE' ? 'QUOTATION' : 'TAX INVOICE';
            titleCell.font = { name: 'Arial', bold: true, size: 20, color: { argb: 'FF14141E' } };
            titleCell.alignment = { horizontal: 'right', vertical: 'middle' };

            worksheet.mergeCells('F5:G5');
            const numCell = worksheet.getCell('F5');
            numCell.value = numberLabel;
            numCell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FFA3E635' } };
            numCell.alignment = { horizontal: 'right' };

            // 4. Metadata (Bill To, Dates, Project)
            let currentRow = 8;
            
            worksheet.getCell(`A${currentRow}`).value = 'DATE:';
            worksheet.getCell(`B${currentRow}`).value = new Date(invoice.date).toLocaleDateString('en-GB');
            worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 10 };
            currentRow++;

            worksheet.getCell(`A${currentRow}`).value = 'PROJECT:';
            worksheet.getCell(`B${currentRow}`).value = invoice.project?.name || 'N/A';
            worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 10 };
            currentRow++;

            worksheet.getCell(`A${currentRow}`).value = 'SITE:';
            worksheet.getCell(`B${currentRow}`).value = invoice.site || 'N/A';
            worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 10 };
            currentRow++;

            currentRow += 2;
            worksheet.getCell(`A${currentRow}`).value = 'BILL TO:';
            worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 11, color: { argb: 'FF14141E' } };
            currentRow++;
            worksheet.getCell(`A${currentRow}`).value = invoice.client.companyName || invoice.client.name;
            worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
            currentRow++;
            worksheet.mergeCells(`A${currentRow}:B${currentRow+1}`);
            worksheet.getCell(`A${currentRow}`).value = invoice.client.address;
            worksheet.getCell(`A${currentRow}`).alignment = { wrapText: true, vertical: 'top' };
            currentRow += 2;
            if (invoice.client.vatNumber) {
                worksheet.getCell(`A${currentRow}`).value = `VAT: ${invoice.client.vatNumber}`;
                worksheet.getCell(`A${currentRow}`).font = { size: 10 };
                currentRow++;
            }

            // 5. Table Head
            currentRow += 2;
            const tableHead = worksheet.getRow(currentRow);
            tableHead.values = ['#', 'AREA/HEADING', 'DESCRIPTION', 'QTY', 'UNIT', 'PRICE', 'TOTAL'];
            tableHead.font = { bold: true, size: 9, color: { argb: 'FFA3E635' } };
            tableHead.height = 20;
            tableHead.eachCell((cell, colNumber) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14141E' } };
                cell.alignment = { 
                    vertical: 'middle', 
                    horizontal: colNumber === 1 || colNumber === 4 || colNumber === 5 ? 'center' : (colNumber >= 6 ? 'right' : 'left')
                };
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
            });

            // 6. Table Body with Sequential Grouping
            const sequentialGroups: { area: string, items: any[] }[] = [];
            items.forEach((item: any) => {
                const area = item.area?.trim() || "";
                const lastGroup = sequentialGroups[sequentialGroups.length - 1];
                if (lastGroup && lastGroup.area === area) {
                    lastGroup.items.push(item);
                } else {
                    sequentialGroups.push({ area, items: [item] });
                }
            });

            currentRow++;
            sequentialGroups.forEach((group: any, gIdx: number) => {
                // Calculate global start index for this group
                let globalStartIndex = 0;
                for (let i = 0; i < gIdx; i++) {
                    globalStartIndex += sequentialGroups[i].items.length;
                }

                if (group.area) {
                    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
                    const groupCell = worksheet.getCell(`A${currentRow}`);
                    groupCell.value = group.area.toUpperCase();
                    groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    groupCell.font = { bold: true, size: 8, italic: true, color: { argb: 'FF14141E' } };
                    groupCell.alignment = { horizontal: 'left' };
                    currentRow++;
                }

                group.items.forEach((item: any, iIdx: number) => {
                    const row = worksheet.getRow(currentRow);
                    row.height = 18; // Even more compact
                    row.values = [
                        globalStartIndex + iIdx + 1,
                        '',
                        item.notes ? `${item.description}\n(Notes: ${item.notes})` : item.description,
                        item.quantity,
                        item.unit || '',
                        item.unitPrice,
                        item.quantity * item.unitPrice
                    ];
                    
                    row.getCell(1).alignment = { horizontal: 'center' };
                    row.getCell(3).alignment = { wrapText: true, horizontal: 'left' };
                    row.getCell(4).alignment = { horizontal: 'right' };
                    row.getCell(5).alignment = { horizontal: 'right' };
                    row.getCell(6).alignment = { horizontal: 'right' };
                    row.getCell(6).numFmt = '"R"#,##0.00';
                    row.getCell(7).alignment = { horizontal: 'right' };
                    row.getCell(7).numFmt = '"R"#,##0.00';
                    row.getCell(7).font = { bold: true };
                    
                    // Borders
                    row.eachCell((cell) => {
                        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } } };
                    });
                    currentRow++;
                });
            });

            // 7. Totals
            currentRow++;
            worksheet.getCell(`F${currentRow}`).value = 'Subtotal';
            worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
            worksheet.getCell(`G${currentRow}`).value = subtotal;
            worksheet.getCell(`G${currentRow}`).numFmt = '"R"#,##0.00';
            worksheet.getCell(`G${currentRow}`).alignment = { horizontal: 'right' };
            currentRow++;
            worksheet.getCell(`F${currentRow}`).value = 'VAT (15%)';
            worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
            worksheet.getCell(`G${currentRow}`).value = taxAmount;
            worksheet.getCell(`G${currentRow}`).numFmt = '"R"#,##0.00';
            worksheet.getCell(`G${currentRow}`).alignment = { horizontal: 'right' };
            currentRow++;
            const totalRow = worksheet.getRow(currentRow);
            totalRow.getCell(6).value = 'TOTAL DUE';
            totalRow.getCell(6).font = { bold: true, size: 12 };
            totalRow.getCell(6).alignment = { horizontal: 'right' };

            totalRow.getCell(7).value = total;
            totalRow.getCell(7).font = { bold: true, size: 13 };
            totalRow.getCell(7).numFmt = '"R"#,##0.00';
            totalRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA3E635' } };
            totalRow.getCell(7).alignment = { horizontal: 'right' };

            // 8. Footer (Banking & Notes)
            currentRow += 2;
            worksheet.getCell(`A${currentRow}`).value = 'BANKING DETAILS';
            worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 10, color: { argb: 'FF14141E' } };
            currentRow++;
            worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = company.bankDetails;
            worksheet.getCell(`A${currentRow}`).font = { size: 9, color: { argb: 'FF475569' } };
            worksheet.getRow(currentRow).height = 25;
            worksheet.getCell(`A${currentRow}`).alignment = { wrapText: true };

            if (note) {
                currentRow += 2;
                worksheet.getCell(`A${currentRow}`).value = 'TERMS & NOTES';
                worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 10, color: { argb: 'FF14141E' } };
                currentRow++;
                worksheet.mergeCells(`A${currentRow}:G${currentRow + 2}`);
                worksheet.getCell(`A${currentRow}`).value = note;
                worksheet.getCell(`A${currentRow}`).font = { size: 9, color: { argb: 'FF475569' } };
                worksheet.getCell(`A${currentRow}`).alignment = { wrapText: true, vertical: 'top' };
            }

            // Write and Save
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `${numberLabel}.xlsx`);
        } catch (e) {
            console.error("Excel generation error", e);
            alert("Failed to generate styled Excel document.");
        } finally {
            setLoading(false);
        }
    };

    const handleConvert = async () => {
        const poNumber = prompt("Please enter the Client PO Number (Optional):");
        if (poNumber === null) return;

        if (!confirm("Convert this Quote to an Invoice?")) return;
        setLoading(true);
        await convertToInvoiceAction(invoice.id, poNumber);
        setLoading(false);
        router.refresh();
    }

    const handlePayment = async () => {
        const amountStr = prompt("Enter payment amount:", (invoice.total - invoice.payments.reduce((acc: number, p: any) => acc + p.amount, 0)).toFixed(2));
        if (!amountStr) return;
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) return;

        setLoading(true);
        await recordPaymentAction({ invoiceId: invoice.id, amount, method: "CASH", date: new Date().toISOString() });
        setLoading(false);
        router.refresh();
    }

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete this ${invoice.type.toLowerCase()}? This cannot be undone.`)) return;
        setLoading(true);
        try {
            await deleteInvoiceAction(invoice.id);
        } catch (error) {
            alert("Failed to delete. Please try again.");
            setLoading(false);
        }
    }

    const paidAmount = invoice.payments.reduce((acc: number, p: any) => acc + p.amount, 0);
    const balance = invoice.total - paidAmount;
    const isPaid = balance <= 0.01;

    // Recalculate totals from local items
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const taxAmount = subtotal * 0.15;
    const total = subtotal + taxAmount;

    return (
        <div className="max-w-5xl mx-auto space-y-6 px-4 md:px-0 pb-20">
            {/* Header Actions */}
            {/* Professional Action Bar */}
            <div className="flex flex-col xl:flex-row justify-between items-center gap-6 py-8 print:hidden border-b border-white/5 pb-10">
                <Link href="/work-breakdown-pricing">
                    <Button variant="ghost" className="hover:bg-white/5 text-muted-foreground font-black uppercase tracking-widest text-[10px]">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Workspace
                    </Button>
                </Link>
                
                <div className="flex flex-wrap items-center justify-center gap-3">
                    {/* Document & Sharing Actions */}
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shadow-inner">
                        <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={loading} className="h-10 px-4 rounded-lg hover:bg-white/10 text-white font-bold text-xs">
                                    <Mail className="mr-2 h-4 w-4 text-primary" /> Email
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-[#0F172A] border-white/10 text-white">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-wider">Send via Email</DialogTitle>
                                    <DialogDescription className="text-gray-400">
                                        Send this {invoice.type.toLowerCase()} directly to the client.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-6 py-6">
                                    <div className="space-y-3">
                                        <Label htmlFor="emails" className="text-[10px] font-black uppercase tracking-widest text-primary">Recipient Emails</Label>
                                        <Input
                                            id="emails"
                                            placeholder="client@example.com, admin@example.com"
                                            value={recipientEmails}
                                            onChange={(e) => setRecipientEmails(e.target.value)}
                                            className="bg-white/5 border-white/10 text-white h-12 focus:border-primary"
                                        />
                                        <p className="text-[10px] text-muted-foreground italic">Separate multiple addresses with commas.</p>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsEmailDialogOpen(false)} className="text-gray-400">Cancel</Button>
                                    <Button onClick={handleSendEmail} disabled={loading || !recipientEmails} className="bg-primary text-primary-foreground font-black px-8">
                                        {loading ? "Sending..." : "Dispatch Email"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <div className="w-px h-6 bg-white/10 self-center mx-1" />

                        <Button variant="ghost" size="sm" onClick={generateExcel} disabled={loading} className="h-10 px-4 rounded-lg hover:bg-white/10 text-white font-bold text-xs">
                            <Download className="mr-2 h-4 w-4 text-emerald-500" /> Excel
                        </Button>
                        <Button variant="ghost" size="sm" onClick={generatePDF} disabled={loading} className="h-10 px-4 rounded-lg hover:bg-white/10 text-white font-bold text-xs">
                            <Download className="mr-2 h-4 w-4 text-rose-500" /> PDF
                        </Button>
                        
                        <div className="w-px h-6 bg-white/10 self-center mx-1" />
                        
                        <Button variant="ghost" size="sm" onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)} className="h-10 px-4 rounded-lg hover:bg-white/10 text-white font-bold text-xs">
                            <FileText className="mr-2 h-4 w-4 text-blue-400" /> {showDetailedBreakdown ? "Summarized" : "Detailed"}
                        </Button>
                    </div>

                    {/* Status & Management Actions */}
                    <div className="flex gap-2">
                        {invoice.type === 'QUOTE' && invoice.status !== 'INVOICED' && (
                            <Button onClick={handleConvert} disabled={loading} variant="outline" className="border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-black uppercase tracking-widest text-[10px] h-12 px-6 rounded-xl">
                                <FileCheck className="mr-2 h-4 w-4" /> Convert to Invoice
                            </Button>
                        )}
                        {!isPaid && (
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    if (!window.confirm(`Are you sure you want to ${invoice.status === 'PAID' ? 'unlock' : 'mark as paid and lock'} this document?`)) return;
                                    setLoading(true);
                                    const { updateInvoiceStatus } = await import("@/app/(dashboard)/invoices/actions");
                                    await updateInvoiceStatus(invoice.id, invoice.status === 'PAID' ? 'DRAFT' : 'PAID');
                                    setLoading(false);
                                    router.refresh();
                                }}
                                disabled={loading}
                                className={cn(
                                    invoice.status === 'PAID' ? "text-red-500 border-red-500/20 bg-red-500/5 hover:bg-red-500/10" : "text-green-500 border-green-500/20 bg-green-500/5 hover:bg-green-500/10"
                                )}
                            >
                                {invoice.status === 'PAID' ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                                {invoice.status === 'PAID' ? "Unlock" : "Mark as Paid (Lock)"}
                            </Button>
                        )}

                        {invoice.status !== 'PAID' && (
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    setLoading(true);
                                    const { updateInvoiceStatus } = await import("@/app/(dashboard)/invoices/actions");
                                    await updateInvoiceStatus(invoice.id, invoice.status === 'CHECKED' ? 'DRAFT' : 'CHECKED');
                                    setLoading(false);
                                    router.refresh();
                                }}
                                disabled={loading}
                                className={cn(
                                    "font-black uppercase tracking-widest text-[10px] h-12 px-6 rounded-xl transition-all",
                                    invoice.status === 'CHECKED' ? "text-cyan-500 border-cyan-500/20 bg-cyan-500/5" : "text-white/60 border-white/10 hover:bg-white/5"
                                )}
                            >
                                <FileCheck className={cn("mr-2 h-4 w-4", invoice.status === 'CHECKED' && "text-cyan-500")} />
                                {invoice.status === 'CHECKED' ? "Verified" : "Mark as Checked"}
                            </Button>
                        )}

                        {invoice.type === 'INVOICE' && !isPaid && (
                            <Button onClick={handlePayment} disabled={loading} className="bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] h-12 px-6 rounded-xl shadow-xl shadow-primary/20">
                                <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                            </Button>
                        )}

                        <Button variant="ghost" onClick={handleDelete} disabled={loading} className="h-12 w-12 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Preview Area - Overhauled to Premium Dark Theme */}
            <div className="bg-[#0F172A] text-white p-4 md:p-8 shadow-2xl min-h-[800px] md:min-h-[1000px] font-sans relative border-0 rounded-2xl overflow-hidden ring-1 ring-white/10 w-full max-w-full">
                {isPaid && invoice.type === 'INVOICE' && (
                    <div className="absolute top-10 right-4 md:top-48 md:right-48 border-[4px] md:border-[12px] border-primary/20 text-primary/20 font-black text-2xl md:text-9xl p-2 md:p-8 rotate-[-20deg] uppercase pointer-events-none select-none tracking-tighter z-10 opacity-50 md:opacity-100">
                        PAID
                    </div>
                )}

                {/* Modern Professional Document Header */}
                <div className="bg-white -mx-4 -mt-4 md:-mx-8 md:-mt-8 p-4 md:p-10 mb-5 md:mb-8 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-5 border-b border-gray-200">
                    <div className="flex flex-col md:flex-row items-center gap-3 md:gap-8 text-center md:text-left">
                        {company.logoUrl ? (
                            <img src={company.logoUrl} alt="Logo" className="h-14 md:h-20 w-auto object-contain" />
                        ) : (
                            <div className="h-14 w-14 md:h-16 md:w-16 bg-primary flex items-center justify-center font-black text-[#0F172A] text-xl md:text-2xl rounded-lg md:rounded-xl shadow-lg rotate-3 outline outline-2 outline-primary/20">LR</div>
                        )}
                        <div>
                            <h1 className="text-xl md:text-3xl font-black tracking-tight text-[#1E293B]">{company.name}</h1>
                            <div className="flex flex-wrap justify-center md:justify-start gap-2 md:gap-3 mt-1 md:mt-2">
                                <p className="text-gray-500 text-[9px] md:text-xs font-semibold uppercase tracking-wider">{company.phone}</p>
                                <span className="text-gray-300 hidden md:inline">•</span>
                                <p className="text-gray-500 text-[9px] md:text-xs font-semibold lowercase">{company.email}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-center md:text-right border-t border-gray-100 pt-3 md:pt-0 md:border-t-0 w-full md:w-auto">
                        <div className="flex flex-col items-center md:items-end gap-1">
                            {invoice.status === 'CHECKED' && (
                                <span className="bg-cyan-500/10 text-cyan-600 text-[10px] font-black px-2 py-0.5 rounded-full border border-cyan-500/20 uppercase tracking-widest mb-1 animate-in fade-in zoom-in-95 duration-300">
                                    ✓ VERIFIED / CHECKED
                                </span>
                            )}
                            <h2 className="text-lg md:text-3xl font-black uppercase tracking-[0.2em] text-[#1E293B]">{invoice.type === 'QUOTE' ? 'QUOTATION' : 'TAX INVOICE'}</h2>
                        </div>
                        <div className="flex items-center justify-center md:justify-end gap-1 md:gap-2 mt-1">
                            <span className="text-primary font-mono text-xs md:text-base font-black">#</span>
                            <input
                                value={quoteNumber}
                                onChange={(e) => setQuoteNumber(e.target.value)}
                                onBlur={saveChanges}
                                className="bg-transparent border-none text-primary font-mono font-black text-sm md:text-xl w-32 md:w-48 text-center md:text-right outline-none focus:ring-2 focus:ring-primary/20 rounded-lg transition-all"
                                disabled={invoice.status === 'PAID'}
                            />
                        </div>
                    </div>
                </div>

                {/* Professionally Organized Metadata & Billing */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 mb-8 md:mb-10 items-start">
                    {/* Column 1: Document Details & Settings */}
                    <div className="flex flex-col space-y-4">
                        <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.3em] text-center md:text-left">Details</h3>
                        <div className="bg-[#1E293B] p-4 rounded-2xl w-full border border-white/5 space-y-2 group shadow-xl ring-1 ring-white/5">
                            <div className="flex justify-between items-center text-xs border-b border-white/5 pb-1.5 transition-all group-hover:border-primary/20">
                                <span className="text-gray-500 font-black uppercase tracking-widest text-[8px]">Date Issued</span>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="bg-transparent border-none text-right font-bold text-white outline-none focus:ring-0 text-[10px] md:text-xs cursor-pointer"
                                    disabled={invoice.status === 'PAID'}
                                />
                            </div>
                            <div className="flex justify-between items-center text-xs border-b border-white/5 pb-1.5 transition-all group-hover:border-primary/20">
                                <span className="text-primary font-black uppercase tracking-widest text-[8px]">Project Link</span>
                                <select
                                    value={projectId}
                                    onChange={(e) => handleProjectChange(e.target.value)}
                                    className="bg-transparent border-none text-right font-black text-primary outline-none focus:ring-0 max-w-[120px] md:max-w-[150px] text-[10px] md:text-xs cursor-pointer"
                                    disabled={invoice.status === 'PAID'}
                                >
                                    <option value="" className="bg-[#1E293B]">Select Project</option>
                                    {availableProjects.map((p: any) => (
                                        <option key={p.id} value={p.id} className="bg-[#1E293B] uppercase">{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            {invoice.projectId && (
                                <div className="flex justify-between items-center text-xs border-b border-white/5 pb-1.5 transition-all group-hover:border-primary/20">
                                    <span className="text-gray-400 font-black uppercase tracking-widest text-[8px]">Rename</span>
                                    <input
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        onBlur={async () => {
                                            if (projectName !== invoice.project?.name) {
                                                const { updateProject } = await import("@/app/(dashboard)/projects/actions");
                                                await updateProject(invoice.projectId!, { name: projectName });
                                                router.refresh();
                                            }
                                        }}
                                        className="bg-transparent border-none text-right font-bold text-white outline-none focus:ring-0 text-[10px] md:text-xs w-full max-w-[150px]"
                                        disabled={invoice.status === 'PAID'}
                                    />
                                </div>
                            )}
                            {invoice.projectId && (
                                <div className="flex justify-between items-center text-xs border-b border-white/5 pb-1.5 transition-all group-hover:border-primary/20">
                                    <span className="text-[7px] font-black uppercase tracking-widest text-[#64748B]">Commercial Status</span>
                                    <select
                                        value={commercialStatus}
                                        onChange={(e) => handleCommercialStatusChange(e.target.value)}
                                        className={cn(
                                            "bg-transparent border-none text-right font-black outline-none focus:ring-0 text-[10px] md:text-xs cursor-pointer px-2 py-0 md:py-1 rounded transition-colors",
                                            commercialStatus === 'EMERGENCY_WORK' ? "bg-red-500/20 text-red-500 mr-[-8px]" :
                                                commercialStatus === 'PO_RECEIVED' ? "bg-primary/20 text-primary mr-[-8px]" :
                                                    "text-white"
                                        )}
                                        disabled={invoice.status === 'PAID'}
                                    >
                                        <option value="AWAITING_PO" className="bg-[#1E293B]">AWAITING PO</option>
                                        <option value="PO_RECEIVED" className="bg-[#1E293B]">PO RECEIVED</option>
                                        <option value="EMERGENCY_WORK" className="bg-[#1E293B]">EMERGENCY WORK</option>
                                    </select>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-xs border-b border-white/5 pb-1.5 transition-all group-hover:border-primary/20">
                                <span className="text-gray-500 font-black uppercase tracking-widest text-[8px]">Site Location</span>
                                <input
                                    value={site}
                                    onChange={(e) => setSite(e.target.value)}
                                    onBlur={saveChanges}
                                    placeholder="Enter Site..."
                                    className="bg-transparent border-none text-right font-bold text-white outline-none focus:ring-0 text-[10px] md:text-xs w-full max-w-[150px]"
                                    disabled={invoice.status === 'PAID'}
                                />
                            </div>
                            <div className="flex justify-between items-center text-xs pb-1 transition-all group-hover:border-primary/20">
                                <span className="text-gray-500 font-black uppercase tracking-widest text-[8px]">Reference</span>
                                <input
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                    onBlur={saveChanges}
                                    placeholder="Customer Ref"
                                    className="bg-transparent border-none text-right font-bold text-white outline-none focus:ring-0 text-[10px] md:text-xs w-full max-w-[150px]"
                                    disabled={invoice.status === 'PAID'}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Column 2: BILL TO (Client) */}
                    <div className="space-y-4">
                        <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.3em] text-center md:text-left">Bill To</h3>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3 min-h-[160px] shadow-xl">
                            <div className="text-lg md:text-xl font-black text-white text-center md:text-left">{invoice.client.companyName || invoice.client.name}</div>
                            {invoice.client.attentionTo && (
                                <div className="text-[10px] md:text-xs font-bold text-gray-400 italic text-center md:text-left">
                                    Attn: {invoice.client.attentionTo}
                                </div>
                            )}
                            <div className="text-gray-400 leading-relaxed font-medium whitespace-pre-wrap text-[10px] md:text-sm text-center md:text-left">
                                {invoice.client.address}
                            </div>
                            <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2 border-t border-white/5 mt-auto">
                                {invoice.client.vatNumber && (
                                    <div className="bg-white/5 px-2 py-0.5 rounded-md border border-white/5 flex items-center gap-2">
                                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">VAT</span>
                                        <span className="text-[10px] font-bold text-gray-300">{invoice.client.vatNumber}</span>
                                    </div>
                                )}
                                {invoice.client.registrationNumber && (
                                    <div className="bg-white/5 px-2 py-0.5 rounded-md border border-white/5 flex items-center gap-2">
                                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">REG</span>
                                        <span className="text-[10px] font-bold text-gray-300">{invoice.client.registrationNumber}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Column 3: FROM (Company) */}
                    <div className="space-y-4">
                        <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.3em] text-center md:text-right">From</h3>
                        <div className="md:text-right space-y-1">
                            <div className="text-lg md:text-xl font-black text-white">{company.name}</div>
                            {company.vatNumber && (
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">VAT: {company.vatNumber}</div>
                            )}
                            <div className="text-gray-400 text-[10px] md:text-[13px] font-medium leading-normal whitespace-pre-wrap pt-2">
                                {company.address}
                            </div>
                            <div className="text-primary font-black text-[11px] uppercase tracking-widest pt-2">
                                {company.phone}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Table - Modern High-Contrast Style */}
                <div className="mb-10 min-h-[400px] overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                    <table className="w-full min-w-[600px] md:min-w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="py-4 text-center w-8 font-black text-[10px] uppercase tracking-[0.2em] text-gray-500">#</th>
                                <th className="py-4 text-left font-black text-[10px] uppercase tracking-[0.2em] text-gray-500">Service Description</th>
                                <th className="py-4 text-center w-24 font-black text-[10px] uppercase tracking-[0.2em] text-gray-500">Qty</th>
                                <th className="py-4 text-right w-36 font-black text-[10px] uppercase tracking-[0.2em] text-gray-500">Unit Price</th>
                                <th className="py-4 text-right w-40 font-black text-[10px] uppercase tracking-[0.2em] text-gray-500">Line Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {(() => {
                                const sequentialGroups: { area: string, items: any[] }[] = [];
                                items.forEach((item: any, index: number) => {
                                    const area = item.area?.trim() || "GENERAL"
                                    const lastGroup = sequentialGroups[sequentialGroups.length - 1];
                                    if (lastGroup && lastGroup.area === area) {
                                        lastGroup.items.push({ ...item, originalIndex: index });
                                    } else {
                                        sequentialGroups.push({ area, items: [{ ...item, originalIndex: index }] });
                                    }
                                });

                                return sequentialGroups.map((group: any, gIdx: number) => {
                                    // Calculate global start index for this group
                                    let globalStartIndex = 0;
                                    for (let i = 0; i < gIdx; i++) {
                                        globalStartIndex += sequentialGroups[i].items.length;
                                    }

                                    return (
                                        <Fragment key={`group-${group.area}-${gIdx}`}>
                                            <tr key={`header-${group.area}`} className="bg-white/5 border-y border-white/5">
                                                <td colSpan={5} className="py-1 px-4 md:px-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                                    {isPricingMode ? (
                                                        <Input
                                                            value={group.area}
                                                            onChange={(e) => {
                                                                const newArea = e.target.value;
                                                                setItems(prev => prev.map((i, idx) => {
                                                                    if (group.items.some((gi: any) => gi.originalIndex === idx)) {
                                                                        return { ...i, area: newArea };
                                                                    }
                                                                    return i;
                                                                }));
                                                            }}
                                                            className="h-6 w-64 bg-transparent border-none text-[10px] font-black uppercase tracking-[0.2em] text-primary italic focus:ring-0 px-0"
                                                            placeholder="HEADING (OPTIONAL)"
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary italic">{group.area ? group.area : "GENERAL"}</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                            {group.items.map((item: any, iIdx: number) => (
                                                <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors border-b border-white/[0.02]">
                                                    <td className="py-2.5 text-center align-top">
                                                        <span className="text-[10px] font-black text-gray-600">{globalStartIndex + iIdx + 1}</span>
                                                    </td>
                                                    <td className="py-2.5 pr-8">
                                                        {isPricingMode ? (
                                                            <div className="flex gap-3">
                                                                <div className="flex-1">
                                                                    <Textarea
                                                                        value={item.description}
                                                                        onChange={(e) => handleItemUpdate(item.id, 'description', e.target.value)}
                                                                        className="min-h-[40px] bg-transparent border-white/10 focus:border-primary text-[13px] md:text-sm font-bold text-white tracking-tight resize-none p-2"
                                                                        placeholder="Item Description"
                                                                    />
                                                                </div>
                                                                <div className="w-1/3 max-w-[120px]">
                                                                    <Input
                                                                        value={item.area || ""}
                                                                        onChange={(e) => handleItemUpdate(item.id, 'area', e.target.value)}
                                                                        className="h-8 bg-transparent border-white/10 focus:border-primary text-[9px] font-bold text-primary uppercase tracking-widest"
                                                                        placeholder="HEADING"
                                                                    />
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-red-500 hover:bg-red-500/10 self-center"
                                                                    onClick={() => handleDeleteItem(item.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="text-[13px] md:text-sm font-bold text-white tracking-tight leading-snug">{item.description}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 text-center align-top">
                                                        {isPricingMode ? (
                                                            <div className="flex flex-col gap-0.5 items-center">
                                                                <Input
                                                                    type="number"
                                                                    value={item.quantity}
                                                                    onChange={(e) => handleItemUpdate(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                                    className="w-12 h-7 text-center bg-transparent border-white/10 font-bold p-0 text-xs"
                                                                />
                                                                <Input
                                                                    value={item.unit || ""}
                                                                    onChange={(e) => handleItemUpdate(item.id, 'unit', e.target.value)}
                                                                    placeholder="Unit"
                                                                    className="w-12 h-4 text-center text-[8px] uppercase bg-transparent border-none opacity-50 p-0"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-black text-gray-400">{item.quantity} <span className="text-[9px] uppercase ml-1 opacity-50">{item.unit || "ea"}</span></span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 text-right align-top">
                                                        {isPricingMode ? (
                                                            <div className="inline-flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                                                                <span className="text-gray-500 font-bold text-[10px]">{currencySymbol}</span>
                                                                <input
                                                                    type="number"
                                                                    className="w-20 bg-transparent text-right text-white font-bold outline-none no-spinner text-xs"
                                                                    value={item.unitPrice}
                                                                    onChange={(e) => handleItemUpdate(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-bold text-white">{formatCurrency(item.unitPrice, currencySymbol)}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 text-right font-black text-[13px] md:text-sm text-white align-top">
                                                        {formatCurrency(item.quantity * item.unitPrice, currencySymbol)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>

                {/* Footer UI - Modernized with conditional payment terms Logic */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-14 mt-8 md:mt-10 pt-8 md:pt-10 border-t border-white/10">
                    <div className="space-y-4 md:space-y-6">
                        <div className="bg-white/5 p-5 md:p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                            <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-primary mb-3 flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5" /> Professional Notes
                            </h4>
                            {isPricingMode ? (
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="ADD SPECIALIZED TERMS, SITE CONDITIONS, OR PROJECT REQUIREMENTS..."
                                    className="w-full min-h-[120px] bg-transparent text-gray-300 text-[13px] border-none focus:ring-0 resize-none font-medium leading-relaxed placeholder:opacity-20"
                                />
                            ) : (
                                <div className="text-[13px] font-bold text-gray-300 leading-relaxed whitespace-pre-wrap italic">
                                    {note || "No specific project notes applied to this document."}
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Settlement Details</h4>
                            <div className="text-[11px] font-bold leading-normal font-mono text-gray-400 bg-white/5 p-4 rounded-2xl border border-white/5">
                                {company.bankDetails}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2 bg-white/[0.02] p-6 rounded-3xl border border-white/5">
                            <div className="flex justify-between items-center text-sm md:text-base">
                                <span className="text-gray-500 font-bold">Document Subtotal</span>
                                <span className="font-bold text-white">{formatCurrency(subtotal, currencySymbol)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm md:text-base">
                                <span className="text-gray-500 font-bold">VAT (15%)</span>
                                <span className="font-bold text-white">{formatCurrency(taxAmount, currencySymbol)}</span>
                            </div>
                            <div className="h-px bg-white/10 my-3" />
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Balance Due</span>
                                <span className="text-3xl md:text-4xl font-black text-white tracking-tighter">{formatCurrency(total, currencySymbol)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {isPricingMode && (
                    <div className="mt-12 flex justify-between gap-3 print:hidden">
                        <Button variant="secondary" onClick={handleAddItem} disabled={loading} className="h-14 px-8 border-2 border-dashed border-white/20">
                            + Add Line Item
                        </Button>
                        <div className="flex gap-3">
                            <Button size="lg" variant="outline" onClick={saveChanges} disabled={loading} className="h-14 px-8 border-2">
                                {loading ? "Saving..." : "Save Draft Changes"}
                            </Button>
                            {invoice.type === 'QUOTE' && (
                                <Button size="lg" onClick={handleApprove} disabled={loading} className="h-14 px-10 bg-blue-600 hover:bg-blue-700 font-bold shadow-xl">
                                    {loading ? "Processing..." : "Approve & Generate Invoice"}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
