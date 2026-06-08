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

// Helper: collect all images for an item (supports both imageUrl and imageUrls)
function getItemImages(item: any): string[] {
    if (item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0) {
        return item.imageUrls;
    }
    if (item.imageUrl) {
        return [item.imageUrl];
    }
    return [];
}

// Helper: detect image format from base64 data URL
function getImageFormat(dataUrl: string): string {
    if (dataUrl.startsWith('data:image/png')) return 'PNG';
    return 'JPEG';
}

export async function drawReportPdf(doc: jsPDF, company: any, report: any) {
    if (report.type === "ADVANCED" || report.type === "CONSTRUCTION") {
        return drawAdvancedReportPdf(doc, company, report);
    }
    
    let currentY = await drawPdfHeader(doc, company, 'REPORT', `REP-${report.number.toString().padStart(3, '0')}`);

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

    // Items (Description + Images)
    for (const item of report.items) {
        // Check for page break
        if (currentY > 240) {
            doc.addPage();
            currentY = 20;
        }

        // Title
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        if (item.title) {
            doc.text(item.title.toUpperCase(), 14, currentY);
            currentY += 6;
        }

        // Description
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const itemDescLines = doc.splitTextToSize(item.description, 180);
        doc.text(itemDescLines, 14, currentY);
        currentY += (itemDescLines.length * 5) + 5;

        // Images - support multiple
        const images = getItemImages(item);
        if (images.length > 0) {
            if (images.length === 1) {
                // Single image - render large
                try {
                    const format = getImageFormat(images[0]);
                    const imgWidth = 140;
                    const imgHeight = 95;
                    if (currentY + imgHeight > 270) {
                        doc.addPage();
                        currentY = 20;
                    }
                    doc.addImage(images[0], format, 14, currentY, imgWidth, imgHeight, undefined, 'FAST');
                    currentY += imgHeight + 10;
                } catch (err) {
                    console.warn("Failed to add image to PDF", err);
                    currentY += 5;
                }
            } else {
                // Multiple images - 2 column grid
                for (let imgIdx = 0; imgIdx < images.length; imgIdx += 2) {
                    const imgWidth = 88;
                    const imgHeight = 62;
                    if (currentY + imgHeight > 270) {
                        doc.addPage();
                        currentY = 20;
                    }
                    // Left image
                    try {
                        const format = getImageFormat(images[imgIdx]);
                        doc.addImage(images[imgIdx], format, 14, currentY, imgWidth, imgHeight, undefined, 'FAST');
                    } catch (err) { console.warn("Failed to add image", err); }
                    // Right image (if exists)
                    if (imgIdx + 1 < images.length) {
                        try {
                            const format = getImageFormat(images[imgIdx + 1]);
                            doc.addImage(images[imgIdx + 1], format, 106, currentY, imgWidth, imgHeight, undefined, 'FAST');
                        } catch (err) { console.warn("Failed to add image", err); }
                    }
                    currentY += imgHeight + 8;
                }
            }
        } else {
            currentY += 5;
        }

        // Divider between items
        doc.setDrawColor(241, 245, 249);
        doc.line(14, currentY - 3, 196, currentY - 3);
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
    const metadata = report.metadata || {};
    const fs = metadata.fieldSettings || {};
    
    // 1. Header Area
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 8, 'F');
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
    if (company.slogan) {
        doc.text(company.slogan.toUpperCase(), nameX, 32);
    }

    // Right side - just "REPORT"
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPORT", 196, 22, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const rightInfoX = 140;
    doc.text("REPORT ID:", rightInfoX, 29);
    doc.text(`UR-${report.number.toString().padStart(6, '0')}`, rightInfoX + 32, 29);
    
    doc.text("DATE:", rightInfoX, 34);
    doc.text(new Date(report.date).toLocaleDateString('en-GB'), rightInfoX + 32, 34);
    
    doc.text("PREPARED BY:", rightInfoX, 39);
    doc.text(company.name, rightInfoX + 32, 39);
    
    const showPilotName = fs.showPilotName !== false;
    const showInspectorName = fs.showInspectorName !== false;
    const pilotNameLabel = fs.pilotNameLabel || "Pilot Name";
    const inspectorNameLabel = fs.inspectorNameLabel || "Inspector Name";

    if (showPilotName && metadata.pilotName && report.type === "ADVANCED") {
        doc.text(`${pilotNameLabel.toUpperCase()}:`, rightInfoX, 44);
        doc.text(metadata.pilotName, rightInfoX + 32, 44);
    } else if (showInspectorName && metadata.inspectorName && report.type === "CONSTRUCTION") {
        doc.text(`${inspectorNameLabel.toUpperCase()}:`, rightInfoX, 44);
        doc.text(metadata.inspectorName, rightInfoX + 32, 44);
    }

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 48, 196, 48);
    
    let currentY = 54;

    // Property/Site Info Fields
    const showPropertyAddress = fs.showPropertyAddress !== false;
    const showPropertyType = fs.showPropertyType !== false;
    const showInspectionType = fs.showInspectionType !== false;
    const showWeather = fs.showWeather !== false;
    const showProjectPhase = fs.showProjectPhase !== false;

    const propertyAddressLabel = fs.propertyAddressLabel || "Property Address";
    const propertyTypeLabel = fs.propertyTypeLabel || "Property Type";
    const inspectionTypeLabel = fs.inspectionTypeLabel || "Report Type";
    const weatherLabel = fs.weatherLabel || "Weather Conditions";
    const projectPhaseLabel = fs.projectPhaseLabel || "Project Phase";

    const propFields: { label: string; val1: string; val2?: string }[] = [];
    if (showPropertyAddress && (metadata.propertyAddress || report.site)) {
        propFields.push({ label: `${propertyAddressLabel}:`, val1: metadata.propertyAddress || report.site || "" });
    }
    if (showPropertyType && metadata.propertyType) {
        propFields.push({ label: `${propertyTypeLabel}:`, val1: metadata.propertyType });
    }
    // Always include Client / Contact
    propFields.push({ label: "Client / Contact:", val1: report.client?.name || "", val2: report.client?.email });
    
    if (report.type === "CONSTRUCTION") {
        if (showProjectPhase && metadata.projectPhase) {
            propFields.push({ label: `${projectPhaseLabel}:`, val1: metadata.projectPhase });
        }
    } else {
        if (showInspectionType && metadata.inspectionType) {
            propFields.push({ label: `${inspectionTypeLabel}:`, val1: metadata.inspectionType });
        }
    }
    if (showWeather && metadata.weather) {
        propFields.push({ label: `${weatherLabel}:`, val1: metadata.weather });
    }

    if (metadata.customFields && Array.isArray(metadata.customFields)) {
        metadata.customFields.forEach((cf: any) => {
            if (cf.key && cf.value) propFields.push({ label: cf.key + ":", val1: cf.value });
        });
    }

    const calculatedPropBoxHeight = Math.max(95, 10 + (propFields.length * 9));

    // Dark Blue Box for Info Title
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(14, currentY, 58, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("REPORT INFORMATION", 18, currentY + 5.5);
    
    // Box for property details
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY + 8, 58, calculatedPropBoxHeight, 2, 2, 'FD');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8);
    
    let propY = currentY + 14;
    const addPropField = (label: string, val1: string, val2?: string) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, 18, propY);
        propY += 4;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(val1 || "-", 50);
        doc.text(lines, 18, propY);
        propY += (lines.length * 4);
        if (val2) {
            doc.text(val2, 18, propY);
            propY += 4;
        }
        doc.setDrawColor(226, 232, 240);
        doc.line(18, propY + 1, 68, propY + 1);
        propY += 5;
    };

    propFields.forEach(f => addPropField(f.label, f.val1, f.val2));

    // Large property overview photo - BIGGER: 95mm height, 120mm width
    const overviewImgH = 95;
    const overviewImgW = 120;
    if (metadata.propertyImage) {
        try {
            let format = 'JPEG';
            if (metadata.propertyImage.startsWith('data:image/png')) format = 'PNG';
            doc.addImage(metadata.propertyImage, format, 76, currentY, overviewImgW, overviewImgH, undefined, 'FAST');
            
            // Subtle border around image
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(76, currentY, overviewImgW, overviewImgH, 2, 2, 'S');
        } catch (e) {
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(76, currentY, overviewImgW, overviewImgH, 2, 2, 'F');
        }
    } else {
        // Grey placeholder
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(76, currentY, overviewImgW, overviewImgH, 2, 2, 'F');
        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("OVERVIEW IMAGE", 136, currentY + overviewImgH / 2, { align: 'center' });
    }

    // Icons Bar - positioned below overview image (120mm width, matching overview image)
    const iconsBarY = currentY + overviewImgH + 5;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(76, iconsBarY, 120, 15, 2, 2, 'FD');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    
    const iconBaseY = iconsBarY + 5;
    
    // Col 1 (Centered at X = 91)
    doc.setFont("helvetica", "bold");
    doc.text("REPORT DATE", 91, iconBaseY, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text(new Date(report.date).toLocaleDateString('en-GB'), 91, iconBaseY + 5, { align: 'center' });
    
    // Col 2 (Centered at X = 121)
    doc.setFont("helvetica", "bold");
    const col2Label = report.type === "CONSTRUCTION" 
        ? (fs.inspectorNameLabel || "INSPECTOR") 
        : (fs.equipmentUsedLabel || "EQUIPMENT USED");
    doc.text(col2Label.toUpperCase(), 121, iconBaseY, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text((report.type === "CONSTRUCTION" ? metadata.inspectorName : metadata.equipmentUsed) || "-", 121, iconBaseY + 5, { align: 'center' });
    
    // Col 3 (Centered at X = 151)
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL IMAGES", 151, iconBaseY, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const imgCount = report.items.filter((i:any) => i.imageUrl).length || metadata.totalImages || 0;
    doc.text(imgCount.toString(), 151, iconBaseY + 6, { align: 'center' });
    doc.setFontSize(7);
    
    // Col 4 (Centered at X = 181)
    doc.setFont("helvetica", "bold");
    const col4Label = report.type === "CONSTRUCTION" 
        ? (fs.projectPhaseLabel || "PHASE") 
        : (fs.flightTimeLabel || "FLIGHT TIME");
    doc.text(col4Label.toUpperCase(), 181, iconBaseY, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    if (report.type === "CONSTRUCTION") {
        doc.text(metadata.projectPhase || "-", 181, iconBaseY + 6, { align: 'center' });
    } else {
        doc.text(metadata.flightTime ? `${metadata.flightTime} min` : "-", 181, iconBaseY + 6, { align: 'center' });
    }
    doc.setFontSize(7);

    currentY = Math.max(iconsBarY + 22, currentY + calculatedPropBoxHeight + 15);

    // 3. Executive Summary & Key Findings - RESPECT VISIBILITY TOGGLES
    const showExecSummary = fs.showExecutiveSummary !== false;
    const showKeyFindings = fs.showKeyFindings !== false;

    if (showExecSummary || showKeyFindings) {
        if (showExecSummary && showKeyFindings) {
            // Both shown: side by side
            // Executive Summary Box
            doc.setFillColor(15, 23, 42);
            doc.roundedRect(14, currentY, 93, 8, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("EXECUTIVE SUMMARY", 18, currentY + 5.5);
            
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(14, currentY + 8, 93, 45, 2, 2, 'S');
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            const summaryLines = doc.splitTextToSize(report.description || report.conclusion || "An inspection was conducted to assess the condition. Several areas of concern were identified. Please refer to the findings section for detailed observations.", 85);
            doc.text(summaryLines, 18, currentY + 14);

            // Key Findings Box
            doc.setFillColor(15, 23, 42);
            doc.roundedRect(112, currentY, 84, 8, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("KEY FINDINGS OVERVIEW", 116, currentY + 5.5);
            
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(112, currentY + 8, 84, 45, 2, 2, 'S');
            
            drawKeyFindingsCounts(doc, report, currentY + 15, 120);

            currentY += 60;

        } else if (showExecSummary) {
            // Only executive summary - full width
            doc.setFillColor(15, 23, 42);
            doc.roundedRect(14, currentY, 182, 8, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("EXECUTIVE SUMMARY", 18, currentY + 5.5);
            
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(14, currentY + 8, 182, 45, 2, 2, 'S');
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            const summaryLines = doc.splitTextToSize(report.description || report.conclusion || "An inspection was conducted to assess the condition. Several areas of concern were identified. Please refer to the findings section for detailed observations.", 174);
            doc.text(summaryLines, 18, currentY + 14);

            currentY += 60;

        } else if (showKeyFindings) {
            // Only key findings - full width
            doc.setFillColor(15, 23, 42);
            doc.roundedRect(14, currentY, 182, 8, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("KEY FINDINGS OVERVIEW", 18, currentY + 5.5);
            
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(14, currentY + 8, 182, 45, 2, 2, 'S');
            
            drawKeyFindingsCounts(doc, report, currentY + 15, 22);

            currentY += 60;
        }
    }
    
    // 4. Findings - CARD BASED LAYOUT (replaces old table)
    if (report.items && report.items.length > 0) {
        let findingsHeaderPrinted = false;

        const showLocation = fs.showLocation !== false;
        const showSeverity = fs.showSeverity !== false;
        const showRecommendation = fs.showRecommendation !== false;
        const locationLabel = (fs.locationLabel || "Location").toUpperCase();
        const severityLabel = (fs.severityLabel || "Severity").toUpperCase();
        const recommendationLabel = (fs.recommendationLabel || "Recommendation").toUpperCase();
        
        for (let i = 0; i < report.items.length; i++) {
            const item = report.items[i];
            const images = getItemImages(item);
            
            // Estimate card height to decide if we need a page break
            const descLines = doc.splitTextToSize(item.description || "-", 170);
            const descHeight = descLines.length * 4;
            const hasImages = images.length > 0;
            const imageRowsNeeded = hasImages ? Math.ceil(images.length / 2) : 0;
            const imageHeight = images.length === 1 ? 100 : (imageRowsNeeded * 68);
            const recLines = (showRecommendation && item.recommendation) ? doc.splitTextToSize(item.recommendation, 170) : [];
            const recHeight = recLines.length > 0 ? (recLines.length * 4) + 14 : 0;
            const estimatedCardHeight = 20 + descHeight + (hasImages ? imageHeight + 8 : 0) + recHeight + 10;
            
            // Check page break before card (include header height if not printed yet)
            const headerHeight = !findingsHeaderPrinted ? 14 : 0;
            if (currentY + Math.min(estimatedCardHeight, 60) + headerHeight > 265) {
                addFooter(doc, company, metadata);
                doc.addPage();
                currentY = 20;
            }

            // Print findings header if not yet printed
            if (!findingsHeaderPrinted) {
                doc.setFillColor(15, 23, 42);
                doc.roundedRect(14, currentY, 182, 8, 2, 2, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.text("FINDINGS", 18, currentY + 5.5);
                
                currentY += 14;
                findingsHeaderPrinted = true;
            }

        // --- Card Header: Number + Title + Location + Severity ---
        // Card background - light grey rounded rect
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        const cardHeaderH = 12;
        doc.roundedRect(14, currentY, 182, cardHeaderH, 2, 2, 'FD');

        // Draw a thick severity color indicator bar on the left edge of the card header
        const sev = item.severity || 'LOW';
        if (sev === 'HIGH') doc.setFillColor(239, 68, 68);
        else if (sev === 'MEDIUM') doc.setFillColor(249, 115, 22);
        else doc.setFillColor(59, 130, 246);
        // Cover only the left-most 4mm of the rounded rect
        doc.roundedRect(14, currentY, 4, cardHeaderH, 2, 2, 'F');
        // Straighten the right edge of this 4mm bar
        doc.rect(16, currentY, 2, cardHeaderH, 'F');

        // Finding number badge
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(16, currentY + 2, 12, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text((i + 1).toString(), 22, currentY + 7.5, { align: 'center' });

        // Title
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const titleText = item.title ? item.title.toUpperCase() : `FINDING ${i + 1}`;
        doc.text(titleText, 32, currentY + 7.5);

        // Location (right of title)
        let metaX = 32;
        const titleWidth = doc.getTextWidth(titleText);
        metaX += titleWidth + 8;

        if (showLocation && item.location) {
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.setFont("helvetica", "normal");
            doc.text(`${locationLabel}: ${item.location}`, metaX, currentY + 7.5);
        }

        // Severity badge (far right)
        if (showSeverity) {
            const sev = item.severity || 'LOW';
            if (sev === 'HIGH') doc.setFillColor(239, 68, 68);
            else if (sev === 'MEDIUM') doc.setFillColor(249, 115, 22);
            else doc.setFillColor(59, 130, 246);
            doc.roundedRect(170, currentY + 3, 22, 6, 1.5, 1.5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6);
            doc.setFont("helvetica", "bold");
            doc.text(sev, 181, currentY + 7, { align: 'center' });
        }

        currentY += cardHeaderH + 4;

        // --- Description ---
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const descWrapped = doc.splitTextToSize(item.description || "-", 170);
        
        // Check if description needs a page break
        const descRenderHeight = descWrapped.length * 4;
        if (currentY + descRenderHeight > 270) {
            addFooter(doc, company, metadata);
            doc.addPage();
            currentY = 20;
        }
        doc.text(descWrapped, 18, currentY);
        currentY += descRenderHeight + 6;

        // --- Images - LARGE --- (matches size of cover image: 120x80, centered)
        if (images.length === 1) {
            // Single image: render large
            const singleImgW = 120;
            const singleImgH = 80;
            if (currentY + singleImgH > 270) {
                addFooter(doc, company, metadata);
                doc.addPage();
                currentY = 20;
            }
            try {
                const format = getImageFormat(images[0]);
                doc.addImage(images[0], format, 45, currentY, singleImgW, singleImgH, undefined, 'FAST');
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(45, currentY, singleImgW, singleImgH, 2, 2, 'S');
            } catch (err) {
                doc.setFillColor(226, 232, 240);
                doc.roundedRect(45, currentY, singleImgW, singleImgH, 2, 2, 'F');
            }
            currentY += singleImgH + 6;
        } else if (images.length > 1) {
            // Multiple images: 2-column grid, each ~85x60mm
            for (let imgIdx = 0; imgIdx < images.length; imgIdx += 2) {
                const gridImgW = 85;
                const gridImgH = 60;
                if (currentY + gridImgH > 270) {
                    addFooter(doc, company, metadata);
                    doc.addPage();
                    currentY = 20;
                }
                // Left image
                try {
                    const format = getImageFormat(images[imgIdx]);
                    doc.addImage(images[imgIdx], format, 14, currentY, gridImgW, gridImgH, undefined, 'FAST');
                    doc.setDrawColor(226, 232, 240);
                    doc.roundedRect(14, currentY, gridImgW, gridImgH, 2, 2, 'S');
                } catch (err) {
                    doc.setFillColor(226, 232, 240);
                    doc.roundedRect(14, currentY, gridImgW, gridImgH, 2, 2, 'F');
                }
                // Right image
                if (imgIdx + 1 < images.length) {
                    try {
                        const format = getImageFormat(images[imgIdx + 1]);
                        doc.addImage(images[imgIdx + 1], format, 106, currentY, gridImgW, gridImgH, undefined, 'FAST');
                        doc.setDrawColor(226, 232, 240);
                        doc.roundedRect(106, currentY, gridImgW, gridImgH, 2, 2, 'S');
                    } catch (err) {
                        doc.setFillColor(226, 232, 240);
                        doc.roundedRect(106, currentY, gridImgW, gridImgH, 2, 2, 'F');
                    }
                }
                currentY += gridImgH + 6;
            }
        }

        // --- Recommendation box ---
        if (showRecommendation && item.recommendation) {
            const recWrapped = doc.splitTextToSize(item.recommendation, 170);
            const recBlockH = (recWrapped.length * 4) + 12;
            if (currentY + recBlockH > 270) {
                addFooter(doc, company, metadata);
                doc.addPage();
                currentY = 20;
            }
            // Recommendation box with lime accent
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(163, 230, 53);
            doc.setLineWidth(0.5);
            doc.roundedRect(14, currentY, 182, recBlockH, 2, 2, 'FD');
            
            doc.setTextColor(163, 230, 53);
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.text(recommendationLabel, 18, currentY + 5);
            
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(recWrapped, 18, currentY + 10);
            
            currentY += recBlockH + 4;
            doc.setLineWidth(0.2); // reset
        }

        // Card bottom divider
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(14, currentY, 196, currentY);
        currentY += 8;
        doc.setLineWidth(0.2);
    }
    }


    // Sign-off section
    const signOffHeight = 30;
    if (currentY + signOffHeight + 10 > 280) {
        addFooter(doc, company, metadata);
        doc.addPage();
        currentY = 20;
    }
    
    // Draw sign-off lines
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.5);
    
    // Inspector Line (Left side)
    doc.line(14, currentY + 15, 84, currentY + 15);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFont("helvetica", "bold");
    doc.text("PREPARED / INSPECTED BY", 14, currentY + 19);
    doc.setFont("helvetica", "normal");
    doc.text(metadata.inspectorName || company.name, 14, currentY + 23);
    
    // Client Line (Right side)
    doc.line(126, currentY + 15, 196, currentY + 15);
    doc.setFont("helvetica", "bold");
    doc.text("CLIENT ACCEPTANCE / SIGN-OFF", 126, currentY + 19);
    doc.setFont("helvetica", "normal");
    doc.text(report.client?.name || "Client Representative", 126, currentY + 23);
    
    currentY += signOffHeight + 5;

    // Note
    if (currentY + 10 > 280) {
        addFooter(doc, company, metadata);
        doc.addPage();
        currentY = 20;
    }
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text("Note: This report is based on visual data captured and does not replace a physical inspection.", 14, currentY);

    // Footer on last page
    addFooter(doc, company, metadata);

    // Add page numbers to all footers at the end
    const totalPages = doc.internal.pages.length - 1;
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        doc.setPage(pageNum);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255); // White text on navy footer
        doc.text(`PAGE ${pageNum} OF ${totalPages}`, 105, 292, { align: 'center' });
    }

    return doc;
}

// Helper to draw the key findings severity counts
function drawKeyFindingsCounts(doc: jsPDF, report: any, startY: number, startX: number) {
    const highCount = report.items.filter((i: any) => i.severity === 'HIGH').length;
    const mediumCount = report.items.filter((i: any) => i.severity === 'MEDIUM').length;
    const lowCount = report.items.filter((i: any) => i.severity === 'LOW').length;
    
    let findingY = startY;
    
    const addFindingRow = (count: number, label: string, color: number[], desc: string) => {
        doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(startX, findingY, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("!", startX, findingY + 1, { align: 'center' });
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.text(count.toString(), startX + 8, findingY + 1);
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
        doc.text(label, startX + 8, findingY + 4);
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(7);
        const descLines = doc.splitTextToSize(desc, 50);
        doc.text(descLines, startX + 25, findingY);
        
        doc.setDrawColor(241, 245, 249);
        doc.line(startX - 4, findingY + 6, startX + 72, findingY + 6);
        findingY += 10;
    };
    
    addFindingRow(highCount, "HIGH PRIORITY", [239, 68, 68], "Requires immediate attention.");
    addFindingRow(mediumCount, "MEDIUM PRIORITY", [249, 115, 22], "Should be addressed in short term.");
    addFindingRow(lowCount, "LOW PRIORITY", [59, 130, 246], "Minor issues to monitor.");
}

function addFooter(doc: jsPDF, company: any, metadata?: any) {
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
    
    if (metadata?.showFooterText !== false) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(148, 163, 184);
        doc.text("Professional Inspection Services", 196, 294, { align: 'right' });
    }
}
