import jsPDF from "jspdf";

export async function drawPdfHeader(doc: jsPDF, company: any, title: string, numberLabel: string, badge?: string) {
    // 1. Branding Bars
    // Top-most solid Navy bar (8mm)
    doc.setFillColor(15, 23, 42); // slate-900 (#0F172A)
    doc.rect(0, 0, 210, 8, 'F');

    // Lime accent line (2mm)
    doc.setFillColor(163, 230, 53); // lime-400 (#A3E635)
    doc.rect(0, 8, 210, 2, 'F');

    // Logo & Company Name (Left)
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
            doc.addImage(img, ext, 14, 16, 25, 25, undefined, 'FAST');
        } catch (err) { console.warn(err); }
    } else {
        // Fallback logo box
        doc.setFillColor(163, 230, 53);
        doc.roundedRect(14, 16, 20, 20, 3, 3, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("LR", 24, 29, { align: 'center' });
    }

    const nameX = company.logoUrl ? 44 : 38;
    
    doc.setTextColor(30, 41, 59); // slate-800 (#1E293B)
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(company.name, nameX, 26);
    
    // Company Contact details below name
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let contactInfo = [];
    if (company.phone) contactInfo.push(company.phone);
    if (company.email) contactInfo.push(company.email);
    doc.text(contactInfo.join("  •  "), nameX, 32);

    // Document Title, Number & Badge (Right)
    if (badge) {
        doc.setFontSize(8);
        doc.setTextColor(6, 182, 212); // cyan-500
        doc.setFont("helvetica", "bold");
        doc.text(badge.toUpperCase(), 196, 20, { align: 'right' });
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), 196, 28, { align: 'right' });

    if (numberLabel) {
        doc.setFontSize(12);
        doc.setTextColor(163, 230, 53); // Lime 
        doc.setFont("helvetica", "bold");
        doc.text(`# ${numberLabel}`, 196, 34, { align: 'right' });
    }

    // Divider Line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 42, 196, 42);

    // Reset styles
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    
    return 48; // Return next Y position
}
