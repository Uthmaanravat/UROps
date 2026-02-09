import jsPDF from "jspdf";

export async function drawPdfHeader(doc: jsPDF, company: any, title: string, numberLabel: string) {
    // 1. Header Bar (30% Opacity of Dark Navy)
    // Dark Navy is (20, 20, 30). 30% Opacity on White = (185, 185, 188)
    doc.setFillColor(185, 185, 188);
    doc.rect(0, 0, 210, 40, 'F');

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
            doc.addImage(img, ext, 14, 5, 30, 30, undefined, 'FAST');
        } catch (err) { console.warn(err); }
    }

    // Company Name (Dark Navy for contrast on light background)
    doc.setTextColor(20, 20, 30);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    const nameX = company.logoUrl ? 50 : 14;
    doc.text(company.name, nameX, 22);

    // Document Title (Lime for branding pop, or Dark Navy if contrast is poor? Lime might be hard to read on light grey. Let's try Dark Navy for text, maybe keep Lime for Title if it stands out.)
    // Lime (163, 230, 53) on (185, 185, 188) might be low contrast. 
    // Let's stick to Dark Navy for the title but maybe larger/bolder.
    // Or actually, the user wants "opacity 30%".

    doc.setFontSize(14);
    doc.setTextColor(20, 20, 30); // Dark Navy
    doc.text(title, 196, 20, { align: 'right' });

    // Number
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(numberLabel, 196, 30, { align: 'right' });
}
