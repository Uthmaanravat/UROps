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
    if (report.type === "ADVANCED") {
        return drawAdvancedReportPdf(doc, company, report);
    }
    
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

    // Conclusion
    if (report.conclusion) {
        if (currentY > 240) {
            doc.addPage();
            currentY = 20;
        }

        // Conclusion header
        doc.setFontSize(8);
        doc.setTextColor(163, 230, 53); // Lime
        doc.setFont("helvetica", "bold");
        doc.text("CONCLUSION", 14, currentY);
        currentY += 7;

        // Conclusion body
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "normal");
        const conclusionLines = doc.splitTextToSize(report.conclusion, 180);
        doc.text(conclusionLines, 14, currentY);
        currentY += (conclusionLines.length * 5) + 10;

        // Final divider
        doc.setDrawColor(163, 230, 53); // Lime accent
        doc.setLineWidth(1);
        doc.line(14, currentY - 5, 196, currentY - 5);
    }

    return doc;
}

export async function drawAdvancedReportPdf(doc: jsPDF, company: any, report: any) {
    // Advanced Drone Inspection Report Layout
    const metadata = report.metadata || {};
    
    // 1. Header Area
    // Top-most solid Navy bar (8mm)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 8, 'F');
    // Lime accent line (2mm)
    doc.setFillColor(163, 230, 53);
    doc.rect(0, 8, 210, 2, 'F');

    // Logo
    if (company.logoUrl) {
        try {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = company.logoUrl;
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
            const ext = company.logoUrl.split('.').pop()?.toUpperCase() || 'PNG';
            doc.addImage(img, ext, 14, 16, 25, 25, undefined, 'FAST');
        } catch (err) { console.warn(err); }
    }

    const nameX = company.logoUrl ? 44 : 14;
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(company.name, nameX, 26);
    
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    if (company.slogan || company.domain) {
        doc.text((company.slogan || company.domain).toUpperCase(), nameX, 32);
    }

    // Right side text
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("DRONE INSPECTION REPORT", 196, 22, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const rightInfoX = 140;
    doc.text("REPORT ID:", rightInfoX, 29);
    doc.text(`UR-${report.number.toString().padStart(6, '0')}`, rightInfoX + 25, 29);
    
    doc.text("DATE:", rightInfoX, 34);
    doc.text(new Date(report.date).toLocaleDateString('en-GB'), rightInfoX + 25, 34);
    
    doc.text("INSPECTED BY:", rightInfoX, 39);
    doc.text(company.name, rightInfoX + 25, 39);
    
    if (metadata.pilotName) {
        doc.text("PILOT:", rightInfoX, 44);
        doc.text(metadata.pilotName, rightInfoX + 25, 44);
    }

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 48, 196, 48);
    
    let currentY = 54;

    // 2. Property Info & Photo
    // Dark Blue Box for Property Info Title
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(14, currentY, 65, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("PROPERTY INFORMATION", 18, currentY + 5.5);
    
    // Box for property details
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY + 8, 65, 65, 2, 2, 'FD');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8);
    
    let propY = currentY + 14;
    const addPropField = (label: string, val1: string, val2?: string) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, 18, propY);
        propY += 4;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(val1 || "-", 55);
        doc.text(lines, 18, propY);
        propY += (lines.length * 4);
        if (val2) {
            doc.text(val2, 18, propY);
            propY += 4;
        }
        doc.setDrawColor(226, 232, 240);
        doc.line(18, propY + 1, 75, propY + 1);
        propY += 5;
    };
    
    addPropField("Property Address:", metadata.propertyAddress || report.site || "");
    addPropField("Property Type:", metadata.propertyType || "");
    addPropField("Client / Contact:", report.client?.name || "", report.client?.email);
    addPropField("Inspection Type:", metadata.inspectionType || "");
    addPropField("Weather Conditions:", metadata.weather || "");

    // Large property overview photo
    if (metadata.propertyImage) {
        try {
            let format = 'JPEG';
            if (metadata.propertyImage.startsWith('data:image/png')) format = 'PNG';
            doc.addImage(metadata.propertyImage, format, 84, currentY, 112, 53, undefined, 'FAST');
            
            // Subtle border around image
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(84, currentY, 112, 53, 2, 2, 'S');
        } catch (e) {
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(84, currentY, 112, 53, 2, 2, 'F');
        }
    } else {
        // Grey placeholder
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(84, currentY, 112, 53, 2, 2, 'F');
        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("PROPERTY OVERVIEW IMAGE", 140, currentY + 28, { align: 'center' });
    }

    // Icons Bar
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(84, currentY + 58, 112, 15, 2, 2, 'FD');
    
    // Columns: Date, Drone, Images, Flight Time
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    
    const iconBaseY = currentY + 63;
    
    // Col 1
    doc.setFont("helvetica", "bold");
    doc.text("INSPECTION DATE", 92, iconBaseY);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(report.date).toLocaleDateString('en-GB'), 92, iconBaseY + 5);
    
    // Col 2
    doc.setFont("helvetica", "bold");
    doc.text("DRONE USED", 120, iconBaseY);
    doc.setFont("helvetica", "normal");
    doc.text(metadata.droneUsed || "-", 120, iconBaseY + 5);
    
    // Col 3
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL IMAGES", 150, iconBaseY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text((metadata.totalImages || "-").toString(), 150, iconBaseY + 6);
    doc.setFontSize(7);
    
    // Col 4
    doc.setFont("helvetica", "bold");
    doc.text("FLIGHT TIME", 175, iconBaseY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(metadata.flightTime ? `${metadata.flightTime} min` : "-", 175, iconBaseY + 6);
    doc.setFontSize(7);

    currentY += 80;

    // 3. Executive Summary & Key Findings
    // Exec Summary Box
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(14, currentY, 93, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("EXECUTIVE SUMMARY", 18, currentY + 5.5);
    
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY + 8, 93, 35, 2, 2, 'S');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(report.description || report.conclusion || "A drone inspection was conducted to assess the condition. Several areas of concern were identified. Please refer to the findings section for detailed observations.", 85);
    doc.text(summaryLines, 18, currentY + 14);

    // Key Findings Box
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(112, currentY, 84, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("KEY FINDINGS OVERVIEW", 116, currentY + 5.5);
    
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(112, currentY + 8, 84, 35, 2, 2, 'S');
    
    const highCount = report.items.filter((i: any) => i.severity === 'HIGH').length;
    const mediumCount = report.items.filter((i: any) => i.severity === 'MEDIUM').length;
    const lowCount = report.items.filter((i: any) => i.severity === 'LOW').length;
    
    let findingY = currentY + 15;
    
    const addFindingRow = (count: number, label: string, color: number[], desc: string) => {
        doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(120, findingY, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("!", 120, findingY + 1, { align: 'center' }); // simple icon
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.text(count.toString(), 128, findingY + 1);
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text(label, 128, findingY + 4);
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(7);
        const descLines = doc.splitTextToSize(desc, 50);
        doc.text(descLines, 145, findingY);
        
        doc.setDrawColor(241, 245, 249);
        doc.line(116, findingY + 6, 192, findingY + 6);
        findingY += 10;
    };
    
    addFindingRow(highCount, "HIGH PRIORITY", [239, 68, 68], "Requires immediate attention.");
    addFindingRow(mediumCount, "MEDIUM PRIORITY", [249, 115, 22], "Should be addressed in short term.");
    addFindingRow(lowCount, "LOW PRIORITY", [59, 130, 246], "Minor issues to monitor.");

    currentY += 50;
    
    // 4. Inspection Findings
    // Title Box
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(14, currentY, 182, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("INSPECTION FINDINGS", 18, currentY + 5.5);
    
    currentY += 8;
    
    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY, 182, 6, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("ID", 16, currentY + 4);
    doc.text("LOCATION", 26, currentY + 4);
    doc.text("ISSUE", 60, currentY + 4);
    doc.text("SEVERITY", 95, currentY + 4);
    doc.text("IMAGE", 115, currentY + 4);
    doc.text("RECOMMENDATION", 155, currentY + 4);
    
    currentY += 6;
    
    // Table Rows
    doc.setFont("helvetica", "normal");
    
    for (let i = 0; i < report.items.length; i++) {
        const item = report.items[i];
        
        if (currentY > 260) {
            // Footer on current page
            addFooter(doc, company);
            doc.addPage();
            currentY = 20;
            // Redraw Header
            doc.setFillColor(241, 245, 249);
            doc.rect(14, currentY, 182, 6, 'F');
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.text("ID", 16, currentY + 4);
            doc.text("LOCATION", 26, currentY + 4);
            doc.text("ISSUE", 60, currentY + 4);
            doc.text("SEVERITY", 95, currentY + 4);
            doc.text("IMAGE", 115, currentY + 4);
            doc.text("RECOMMENDATION", 155, currentY + 4);
            currentY += 6;
            doc.setFont("helvetica", "normal");
        }
        
        const rowH = 22; // Fixed row height for image
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text((i + 1).toString(), 16, currentY + 5);
        
        doc.setFontSize(7);
        const locLines = doc.splitTextToSize(item.location || "-", 30);
        doc.text(locLines, 26, currentY + 5);
        
        doc.setFont("helvetica", "normal");
        const issueLines = doc.splitTextToSize(item.description || "-", 32);
        doc.text(issueLines, 60, currentY + 5);
        
        // Severity Badge
        const sev = item.severity || 'LOW';
        if (sev === 'HIGH') doc.setFillColor(239, 68, 68);
        else if (sev === 'MEDIUM') doc.setFillColor(249, 115, 22);
        else doc.setFillColor(59, 130, 246);
        doc.roundedRect(95, currentY + 2, 16, 4, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.text(sev, 103, currentY + 5, { align: 'center' });
        
        // Image
        if (item.imageUrl) {
            try {
                let format = 'JPEG';
                if (item.imageUrl.startsWith('data:image/png')) format = 'PNG';
                doc.addImage(item.imageUrl, format, 115, currentY + 1, 35, 18, undefined, 'FAST');
            } catch (e) {
                doc.setFillColor(226, 232, 240);
                doc.rect(115, currentY + 1, 35, 18, 'F');
            }
        } else {
            doc.setFillColor(226, 232, 240);
            doc.rect(115, currentY + 1, 35, 18, 'F');
        }
        
        // Recommendation
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        const recLines = doc.splitTextToSize(item.recommendation || "-", 38);
        doc.text(recLines, 155, currentY + 5);
        
        // Row divider
        doc.setDrawColor(226, 232, 240);
        doc.line(14, currentY + rowH, 196, currentY + rowH);
        
        currentY += rowH;
    }
    
    // Note
    currentY += 5;
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text("Note: This report is based on visual data captured and does not replace a physical inspection.", 14, currentY);

    // Footer on last page
    addFooter(doc, company);

    return doc;
}

function addFooter(doc: jsPDF, company: any) {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 285, 210, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    
    let fx = 14;
    if (company.phone) {
        doc.text(company.phone, fx, 292);
        fx += 40;
    }
    if (company.email) {
        doc.text(company.email, fx, 292);
        fx += 60;
    }
    if (company.domain) {
        doc.text(company.domain, fx, 292);
    }
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(company.name.toUpperCase(), 196, 290, { align: 'right' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text("Professional Inspection Services", 196, 294, { align: 'right' });
}
