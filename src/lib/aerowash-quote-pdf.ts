import { isVatEffective, getVatRate } from "@/lib/vat-utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/utils";
import { parseClauses } from "@/lib/terms-utils";
import { AEROWASH_STANDARD_TERMS_BODY } from "@/lib/aerowash-catalogue";

export interface AeroWashQuotePdfOptions {
    invoice: {
        id?: string;
        number: number;
        quoteNumber?: string | null;
        date: string | Date;
        type?: 'QUOTE' | 'INVOICE';
        site?: string | null;
        reference?: string | null;
        notes?: string | null;
        subtotal: number;
        taxAmount: number;
        total: number;
        clientPoNumber?: string | null;
        client: {
            name: string;
            companyName?: string | null;
            address?: string | null;
            attentionTo?: string | null;
            email?: string | null;
            phone?: string | null;
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
            isIncluded?: boolean;
            originalPrice?: number;
            metadata?: any;
        }[];
        metadata?: any;
        conditionFlags?: any[];
        siteVisitPhotos?: any[];
        terms?: { bodySnapshot: string }[];
    };
    company: {
        name: string;
        address: string;
        phone: string;
        email: string;
        website?: string | null;
        logoUrl?: string | null;
        vatNumber?: string | null;
        registrationNumber?: string | null;
        vatRegistrationDate?: Date | string | null;
        vatRate?: number | string | null;
        bankDetails?: string | null;
    };
    companySettings?: {
        theme?: string;
        currency?: string;
        taxId?: string | null;
        validityDays?: number;
        preparedByName?: string;
        preparedByPhone?: string;
    };
}

export async function generateAeroWashQuotePdf({
    invoice,
    company,
    companySettings
}: AeroWashQuotePdfOptions): Promise<jsPDF> {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const isInvoice = invoice.type === 'INVOICE';
    const currencySymbol = companySettings?.currency || "R";
    const dateObj = new Date(invoice.date);
    const year = dateObj.getFullYear();

    // Document numbering
    const numberLabel = invoice.quoteNumber
        ? invoice.quoteNumber
        : (isInvoice
            ? `INV-${year}-${invoice.number.toString().padStart(3, '0')}`
            : `AW-${year}-${invoice.number.toString().padStart(3, '0')}`);

    // VAT check
    const isVatActive = isVatEffective(invoice.date, {
        taxId: company.vatNumber,
        vatRegistrationDate: company.vatRegistrationDate
    });
    const docHeading = isInvoice
        ? (isVatActive ? 'T A X   I N V O I C E' : 'I N V O I C E')
        : 'Q U O T A T I O N';

    // Validity: quote date + validity days (default 45)
    const validityDays = companySettings?.validityDays || 45;
    const validUntilDate = new Date(dateObj);
    validUntilDate.setDate(validUntilDate.getDate() + validityDays);

    const formattedDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const formattedValidDate = validUntilDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // Client and Site text
    const clientName = invoice.client.companyName || invoice.client.name;
    const attentionName = invoice.client.attentionTo || invoice.client.name;
    const siteRaw = invoice.site || invoice.reference || 'Site address as agreed';
    const siteText = siteRaw.startsWith('Site:') ? siteRaw : `Site: ${siteRaw}`;

    // Colors
    const orangeRGB: [number, number, number] = [208, 94, 0]; // #D05E00
    const blackRGB: [number, number, number] = [10, 10, 10]; // #0A0A0A
    const darkGreyRGB: [number, number, number] = [17, 24, 39]; // #111827
    const bodyGreyRGB: [number, number, number] = [75, 85, 99]; // #4B5563
    const lightLineRGB: [number, number, number] = [229, 231, 235]; // #E5E7EB
    const greenRGB: [number, number, number] = [22, 163, 74]; // #16A34A

    // ==========================================
    // 1. PAGE 1 HEADER BAND
    // ==========================================
    doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
    doc.rect(0, 0, 210, 36, 'F');

    // Left: AeroWash Logo / Wordmark
    // Stylized orange AW mark
    doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    // Left stroke
    doc.triangle(14, 25, 20, 10, 24, 25, 'F');
    // Middle chevron
    doc.triangle(24, 25, 28, 14, 32, 25, 'F');
    // Right stroke
    doc.triangle(32, 25, 36, 10, 42, 25, 'F');
    // Cutout center
    doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
    doc.triangle(18, 25, 20, 19, 22, 25, 'F');
    doc.triangle(34, 25, 36, 19, 38, 25, 'F');

    // Brand text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("A E R O W A S H", 46, 18);

    doc.setFontSize(6.5);
    doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.text("D R O N E   C L E A N I N G   S O L U T I O N S", 46, 23);

    // Right: Document Title & Metadata
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(docHeading, 196, 14, { align: "right" });

    doc.setFontSize(8);
    const labelX = 158;
    const valX = 196;

    // Doc No
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text(isInvoice ? "Invoice No." : "Quote No.", labelX, 20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.text(numberLabel, valX, 20, { align: "right" });

    // Date
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text("Date:", labelX, 25);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.text(formattedDate, valX, 25, { align: "right" });

    // Valid until (quotes only)
    if (!isInvoice) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(255, 255, 255);
        doc.text("Valid until:", labelX, 30);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
        doc.text(formattedValidDate, valX, 30, { align: "right" });
    }

    // Thin orange rule under header band
    doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.rect(0, 36, 210, 1.2, 'F');

    // ==========================================
    // 2. FROM & ATTENTION BLOCKS
    // ==========================================
    let y = 46;

    // Column 1: FROM
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.text("F R O M", 14, y);
    doc.setDrawColor(lightLineRGB[0], lightLineRGB[1], lightLineRGB[2]);
    doc.setLineWidth(0.3);
    doc.line(14, y + 2, 98, y + 2);

    let fromY = y + 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(darkGreyRGB[0], darkGreyRGB[1], darkGreyRGB[2]);
    doc.text(company.name || "AeroWash (Pty) Ltd", 14, fromY);
    fromY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
    doc.text("Drone Cleaning Solutions", 14, fromY);
    fromY += 4.2;

    const companyAddress = company.address || "15 Culemborg Street, Parow, Cape Town, 7500";
    doc.text(companyAddress, 14, fromY);
    fromY += 4.2;

    const companyPhone = company.phone || "067 829 3350";
    const companyEmail = company.email || "info@aerowash.co.za";
    doc.text(`${companyPhone}  ·  ${companyEmail}`, 14, fromY);
    fromY += 4.2;

    const companyReg = company.registrationNumber ? `Reg. ${company.registrationNumber}` : "Reg. 2026/475172/07";
    const companyWeb = company.website || "www.aerowash.co.za";
    doc.text(`${companyWeb}  ·  ${companyReg}`, 14, fromY);
    fromY += 4.2;

    if (company.vatNumber && isVatActive) {
        doc.text(`VAT No. ${company.vatNumber}`, 14, fromY);
        fromY += 4.2;
    }

    // Column 2: ATTENTION
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.text("A T T E N T I O N", 112, y);
    doc.setDrawColor(lightLineRGB[0], lightLineRGB[1], lightLineRGB[2]);
    doc.setLineWidth(0.3);
    doc.line(112, y + 2, 196, y + 2);

    let attY = y + 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(darkGreyRGB[0], darkGreyRGB[1], darkGreyRGB[2]);
    doc.text(attentionName, 112, attY);
    attY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);

    if (invoice.client.email) {
        doc.text(invoice.client.email, 112, attY);
        attY += 4.2;
    }
    if (invoice.client.phone) {
        doc.text(invoice.client.phone, 112, attY);
        attY += 4.2;
    }
    if (invoice.client.companyName && invoice.client.companyName !== attentionName) {
        doc.text(invoice.client.companyName, 112, attY);
        attY += 4.2;
    }
    if (invoice.client.vatNumber) {
        doc.text(`VAT No. ${invoice.client.vatNumber}`, 112, attY);
        attY += 4.2;
    }

    attY += 1.5;
    // Site label and address
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkGreyRGB[0], darkGreyRGB[1], darkGreyRGB[2]);
    doc.text("Site:", 112, attY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);

    const siteClean = siteRaw.replace(/^site:\s*/i, '');
    const siteLines = doc.splitTextToSize(siteClean, 74);
    doc.text(siteLines, 120, attY);
    attY += Math.max(siteLines.length * 4.2, 4.2);

    // ==========================================
    // 3. SCOPE OF WORKS BLOCK
    // ==========================================
    y = Math.max(fromY, attY) + 4;

    const scopeOfWorksText = invoice.metadata?.scopeOfWorks || invoice.notes || (
        `Exterior maintenance cleaning of the building elevations at ${invoice.site || 'the premises'}, delivered by drone with no scaffolding, cradles, ladders or rope access and no obstruction of trading or parking.`
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.text("S C O P E   O F   W O R K S", 14, y);
    doc.setDrawColor(lightLineRGB[0], lightLineRGB[1], lightLineRGB[2]);
    doc.setLineWidth(0.3);
    doc.line(14, y + 2, 196, y + 2);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
    const scopeLines = doc.splitTextToSize(scopeOfWorksText, 182);
    doc.text(scopeLines, 14, y);
    y += (scopeLines.length * 4.2) + 4;

    // ==========================================
    // 4. ITEMS TABLE (ITEM | AMOUNT only)
    // ==========================================
    const tableBody: any[] = [];
    let itemNumber = 1;

    // Group items if multiple elevations
    const sequentialGroups: { area: string; items: any[] }[] = [];
    invoice.items.forEach(item => {
        const area = (item.area || '').trim();
        const last = sequentialGroups[sequentialGroups.length - 1];
        if (last && last.area === area) {
            last.items.push(item);
        } else {
            sequentialGroups.push({ area, items: [item] });
        }
    });

    const isGroupedByElevation = sequentialGroups.length > 1 && sequentialGroups.some(g => Boolean(g.area));

    sequentialGroups.forEach(group => {
        if (isGroupedByElevation && group.area) {
            tableBody.push([
                {
                    content: group.area.toUpperCase(),
                    colSpan: 2,
                    styles: {
                        fillColor: [249, 250, 251],
                        textColor: [darkGreyRGB[0], darkGreyRGB[1], darkGreyRGB[2]],
                        fontStyle: 'bold',
                        fontSize: 8,
                        halign: 'left',
                        cellPadding: 2
                    }
                }
            ]);
        }

        group.items.forEach(item => {
            const isIncluded = item.isIncluded || item.metadata?.isIncluded || (item.unitPrice === 0 && item.originalPrice && item.originalPrice > 0);
            const originalAmount = item.originalPrice || (item.total !== undefined ? item.total : item.quantity * item.unitPrice) || 0;
            const amount = (item.total !== undefined ? item.total : item.quantity * item.unitPrice) || 0;

            // Clean title and description
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

            const cleanTitle = `${itemNumber++}. ${title.replace(/^\d+[\.\)]\s*/, '')}`;

            // Cell formatting for Item Description
            const itemCellContent = subDesc
                ? `${cleanTitle}\n${subDesc}`
                : cleanTitle;

            // Cell formatting for Amount
            let amountCellContent: any = formatCurrency(amount, currencySymbol);
            if (isIncluded) {
                amountCellContent = `${formatCurrency(originalAmount, currencySymbol)}\nINCLUDED`;
            } else if (amount === 0) {
                amountCellContent = "INCLUDED";
            }

            tableBody.push([
                itemCellContent,
                amountCellContent
            ]);
        });

        // Condition flags for this elevation
        const conditionFlags: any[] = invoice.metadata?.conditionFlags || invoice.conditionFlags || [];
        const matchingFlags = conditionFlags.filter((f: any) =>
            f.elevation && (
                f.elevation.toLowerCase() === group.area.toLowerCase() ||
                (!isGroupedByElevation && sequentialGroups.length === 1)
            )
        );

        matchingFlags.forEach((flag: any) => {
            tableBody.push([
                {
                    content: `Existing condition noted:\n${flag.wording}`,
                    colSpan: 2,
                    styles: {
                        fillColor: [255, 247, 237], // #FFF7ED light orange
                        textColor: [124, 45, 18],   // #7C2D12
                        lineColor: [208, 94, 0],    // #D05E00
                        lineWidth: { left: 1.5, top: 0, right: 0, bottom: 0 },
                        fontSize: 7.5,
                        fontStyle: 'normal',
                        cellPadding: 3.5
                    }
                }
            ]);
        });
    });

    // Any remaining condition flags not caught by elevation matching
    const conditionFlagsAll: any[] = invoice.metadata?.conditionFlags || invoice.conditionFlags || [];
    const processedFlagIds = new Set();
    sequentialGroups.forEach(group => {
        const matching = conditionFlagsAll.filter((f: any) =>
            f.elevation && (
                f.elevation.toLowerCase() === group.area.toLowerCase() ||
                (!isGroupedByElevation && sequentialGroups.length === 1)
            )
        );
        matching.forEach(f => processedFlagIds.add(f.id));
    });

    const unhandledFlags = conditionFlagsAll.filter((f: any) => !processedFlagIds.has(f.id));
    unhandledFlags.forEach((flag: any) => {
        tableBody.push([
            {
                content: `Existing condition noted (${flag.elevation}):\n${flag.wording}`,
                colSpan: 2,
                styles: {
                    fillColor: [255, 247, 237],
                    textColor: [124, 45, 18],
                    lineColor: [208, 94, 0],
                    lineWidth: { left: 1.5, top: 0, right: 0, bottom: 0 },
                    fontSize: 7.5,
                    fontStyle: 'normal',
                    cellPadding: 3.5
                }
            }
        ]);
    });

    autoTable(doc, {
        margin: { left: 14, right: 14 },
        head: [[
            { content: 'ITEM', styles: { halign: 'left' } },
            { content: 'AMOUNT', styles: { halign: 'right' } }
        ]],
        body: tableBody,
        startY: y,
        theme: 'plain',
        headStyles: {
            fillColor: [243, 244, 246], // #F3F4F6
            textColor: [55, 65, 81], // #374151
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: 2.8
        },
        bodyStyles: {
            fontSize: 7.5,
            textColor: [darkGreyRGB[0], darkGreyRGB[1], darkGreyRGB[2]],
            cellPadding: 3,
            lineColor: [243, 244, 246],
            lineWidth: 0.2
        },
        columnStyles: {
            0: { cellWidth: 145, halign: 'left' },
            1: { cellWidth: 37, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: data => {
            if (data.column.index === 1 && typeof data.cell.raw === 'string' && data.cell.raw.includes('INCLUDED')) {
                data.cell.styles.textColor = greenRGB;
            }
        }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 5;
    const pageHeight = doc.internal.pageSize.getHeight();

    // ==========================================
    // 5. TOTALS BLOCK (Right-aligned)
    // ==========================================
    const totalsWidth = 85;
    const totalsRightX = 196;
    const totalsLeftX = totalsRightX - totalsWidth;

    // Full scope subtotal at standard rates
    const allowanceAmount = invoice.metadata?.allowanceAmount || 0;
    const allowanceName = invoice.metadata?.allowanceName || "Introductory allowance";
    const subtotalStandardRates = invoice.subtotal + allowanceAmount;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);

    if (allowanceAmount > 0) {
        doc.text("Subtotal — full scope at standard rates", totalsLeftX, currentY);
        doc.text(formatCurrency(subtotalStandardRates, currencySymbol), totalsRightX, currentY, { align: "right" });
        currentY += 4.5;

        // Allowance in green as minus
        doc.setFont("helvetica", "bold");
        doc.setTextColor(greenRGB[0], greenRGB[1], greenRGB[2]);
        doc.text(allowanceName, totalsLeftX, currentY);
        doc.text(`− ${formatCurrency(allowanceAmount, currencySymbol)}`, totalsRightX, currentY, { align: "right" });
        currentY += 5;
    } else {
        doc.text("Subtotal", totalsLeftX, currentY);
        doc.text(formatCurrency(invoice.subtotal, currencySymbol), totalsRightX, currentY, { align: "right" });
        currentY += 5;
    }

    // VAT line if registered
    const vatRate = (company as any).vatRate ?? 15;
    const isVatRegistered = isVatActive && invoice.taxAmount > 0;
    if (isVatRegistered) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
        doc.text(`VAT (${vatRate}%)`, totalsLeftX, currentY);
        doc.text(formatCurrency(invoice.taxAmount, currencySymbol), totalsRightX, currentY, { align: "right" });
        currentY += 5;
    }

    // Black TOTAL DUE Bar with orange top border
    const barY = currentY + 1;
    doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
    doc.rect(totalsLeftX, barY, totalsWidth, 10, 'F');

    // Orange top border
    doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.rect(totalsLeftX, barY, totalsWidth, 1.2, 'F');

    // Total Due Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL DUE", totalsLeftX + 4, barY + 6.5);

    doc.setFontSize(11);
    doc.text(formatCurrency(invoice.total, currencySymbol), totalsRightX - 4, barY + 6.5, { align: "right" });

    currentY = barY + 13;

    // Prepared by line
    const prepName = companySettings?.preparedByName || "Uthmaan Ravat";
    const prepPhone = companySettings?.preparedByPhone || "067 829 3350";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
    doc.text(`Prepared by: ${prepName}, ${prepPhone}`, totalsRightX, currentY, { align: "right" });
    currentY += 7;

    // ==========================================
    // 6. NOTICE BOX (Site visit required)
    // ==========================================
    const siteVisitRequired = invoice.metadata?.siteVisitRequired ?? (
        invoice.total >= 50000 || invoice.items.some(i => i.description.toLowerCase().includes('site visit') || i.description.toLowerCase().includes('pre-treatment'))
    );

    if (siteVisitRequired) {
        if (currentY + 22 > pageHeight - 30) {
            doc.addPage();
            currentY = 20;
        }

        const noticeH = 20;
        // Background #FFF7ED
        doc.setFillColor(255, 247, 237);
        doc.rect(14, currentY, 182, noticeH, 'F');

        // Left border #D05E00
        doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
        doc.rect(14, currentY, 1.5, noticeH, 'F');

        // Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(154, 52, 18); // #9A3412
        doc.text("Site visit required to confirm this quotation", 18, currentY + 5);

        // Body text (strictly without measurements or heights)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(124, 45, 18); // #7C2D12
        const noticeMsg = "Measurements are taken from aerial survey data. Before this quotation is confirmed, AeroWash will attend site at no charge to verify dimensions, assess condition, confirm water and power points and identify access constraints. A revised figure will be issued if verified measurements differ materially.";
        const noticeLines = doc.splitTextToSize(noticeMsg, 174);
        doc.text(noticeLines, 18, currentY + 9);

        currentY += noticeH + 6;
    }

    // ==========================================
    // 7. BANKING DETAILS (Invoices only)
    // ==========================================
    if (isInvoice) {
        if (currentY + 25 > pageHeight - 25) {
            doc.addPage();
            currentY = 20;
        }

        const bankBoxH = 22;
        doc.setFillColor(249, 250, 251);
        doc.rect(14, currentY, 182, bankBoxH, 'F');
        doc.setDrawColor(lightLineRGB[0], lightLineRGB[1], lightLineRGB[2]);
        doc.setLineWidth(0.3);
        doc.rect(14, currentY, 182, bankBoxH, 'S');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(darkGreyRGB[0], darkGreyRGB[1], darkGreyRGB[2]);
        doc.text("Banking Details (EFT Settlement)", 18, currentY + 5.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
        const bankName = "Standard Bank";
        const accName = company.name || "AeroWash (Pty) Ltd";
        const accNum = "070 829 335";
        const branchCode = "051001";
        doc.text(`Bank: ${bankName}    ·    Account Name: ${accName}    ·    Account Number: ${accNum}    ·    Branch Code: ${branchCode}`, 18, currentY + 11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
        doc.text(`Payment Reference: ${numberLabel}`, 18, currentY + 16.5);

        currentY += bankBoxH + 6;
    }

    // ==========================================
    // 8. ACCEPTANCE BLOCK (Quotes only)
    // ==========================================
    if (!isInvoice) {
        if (currentY + 30 > pageHeight - 25) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(darkGreyRGB[0], darkGreyRGB[1], darkGreyRGB[2]);
        doc.text(`Accepted on behalf of ${clientName}:`, 14, currentY);
        currentY += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
        doc.text("Name: ____________________________________          Signature: ____________________________________", 14, currentY);
        currentY += 6;
        doc.text("Date:   ____________________________________          PO number: ____________________________________", 14, currentY);
        currentY += 5;

        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.text("Please sign and return, or reply to accept by email.", 14, currentY);
    }

    // ==========================================
    // 9. PAGE 2: TERMS AND CONDITIONS
    // ==========================================
    doc.addPage();

    // Black header on Terms page
    doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
    doc.rect(0, 0, 210, 28, 'F');

    // AW Logo mark
    doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.triangle(14, 20, 18, 9, 21, 20, 'F');
    doc.triangle(21, 20, 24, 12, 27, 20, 'F');
    doc.triangle(27, 20, 30, 9, 34, 20, 'F');
    doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
    doc.triangle(16, 20, 18, 15, 20, 20, 'F');
    doc.triangle(28, 20, 30, 15, 32, 20, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("A E R O W A S H", 38, 16);

    // Right: TERMS heading & doc reference
    doc.setFontSize(12);
    doc.text("T E R M S", 196, 12, { align: "right" });

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.text(`Quote No. ${numberLabel}`, 196, 18, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    const shortSite = siteClean.split(',')[0];
    doc.text(shortSite, 196, 23, { align: "right" });

    // Thin orange rule
    doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.rect(0, 28, 210, 1.2, 'F');

    // Terms body clauses
    let termsY = 36;
    const termsBody = invoice.terms && invoice.terms.length > 0
        ? invoice.terms.map(t => t.bodySnapshot).join('\n\n')
        : AEROWASH_STANDARD_TERMS_BODY;

    const parsedClauses = parseClauses(termsBody);
    parsedClauses.forEach((clauseText, cIdx) => {
        if (termsY + 16 > pageHeight - 20) {
            doc.addPage();
            termsY = 20;
        }

        const lines = clauseText.split('\n');
        if (lines.length > 1 && lines[0].length < 60) {
            const title = lines[0].trim();
            const body = lines.slice(1).join(' ').trim();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
            doc.text(`${cIdx + 1}.  ${title}`, 14, termsY);
            termsY += 4.2;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            const bodyLines = doc.splitTextToSize(body, 182);
            doc.text(bodyLines, 14, termsY);
            termsY += (bodyLines.length * 3.8) + 3.5;
        } else {
            const clauseLines = doc.splitTextToSize(`${cIdx + 1}.  ${clauseText}`, 182);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
            doc.text(clauseLines, 14, termsY);
            termsY += (clauseLines.length * 3.8) + 3;
        }
    });

    // ==========================================
    // 9b. APPENDIX: SITE INSPECTION PHOTOGRAPHS
    // ==========================================
    const siteVisitPhotos: any[] = invoice.metadata?.siteVisitPhotos || invoice.siteVisitPhotos || [];
    if (siteVisitPhotos && siteVisitPhotos.length > 0) {
        doc.addPage();

        // Black header on Appendix page
        doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
        doc.rect(0, 0, 210, 28, 'F');

        // AW Logo mark
        doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
        doc.triangle(14, 20, 18, 9, 21, 20, 'F');
        doc.triangle(21, 20, 24, 12, 27, 20, 'F');
        doc.triangle(27, 20, 30, 9, 34, 20, 'F');
        doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
        doc.triangle(16, 20, 18, 15, 20, 20, 'F');
        doc.triangle(28, 20, 30, 15, 32, 20, 'F');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text("A E R O W A S H", 38, 16);

        // Right: APPENDIX heading & doc reference
        doc.setFontSize(11);
        doc.text("S I T E   I N S P E C T I O N   P H O T O G R A P H S", 196, 12, { align: "right" });

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
        doc.text(`Quote No. ${numberLabel}`, 196, 18, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setTextColor(255, 255, 255);
        doc.text(shortSite, 196, 23, { align: "right" });

        // Thin orange rule
        doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
        doc.rect(0, 28, 210, 1.2, 'F');

        // Section header line
        let photoY = 36;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
        doc.text("P H O T O G R A P H I C   R E C O R D", 14, photoY);
        doc.setDrawColor(lightLineRGB[0], lightLineRGB[1], lightLineRGB[2]);
        doc.setLineWidth(0.3);
        doc.line(14, photoY + 2, 196, photoY + 2);
        photoY += 8;

        // Grid of photos: 3 columns per row
        const cols = 3;
        const colWidth = 56;
        const colGap = 7;
        const photoHeight = 42;
        const cardHeight = 65;

        siteVisitPhotos.forEach((photo: any, pIdx: number) => {
            const colIndex = pIdx % cols;
            const rowIndex = Math.floor(pIdx / cols);

            // New page if overflowing
            const cardY = photoY + (rowIndex * (cardHeight + 5));
            if (cardY + cardHeight > pageHeight - 16) {
                doc.addPage();
                doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
                doc.rect(0, 0, 210, 28, 'F');
                doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
                doc.rect(0, 28, 210, 1.2, 'F');
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(255, 255, 255);
                doc.text("A E R O W A S H", 38, 16);
                doc.setFontSize(11);
                doc.text("S I T E   I N S P E C T I O N   P H O T O G R A P H S   ( C O N T . )", 196, 12, { align: "right" });
                photoY = 36;
            }

            const cardX = 14 + (colIndex * (colWidth + colGap));

            // Card background & border
            doc.setFillColor(249, 250, 251); // #F9FAFB
            doc.setDrawColor(229, 231, 235); // #E5E7EB
            doc.setLineWidth(0.3);
            doc.roundedRect(cardX, cardY, colWidth, cardHeight, 1.5, 1.5, 'FD');

            // Photo image or placeholder
            if (photo.url && typeof photo.url === 'string' && (photo.url.startsWith('data:image') || photo.url.startsWith('http') || photo.url.length > 100)) {
                try {
                    const format = photo.url.includes('image/png') ? 'PNG' : 'JPEG';
                    doc.addImage(photo.url, format, cardX + 2, cardY + 2, colWidth - 4, photoHeight, undefined, 'FAST');
                } catch (e) {
                    doc.setFillColor(243, 244, 246);
                    doc.rect(cardX + 2, cardY + 2, colWidth - 4, photoHeight, 'F');
                    doc.setFontSize(7);
                    doc.setTextColor(156, 163, 175);
                    doc.text("Photo Attached", cardX + (colWidth / 2), cardY + (photoHeight / 2), { align: "center" });
                }
            } else {
                doc.setFillColor(243, 244, 246);
                doc.rect(cardX + 2, cardY + 2, colWidth - 4, photoHeight, 'F');
                doc.setFontSize(7);
                doc.setTextColor(156, 163, 175);
                doc.text("Inspection Photo", cardX + (colWidth / 2), cardY + (photoHeight / 2), { align: "center" });
            }

            // Photo badge: Photo 04
            const labelY = cardY + photoHeight + 6;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
            doc.text(`Photo ${photo.photoNumber}`, cardX + 3, labelY);

            // Elevation
            if (photo.elevation) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.setTextColor(darkGreyRGB[0], darkGreyRGB[1], darkGreyRGB[2]);
                const elevLines = doc.splitTextToSize(photo.elevation, colWidth - 6);
                doc.text(elevLines[0], cardX + colWidth - 3, labelY, { align: "right" });
            }

            // Caption
            if (photo.caption) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(6.5);
                doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
                const capLines = doc.splitTextToSize(photo.caption, colWidth - 6);
                doc.text(capLines.slice(0, 2), cardX + 3, labelY + 4);
            }
        });
    }

    // ==========================================
    // 10. FOOTER ON EVERY PAGE
    // ==========================================
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);

        // Left footer
        doc.text(`AeroWash (Pty) Ltd  ·  Quotation ${numberLabel}`, 14, pageHeight - 8);

        // Right footer
        doc.text(`Page ${p} of ${totalPages}`, 196, pageHeight - 8, { align: "right" });
    }

    return doc;
}
