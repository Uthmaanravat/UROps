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
    let contactY = 31.5;
    if (company.phone) {
        doc.text(company.phone, nameX, contactY);
        contactY += 4.5;
    }
    if (company.email) {
        doc.text(company.email, nameX, contactY);
    }

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

export async function drawReportPdf(doc: jsPDF, company: any, report: any) {
    let currentY = await drawPdfHeader(doc, company, 'SITE / PROGRESS REPORT', `REP-${report.number.toString().padStart(3, '0')}`);

    // Report Info Header
    doc.setFontSize(8);
    doc.setTextColor(163, 230, 53); // Lime 
    doc.setFont("helvetica", "bold");
    doc.text("REPORT DETAILS", 14, currentY + 5);

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Title: ${report.title.toUpperCase()}`, 14, currentY + 12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${new Date(report.date).toLocaleDateString('en-GB')}`, 14, currentY + 17);

    if (report.client || report.project) {
        let clientY = currentY + 12;
        doc.setFontSize(8);
        doc.setTextColor(163, 230, 53); // Lime 
        doc.setFont("helvetica", "bold");
        doc.text("PROJECT / CLIENT", 105, currentY + 5);

        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        if (report.project) {
            doc.text(`Project: ${report.project.name}`, 105, clientY);
            clientY += 5;
        }
        if (report.client) {
            doc.text(`Client: ${report.client.name}`, 105, clientY);
        }
    }

    currentY += 30;

    // Report Description if exists
    if (report.description) {
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        const descLines = doc.splitTextToSize(report.description, 180);
        doc.text(descLines, 14, currentY);
        currentY += (descLines.length * 5) + 10;
    }

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.line(14, currentY - 5, 196, currentY - 5);

    // Items (Description + Image)
    for (const item of report.items) {
        // Check for page break (Simplified check: if currentY > 240, add new page)
        if (currentY > 240) {
            doc.addPage();
            currentY = 20; // Start at top of new page
        }

        // Description
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        if (item.title) {
            doc.text(item.title.toUpperCase(), 14, currentY);
            currentY += 6;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const itemDescLines = doc.splitTextToSize(item.description, 180);
        doc.text(itemDescLines, 14, currentY);
        currentY += (itemDescLines.length * 5) + 5;

        // Image
        if (item.imageUrl) {
            try {
                // Determine image format
                let format = 'JPEG';
                if (item.imageUrl.startsWith('data:image/png')) format = 'PNG';
                
                // Add image (using width of 120mm as standard)
                // We'd ideally want to calculate the image aspect ratio, 
                // but jspdf-autotable or complex image handling might be better.
                // For now, fixed width and estimated height check.
                const imgWidth = 120;
                const imgHeight = 80; // Rough estimate or we can use 0 for auto-scale if we had the natural size

                // Check for page break before image
                if (currentY + imgHeight > 270) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.addImage(item.imageUrl, format, 14, currentY, imgWidth, imgHeight, undefined, 'FAST');
                currentY += imgHeight + 15;
            } catch (err) {
                console.warn("Failed to add image to PDF", err);
                currentY += 5;
            }
        } else {
            currentY += 5;
        }

        // Divider between items
        doc.setDrawColor(241, 245, 249);
        doc.line(14, currentY - 5, 196, currentY - 5);
        currentY += 5;
    }

    return doc;
}
