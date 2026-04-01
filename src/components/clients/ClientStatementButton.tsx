"use client"

import { Button } from "@/components/ui/button"
import { FileText, Loader2, Table } from "lucide-react"
import jsPDF from "jspdf"
import { drawPdfHeader } from "@/lib/pdf-utils"
import autoTable from "jspdf-autotable"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"
import { useState } from "react"
import { formatCurrency } from "@/lib/utils"

export function ClientStatementButton({ client, settings }: { client: any, settings?: any }) {
    const [loading, setLoading] = useState(false)

    const company = {
        name: settings?.name || "LR Builders & Maintenance Pty (Ltd)",
        address: settings?.address || "15 Culemborg Street, Avondale, Parow, Cape Town, 7500",
        email: settings?.email || "Loedvi@lrbuilders.co.za",
        phone: settings?.phone || "082 448 7490",
        logoUrl: settings?.logoUrl || "",
        vatNumber: settings?.vatNumber || "",
        paymentTerms: settings?.paymentTerms || "",
        bankDetails: settings?.bankDetails || "Name: LR Builders & Maintenance Pty (Ltd), Bank: FNB, Acc No.: 63114141714, Branch Code: 200510"
    };

    const generateStatement = async () => {
        setLoading(true)
        try {
            const doc = new jsPDF()

            // Header (Shared)
            const nextY = await drawPdfHeader(doc, company, 'STATEMENT OF ACCOUNT', '');

            // 3-Column Document Details Grid
            const gridY = nextY;
            
            // Column 1: Details
            doc.setFontSize(8);
            doc.setTextColor(163, 230, 53); // Lime
            doc.setFont("helvetica", "bold");
            doc.text("DETAILS", 14, gridY);
            
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.setFont("helvetica", "normal");
            doc.text("Date:", 14, gridY + 6);
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.text(new Date().toLocaleDateString('en-GB'), 30, gridY + 6);

            // Column 2: Bill To
            doc.setFontSize(8);
            doc.setTextColor(163, 230, 53); // Lime
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
            if (client.registrationNumber) {
                doc.text(`REG: ${client.registrationNumber}`, 80, currentBillY);
            }

            // Column 3: From
            doc.setFontSize(8);
            doc.setTextColor(163, 230, 53); // Lime
            doc.setFont("helvetica", "bold");
            doc.text("FROM", 196, gridY, { align: 'right' });
            
            doc.setFontSize(11);
            doc.setTextColor(30, 41, 59);
            doc.text(company.name, 196, gridY + 6, { align: 'right' });
            
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.setFont("helvetica", "normal");
            let currentFromY = gridY + 11;
            if (company.vatNumber) {
                doc.text(`VAT: ${company.vatNumber}`, 196, currentFromY, { align: 'right' });
                currentFromY += 4.5;
            }
            if (company.address) {
                const addressLines = doc.splitTextToSize(company.address, 50);
                doc.text(addressLines, 196, currentFromY, { align: 'right' });
                currentFromY += addressLines.length * 4.5;
            }
            doc.setTextColor(163, 230, 53); // Lime pop for phone
            doc.setFont("helvetica", "bold");
            doc.text(company.phone, 196, currentFromY, { align: 'right' });

            const minListY = Math.max(gridY + 12, currentBillY + 5, currentFromY + 5);

            // Statement of Outstanding Invoices
            const headerY = minListY + 10;
            doc.setFontSize(14)
            doc.setFont("helvetica", "bold")
            doc.text("OUTSTANDING INVOICES", 14, headerY)

            const rows: any[] = []
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
                const outstanding = i.total - paid

                if (outstanding > 0.01) {
                    totalDue += outstanding
                    // Logic to ensure we show the correct formatted number
                    const docNumber = i.quoteNumber || (i.type === 'QUOTE' ? `Q-${new Date(i.date).getFullYear()}-${i.number.toString().padStart(3, '0')}` : `INV-${new Date(i.date).getFullYear()}-${i.number.toString().padStart(3, '0')}`);

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
                head: [['Date', 'Document #', 'Site / Project', 'Total', 'Outstanding']],
                body: rows,
                theme: 'striped',
                headStyles: {
                    fillColor: [20, 20, 30], // Professional Navy
                    textColor: [163, 230, 53], // Lime pop
                    fontStyle: 'bold'
                },
                bodyStyles: {
                    cellPadding: 3,
                    fontSize: 9
                },
                columnStyles: {
                    3: { halign: 'right' },
                    4: { halign: 'right', fontStyle: 'bold' }
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



            doc.save(`Statement_${client.name}_${new Date().toISOString().split('T')[0]}.pdf`)
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
            worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA3E635' } };

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

            // 4. Metadata
            let currentRow = 8;
            
            // Headings
            worksheet.getCell(`A${currentRow}`).value = 'DETAILS';
            worksheet.getCell(`A${currentRow}`).font = { bold: true, color: { argb: 'FFA3E635' } };
            
            worksheet.getCell(`C${currentRow}`).value = 'BILL TO';
            worksheet.getCell(`C${currentRow}`).font = { bold: true, color: { argb: 'FFA3E635' } };
            
            worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
            const fromCell = worksheet.getCell(`D${currentRow}`);
            fromCell.value = 'FROM';
            fromCell.font = { bold: true, color: { argb: 'FFA3E635' } };
            fromCell.alignment = { horizontal: 'right' };
            
            currentRow++;
            const startDataRow = currentRow;
            
            // Details
            let detailsRow = startDataRow;
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
            phoneCell.font = { bold: true, color: { argb: 'FFA3E635' } };
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
                cell.font = { bold: true, color: { argb: 'FFA3E635' } }; // Lime pop
                cell.alignment = { 
                    vertical: 'middle', 
                    horizontal: colNumber <= 3 ? 'left' : 'right' 
                };
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
            });

            // 6. Table Body
            let totalDue = 0;
            const unpaidInvoices = client.invoices.filter((i: any) =>
                i.type === 'INVOICE' &&
                i.status !== 'PAID' &&
                i.status !== 'CANCELLED'
            )

            currentRow++;
            unpaidInvoices.forEach((i: any) => {
                const paid = i.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0
                const outstanding = i.total - paid

                if (outstanding > 0.01) {
                    totalDue += outstanding
                    const docNumber = i.quoteNumber || (i.type === 'QUOTE' ? `Q-${new Date(i.date).getFullYear()}-${i.number.toString().padStart(3, '0')}` : `INV-${new Date(i.date).getFullYear()}-${i.number.toString().padStart(3, '0')}`);

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
            saveAs(new Blob([buffer]), `Statement_${client.name}_${new Date().toISOString().split('T')[0]}.xlsx`);

        } catch (e) {
            console.error(e)
            alert("Failed to generate Excel statement")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex gap-2">
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
