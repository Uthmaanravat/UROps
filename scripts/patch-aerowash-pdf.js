const fs = require('fs');

function patchFile(filePath, transforms) {
    let content = fs.readFileSync(filePath, 'utf8');
    const isCrlf = content.includes('\r\n');
    let normalized = content.replace(/\r\n/g, '\n');

    for (const { name, search, replace } of transforms) {
        const normSearch = search.replace(/\r\n/g, '\n');
        const normReplace = replace.replace(/\r\n/g, '\n');

        if (!normalized.includes(normSearch)) {
            console.error(`FAILED to find transform "${name}" in ${filePath}`);
            process.exit(1);
        }
        normalized = normalized.replace(normSearch, normReplace);
        console.log(`Applied transform: "${name}" to ${filePath}`);
    }

    if (isCrlf) {
        normalized = normalized.replace(/\n/g, '\r\n');
    }
    fs.writeFileSync(filePath, normalized, 'utf8');
    console.log(`Saved ${filePath} successfully.\n`);
}

patchFile('src/lib/aerowash-quote-pdf.ts', [
    {
        name: 'Deposit / First Payment handling in AeroWash PDF totals',
        search: `    // Black TOTAL DUE / BALANCE DUE Bar with orange top border
    const barY = currentY + 1;
    doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
    doc.rect(totalsLeftX, barY, totalsWidth, 10, 'F');

    // Orange top border
    doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.rect(totalsLeftX, barY, totalsWidth, 1.2, 'F');

    // Total Due / Balance Due Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(isBalanceInvoice ? "BALANCE DUE" : "TOTAL DUE", totalsLeftX + 4, barY + 6.5);

    doc.setFontSize(11);
    doc.text(formatCurrency(effectiveTotal, currencySymbol), totalsRightX - 4, barY + 6.5, { align: "right" });

    currentY = barY + 14;`,
        replace: `    // Deposit / First Payment breakdown for invoices
    const firstPaymentPct = invoice.firstPaymentPercentage;
    const hasFirstPayment = Boolean(isInvoice && firstPaymentPct && firstPaymentPct > 0 && firstPaymentPct < 100);
    const firstPaymentAmount = hasFirstPayment ? (effectiveTotal * (firstPaymentPct! / 100)) : 0;
    const balanceRemaining = hasFirstPayment ? (effectiveTotal - firstPaymentAmount) : 0;

    if (hasFirstPayment) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(bodyGreyRGB[0], bodyGreyRGB[1], bodyGreyRGB[2]);
        const paymentLabel = firstPaymentPct === 60 ? "Deposit (60%)" : \`First Payment (\${firstPaymentPct}%)\`;
        const remainingLabel = firstPaymentPct === 60 ? "Balance on Completion (40%)" : \`Remaining Balance (\${(100 - firstPaymentPct!).toFixed(0)}%)\`;
        doc.text(paymentLabel, totalsLeftX, currentY);
        doc.text(formatCurrency(firstPaymentAmount, currencySymbol), totalsRightX, currentY, { align: "right" });
        currentY += 4.5;

        doc.text(remainingLabel, totalsLeftX, currentY);
        doc.text(formatCurrency(balanceRemaining, currencySymbol), totalsRightX, currentY, { align: "right" });
        currentY += 5;
    }

    // Black TOTAL DUE / BALANCE DUE Bar with orange top border
    const barY = currentY + 1;
    doc.setFillColor(blackRGB[0], blackRGB[1], blackRGB[2]);
    doc.rect(totalsLeftX, barY, totalsWidth, 10, 'F');

    // Orange top border
    doc.setFillColor(orangeRGB[0], orangeRGB[1], orangeRGB[2]);
    doc.rect(totalsLeftX, barY, totalsWidth, 1.2, 'F');

    // Total Due / Balance Due Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    const barLabel = hasFirstPayment
        ? (firstPaymentPct === 60 ? "DEPOSIT DUE (60%)" : \`AMOUNT DUE (\${firstPaymentPct}%)\`)
        : (isBalanceInvoice ? "BALANCE DUE" : "TOTAL DUE");
    const barAmount = hasFirstPayment ? firstPaymentAmount : effectiveTotal;
    doc.text(barLabel, totalsLeftX + 4, barY + 6.5);

    doc.setFontSize(11);
    doc.text(formatCurrency(barAmount, currencySymbol), totalsRightX - 4, barY + 6.5, { align: "right" });

    currentY = barY + 14;`
    },
    {
        name: 'Only show Terms & Acceptance page for quotations, not invoices',
        search: `    // ==========================================
    // 9. PAGE 2: TERMS AND CONDITIONS & ACCEPTANCE
    // ==========================================
    doc.addPage();`,
        replace: `    // ==========================================
    // 9. PAGE 2: TERMS AND CONDITIONS & ACCEPTANCE (Quotations only)
    // ==========================================
    if (!isInvoice) {
        doc.addPage();`
    },
    {
        name: 'Close if (!isInvoice) block before Photo Appendix',
        search: `    doc.setFontSize(7);
    doc.text("Purchase order no. (if applicable): ____________________________________", col1X, p2Y);

    // ==========================================
    // 9b. APPENDIX: SITE INSPECTION PHOTOGRAPHS
    // ==========================================`,
        replace: `    doc.setFontSize(7);
    doc.text("Purchase order no. (if applicable): ____________________________________", col1X, p2Y);
    } // End if (!isInvoice) for Terms & Acceptance

    // ==========================================
    // 9b. APPENDIX: SITE INSPECTION PHOTOGRAPHS
    // ==========================================`
    },
    {
        name: 'Page footer document type label dynamic',
        search: `        // Left footer
        doc.text(\`AeroWash (Pty) Ltd  ·  Quotation \${numberLabel}\${clientRef ? '  ·  Client ref: ' + clientRef : ''}\`, 14, pageHeight - 8);`,
        replace: `        // Left footer
        const footerDocType = isInvoice ? (isVatActive ? 'Tax Invoice ' : 'Invoice ') : 'Quotation ';
        doc.text(\`AeroWash (Pty) Ltd  ·  \${footerDocType}\${numberLabel}\${clientRef ? '  ·  Client ref: ' + clientRef : ''}\`, 14, pageHeight - 8);`
    }
]);

console.log("aerowash-quote-pdf.ts patched successfully!");
