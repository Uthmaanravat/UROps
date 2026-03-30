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
        paymentTerms: settings?.paymentTerms || "",
        bankDetails: settings?.bankDetails || "Name: LR Builders & Maintenance Pty (Ltd), Bank: FNB, Acc No.: 63114141714, Branch Code: 200510"
    };

    const generateStatement = async () => {
        setLoading(true)
        try {
            const doc = new jsPDF()

            // Header (Shared)
            await drawPdfHeader(doc, company, 'STATEMENT OF ACCOUNT', '');

            doc.setTextColor(20, 20, 30); // Reset to dark for content

            // Client Info Block
            const clientInfoY = 50;
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 14, clientInfoY);

            doc.setFont("helvetica", "bold");
            doc.text(`Client: ${client.companyName || client.name}`, 14, clientInfoY + 5);
            doc.setFont("helvetica", "normal");

            if (client.vatNumber) doc.text(`VAT No: ${client.vatNumber}`, 14, clientInfoY + 10);

            // Statement of Outstanding Invoices - Moved further down to avoid overlap
            const headerY = clientInfoY + 25;
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
            worksheet.getCell(`A${currentRow}`).value = 'DATE:';
            worksheet.getCell(`B${currentRow}`).value = new Date().toLocaleDateString('en-GB');
            worksheet.getCell(`A${currentRow}`).font = { bold: true };
            currentRow++;

            worksheet.getCell(`A${currentRow}`).value = 'CLIENT:';
            worksheet.getCell(`B${currentRow}`).value = client.companyName || client.name;
            worksheet.getCell(`A${currentRow}`).font = { bold: true };
            currentRow++;

            if (client.vatNumber) {
                worksheet.getCell(`A${currentRow}`).value = 'VAT NO:';
                worksheet.getCell(`B${currentRow}`).value = client.vatNumber;
                worksheet.getCell(`A${currentRow}`).font = { bold: true };
                currentRow++;
            }

            // 5. Table Head
            currentRow += 2;
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
