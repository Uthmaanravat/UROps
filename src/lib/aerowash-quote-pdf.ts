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


async function resolveImageBase64(src?: string | null): Promise<string | null> {
    if (!src) return null;
    if (src.startsWith('data:image/')) return src;
    try {
        if (typeof window === 'undefined') {
            const fs = await import('fs');
            const path = await import('path');
            const cleanPath = src.startsWith('/') ? src.slice(1) : src;
            const fullPath = path.join(process.cwd(), 'public', cleanPath);
            if (fs.existsSync(fullPath)) {
                const buf = fs.readFileSync(fullPath);
                const ext = path.extname(cleanPath).toLowerCase();
                const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
                return `data:${mime};base64,${buf.toString('base64')}`;
            }
        } else {
            const res = await fetch(src);
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        }
    } catch (err) {
        console.warn('Failed to resolve image to base64:', err);
    }
    return null;
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
        const rawLogo =
        (companySettings as any)?.layoutPreferences?.darkHeaderLogoUrl ||
        '/aerowash_header_logo.png';
    const headerLogoBase64 =
        (await resolveImageBase64(rawLogo)) ||
        (await resolveImageBase64('/aerowash_header_logo.png'));

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
    const shortSite = siteRaw.split(',')[0].replace(/^Site:\s*/i, '');

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

    // Left: Real Logo from Settings (Never draw invented triangles or duplicate text)
    if (headerLogoBase64) {
        try {
            const imgProps = doc.getImageProperties(headerLogoBase64);
            const maxH = 26;
            const aspect = imgProps.width / imgProps.height;
            const renderW = Math.min(maxH * aspect, 65);
            const renderH = renderW / aspect;
            const renderY = 5 + (maxH - renderH) / 2;
            doc.addImage(headerLogoBase64, 'PNG', 14, renderY, renderW, renderH);
        } catch {
            doc.addImage(headerLogoBase64, 'PNG', 14, 5, 26, 26);
        }
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text("A E R O W A S H", 14, 20);
    }

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

    currentY = barY + 14;

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
    // 9. PAGE 2: TERMS AND CONDITIONS & ACCEPTANCE
    // ==========================================
    doc.addPage();

    // Black header on Terms page (Matches reference media_1793210441931_b9902b4d.png)
    doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
    doc.rect(0, 0, 210, 28, 'F');

    // AW Logo mark on left
    if (headerLogoBase64) {
        try {
            const imgProps = doc.getImageProperties(headerLogoBase64);
            const maxH = 20;
            const aspect = imgProps.width / imgProps.height;
            const renderW = Math.min(maxH * aspect, 50);
            const renderH = renderW / aspect;
            const renderY = 4 + (maxH - renderH) / 2;
            doc.addImage(headerLogoBase64, 'PNG', 14, renderY, renderW, renderH);
        } catch {
            doc.addImage(headerLogoBase64, 'PNG', 14, 4, 34, 20);
        }
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text("A E R O W A S H", 14, 16);
    }

    // Right: TERMS heading & doc reference
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("T E R M S", 196, 12, { align: "right" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text(isInvoice ? "Invoice No. " : "Quote No. ", 158, 18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.text(numberLabel, 196, 18, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(200, 200, 200);
    doc.text(shortSite, 196, 23, { align: "right" });

    // Thin orange rule under header band
    doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.rect(0, 28, 210, 1.2, 'F');

    let p2Y = 36;

    // Helper: Draw orange spaced heading with underline
    const drawSpacedHeading = (title: string, x: number, y: number, width: number) => {
        const spaced = title.split('').join(' ');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
        doc.text(spaced, x, y);
        doc.setDrawColor(lightLineRGB[0], lightLineRGB[1], lightLineRGB[2]);
        doc.setLineWidth(0.3);
        doc.line(x, y + 2, x + width, y + 2);
        return y + 6;
    };

    // Helper: Draw bullet list
    const drawBullets = (bullets: Array<{ text: string; isBold?: boolean }>, x: number, startY: number, width: number): number => {
        let curY = startY;
        bullets.forEach(b => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
            doc.text("•", x, curY);

            doc.setFont("helvetica", b.isBold ? "bold" : "normal");
            doc.setTextColor(darkGreyRGB[0], darkGreyRGB[1], darkGreyRGB[2]);
            const lines = doc.splitTextToSize(b.text, width - 4.5);
            doc.text(lines, x + 3.5, curY);
            curY += (lines.length * 3.7) + 1.8;
        });
        return curY;
    };

    // 1. INCLUDED & EXCLUDED (Two Columns)
    const colW = 86;
    const col1X = 14;
    const col2X = 110;

    // Headings
    drawSpacedHeading("INCLUDED", col1X, p2Y, colW);
    drawSpacedHeading("EXCLUDED", col2X, p2Y, colW);
    p2Y += 6;

    // Included Bullets
    const itemNames = invoice.items.map(i => i.description.split('\n')[0].trim());
    const uniqueItems = Array.from(new Set(itemNames));
    const includedList: Array<{ text: string; isBold?: boolean }> = uniqueItems.map(name => ({ text: name, isBold: false }));
    includedList.push(
        { text: "Pre- and post-clean photographic record", isBold: false },
        { text: "All labour, equipment and remote pilot crew", isBold: false }
    );

    // Excluded Bullets
    const excludedList: Array<{ text: string; isBold?: boolean }> = [];
    // Bold: Exclusions from elevations
    const elevs = invoice.metadata?.elevations || [];
    elevs.forEach((e: any) => {
        if (e.exclusions && typeof e.exclusions === 'string' && e.exclusions.trim().length > 0) {
            excludedList.push({
                text: `${e.name ? `${e.name}: ` : ''}${e.exclusions.trim()}`,
                isBold: true
            });
        }
    });
    // Bold: Cracked/damaged condition flags
    const flags = invoice.metadata?.conditionFlags || invoice.conditionFlags || [];
    flags.forEach((f: any) => {
        const loc = f.location || 'specific panels';
        const elev = f.elevation || 'Elevation';
        const cond = (f.conditionType || 'Defect').replace(/_/g, ' ').toLowerCase();
        excludedList.push({
            text: `${elev} (${loc}) — existing ${cond} excluded from cleaning/restoration warranty`,
            isBold: true
        });
    });
    // Standard Exclusions
    excludedList.push(
        { text: "Internal faces of glass, unless separately agreed", isBold: false },
        { text: "Hardened cement, paint and adhesive residue", isBold: false },
        { text: "Repair of existing damage, failed sealant or penetrated staining", isBold: false }
    );

    const endY1 = drawBullets(includedList, col1X, p2Y, colW);
    const endY2 = drawBullets(excludedList, col2X, p2Y, colW);
    p2Y = Math.max(endY1, endY2) + 5;

    // 2. CONDITIONS OF ACCESS (Full Width)
    drawSpacedHeading("CONDITIONS OF ACCESS", col1X, p2Y, 182);
    p2Y += 6;

    const accessBullets = [
        { text: "The client provides access to the work area and a water supply point within reach of it (unless Water Supply – Site Provision is quoted), and notifies tenants where required.", isBold: false },
        { text: "All flight operations are conducted in line with South African Civil Aviation Authority (SACAA) regulations, during daylight hours only.", isBold: false },
        { text: "Work is weather-dependent. Where wind, rain or visibility make flying unsafe, AeroWash will reschedule at no charge to the next available date.", isBold: false },
        { text: "The standard service area is within 50 km of Parow, Cape Town. Sites beyond this carry an Extended Travel provision.", isBold: false }
    ];
    p2Y = drawBullets(accessBullets, col1X, p2Y, 182) + 5;

    // 3. COMMERCIAL TERMS (Two Columns)
    drawSpacedHeading("COMMERCIAL TERMS", col1X, p2Y, 182);
    p2Y += 6;

    const commercialLeft = [
        { text: "Quotations are fixed price for the scope and elevations stated.", isBold: false },
        { text: "A 60% deposit is payable on acceptance to secure the booking.", isBold: false },
        { text: "The balance is payable on completion.", isBold: false },
        { text: "This quotation is valid for 45 days from the date of issue.", isBold: false }
    ];
    const commercialRight = [
        { text: "Any variation or additional work is quoted separately before it is carried out.", isBold: false },
        { text: "Prices exclude VAT. If AeroWash becomes VAT-registered, VAT will be added at the prevailing rate on invoices issued on or after the registration date.", isBold: false },
        { text: "Where work cannot start, continue or be completed for reasons outside AeroWash's control, including site access not being available or work being stopped at the client's request, a standby or return attendance charge applies, agreed with you before it is invoiced.", isBold: false },
        { text: "Existing damage, failed sealant, staining that has penetrated the substrate and other pre-existing defects are recorded before work starts and are not the responsibility of AeroWash.", isBold: false }
    ];

    const cEndY1 = drawBullets(commercialLeft, col1X, p2Y, colW);
    const cEndY2 = drawBullets(commercialRight, col2X, p2Y, colW);
    p2Y = Math.max(cEndY1, cEndY2) + 5;

    // 4. NOTE BOX (grey, only shown when quote has included/waived item or allowance line)
    const allowanceAmountVal = invoice.metadata?.allowanceAmount || 0;
    const waivedLines = invoice.items.filter(i => i.unitPrice === 0 || i.isIncluded || (i.metadata && (i.metadata.label === 'No charge' || i.metadata.label === 'Included')));
    const showNoteBox = allowanceAmountVal > 0 || waivedLines.length > 0;

    if (showNoteBox) {
        let waivedNames = waivedLines.map(i => i.description.split('\n')[0].trim()).join(' and ');
        if (!waivedNames && allowanceAmountVal > 0) {
            waivedNames = invoice.metadata?.allowanceName || "Introductory scope allowance";
        }
        if (!waivedNames) waivedNames = "Site Visit & Facade Assessment";

        const noteText = `Note on the introductory allowance. ${waivedNames} are shown above at their standard value and are included at no charge on this first engagement only, as an introduction to our service. They will be quoted at standard rates on subsequent works.`;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        const noteLines = doc.splitTextToSize(noteText, 174);
        const boxH = (noteLines.length * 3.8) + 6;

        // Background #F3F4F6
        doc.setFillColor(243, 244, 246);
        doc.rect(col1X, p2Y, 182, boxH, 'F');
        // Left border #9CA3AF
        doc.setFillColor(156, 163, 175);
        doc.rect(col1X, p2Y, 1.2, boxH, 'F');

        doc.setTextColor(55, 65, 81);
        doc.text(noteLines, col1X + 4, p2Y + 4.5);
        p2Y += boxH + 6;
    }

    // 5. ACCEPTANCE
    drawSpacedHeading("ACCEPTANCE", col1X, p2Y, 182);
    p2Y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
    doc.text("To proceed, sign below and return, or confirm by email to info@aerowash.co.za.", col1X, p2Y);
    p2Y += 10;

    // Signature lines
    const sigLineW = 82;
    doc.setDrawColor(lightLineRGB[0], lightLineRGB[1], lightLineRGB[2]);
    doc.setLineWidth(0.4);
    // Left line
    doc.line(col1X, p2Y, col1X + sigLineW, p2Y);
    // Right line
    doc.line(col2X, p2Y, col2X + sigLineW, p2Y);

    doc.setFontSize(7);
    doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
    doc.text("Client signature · Name, position, date", col1X, p2Y + 3.8);
    doc.text("For AeroWash (Pty) Ltd · Date", col2X, p2Y + 3.8);
    p2Y += 10;

    doc.setFontSize(7);
    doc.text("Purchase order no. (if applicable): ____________________________________", col1X, p2Y);

    // ==========================================
    // 9b. APPENDIX: SITE INSPECTION PHOTOGRAPHS
    // ==========================================
    const siteVisitPhotos: any[] = invoice.metadata?.siteVisitPhotos || invoice.siteVisitPhotos || [];
    if (siteVisitPhotos && siteVisitPhotos.length > 0) {
        doc.addPage();

        // Black header on Appendix page
        doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
        doc.rect(0, 0, 210, 28, 'F');

        // Logo from Settings (no invented triangles)
        if (headerLogoBase64) {
            try {
                const imgProps = doc.getImageProperties(headerLogoBase64);
                const maxH = 20;
                const aspect = imgProps.width / imgProps.height;
                const renderW = Math.min(maxH * aspect, 50);
                const renderH = renderW / aspect;
                const renderY = 4 + (maxH - renderH) / 2;
                doc.addImage(headerLogoBase64, 'PNG', 14, renderY, renderW, renderH);
            } catch {
                doc.addImage(headerLogoBase64, 'PNG', 14, 4, 20, 20);
            }
        } else {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.text("A E R O W A S H", 14, 16);
        }

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
