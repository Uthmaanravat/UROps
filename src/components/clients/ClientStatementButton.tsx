"use client"

import { Button } from "@/components/ui/button"
import { FileText, Loader2, Table } from "lucide-react"
import jsPDF from "jspdf"
import { drawPdfHeader } from "@/lib/pdf-utils"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
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

            const unpaidInvoices = client.invoices.filter((i: any) =>
                i.type === 'INVOICE' &&
                i.status !== 'PAID' &&
                i.status !== 'CANCELLED'
            )

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
                    fillColor: [220, 38, 38], // Red for outstanding
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
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
            const wsData = [
                [company.name],
                ["Email:", company.email, "Phone:", company.phone],
                ["Bank:", company.bankDetails],
                [],
                ["STATEMENT OF ACCOUNT"],
                ["Date:", new Date().toLocaleDateString('en-GB')],
                ["Client:", client.companyName || client.name],
                ["VAT No:", client.vatNumber || "N/A"],
                [],
                ["Date", "Document #", "Site / Project", "Total", "Outstanding"]
            ];

            let totalDue = 0;
            const unpaidInvoices = client.invoices.filter((i: any) =>
                i.type === 'INVOICE' &&
                i.status !== 'PAID' &&
                i.status !== 'CANCELLED'
            )

            unpaidInvoices.forEach((i: any) => {
                const paid = i.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0
                const outstanding = i.total - paid

                if (outstanding > 0.01) {
                    totalDue += outstanding
                    const docNumber = i.quoteNumber || (i.type === 'QUOTE' ? `Q-${new Date(i.date).getFullYear()}-${i.number.toString().padStart(3, '0')}` : `INV-${new Date(i.date).getFullYear()}-${i.number.toString().padStart(3, '0')}`);

                    wsData.push([
                        new Date(i.date).toLocaleDateString('en-GB'),
                        docNumber,
                        i.site || i.project?.name || '-',
                        i.total,
                        outstanding
                    ])
                }
            })

            wsData.push([]);
            wsData.push(["", "", "", "Total Amount Due:", totalDue]);

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = [
                { wch: 12 }, // Date
                { wch: 15 }, // Doc #
                { wch: 30 }, // Project
                { wch: 15 }, // Total
                { wch: 15 }  // Outstanding
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Statement');
            XLSX.writeFile(wb, `Statement_${client.name}_${new Date().toISOString().split('T')[0]}.xlsx`);

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
