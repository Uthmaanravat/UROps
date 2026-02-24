import jsPDF from "jspdf";

export async function drawPdfHeader(doc: jsPDF, company: any, title: string, numberLabel: string) {
    // 1. Branding Bars
    // Top-most solid Navy bar (5mm)
    doc.setFillColor(20, 20, 30);
    doc.rect(0, 0, 210, 8, 'F');

    // Lime accent line (1.5mm)
    doc.setFillColor(163, 230, 53);
    doc.rect(0, 8, 210, 1.5, 'F');

    // 2. Main Header Background (Subtle Light Grey/Navy tint)
    // 15% Opacity on White = (220, 220, 225)
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 9.5, 210, 35, 'F');

    // Logo
    if (company.logoUrl) {
        try {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = company.logoUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            const ext = company.logoUrl.split('.').pop()?.toUpperCase() || 'PNG';
            doc.addImage(img, ext, 14, 15, 25, 25, undefined, 'FAST');
        } catch (err) { console.warn(err); }
    }

    // Company Name (Dark Navy)
    doc.setTextColor(20, 20, 30);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    const nameX = company.logoUrl ? 44 : 14;
    doc.text(company.name, nameX, 30);

    // Document Title (Right-aligned, Bold Navy)
    doc.setFontSize(16);
    doc.text(title, 196, 28, { align: 'right' });

    // Number (Right-aligned, Lime for pop)
    doc.setFontSize(11);
    doc.setTextColor(101, 163, 13); // A slightly darker lime for readability
    doc.setFont("helvetica", "bold");
    doc.text(numberLabel, 196, 36, { align: 'right' });

    // Reset for next drawing operations
    doc.setTextColor(20, 20, 30);
    doc.setFont("helvetica", "normal");
}
