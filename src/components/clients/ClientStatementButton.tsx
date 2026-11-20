"use client"

import { Button } from "@/components/ui/button"
import { FileText, Loader2, Table, Eye, Download } from "lucide-react"
import jsPDF from "jspdf"
import { drawPdfHeader, getThemePrimaryRGB, getThemePrimaryHex } from "@/lib/pdf-utils"
import autoTable from "jspdf-autotable"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { createStatementAction } from "@/app/(dashboard)/invoices/actions"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function getInvoiceQuoteReference(i: any): string | null {
    if (i.reference && typeof i.reference === 'string') {
        const match = i.reference.match(/(?:as per quotation\s*)?([A-Z0-9]+-Q-\d{4}-\d+|Q-\d{4}-\d+|AW-\d{4}-\d+)/i);
        if (match) return match[1];
        if (i.reference.trim().startsWith('Q-') || i.reference.trim().startsWith('AW-')) {
            return i.reference.trim();
        }
    }
    if (i.project?.invoices && Array.isArray(i.project.invoices)) {
        const linkedQuote = i.project.invoices.find((inv: any) => inv.type === 'QUOTE');
        if (linkedQuote) {
            return linkedQuote.quoteNumber || `Q-${new Date(linkedQuote.date).getFullYear()}-${String(linkedQuote.number).padStart(3, '0')}`;
        }
    }
    const meta = (i.metadata as any) || {};
    if (meta.quoteNumber && typeof meta.quoteNumber === 'string') return meta.quoteNumber;
    if (meta.linkedQuoteNumber && typeof meta.linkedQuoteNumber === 'string') return meta.linkedQuoteNumber;
    return null;
}

export function ClientStatementButton({ client, settings }: { client: any, settings?: any }) {
    const [loading, setLoading] = useState(false)

    const company = {
        name: settings?.name || "Company",
        address: settings?.address || "15 Culemborg Street, Avondale, Parow, Cape Town, 7500",
        email: settings?.email || "",
        phone: settings?.phone || "",
        logoUrl: settings?.logoUrl || "",
        vatNumber: settings?.vatNumber || "",
        paymentTerms: settings?.paymentTerms || "",
        bankDetails: settings?.bankDetails || "",
        layoutPreferences: settings?.layoutPreferences
    };

    const generateStatement = async () => {
        setLoading(true)
        try {
            // Calculate Total Due and create statement record first
            let totalDue = 0
            const unpaidInvoices = client.invoices
                .filter((i: any) =>
                    i.type === 'INVOICE' &&
                    i.status !== 'PAID' &&
                    i.status !== 'CANCELLED'
                )
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

            unpaidInvoices.forEach((i: any) => {
                const paid = i.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0
                let outstanding = i.total - paid
                if (i.firstPaymentPercentage && i.firstPaymentPercentage > 0 && i.firstPaymentPercentage < 100) {
                    const firstPaymentAmount = i.total * (i.firstPaymentPercentage / 100);
                    if (paid < firstPaymentAmount) {
                        outstanding = firstPaymentAmount - paid;
                    }
                }
                if (outstanding > 0.01) {
                    totalDue += outstanding
                }
            })

            const statementNumber = await createStatementAction(client.id, totalDue);

            const [themeR, themeG, themeB] = getThemePrimaryRGB(settings?.theme);
            const doc = new jsPDF()

            // Header (Shared)
            const nextY = await drawPdfHeader(doc, company, 'STATEMENT OF ACCOUNT', statementNumber);

            // 3-Column Document Details Grid
            const gridY = nextY;
            
            // Column 1: Details
            doc.setFontSize(8);
            doc.setTextColor(themeR, themeG, themeB); // Lime
            doc.setFont("helvetica", "bold");
            doc.text("DETAILS", 14, gridY);
            
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.setFont("helvetica", "normal");
            doc.text("Statement #:", 14, gridY + 6);
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.text(statementNumber, 38, gridY + 6);

            doc.setTextColor(100, 116, 139); // slate-500
            doc.setFont("helvetica", "normal");
            doc.text("Date:", 14, gridY + 11);
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.text(new Date().toLocaleDateString('en-GB'), 38, gridY + 11);

            // Column 2: Bill To
            doc.setFontSize(8);
            doc.setTextColor(themeR, themeG, themeB); // Lime
            doc.setFont("helvetica", "bold");
            doc.text("BILL TO", 80, gridY);
            
            doc.setFontSize(11);
            doc.setTextColor(30, 41, 59);
            doc.text(client.companyName || client.name, 80, gridY + 6);
            
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.setFont("helvetica", "normal");
            let currentBillY = gridY + 11;
            if (client.attentionTo) {
                doc.text(`Attn: ${client.attentionTo}`, 80, currentBillY);
                currentBillY += 4.5;
            }
            if (client.address) {
                const addressLines = doc.splitTextToSize(client.address, 50);
                doc.text(addressLines, 80, currentBillY);
                currentBillY += addressLines.length * 4.5;
            }
            if (client.vatNumber) {
                doc.text(`VAT: ${client.vatNumber}`, 80, currentBillY);
                currentBillY += 4.5;
            }
            if (client.vendorNumber) {
                doc.text(`VENDOR: ${client.vendorNumber}`, 80, currentBillY);
                currentBillY += 4.5;
            }
            if (client.registrationNumber) {
                doc.text(`REG: ${client.registrationNumber}`, 80, currentBillY);
            }

            // Column 3: From
            doc.setFontSize(8);
            doc.setTextColor(themeR, themeG, themeB); // Lime
            doc.setFont("helvetica", "bold");
            doc.text("FROM", 196, gridY, { align: 'right' });
            
            doc.setFontSize(11);
            doc.setTextColor(30, 41, 59);
            const companyNameLines = doc.splitTextToSize(company.name, 50);
            doc.text(companyNameLines, 196, gridY + 6, { align: 'right' });
            
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.setFont("helvetica", "normal");
            let currentFromY = gridY + 6 + (companyNameLines.length * 4.5) + 0.5;
            if (company.vatNumber) {
                doc.text(`VAT: ${company.vatNumber}`, 196, currentFromY, { align: 'right' });
                currentFromY += 4.5;
            }
            if (company.address) {
                const addressLines = doc.splitTextToSize(company.address, 50);
                doc.text(addressLines, 196, currentFromY, { align: 'right' });
                currentFromY += addressLines.length * 4.5;
            }
            doc.setTextColor(themeR, themeG, themeB); // Lime pop for phone
            doc.setFont("helvetica", "bold");
            doc.text(company.phone, 196, currentFromY, { align: 'right' });

            const minListY = Math.max(gridY + 12, currentBillY + 5, currentFromY + 5);

            // Statement of Outstanding Invoices
            const headerY = minListY + 10;
            doc.setFontSize(14)
            doc.setFont("helvetica", "bold")
            doc.text("OUTSTANDING INVOICES", 14, headerY)

            const rows: any[] = []
            let processedTotalDue = 0; // Using processedTotalDue to verify calculation matches
            unpaidInvoices.forEach((i: any) => {
                const paid = i.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0
                let outstanding = i.total - paid
                if (i.firstPaymentPercentage && i.firstPaymentPercentage > 0 && i.firstPaymentPercentage < 100) {
                    const firstPaymentAmount = i.total * (i.firstPaymentPercentage / 100);
                    if (paid < firstPaymentAmount) {
                        outstanding = firstPaymentAmount - paid;
                    }
                }

                if (outstanding > 0.01) {
                    processedTotalDue += outstanding
                    // Format invoice line with quote reference: e.g. "INV-2026-029 (Q-2026-034)"
                    const baseDocNumber = i.quoteNumber || (i.type === 'QUOTE' ? `Q-${new Date(i.date).getFullYear()}-${i.number.toString().padStart(3, '0')}` : `INV-${new Date(i.date).getFullYear()}-${i.number.toString().padStart(3, '0')}`);
                    const quoteRef = i.type === 'INVOICE' ? getInvoiceQuoteReference(i) : null;
                    const docNumber = quoteRef ? `${baseDocNumber} (${quoteRef})` : baseDocNumber;

                    rows.push([
                        new Date(i.date).toLocaleDateString('en-GB'),
                        docNumber,
                        i.site || i.project?.name || '-',
                        formatCurrency(i.total),
                        formatCurrency(outstanding)
                    ])
                }
            })

            // Table
            autoTable(doc, {
                startY: headerY + 10,
                head: [[
                    { content: 'Date', styles: { halign: 'left' } },
                    { content: 'Document #', styles: { halign: 'left' } },
                    { content: 'Site / Project', styles: { halign: 'left' } },
                    { content: 'Total', styles: { halign: 'right' } },
                    { content: 'Outstanding', styles: { halign: 'right' } }
                ]],
                body: rows,
                theme: 'striped',
                headStyles: {
                    fillColor: [20, 20, 30], // Professional Navy
                    textColor: (settings?.theme || '').toLowerCase().includes('orange') ? [208, 94, 0] : [163, 230, 53],
                    fontStyle: 'bold',
                    cellPadding: 3
                },
                bodyStyles: {
                    cellPadding: 3,
                    fontSize: 9
                },
                columnStyles: {
                    3: { halign: 'right' },
                    4: { halign: 'right', fontStyle: 'bold' }
                },
                didParseCell: (data) => {
                    if (data.column.index === 0 || data.column.index === 1 || data.column.index === 2) {
                        data.cell.styles.halign = 'left';
                    } else if (data.column.index === 3 || data.column.index === 4) {
                        data.cell.styles.halign = 'right';
                    }
                }
            })

            // Summary with Standard Underline
            const finalY = (doc as any).lastAutoTable.finalY + 15

            doc.setDrawColor(20, 20, 30);
            doc.setLineWidth(0.2);
            doc.line(130, finalY - 5, 196, finalY - 5);

            doc.setFontSize(12)
            doc.setFont("helvetica", "bold")
            doc.setTextColor(20, 20, 30)
            doc.text(`Total Amount Due: ${formatCurrency(totalDue)}`, 192, finalY, { align: 'right' })



            doc.save(`Statement_${statementNumber}_${client.name.replace(/[^a-z0-9]/gi, '_')}.pdf`)
        } catch (e) {
            console.error(e)
            alert("Failed to generate statement")
        } finally {
            setLoading(false)
        }
    }

    const generateExcelStatement = async () => {
        setLoading(true)
        try {
            // Calculate Total Due and create statement record first
            let totalDue = 0
            const unpaidInvoices = client.invoices.filter((i: any) =>
                i.type === 'INVOICE' &&
                i.status !== 'PAID' &&
                i.status !== 'CANCELLED'
            )
            unpaidInvoices.forEach((i: any) => {
                const paid = i.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0
                let outstanding = i.total - paid
                if (i.firstPaymentPercentage && i.firstPaymentPercentage > 0 && i.firstPaymentPercentage < 100) {
                    const firstPaymentAmount = i.total * (i.firstPaymentPercentage / 100);
                    if (paid < firstPaymentAmount) {
                        outstanding = firstPaymentAmount - paid;
                    }
                }
                if (outstanding > 0.01) {
                    totalDue += outstanding
                }
            })
            
            const statementNumber = await createStatementAction(client.id, totalDue);

            const themeHex = getThemePrimaryHex(settings?.theme);
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Statement');

            // 1. Set Column Widths
            worksheet.columns = [
                { width: 15 }, // Date
                { width: 18 }, // Doc #
                { width: 40 }, // Site / Project
                { width: 15 }, // Total
                { width: 15 }  // Outstanding
            ];

            // 2. Branding Bars (Navy and Lime)
            const navyBar = worksheet.getRow(1);
            navyBar.height = 15;
            worksheet.mergeCells('A1:E1');
            worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14141E' } };

            const limeBar = worksheet.getRow(2);
            limeBar.height = 4;
            worksheet.mergeCells('A2:E2');
            worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: themeHex } };

            // 3. Logo & Title
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

            worksheet.mergeCells('D4:E4');
            const titleCell = worksheet.getCell('D4');
            titleCell.value = 'STATEMENT OF ACCOUNT';
            titleCell.font = { name: 'Arial', bold: true, size: 20, color: { argb: 'FF14141E' } };
            titleCell.alignment = { horizontal: 'right', vertical: 'middle' };
            
            worksheet.mergeCells('D5:E5');
            const numCell = worksheet.getCell('D5');
            numCell.value = `Statement #: ${statementNumber}`;
            numCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF64748B' } };
            numCell.alignment = { horizontal: 'right', vertical: 'middle' };

            // 4. Metadata
            let currentRow = 8;
            
            // Headings
            worksheet.getCell(`A${currentRow}`).value = 'DETAILS';
            worksheet.getCell(`A${currentRow}`).font = { bold: true, color: { argb: themeHex } };
            
            worksheet.getCell(`C${currentRow}`).value = 'BILL TO';
            worksheet.getCell(`C${currentRow}`).font = { bold: true, color: { argb: themeHex } };
            
            worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
            const fromCell = worksheet.getCell(`D${currentRow}`);
            fromCell.value = 'FROM';
            fromCell.font = { bold: true, color: { argb: themeHex } };
            fromCell.alignment = { horizontal: 'right' };
            
            currentRow++;
            const startDataRow = currentRow;
            
            // Details
            let detailsRow = startDataRow;
            worksheet.getCell(`A${detailsRow}`).value = 'Statement #:';
            worksheet.getCell(`A${detailsRow}`).font = { color: { argb: 'FF64748B' } };
            worksheet.getCell(`B${detailsRow}`).value = statementNumber;
            worksheet.getCell(`B${detailsRow}`).font = { bold: true };
            detailsRow++;
            worksheet.getCell(`A${detailsRow}`).value = 'Date Issued:';
            worksheet.getCell(`A${detailsRow}`).font = { color: { argb: 'FF64748B' } };
            worksheet.getCell(`B${detailsRow}`).value = new Date().toLocaleDateString('en-GB');
            worksheet.getCell(`B${detailsRow}`).font = { bold: true };
            
            // Bill To
            let billToRow = startDataRow;
            worksheet.getCell(`C${billToRow}`).value = client.companyName || client.name;
            worksheet.getCell(`C${billToRow}`).font = { bold: true, size: 12, color: { argb: 'FF1E293B' } };
            billToRow++;
            
            if (client.attentionTo) {
                worksheet.getCell(`C${billToRow}`).value = `Attn: ${client.attentionTo}`;
                worksheet.getCell(`C${billToRow}`).font = { color: { argb: 'FF64748B' } };
                billToRow++;
            }
            if (client.address) {
                const cCell = worksheet.getCell(`C${billToRow}`);
                cCell.value = client.address;
                cCell.font = { color: { argb: 'FF64748B' } };
                cCell.alignment = { wrapText: true };
                worksheet.getRow(billToRow).height = (client.address.split('\n').length || 1) * 15;
                billToRow++;
            }
            if (client.vatNumber) {
                worksheet.getCell(`C${billToRow}`).value = `VAT: ${client.vatNumber}`;
                worksheet.getCell(`C${billToRow}`).font = { color: { argb: 'FF64748B' } };
                billToRow++;
            }
            if (client.vendorNumber) {
                worksheet.getCell(`C${billToRow}`).value = `VENDOR: ${client.vendorNumber}`;
                worksheet.getCell(`C${billToRow}`).font = { color: { argb: 'FF64748B' } };
                billToRow++;
            }
            if (client.registrationNumber) {
                worksheet.getCell(`C${billToRow}`).value = `REG: ${client.registrationNumber}`;
                worksheet.getCell(`C${billToRow}`).font = { color: { argb: 'FF64748B' } };
                billToRow++;
            }
            
            // From
            let fromRow = startDataRow;
            worksheet.mergeCells(`D${fromRow}:E${fromRow}`);
            const compNameCell = worksheet.getCell(`D${fromRow}`);
            compNameCell.value = company.name;
            compNameCell.font = { bold: true, size: 12, color: { argb: 'FF1E293B' } };
            compNameCell.alignment = { horizontal: 'right' };
            fromRow++;
            
            if (company.vatNumber) {
                worksheet.mergeCells(`D${fromRow}:E${fromRow}`);
                const vatCell = worksheet.getCell(`D${fromRow}`);
                vatCell.value = `VAT: ${company.vatNumber}`;
                vatCell.font = { color: { argb: 'FF64748B' } };
                vatCell.alignment = { horizontal: 'right' };
                fromRow++;
            }
            if (company.address) {
                worksheet.mergeCells(`D${fromRow}:E${fromRow}`);
                const addrCell = worksheet.getCell(`D${fromRow}`);
                addrCell.value = company.address;
                addrCell.font = { color: { argb: 'FF64748B' } };
                addrCell.alignment = { wrapText: true, horizontal: 'right' };
                worksheet.getRow(fromRow).height = (company.address.split('\n').length || 1) * 15;
                fromRow++;
            }
            worksheet.mergeCells(`D${fromRow}:E${fromRow}`);
            const phoneCell = worksheet.getCell(`D${fromRow}`);
            phoneCell.value = company.phone;
            phoneCell.font = { bold: true, color: { argb: themeHex } };
            phoneCell.alignment = { horizontal: 'right' };
            fromRow++;
            
            currentRow = Math.max(detailsRow, billToRow, fromRow) + 3;

            // 5. Table Head
            const tableHead = worksheet.getRow(currentRow);
            tableHead.values = ['Date', 'Document #', 'Site / Project', 'Total', 'Outstanding'];
            tableHead.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            tableHead.height = 20;
            tableHead.eachCell((cell, colNumber) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14141E' } }; // Professional Navy
                cell.font = { bold: true, color: { argb: themeHex } }; // Lime pop
                cell.alignment = { 
                    vertical: 'middle', 
                    horizontal: colNumber <= 3 ? 'left' : 'right' 
                };
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
            });

            // 6. Table Body
            let processedExcelTotalDue = 0;

            currentRow++;
            unpaidInvoices.forEach((i: any) => {
                const paid = i.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0
                let outstanding = i.total - paid
                if (i.firstPaymentPercentage && i.firstPaymentPercentage > 0 && i.firstPaymentPercentage < 100) {
                    const firstPaymentAmount = i.total * (i.firstPaymentPercentage / 100);
                    if (paid < firstPaymentAmount) {
                        outstanding = firstPaymentAmount - paid;
                    }
                }

                if (outstanding > 0.01) {
                    processedExcelTotalDue += outstanding
                    const baseDocNumber = i.quoteNumber || (i.type === 'QUOTE' ? `Q-${new Date(i.date).getFullYear()}-${i.number.toString().padStart(3, '0')}` : `INV-${new Date(i.date).getFullYear()}-${i.number.toString().padStart(3, '0')}`);
                    const quoteRef = i.type === 'INVOICE' ? getInvoiceQuoteReference(i) : null;
                    const docNumber = quoteRef ? `${baseDocNumber} (${quoteRef})` : baseDocNumber;

                    const row = worksheet.getRow(currentRow);
                    row.values = [
                        new Date(i.date).toLocaleDateString('en-GB'),
                        docNumber,
                        i.site || i.project?.name || '-',
                        i.total,
                        outstanding
                    ];

                    row.getCell(1).alignment = { horizontal: 'left' };
                    row.getCell(2).alignment = { horizontal: 'left' };
                    row.getCell(3).alignment = { horizontal: 'left' };
                    row.getCell(4).alignment = { horizontal: 'right' };
                    row.getCell(4).numFmt = '"R"#,##0.00';
                    row.getCell(5).alignment = { horizontal: 'right' };
                    row.getCell(5).numFmt = '"R"#,##0.00';
                    row.getCell(5).font = { bold: true };
                    
                    row.eachCell((cell) => {
                        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } } };
                    });
                    row.height = 20; // Compact row height

                    currentRow++;
                }
            })

            // 7. Footer Summary
            currentRow++;
            const summaryRow = worksheet.getRow(currentRow);
            summaryRow.getCell(4).value = 'Total Amount Due:';
            summaryRow.getCell(4).font = { bold: true };
            summaryRow.getCell(4).alignment = { horizontal: 'right' };
            summaryRow.getCell(5).value = totalDue;
            summaryRow.getCell(5).font = { bold: true, size: 12, color: { argb: 'FF14141E' } };
            summaryRow.getCell(5).numFmt = '"R"#,##0.00';
            summaryRow.getCell(5).alignment = { horizontal: 'right' };
            summaryRow.getCell(5).border = { top: { style: 'thin', color: { argb: 'FF14141E' } } };

            // 8. Banking Info
            currentRow += 3;
            worksheet.getCell(`A${currentRow}`).value = 'BANKING DETAILS';
            worksheet.getCell(`A${currentRow}`).font = { bold: true, color: { argb: 'FF14141E' } };
            currentRow++;
            worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = company.bankDetails;
            worksheet.getCell(`A${currentRow}`).font = { size: 9, color: { argb: 'FF475569' } };

            // Write and Save
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Statement_${statementNumber}_${client.name.replace(/[^a-z0-9]/gi, '_')}.xlsx`);

        } catch (e) {
            console.error(e)
            alert("Failed to generate Excel statement")
        } finally {
            setLoading(false)
        }
    }

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const unpaidInvoices = (client.invoices || [])
        .filter((i: any) =>
            i.type === 'INVOICE' &&
            i.status !== 'PAID' &&
            i.status !== 'CANCELLED'
        )
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let calculatedTotalDue = 0;
    const statementLines = unpaidInvoices.map((i: any) => {
        const paid = i.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
        let outstanding = i.total - paid;
        if (i.firstPaymentPercentage && i.firstPaymentPercentage > 0 && i.firstPaymentPercentage < 100) {
            const firstPaymentAmount = i.total * (i.firstPaymentPercentage / 100);
            if (paid < firstPaymentAmount) {
                outstanding = firstPaymentAmount - paid;
            }
        }
        if (outstanding > 0.01) {
            calculatedTotalDue += outstanding;
        }
        const baseDoc = i.quoteNumber || (i.type === 'QUOTE' ? `Q-${new Date(i.date).getFullYear()}-${String(i.number).padStart(3, '0')}` : `INV-${new Date(i.date).getFullYear()}-${String(i.number).padStart(3, '0')}`);
        const quoteRef = i.type === 'INVOICE' ? getInvoiceQuoteReference(i) : null;
        const formattedNumber = quoteRef ? `${baseDoc} (${quoteRef})` : baseDoc;
        const projectOrSite = i.site || i.project?.name || '-';
        return {
            id: i.id,
            date: new Date(i.date).toLocaleDateString('en-GB'),
            docNumber: formattedNumber,
            projectOrSite,
            fullLine: `${formattedNumber} – ${projectOrSite}`,
            total: i.total,
            outstanding
        };
    }).filter((l: any) => l.outstanding > 0.01);

    return (
        <div className="flex gap-2">
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-bold">
                        <Eye className="mr-2 h-4 w-4" />
                        Preview Statement
                    </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0F172A] border-white/10 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Statement of Account — {client.companyName || client.name}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400 text-xs">
                            Outstanding invoices showing quote reference next to each invoice number.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="rounded-xl border border-white/10 overflow-hidden bg-black/40">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-[#1E293B] text-gray-300 uppercase text-[10px] font-bold tracking-wider">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Invoice & Quote Reference</th>
                                        <th className="p-3 text-right">Total</th>
                                        <th className="p-3 text-right">Outstanding</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-sans">
                                    {statementLines.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-6 text-center text-muted-foreground">
                                                No outstanding invoices found for this client.
                                            </td>
                                        </tr>
                                    ) : (
                                        statementLines.map((line: any) => (
                                            <tr key={line.id} className="hover:bg-white/[0.02]">
                                                <td className="p-3 font-mono text-gray-400">{line.date}</td>
                                                <td className="p-3">
                                                    <div className="font-semibold text-white">
                                                        <span>{line.docNumber}</span>
                                                        <span className="text-gray-400 font-normal"> – {line.projectOrSite}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right font-mono text-gray-300">{formatCurrency(line.total)}</td>
                                                <td className="p-3 text-right font-mono font-bold text-emerald-400">{formatCurrency(line.outstanding)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-[#1E293B]/60 border-t border-white/10 font-black">
                                    <tr>
                                        <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-xs">Total Amount Due:</td>
                                        <td className="p-3 text-right font-mono text-sm text-emerald-400">{formatCurrency(calculatedTotalDue)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <DialogFooter className="flex items-center justify-between gap-2">
                        <Button variant="ghost" onClick={() => setIsPreviewOpen(false)} className="text-gray-400">
                            Close
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="default" onClick={generateExcelStatement} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                                {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Table className="mr-1.5 h-3.5 w-3.5" />}
                                Export Excel
                            </Button>
                            <Button variant="default" onClick={generateStatement} disabled={loading} className="bg-primary text-black font-black text-xs hover:bg-primary/90">
                                {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                                Download PDF
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Button variant="default" onClick={generateExcelStatement} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Table className="mr-2 h-4 w-4" />}
                Statement (Excel)
            </Button>
            <Button variant="outline" onClick={generateStatement} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Statement (PDF)
            </Button>
        </div>
    )
}
