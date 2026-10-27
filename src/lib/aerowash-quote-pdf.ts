import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { drawPdfHeader, getThemePrimaryRGB } from "@/lib/pdf-utils"
import { formatCurrency } from "@/lib/utils"

export interface AeroWashQuotePdfOptions {
    invoice: {
        number: number;
        quoteNumber?: string | null;
        date: string | Date;
        site?: string | null;
        reference?: string | null;
        subtotal: number;
        taxAmount: number;
        total: number;
        client: {
            name: string;
            companyName?: string | null;
            address?: string | null;
            attentionTo?: string | null;
            vatNumber?: string | null;
            registrationNumber?: string | null;
        };
        items: {
            id?: string;
            area?: string | null;
            description: string;
            quantity: number;
            unitPrice: number;
            total?: number;
            metadata?: any;
        }[];
        metadata?: any;
        terms?: { bodySnapshot: string }[];
    };
    company: {
        name: string;
        address: string;
        phone: string;
        email: string;
        logoUrl?: string | null;
        vatNumber?: string | null;
        registrationNumber?: string | null;
    };
    companySettings?: {
        theme?: string;
        currency?: string;
        taxId?: string | null;
    };
}

export async function generateAeroWashQuotePdf({
    invoice,
    company,
    companySettings
}: AeroWashQuotePdfOptions): Promise<jsPDF> {
    const doc = new jsPDF();
    const currencySymbol = companySettings?.currency || "R";
    const [themeR, themeG, themeB] = getThemePrimaryRGB(companySettings?.theme || "dark-orange");

    // 1. Header Bar
    const dateObj = new Date(invoice.date);
    const numberLabel = invoice.quoteNumber || `Q-${dateObj.getFullYear()}-${invoice.number.toString().padStart(3, '0')}`;
    const nextY = await drawPdfHeader(doc, company, 'QUOTATION', numberLabel);

    // 2. Metadata Section (3-Column Layout)
    const gridY = nextY + 5;

    // Column 1: Document Details
    doc.setTextColor(themeR, themeG, themeB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DETAILS", 14, gridY);

    let detailY = gridY + 6;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text("Date Issued:", 14, detailY);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(dateObj.toLocaleDateString('en-GB'), 36, detailY);
    detailY += 6;

    if (invoice.reference) {
        const refLines = doc.splitTextToSize(invoice.reference, 45);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text("Project/Ref:", 14, detailY);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.text(refLines, 36, detailY);
        detailY += refLines.length * 4.5;
    }

    if (invoice.site) {
        const siteLines = doc.splitTextToSize(invoice.site, 45);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text("Site:", 14, detailY);
        doc.setTextColor(30, 41, 59);
        doc.text(siteLines, 36, detailY);
        detailY += siteLines.length * 4.5;
    }

    // Column 2: Bill To
    doc.setTextColor(themeR, themeG, themeB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("CLIENT", 85, gridY);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    const clientName = (invoice.client.companyName || invoice.client.name).toUpperCase();
    doc.text(clientName, 85, gridY + 6);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");

    let clientLegalY = gridY + 11;
    if (invoice.client.attentionTo) {
        doc.text(`Attn: ${invoice.client.attentionTo}`, 85, clientLegalY);
        clientLegalY += 4.5;
    }

    if (invoice.client.address) {
        const addrLines = doc.splitTextToSize(invoice.client.address, 55);
        doc.text(addrLines, 85, clientLegalY);
        clientLegalY += addrLines.length * 4.5;
    }

    // Column 3: From (AeroWash)
    doc.setTextColor(themeR, themeG, themeB);
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

    if (company.registrationNumber) {
        doc.text(`Reg: ${company.registrationNumber}`, 196, fromY, { align: 'right' });
        fromY += 4.5;
    }

    if (company.vatNumber) {
        doc.text(`VAT: ${company.vatNumber}`, 196, fromY, { align: 'right' });
        fromY += 4.5;
    }

    const compAddr = doc.splitTextToSize(company.address, 55);
    doc.text(compAddr, 196, fromY, { align: 'right' });
    fromY += compAddr.length * 4.5;

    doc.setTextColor(themeR, themeG, themeB);
    doc.setFont("helvetica", "bold");
    doc.text(company.phone, 196, fromY, { align: 'right' });
    fromY += 4.5;

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(company.email, 196, fromY, { align: 'right' });

    const startTableY = Math.max(detailY, clientLegalY, fromY) + 8;

    // 3. Client-Compliant Table: #, ITEM & DESCRIPTION, AMOUNT only
    // Grouped by elevation
    const sequentialGroups: { area: string; items: any[] }[] = [];
    invoice.items.forEach(item => {
        const area = (item.area || 'Scope of Work').trim();
        const last = sequentialGroups[sequentialGroups.length - 1];
        if (last && last.area === area) {
            last.items.push(item);
        } else {
            sequentialGroups.push({ area, items: [item] });
        }
    });

    const tableBody: any[] = [];
    let globalIndex = 1;

    sequentialGroups.forEach(group => {
        tableBody.push([
            {
                content: group.area.toUpperCase(),
                colSpan: 3,
                styles: {
                    fillColor: [248, 250, 252],
                    textColor: [20, 20, 30],
                    fontStyle: 'bold',
                    fontSize: 8,
                    halign: 'left',
                    cellPadding: 2.5
                }
            }
        ]);

        group.items.forEach(item => {
            const amount = (item.total !== undefined ? item.total : (item.quantity * item.unitPrice)) || 0;
            const amountStr = amount === 0 ? 'No charge' : formatCurrency(amount, currencySymbol);

            // Clean description: item name + client description only
            const cleanDesc = item.description.trim();

            tableBody.push([
                globalIndex++,
                cleanDesc,
                amountStr
            ]);
        });
    });

    autoTable(doc, {
        margin: { left: 14, right: 14 },
        head: [[
            { content: '#', styles: { halign: 'center' } },
            { content: 'ITEM & DESCRIPTION', styles: { halign: 'left' } },
            { content: 'AMOUNT', styles: { halign: 'right' } }
        ]],
        body: tableBody,
        startY: startTableY,
        theme: 'striped',
        headStyles: {
            fillColor: [20, 20, 30],
            textColor: [themeR, themeG, themeB],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: 2.5
        },
        bodyStyles: {
            fontSize: 7.5,
            textColor: [20, 20, 30],
            cellPadding: 2.5
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 135, halign: 'left' },
            2: { cellWidth: 37, halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: {
            fillColor: [252, 254, 255]
        },
        didParseCell: data => {
            if (data.row.raw && Array.isArray(data.row.raw) && (data.row.raw[0] as any)?.colSpan) {
                data.cell.styles.halign = 'left';
                return;
            }
            if (data.column.index === 0) data.cell.styles.halign = 'center';
            else if (data.column.index === 1) data.cell.styles.halign = 'left';
            else if (data.column.index === 2) data.cell.styles.halign = 'right';
        }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;
    const pageHeight = doc.internal.pageSize.getHeight();

    if (currentY + 35 > pageHeight - 15) {
        doc.addPage();
        currentY = 25;
    }

    // 4. Summary: Subtotal and Total (NO VAT line unless VAT registered)
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(135, currentY - 4, 196, currentY - 4);

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.text(`Subtotal:`, 140, currentY);
    doc.text(formatCurrency(invoice.subtotal, currencySymbol), 196, currentY, { align: 'right' });

    const isVatRegistered = Boolean(company.vatNumber && company.vatNumber.trim() !== '') && invoice.taxAmount > 0;
    let totalDueY = currentY + 8;
    if (isVatRegistered) {
        doc.text(`VAT (15%):`, 140, currentY + 6);
        doc.text(formatCurrency(invoice.taxAmount, currencySymbol), 196, currentY + 6, { align: 'right' });
        totalDueY = currentY + 14;
    }

    doc.setFontSize(11);
    doc.setTextColor(20, 20, 30);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL DUE:`, 140, totalDueY);
    doc.text(formatCurrency(invoice.total, currencySymbol), 196, totalDueY, { align: 'right' });
    currentY = totalDueY;

    // Contract Programme Banner (No percentages!)
    const progInfo = invoice.metadata?.programmeInfo;
    if (progInfo && progInfo.id !== 'ONCE_OFF') {
        currentY += 8;
        if (currentY + 24 > pageHeight - 15) {
            doc.addPage();
            currentY = 25;
        }

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, currentY, 182, 20, 2, 2, 'F');
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(themeR, themeG, themeB);
        doc.text(progInfo.name, 18, currentY + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Visits per year: ${progInfo.visitsPerYear} scheduled visits`, 18, currentY + 12);
        doc.text(`Price per visit: ${formatCurrency(invoice.total, currencySymbol)}`, 18, currentY + 16.5);
        doc.text(`Annual Total: ${formatCurrency(invoice.total * progInfo.visitsPerYear, currencySymbol)}`, 110, currentY + 16.5);
        currentY += 24;
    }

    // 5. Quotation Terms on New Page
    if (invoice.terms && invoice.terms.length > 0) {
        doc.addPage();
        let termsY = 25;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 30);
        doc.text("TERMS AND CONDITIONS", 14, termsY);
        doc.setDrawColor(themeR, themeG, themeB);
        doc.setLineWidth(0.5);
        doc.line(14, termsY + 2, 60, termsY + 2);
        termsY += 10;

        for (const term of invoice.terms) {
            const lines = doc.splitTextToSize(term.bodySnapshot, 182);
            if (termsY + lines.length * 4 > pageHeight - 15) {
                doc.addPage();
                termsY = 25;
            }
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            doc.text(lines, 14, termsY);
            termsY += (lines.length * 4) + 4;
        }
    }

    return doc;
}
