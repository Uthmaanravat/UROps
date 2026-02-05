"use client"

import { Button } from "@/components/ui/button"
import { FileText, Loader2 } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { useState } from "react"
import { formatCurrency } from "@/lib/utils"

export function ClientStatementButton({ client }: { client: any }) {
    const [loading, setLoading] = useState(false)

    const generateStatement = () => {
        setLoading(true)
        try {
            const doc = new jsPDF()

            // Header
            doc.setFontSize(22)
            doc.text("STATEMENT OF ACCOUNT", 14, 20)

            doc.setFontSize(10)
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30)
            doc.text(`Client: ${client.companyName || client.name}`, 14, 35)
            if (client.vatNumber) doc.text(`VAT No: ${client.vatNumber}`, 14, 40)

            // Statement of Outstanding Invoices
            doc.setFontSize(14)
            doc.text("OUTSTANDING INVOICES", 14, 50)

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
                    rows.push([
                        new Date(i.date).toLocaleDateString(),
                        `#${i.number}`,
                        i.quoteNumber || i.reference || '-',
                        i.site || i.project?.name || '-',
                        formatCurrency(i.total),
                        formatCurrency(outstanding)
                    ])
                }
            })

            // Table
            autoTable(doc, {
                startY: 55,
                head: [['Date', 'Invoice #', 'Quote/Ref', 'Site / Project', 'Total', 'Outstanding']],
                body: rows,
                theme: 'striped',
                headStyles: { fillColor: [220, 38, 38] }, // Red for outstanding
                columnStyles: {
                    4: { halign: 'right' },
                    5: { halign: 'right', fontStyle: 'bold' }
                }
            })

            // Summary
            const finalY = (doc as any).lastAutoTable.finalY + 10
            doc.setFontSize(12)
            doc.setFont("helvetica", "bold")
            doc.text(`Total Amount Due: ${formatCurrency(totalDue)}`, 195, finalY, { align: 'right' })



            doc.save(`Statement_${client.name}_${new Date().toISOString().split('T')[0]}.pdf`)
        } catch (e) {
            console.error(e)
            alert("Failed to generate statement")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button variant="outline" onClick={generateStatement} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Statement
        </Button>
    )
}
