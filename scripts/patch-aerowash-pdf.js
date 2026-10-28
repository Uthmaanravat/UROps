const fs = require('fs');

let code = fs.readFileSync('src/lib/aerowash-quote-pdf.ts', 'utf8');

// 1. Add resolveImageBase64 helper if not present
if (!code.includes('async function resolveImageBase64')) {
    const helperCode = `
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
                return \`data:\${mime};base64,\${buf.toString('base64')}\`;
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
`;
    code = code.replace('export async function generateAeroWashQuotePdf', helperCode + '\nexport async function generateAeroWashQuotePdf');
}

// 2. Resolve header logo in generateAeroWashQuotePdf
const resolveLogoCode = `    const rawLogo =
        (companySettings as any)?.layoutPreferences?.darkHeaderLogoUrl ||
        (companySettings as any)?.logoUrl ||
        company.logoUrl;
    const headerLogoBase64 =
        (await resolveImageBase64(rawLogo)) ||
        (await resolveImageBase64('/aerowash_header_logo.png'));
`;

if (!code.includes('headerLogoBase64')) {
    code = code.replace(
        'const docHeading = isInvoice',
        resolveLogoCode + '\n    const docHeading = isInvoice'
    );
}

// 3. Replace Page 1 Header Band logo drawing
const oldHeaderLogoRegex = /\/\/ Left: AeroWash Logo \/ Wordmark[\s\S]*?\/\/ Right: Document Title & Metadata/;
const newHeaderLogoCode = `// Left: Real Logo from Settings (Never draw invented triangles or duplicate text)
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

    // Right: Document Title & Metadata`;

code = code.replace(oldHeaderLogoRegex, newHeaderLogoCode);

// 4. Remove duplicate Page 1 Acceptance Block so acceptance is on Page 2 terms page
const oldPage1AcceptanceRegex = /\/\/ ==========================================\s*\/\/ 8\. ACCEPTANCE BLOCK \(Quotes only\)[\s\S]*?\/\/ ==========================================\s*\/\/ 9\. PAGE 2: TERMS AND CONDITIONS/;
const newPage1AcceptanceCode = `// ==========================================
    // 9. PAGE 2: TERMS AND CONDITIONS & ACCEPTANCE`;

code = code.replace(oldPage1AcceptanceRegex, newPage1AcceptanceCode);

// 5. Replace Page 2 Terms generation with exact structured layout
const oldPage2TermsRegex = /\/\/ 9\. PAGE 2: TERMS AND CONDITIONS[\s\S]*?\/\/ ==========================================\s*\/\/ 9b\. APPENDIX: SITE INSPECTION PHOTOGRAPHS/;

const newPage2TermsCode = `// 9. PAGE 2: TERMS AND CONDITIONS & ACCEPTANCE
    // ==========================================
    doc.addPage();

    // Top thin black/orange strip
    doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.rect(0, 8, 210, 1.2, 'F');

    let p2Y = 18;

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
    const itemNames = invoice.items.map(i => i.description.split('\\n')[0].trim());
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
                text: \`\${e.name ? \`\${e.name}: \` : ''}\${e.exclusions.trim()}\`,
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
            text: \`\${elev} (\${loc}) — existing \${cond} excluded from cleaning/restoration warranty\`,
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
        let waivedNames = waivedLines.map(i => i.description.split('\\n')[0].trim()).join(' and ');
        if (!waivedNames && allowanceAmountVal > 0) {
            waivedNames = invoice.metadata?.allowanceName || "Introductory scope allowance";
        }
        if (!waivedNames) waivedNames = "Site Visit & Facade Assessment";

        const noteText = \`Note on the introductory allowance. \${waivedNames} are shown above at their standard value and are included at no charge on this first engagement only, as an introduction to our service. They will be quoted at standard rates on subsequent works.\`;

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
    // 9b. APPENDIX: SITE INSPECTION PHOTOGRAPHS`;

code = code.replace(oldPage2TermsRegex, newPage2TermsCode);

// 6. Update Appendix Header to use real logo from Settings
const oldAppendixLogoRegex = /\/\/ Black header on Appendix page[\s\S]*?\/\/ Right: APPENDIX heading/;
const newAppendixLogoCode = `// Black header on Appendix page
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

        // Right: APPENDIX heading`;

code = code.replace(oldAppendixLogoRegex, newAppendixLogoCode);

fs.writeFileSync('src/lib/aerowash-quote-pdf.ts', code);
console.log('Successfully patched aerowash-quote-pdf.ts');
