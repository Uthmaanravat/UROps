const fs = require('fs');

let code = fs.readFileSync('src/components/invoices/AeroWashQuoteBuilder.tsx', 'utf8');

// 1. Update SiteProvisionsState interface
if (!code.includes('customProvisions?: Record<number, number>;')) {
    code = code.replace(
        'hasExtendedTravel: boolean;\n    extendedTravelPrice: number;',
        'hasExtendedTravel: boolean;\n    extendedTravelPrice: number;\n    customProvisions?: Record<number, number>;'
    );
}

// 2. Update recalculateQuote block
const startIdx = code.indexOf('// Item 1: Glazing\n            const rawGlazing = effectiveArea * bandRate;');
const endIdx = code.indexOf('// Subtotal before programme discounts\n        let rawSubtotal = clientItems.reduce');

if (startIdx !== -1 && endIdx !== -1) {
    const newCalcBlock = `// Catalogue item lookups & rates
            const cat1 = getItem(1);
            const cat2 = getItem(2);
            const cat1Meta = (cat1?.metadata as any) || {};
            const cat1Rates = cat1Meta?.rates || {};
            const effectiveBandRate = Number(cat1Rates[elev.band]) || bandRate;

            // Item 1: Glazing
            const rawGlazing = effectiveArea * effectiveBandRate;
            const glazingAmount = roundToNearest50(rawGlazing);

            // Item 2: Full Facade (+15% provisional uplift, removed if mostly-glass)
            const facadeUplift = elev.isMostlyGlassTower ? 0 : 0.15;
            const rawFacade = glazingAmount * (1 + facadeUplift);
            const fullFacadeAmount = roundToNearest50(rawFacade);

            let elevCleaningAmount = 0;

            const name1 = cat1?.name ? (cat1.name.includes('[Elevation]') ? cat1.name.replace('[Elevation]', elev.name) : \`\${cat1.name} – \${elev.name}\`) : \`Exterior Glazing Maintenance Clean – \${elev.name}\`;
            const desc1 = cat1?.clientDescription || AEROWASH_CATALOGUE_ITEMS[0].clientDescription;

            const name2 = cat2?.name ? (cat2.name.includes('[Elevation]') ? cat2.name.replace('[Elevation]', elev.name) : \`\${cat2.name} – \${elev.name}\`) : \`Full Facade Maintenance Clean – \${elev.name}\`;
            const desc2 = cat2?.clientDescription || AEROWASH_CATALOGUE_ITEMS[1].clientDescription;

            if (elev.selectedCleaning === 'GLAZING') {
                elevCleaningAmount = glazingAmount;
                clientItems.push({
                    name: name1,
                    description: desc1,
                    area: elev.name,
                    amount: glazingAmount,
                    internalMetadata: {
                        itemNumber: 1,
                        width: elev.width,
                        height: elev.height,
                        effectiveArea,
                        band: elev.band,
                        bandRate: effectiveBandRate,
                        condition: elev.condition
                    }
                });
            } else if (elev.selectedCleaning === 'FULL_FACADE') {
                elevCleaningAmount = fullFacadeAmount;
                clientItems.push({
                    name: name2,
                    description: desc2,
                    area: elev.name,
                    amount: fullFacadeAmount,
                    isProvisional: !elev.isMostlyGlassTower,
                    internalMetadata: {
                        itemNumber: 2,
                        width: elev.width,
                        height: elev.height,
                        effectiveArea,
                        band: elev.band,
                        bandRate: effectiveBandRate,
                        isMostlyGlassTower: elev.isMostlyGlassTower,
                        uplift: facadeUplift,
                        condition: elev.condition
                    }
                });
            } else if (elev.selectedCleaning === 'BOTH_ALTERNATIVES') {
                elevCleaningAmount = fullFacadeAmount; // base calculations on full facade
                clientItems.push({
                    name: \`Option A: \${name1}\`,
                    description: desc1,
                    area: elev.name,
                    amount: glazingAmount,
                    isAlternative: true,
                    internalMetadata: { itemNumber: 1, width: elev.width, height: elev.height, band: elev.band, bandRate: effectiveBandRate }
                });
                clientItems.push({
                    name: \`Option B: \${name2}\`,
                    description: desc2,
                    area: elev.name,
                    amount: fullFacadeAmount,
                    isProvisional: !elev.isMostlyGlassTower,
                    isAlternative: true,
                    internalMetadata: { itemNumber: 2, width: elev.width, height: elev.height, band: elev.band, bandRate: effectiveBandRate, isMostlyGlassTower: elev.isMostlyGlassTower }
                });
            }

            cleaningLinesTotal += elevCleaningAmount;

            // Item 3: Balcony & Detail Areas
            if (elev.hasBalconies && isItemActive(3)) {
                const cat3 = getItem(3);
                const balconyPct = (elev.balconyPercent || 12) / 100;
                const rawBalcony = (effectiveArea * effectiveBandRate) * balconyPct;
                const balconyAmount = roundToNearest50(rawBalcony);
                cleaningLinesTotal += balconyAmount;
                const name3 = cat3?.name ? (cat3.name.includes('[Elevation]') ? cat3.name.replace('[Elevation]', elev.name) : \`\${cat3.name} – \${elev.name}\`) : \`Balcony & Detail Areas – \${elev.name}\`;
                clientItems.push({
                    name: name3,
                    description: cat3?.clientDescription || AEROWASH_CATALOGUE_ITEMS[2].clientDescription,
                    area: elev.name,
                    amount: balconyAmount,
                    internalMetadata: { itemNumber: 3, percentage: elev.balconyPercent, effectiveArea, bandRate: effectiveBandRate }
                });
            }

            // Item 4: Stain & Growth Pre-Treatment
            if (elev.hasPreTreatment && isItemActive(4)) {
                if (!siteVisitDone) {
                    errors.push(\`\${elev.name}: Stain & Growth Pre-Treatment requires "Site visit done" before quote can be sent.\`);
                }
                const cat4 = getItem(4);
                const preTreatPct = (elev.preTreatmentPercent || 25) / 100;
                const rawPreTreat = elevCleaningAmount * preTreatPct;
                const preTreatAmount = roundToNearest50(rawPreTreat);
                cleaningLinesTotal += preTreatAmount;
                const name4 = cat4?.name ? (cat4.name.includes('[Elevation]') ? cat4.name.replace('[Elevation]', elev.name) : \`\${cat4.name} – \${elev.name}\`) : \`Stain & Growth Pre-Treatment – \${elev.name}\`;
                clientItems.push({
                    name: name4,
                    description: cat4?.clientDescription || AEROWASH_CATALOGUE_ITEMS[3].clientDescription,
                    area: elev.name,
                    amount: preTreatAmount,
                    isProvisional: true,
                    internalMetadata: { itemNumber: 4, percentage: elev.preTreatmentPercent, baseAmount: elevCleaningAmount }
                });
            }

            // Item 9: Pre-Coating Facade Wash
            if (elev.hasPreCoatingWash && isItemActive(9)) {
                if (!contractorSpecReceived) {
                    errors.push(\`\${elev.name}: Pre-Coating Facade Wash requires "Contractor specification received" tick before sending.\`);
                }
                const cat9 = getItem(9);
                const preCoatingAmount = fullFacadeAmount;
                cleaningLinesTotal += preCoatingAmount;
                const name9 = cat9?.name ? (cat9.name.includes('[Elevation]') ? cat9.name.replace('[Elevation]', elev.name) : \`\${cat9.name} – \${elev.name}\`) : \`Pre-Coating Facade Wash – \${elev.name}\`;
                clientItems.push({
                    name: name9,
                    description: cat9?.clientDescription || AEROWASH_CATALOGUE_ITEMS[8].clientDescription,
                    area: elev.name,
                    amount: preCoatingAmount,
                    internalMetadata: { itemNumber: 9, effectiveArea, fullFacadeAmount }
                });
            }

            // Item 16: Extended Soiling Provision
            if (elev.hasExtendedSoiling && isItemActive(16)) {
                if (elev.hasPreTreatment && !elev.allowSoilingOverride) {
                    warnings.push(\`\${elev.name}: Extended Soiling Provision used with Stain & Growth Pre-Treatment on same elevation (possible double charge). Allow override to proceed.\`);
                }
                if (elev.extendedSoilingPrice <= 0) {
                    errors.push(\`\${elev.name}: Extended Soiling Provision requires an amount before sending.\`);
                }
                const cat16 = getItem(16);
                const soilingAmount = roundToNearest50(elev.extendedSoilingPrice);
                const name16 = cat16?.name ? (cat16.name.includes('[Elevation]') ? cat16.name.replace('[Elevation]', elev.name) : \`\${cat16.name} – \${elev.name}\`) : \`Extended Soiling Provision – \${elev.name}\`;
                clientItems.push({
                    name: name16,
                    description: cat16?.clientDescription || AEROWASH_CATALOGUE_ITEMS[15].clientDescription,
                    area: elev.name,
                    amount: soilingAmount,
                    internalMetadata: { itemNumber: 16 }
                });
            }

            // Item 23: Low-Level & Detail Hand Clean
            if (elev.hasHandClean && isItemActive(23)) {
                if ((elev.handCleanPrice || 0) <= 0) {
                    errors.push(\`\${elev.name}: Low-Level & Detail Hand Clean requires a price before sending.\`);
                }
                const cat23 = getItem(23);
                const handCleanAmount = roundToNearest50(elev.handCleanPrice || 0);
                cleaningLinesTotal += handCleanAmount;
                const name23 = cat23?.name ? (cat23.name.includes('[Elevation]') ? cat23.name.replace('[Elevation]', elev.name) : \`\${cat23.name} – \${elev.name}\`) : \`Low-Level & Detail Hand Clean – \${elev.name}\`;
                clientItems.push({
                    name: name23,
                    description: cat23?.clientDescription || 'Hand cleaning of ground-level glazing, entrances and detail areas that are not reachable by drone, completed as part of the same visit.',
                    area: elev.name,
                    amount: handCleanAmount,
                    internalMetadata: { itemNumber: 23, price: elev.handCleanPrice }
                });
            }
        }

        // 2. Process Site Provisions
        const prov = siteProvisions;
        const provisionsArea = 'Site Provisions';

        if (prov.hasRoofClean && isItemActive(5)) {
            if (prov.roofCleanPrice <= 0) errors.push('Roof Maintenance Clean requires a price before sending.');
            const amt = roundToNearest50(prov.roofCleanPrice);
            cleaningLinesTotal += amt;
            const cat5 = getItem(5);
            clientItems.push({
                name: cat5?.name || 'Roof Maintenance Clean',
                description: cat5?.clientDescription || AEROWASH_CATALOGUE_ITEMS[4].clientDescription,
                area: provisionsArea,
                amount: amt,
                internalMetadata: { itemNumber: 5 }
            });
        }

        if (prov.hasSolarClean && isItemActive(6)) {
            const cat6 = getItem(6);
            const cat6Meta = (cat6?.metadata as any) || {};
            const clientSolarRate = Number(cat6Meta?.solarRates?.client) || 6;
            const aeroWashSolarRate = Number(cat6Meta?.solarRates?.aerowash) || 10;
            const rate = prov.solarWaterSource === 'CLIENT' ? clientSolarRate : aeroWashSolarRate;
            const amt = roundToNearest50(prov.solarPanelCount * rate);
            if (prov.solarPanelCount <= 0) errors.push('Solar Array Maintenance Clean requires panel count > 0.');
            cleaningLinesTotal += amt;
            clientItems.push({
                name: cat6?.name || 'Solar Array Maintenance Clean',
                description: cat6?.clientDescription || AEROWASH_CATALOGUE_ITEMS[5].clientDescription,
                area: provisionsArea,
                amount: amt,
                internalMetadata: { itemNumber: 6, panelCount: prov.solarPanelCount, waterSource: prov.solarWaterSource, rate }
            });
        }

        if (prov.hasSignage && isItemActive(7)) {
            if (prov.signagePrice <= 0) errors.push('Signage & Entrance Features requires a price before sending.');
            const amt = roundToNearest50(prov.signagePrice);
            cleaningLinesTotal += amt;
            const cat7 = getItem(7);
            clientItems.push({
                name: cat7?.name || 'Signage & Entrance Features',
                description: cat7?.clientDescription || AEROWASH_CATALOGUE_ITEMS[6].clientDescription,
                area: provisionsArea,
                amount: amt,
                internalMetadata: { itemNumber: 7 }
            });
        }

        if (prov.hasBirdFouling && isItemActive(8)) {
            if (prov.birdFoulingPrice <= 0) errors.push('Bird Fouling Removal requires a price before sending.');
            const amt = roundToNearest50(prov.birdFoulingPrice);
            cleaningLinesTotal += amt;
            const cat8 = getItem(8);
            clientItems.push({
                name: cat8?.name || 'Bird Fouling Removal',
                description: cat8?.clientDescription || AEROWASH_CATALOGUE_ITEMS[7].clientDescription,
                area: provisionsArea,
                amount: amt,
                internalMetadata: { itemNumber: 8 }
            });
        }

        if (prov.hasPostConstruction && isItemActive(10)) {
            if (prov.postConstructionPrice <= 0) errors.push('Post-Construction Exterior Clean requires a price before sending.');
            const amt = roundToNearest50(prov.postConstructionPrice);
            cleaningLinesTotal += amt;
            const cat10 = getItem(10);
            clientItems.push({
                name: cat10?.name || 'Post-Construction Exterior Clean',
                description: cat10?.clientDescription || AEROWASH_CATALOGUE_ITEMS[9].clientDescription,
                area: provisionsArea,
                amount: amt,
                internalMetadata: { itemNumber: 10 }
            });
        }

        // Item 11: Site Visit & Facade Assessment (R0, No charge)
        if (prov.hasSiteVisit && isItemActive(11)) {
            const cat11 = getItem(11);
            clientItems.push({
                name: cat11?.name || 'Site Visit & Facade Assessment',
                description: cat11?.clientDescription || AEROWASH_CATALOGUE_ITEMS[10].clientDescription,
                area: provisionsArea,
                amount: 0,
                internalMetadata: { itemNumber: 11, label: 'No charge' }
            });
        }

        // Item 12: Facade Condition Survey (Hidden unless Survey Camera Enabled)
        if (surveyCameraEnabled && prov.hasFacadeSurvey && isItemActive(12)) {
            if (prov.facadeSurveyPrice <= 0) errors.push('Facade Condition Survey requires a price before sending.');
            const cat12 = getItem(12);
            clientItems.push({
                name: cat12?.name || 'Facade Condition Survey',
                description: cat12?.clientDescription || AEROWASH_CATALOGUE_ITEMS[11].clientDescription,
                area: provisionsArea,
                amount: roundToNearest50(prov.facadeSurveyPrice),
                internalMetadata: { itemNumber: 12 }
            });
        }

        // Item 13: Thermal Roof Survey (Hidden unless Thermal Camera Enabled)
        if (thermalCameraEnabled && prov.hasThermalSurvey && isItemActive(13)) {
            if (prov.thermalSurveyPrice <= 0) errors.push('Thermal Roof Survey requires a price before sending.');
            const cat13 = getItem(13);
            clientItems.push({
                name: cat13?.name || 'Thermal Roof Survey',
                description: cat13?.clientDescription || AEROWASH_CATALOGUE_ITEMS[12].clientDescription,
                area: provisionsArea,
                amount: roundToNearest50(prov.thermalSurveyPrice),
                internalMetadata: { itemNumber: 13 }
            });
        }

        // Item 14: Service Photo Record (R0 allowed, shown as Included)
        if (prov.hasPhotoRecord && isItemActive(14)) {
            const cat14 = getItem(14);
            clientItems.push({
                name: cat14?.name || 'Service Photo Record',
                description: cat14?.clientDescription || AEROWASH_CATALOGUE_ITEMS[13].clientDescription,
                area: provisionsArea,
                amount: prov.photoRecordPrice > 0 ? roundToNearest50(prov.photoRecordPrice) : 0,
                internalMetadata: { itemNumber: 14, label: prov.photoRecordPrice > 0 ? undefined : 'Included' }
            });
        }

        // Item 15: Occupied Building Provision (10% of cleaning lines it applies to)
        if (prov.hasOccupiedBuilding && cleaningLinesTotal > 0 && isItemActive(15)) {
            const cat15 = getItem(15);
            const cat15Meta = (cat15?.metadata as any) || {};
            const occupiedPercent = (Number(cat15Meta?.defaultPercent) || 10) / 100;
            const rawOccupied = cleaningLinesTotal * occupiedPercent;
            const occupiedAmount = roundToNearest50(rawOccupied);
            clientItems.push({
                name: cat15?.name || 'Occupied Building Provision',
                description: cat15?.clientDescription || AEROWASH_CATALOGUE_ITEMS[14].clientDescription,
                area: provisionsArea,
                amount: occupiedAmount,
                internalMetadata: { itemNumber: 15, baseCleaningTotal: cleaningLinesTotal, percentage: occupiedPercent * 100 }
            });
        }

        if (prov.hasOutOfWeekHours && isItemActive(17)) {
            if (prov.outOfWeekHoursPrice <= 0) errors.push('Out-of-Hours Service requires a price before sending.');
            const cat17 = getItem(17);
            clientItems.push({
                name: cat17?.name || 'Out-of-Hours Service',
                description: cat17?.clientDescription || AEROWASH_CATALOGUE_ITEMS[16].clientDescription,
                area: provisionsArea,
                amount: roundToNearest50(prov.outOfWeekHoursPrice),
                internalMetadata: { itemNumber: 17, note: 'Daylight operations only (no SACAA night flying)' }
            });
        }

        if (prov.hasWaterSupplySite && isItemActive(18)) {
            if (prov.waterSupplySitePrice <= 0) errors.push('Water Supply – Site Provision requires a price before sending.');
            const cat18 = getItem(18);
            clientItems.push({
                name: cat18?.name || 'Water Supply – Site Provision',
                description: cat18?.clientDescription || AEROWASH_CATALOGUE_ITEMS[17].clientDescription,
                area: provisionsArea,
                amount: roundToNearest50(prov.waterSupplySitePrice),
                internalMetadata: { itemNumber: 18 }
            });
        }

        if (prov.hasRegionalWater && isItemActive(19)) {
            const cat19 = getItem(19);
            const cat19Meta = (cat19?.metadata as any) || {};
            const atlantisRate = Number(cat19Meta?.waterRates?.atlantis) || 0.30;
            const simonsTownRate = Number(cat19Meta?.waterRates?.simons_town) || 0.85;
            const perLitreRate = prov.regionalWaterZone === 'ATLANTIS' ? atlantisRate : simonsTownRate;
            if (prov.regionalWaterLitres <= 0) errors.push('Regional Water Provision requires estimated litres.');
            const amt = roundToNearest50(prov.regionalWaterLitres * perLitreRate);
            clientItems.push({
                name: cat19?.name || 'Regional Water Provision',
                description: cat19?.clientDescription || AEROWASH_CATALOGUE_ITEMS[18].clientDescription,
                area: provisionsArea,
                amount: amt,
                internalMetadata: { itemNumber: 19, zone: prov.regionalWaterZone, litres: prov.regionalWaterLitres, rate: perLitreRate }
            });
        }

        if (prov.hasExtendedTravel && isItemActive(20)) {
            if (prov.extendedTravelPrice <= 0) errors.push('Extended Travel requires a price before sending.');
            const cat20 = getItem(20);
            clientItems.push({
                name: cat20?.name || 'Extended Travel',
                description: cat20?.clientDescription || AEROWASH_CATALOGUE_ITEMS[19].clientDescription,
                area: provisionsArea,
                amount: roundToNearest50(prov.extendedTravelPrice),
                internalMetadata: { itemNumber: 20 }
            });
        }

        // Custom Catalogue Items (> 23)
        const customCatItems = (catalogueItems || []).filter((it: any) => it.itemNumber > 23 && it.isActive !== false);
        customCatItems.forEach((cItem: any) => {
            const amt = prov.customProvisions?.[cItem.itemNumber] || 0;
            if (amt > 0) {
                clientItems.push({
                    name: cItem.name,
                    description: cItem.clientDescription,
                    area: provisionsArea,
                    amount: roundToNearest50(amt),
                    internalMetadata: { itemNumber: cItem.itemNumber }
                });
            }
        });

        `;
    code = code.slice(0, startIdx) + newCalcBlock + code.slice(endIdx);
    console.log('RecalculateQuote block replaced successfully');
} else {
    console.error('Could not find start/end idx for recalculateQuote', startIdx, endIdx);
}

// 3. Update Elevation Add-ons UI
const elevAddonStart = code.indexOf('{/* Elevation Add-ons */}');
const elevAddonEnd = code.indexOf('{/* Exclusions (if condition flags excluded areas) */}');

if (elevAddonStart !== -1 && elevAddonEnd !== -1) {
    const newElevAddonsUI = `{/* Elevation Add-ons */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 text-xs">
                                                    {/* Balcony & Detail */}
                                                    {isItemActive(3) && (
                                                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                                                            <label className="flex items-center gap-2 cursor-pointer font-bold">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={elev.hasBalconies}
                                                                    onChange={e => updateElevation(elev.id, { hasBalconies: e.target.checked })}
                                                                    className="rounded text-primary"
                                                                />
                                                                <span>{getItem(3)?.name?.replace(' – [Elevation]', '') || 'Item 3: Balconies & Details'}</span>
                                                            </label>
                                                            {elev.hasBalconies && (
                                                                <div className="flex items-center gap-2 pl-6">
                                                                    <Label className="text-[10px] text-gray-400">Area % (10-15%):</Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="10"
                                                                        max="15"
                                                                        value={elev.balconyPercent}
                                                                        onChange={e => updateElevation(elev.id, { balconyPercent: parseFloat(e.target.value) || 12 })}
                                                                        className="h-7 w-16 text-xs font-mono"
                                                                    />
                                                                    <span className="text-gray-400 text-[10px]">
                                                                        {formatCurrency(roundToNearest50((areaToUse * bandRate) * (elev.balconyPercent / 100)), currencySymbol)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Stain & Growth Pre-treatment */}
                                                    {isItemActive(4) && (
                                                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                                                            <label className="flex items-center gap-2 cursor-pointer font-bold">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={elev.hasPreTreatment}
                                                                    onChange={e => updateElevation(elev.id, { hasPreTreatment: e.target.checked })}
                                                                    className="rounded text-primary"
                                                                />
                                                                <span className="flex items-center gap-1">
                                                                    {getItem(4)?.name?.replace(' – [Elevation]', '') || 'Item 4: Pre-Treatment'}
                                                                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono">
                                                                        PROVISIONAL
                                                                    </span>
                                                                </span>
                                                            </label>
                                                            {elev.hasPreTreatment && (
                                                                <div className="flex items-center gap-2 pl-6">
                                                                    <Label className="text-[10px] text-gray-400">% (25-30%):</Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="25"
                                                                        max="30"
                                                                        value={elev.preTreatmentPercent}
                                                                        onChange={e => updateElevation(elev.id, { preTreatmentPercent: parseFloat(e.target.value) || 25 })}
                                                                        className="h-7 w-16 text-xs font-mono"
                                                                    />
                                                                    <span className="text-gray-400 text-[10px]">
                                                                        {formatCurrency(roundToNearest50((elev.selectedCleaning === 'GLAZING' ? glazingPrice : facadePrice) * (elev.preTreatmentPercent / 100)), currencySymbol)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Pre-Coating Wash */}
                                                    {isItemActive(9) && (
                                                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                                                            <label className="flex items-center gap-2 cursor-pointer font-bold">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={elev.hasPreCoatingWash}
                                                                    onChange={e => updateElevation(elev.id, { hasPreCoatingWash: e.target.checked })}
                                                                    className="rounded text-primary"
                                                                />
                                                                <span>{getItem(9)?.name?.replace(' – [Elevation]', '') || 'Item 9: Pre-Coating Wash'}</span>
                                                            </label>
                                                            {elev.hasPreCoatingWash && (
                                                                <p className="text-[10px] text-gray-400 pl-6">
                                                                    Priced as Full Facade ({formatCurrency(facadePrice, currencySymbol)}). Contractor spec required.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Item 16: Extended Soiling Provision */}
                                                    {isItemActive(16) && (
                                                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                                                            <label className="flex items-center gap-2 cursor-pointer font-bold">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={elev.hasExtendedSoiling}
                                                                    onChange={e => updateElevation(elev.id, { hasExtendedSoiling: e.target.checked })}
                                                                    className="rounded text-primary"
                                                                />
                                                                <span>{getItem(16)?.name?.replace(' – [Elevation]', '') || 'Item 16: Extended Soiling'}</span>
                                                            </label>
                                                            {elev.hasExtendedSoiling && (
                                                                <div className="space-y-1.5 pl-6">
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Price on quote (R)"
                                                                        value={elev.extendedSoilingPrice || ''}
                                                                        onChange={e => updateElevation(elev.id, { extendedSoilingPrice: parseFloat(e.target.value) || 0 })}
                                                                        className="h-7 text-xs font-mono"
                                                                    />
                                                                    {elev.hasPreTreatment && (
                                                                        <label className="flex items-center gap-1.5 text-[10px] text-amber-300 cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={elev.allowSoilingOverride}
                                                                                onChange={e => updateElevation(elev.id, { allowSoilingOverride: e.target.checked })}
                                                                                className="rounded text-primary"
                                                                            />
                                                                            <span>Allow override (double charge with Item 4)</span>
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Item 23: Low-Level & Detail Hand Clean */}
                                                    {isItemActive(23) && (
                                                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                                                            <label className="flex items-center gap-2 cursor-pointer font-bold">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={elev.hasHandClean || false}
                                                                    onChange={e => updateElevation(elev.id, { hasHandClean: e.target.checked })}
                                                                    className="rounded text-primary"
                                                                />
                                                                <span>{getItem(23)?.name?.replace(' – [Elevation]', '') || 'Item 23: Hand Clean'}</span>
                                                            </label>
                                                            {elev.hasHandClean && (
                                                                <div className="pl-6">
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="Price on quote (R)"
                                                                        value={elev.handCleanPrice || ''}
                                                                        onChange={e => updateElevation(elev.id, { handCleanPrice: parseFloat(e.target.value) || 0 })}
                                                                        className="h-7 text-xs font-mono"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>\n\n                                                `;
    code = code.slice(0, elevAddonStart) + newElevAddonsUI + code.slice(elevAddonEnd);
    console.log('Elevation add-ons UI replaced successfully');
} else {
    console.error('Could not find start/end idx for elevAddon', elevAddonStart, elevAddonEnd);
}

// 4. Update Building & Site Provisions UI
const provStart = code.indexOf('{/* SECTION 2: BUILDING & SITE PROVISIONS */}');
const provEnd = code.indexOf('{/* SECTION 3: CONTRACT PROGRAMMES & PRE-SEND CHECKS */}');

if (provStart !== -1 && provEnd !== -1) {
    const newProvUI = `{/* SECTION 2: BUILDING & SITE PROVISIONS */}
                    <Card className="border-white/10 bg-[#0F172A]/70">
                        <CardHeader className="p-4 bg-white/[0.02] border-b border-white/5">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary" />
                                Building & Site Provisions
                            </CardTitle>
                            <CardDescription className="text-xs text-gray-400">
                                Additional scope, water access, and working condition provisions.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                {/* Item 15: Occupied Building */}
                                {isItemActive(15) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasOccupiedBuilding}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasOccupiedBuilding: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(15)?.name || 'Item 15: Occupied Building Provision'}</span>
                                        </label>
                                        <p className="text-[11px] text-gray-400">
                                            {getItem(15)?.clientDescription || 'Automatic 10% provision of all cleaning lines for tenant notifications and interrupted access.'}
                                        </p>
                                    </div>
                                )}

                                {/* Item 11: Site Visit (R0) */}
                                {isItemActive(11) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasSiteVisit}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasSiteVisit: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(11)?.name || 'Item 11: Site Visit & Facade Assessment'}</span>
                                        </label>
                                        <p className="text-[11px] text-emerald-400 font-bold">
                                            R0 – Shown as &quot;No charge&quot; on client quote
                                        </p>
                                    </div>
                                )}

                                {/* Item 14: Service Photo Record */}
                                {isItemActive(14) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasPhotoRecord}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasPhotoRecord: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(14)?.name || 'Item 14: Service Photo Record'}</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                placeholder="0 for Included"
                                                value={siteProvisions.photoRecordPrice || ''}
                                                onChange={e => setSiteProvisions(p => ({ ...p, photoRecordPrice: parseFloat(e.target.value) || 0 }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                            <span className="text-[10px] text-gray-400">
                                                {siteProvisions.photoRecordPrice === 0 ? 'Shown as "Included"' : ''}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Item 5: Roof Clean */}
                                {isItemActive(5) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasRoofClean}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasRoofClean: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(5)?.name || 'Item 5: Roof Maintenance Clean'}</span>
                                        </label>
                                        {siteProvisions.hasRoofClean && (
                                            <Input
                                                type="number"
                                                placeholder="Price on quote (R)"
                                                value={siteProvisions.roofCleanPrice || ''}
                                                onChange={e => setSiteProvisions(p => ({ ...p, roofCleanPrice: parseFloat(e.target.value) || 0 }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Item 6: Solar Array Clean */}
                                {isItemActive(6) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasSolarClean}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasSolarClean: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(6)?.name || 'Item 6: Solar Array Clean'}</span>
                                        </label>
                                        {siteProvisions.hasSolarClean && (
                                            <div className="space-y-1.5 pl-6">
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-[10px] text-gray-400">Panels:</Label>
                                                    <Input
                                                        type="number"
                                                        value={siteProvisions.solarPanelCount || ''}
                                                        onChange={e => setSiteProvisions(p => ({ ...p, solarPanelCount: parseInt(e.target.value) || 0 }))}
                                                        className="h-7 w-20 text-xs font-mono"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <label className="flex items-center gap-1 cursor-pointer text-[11px]">
                                                        <input
                                                            type="radio"
                                                            name="solarWater"
                                                            checked={siteProvisions.solarWaterSource === 'CLIENT'}
                                                            onChange={() => setSiteProvisions(p => ({ ...p, solarWaterSource: 'CLIENT' }))}
                                                        />
                                                        <span>Client water (R6)</span>
                                                    </label>
                                                    <label className="flex items-center gap-1 cursor-pointer text-[11px]">
                                                        <input
                                                            type="radio"
                                                            name="solarWater"
                                                            checked={siteProvisions.solarWaterSource === 'AEROWASH'}
                                                            onChange={() => setSiteProvisions(p => ({ ...p, solarWaterSource: 'AEROWASH' }))}
                                                        />
                                                        <span>AeroWash water (R10)</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Item 7: Signage & Entrance Features */}
                                {isItemActive(7) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasSignage}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasSignage: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(7)?.name || 'Item 7: Signage & Entrance Features'}</span>
                                        </label>
                                        {siteProvisions.hasSignage && (
                                            <Input
                                                type="number"
                                                placeholder="Price on quote (R)"
                                                value={siteProvisions.signagePrice || ''}
                                                onChange={e => setSiteProvisions(p => ({ ...p, signagePrice: parseFloat(e.target.value) || 0 }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Item 8: Bird Fouling Removal */}
                                {isItemActive(8) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasBirdFouling}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasBirdFouling: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(8)?.name || 'Item 8: Bird Fouling Removal'}</span>
                                        </label>
                                        {siteProvisions.hasBirdFouling && (
                                            <Input
                                                type="number"
                                                placeholder="Price on quote (R)"
                                                value={siteProvisions.birdFoulingPrice || ''}
                                                onChange={e => setSiteProvisions(p => ({ ...p, birdFoulingPrice: parseFloat(e.target.value) || 0 }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Item 10: Post-Construction Exterior Clean */}
                                {isItemActive(10) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasPostConstruction}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasPostConstruction: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(10)?.name || 'Item 10: Post-Construction Exterior Clean'}</span>
                                        </label>
                                        {siteProvisions.hasPostConstruction && (
                                            <Input
                                                type="number"
                                                placeholder="Price on quote (R)"
                                                value={siteProvisions.postConstructionPrice || ''}
                                                onChange={e => setSiteProvisions(p => ({ ...p, postConstructionPrice: parseFloat(e.target.value) || 0 }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Item 12: Facade Survey (Settings Gated) */}
                                {surveyCameraEnabled && isItemActive(12) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasFacadeSurvey}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasFacadeSurvey: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(12)?.name || 'Item 12: Facade Condition Survey'}</span>
                                        </label>
                                        {siteProvisions.hasFacadeSurvey && (
                                            <Input
                                                type="number"
                                                placeholder="Price on quote (R)"
                                                value={siteProvisions.facadeSurveyPrice || ''}
                                                onChange={e => setSiteProvisions(p => ({ ...p, facadeSurveyPrice: parseFloat(e.target.value) || 0 }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Item 13: Thermal Roof Survey (Settings Gated) */}
                                {thermalCameraEnabled && isItemActive(13) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasThermalSurvey}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasThermalSurvey: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(13)?.name || 'Item 13: Thermal Roof Survey'}</span>
                                        </label>
                                        {siteProvisions.hasThermalSurvey && (
                                            <Input
                                                type="number"
                                                placeholder="Price on quote (R)"
                                                value={siteProvisions.thermalSurveyPrice || ''}
                                                onChange={e => setSiteProvisions(p => ({ ...p, thermalSurveyPrice: parseFloat(e.target.value) || 0 }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Item 17: Out of Hours */}
                                {isItemActive(17) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasOutOfWeekHours}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasOutOfWeekHours: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(17)?.name || 'Item 17: Out-of-Hours Service'}</span>
                                        </label>
                                        {siteProvisions.hasOutOfWeekHours && (
                                            <div>
                                                <Input
                                                    type="number"
                                                    placeholder="Price on quote (R)"
                                                    value={siteProvisions.outOfWeekHoursPrice || ''}
                                                    onChange={e => setSiteProvisions(p => ({ ...p, outOfWeekHoursPrice: parseFloat(e.target.value) || 0 }))}
                                                    className="h-8 text-xs font-mono"
                                                />
                                                <p className="text-[10px] text-amber-300 mt-1">Daylight only (no night flying).</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Item 18: Water Supply Site Provision */}
                                {isItemActive(18) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasWaterSupplySite}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasWaterSupplySite: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(18)?.name || 'Item 18: Water Supply – Site Provision'}</span>
                                        </label>
                                        {siteProvisions.hasWaterSupplySite && (
                                            <Input
                                                type="number"
                                                placeholder="Price on quote (R)"
                                                value={siteProvisions.waterSupplySitePrice || ''}
                                                onChange={e => setSiteProvisions(p => ({ ...p, waterSupplySitePrice: parseFloat(e.target.value) || 0 }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Item 19: Regional Water Provision */}
                                {isItemActive(19) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasRegionalWater}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasRegionalWater: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(19)?.name || 'Item 19: Regional Water Provision'}</span>
                                        </label>
                                        {siteProvisions.hasRegionalWater && (
                                            <div className="space-y-1.5 pl-6">
                                                <select
                                                    value={siteProvisions.regionalWaterZone}
                                                    onChange={e => setSiteProvisions(p => ({ ...p, regionalWaterZone: e.target.value as any }))}
                                                    className="w-full h-7 rounded border border-input bg-background text-[11px] px-2"
                                                >
                                                    <option value="ATLANTIS">Atlantis (R0.30/L)</option>
                                                    <option value="SIMONS_TOWN_DESAL">Simon&apos;s Town & Desal (R0.85/L)</option>
                                                </select>
                                                <Input
                                                    type="number"
                                                    placeholder="Estimated litres"
                                                    value={siteProvisions.regionalWaterLitres || ''}
                                                    onChange={e => setSiteProvisions(p => ({ ...p, regionalWaterLitres: parseFloat(e.target.value) || 0 }))}
                                                    className="h-7 text-xs font-mono"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Item 20: Extended Travel */}
                                {isItemActive(20) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasExtendedTravel}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasExtendedTravel: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{getItem(20)?.name || 'Item 20: Extended Travel'}</span>
                                        </label>
                                        {siteProvisions.hasExtendedTravel && (
                                            <Input
                                                type="number"
                                                placeholder="Price on quote (R)"
                                                value={siteProvisions.extendedTravelPrice || ''}
                                                onChange={e => setSiteProvisions(p => ({ ...p, extendedTravelPrice: parseFloat(e.target.value) || 0 }))}
                                                className="h-8 text-xs font-mono"
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Custom Catalogue Items (> 23) */}
                                {(catalogueItems || [])
                                    .filter((it: any) => it.itemNumber > 23 && it.isActive !== false)
                                    .map((cItem: any) => {
                                        const isChecked = !!(siteProvisions.customProvisions && siteProvisions.customProvisions[cItem.itemNumber] !== undefined);
                                        const val = siteProvisions.customProvisions?.[cItem.itemNumber] || 0;
                                        return (
                                            <div key={cItem.id || cItem.itemNumber} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                                <label className="flex items-center gap-2 cursor-pointer font-bold">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={e => {
                                                            const checked = e.target.checked;
                                                            setSiteProvisions(p => {
                                                                const next = { ...(p.customProvisions || {}) };
                                                                if (checked) {
                                                                    next[cItem.itemNumber] = (cItem.metadata as any)?.defaultPrice || 0;
                                                                } else {
                                                                    delete next[cItem.itemNumber];
                                                                }
                                                                return { ...p, customProvisions: next };
                                                            });
                                                        }}
                                                        className="rounded text-primary"
                                                    />
                                                    <span>{cItem.name}</span>
                                                </label>
                                                {cItem.clientDescription && (
                                                    <p className="text-[11px] text-gray-400 pl-6">{cItem.clientDescription}</p>
                                                )}
                                                {isChecked && (
                                                    <div className="pl-6">
                                                        <Input
                                                            type="number"
                                                            placeholder="Price on quote (R)"
                                                            value={val || ''}
                                                            onChange={e => {
                                                                const num = parseFloat(e.target.value) || 0;
                                                                setSiteProvisions(p => ({
                                                                    ...p,
                                                                    customProvisions: {
                                                                        ...(p.customProvisions || {}),
                                                                        [cItem.itemNumber]: num
                                                                    }
                                                                }));
                                                            }}
                                                            className="h-8 text-xs font-mono"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        </CardContent>
                    </Card>\n\n                    `;
    code = code.slice(0, provStart) + newProvUI + code.slice(provEnd);
    console.log('Building & site provisions UI replaced successfully');
} else {
    console.error('Could not find start/end idx for provUI', provStart, provEnd);
}

fs.writeFileSync('src/components/invoices/AeroWashQuoteBuilder.tsx', code, 'utf8');
console.log('Finished updating AeroWashQuoteBuilder.tsx');
