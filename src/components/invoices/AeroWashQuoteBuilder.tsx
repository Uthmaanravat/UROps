"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Plus,
    Trash2,
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    Check,
    Building2,
    Calendar,
    Camera,
    Info,
    Droplet,
    Sparkles,
    Eye,
    Percent,
    Sun,
    Layers,
    FileText,
    RotateCcw
} from "lucide-react"
import {
    getBandFromHeight,
    roundToNearest50,
    RATE_CARD_BANDS,
    AEROWASH_CATALOGUE_ITEMS,
    CONTRACT_PROGRAMMES,
    CONTRACT_PROGRAMME_DESCRIPTIONS,
    MINIMUM_JOB_AMOUNT,
    MINIMUM_FLOOR_RATE_PER_M2,
    AEROWASH_STANDARD_TERMS_NAME,
    generateAeroWashScopeOfWorks,
    CONDITION_TYPE_PRESETS,
    ConditionTypePreset,
    ConditionFlag,
    SiteVisitPhoto,
    generateConditionFlagWording,
    formatPhotoRefs
} from "@/lib/aerowash-catalogue"
import { formatCurrency } from "@/lib/utils"

function parseDecimalInput(val: string): number {
    if (!val) return 0;
    const clean = val.replace(',', '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

export interface ElevationState {
    id: string;
    name: string;
    width: number; // m
    height: number; // m
    areaOverride?: number; // optional polygon cross-check / exact area in m²
    polygonArea?: number; // m² for cross-check
    band: 'A' | 'B' | 'C' | 'D' | 'E';
    condition: 'Light' | 'Sound' | 'Medium' | 'Heavy';
    selectedCleaning: 'GLAZING' | 'FULL_FACADE' | 'BOTH_ALTERNATIVES' | 'NONE';
    isMostlyGlassTower: boolean;
    hasBalconies: boolean;
    balconyPercent: number; // 10 - 15, default 12
    hasPreTreatment: boolean;
    preTreatmentPercent: number; // 25 - 30, default 25
    hasPreCoatingWash: boolean;
    hasExtendedSoiling: boolean;
    extendedSoilingPrice: number;
    allowSoilingOverride: boolean;
    hasHandClean?: boolean;
    handCleanPrice?: number;
    exclusions?: string;
}

export interface SiteProvisionsState {
    hasRoofClean: boolean;
    roofCleanPrice: number;
    hasSolarClean: boolean;
    solarPanelCount: number;
    solarWaterSource: 'CLIENT' | 'AEROWASH';
    hasSignage: boolean;
    signagePrice: number;
    hasBirdFouling: boolean;
    birdFoulingPrice: number;
    hasPostConstruction: boolean;
    postConstructionPrice: number;
    hasSiteVisit: boolean;
    hasFacadeSurvey: boolean;
    facadeSurveyPrice: number;
    hasThermalSurvey: boolean;
    thermalSurveyPrice: number;
    hasPhotoRecord: boolean;
    photoRecordPrice: number;
    hasOccupiedBuilding: boolean;
    hasOutOfWeekHours: boolean;
    outOfWeekHoursPrice: number;
    hasWaterSupplySite: boolean;
    waterSupplySitePrice: number;
    hasRegionalWater: boolean;
    regionalWaterZone: 'ATLANTIS' | 'SIMONS_TOWN_DESAL';
    regionalWaterLitres: number;
    hasExtendedTravel: boolean;
    extendedTravelPrice: number;
    customProvisions?: Record<number, number>;
}

export interface AeroWashQuoteBuilderProps {
    siteName?: string;
    clientSelected?: boolean;
    currencySymbol?: string;
    surveyCameraEnabled?: boolean;
    thermalCameraEnabled?: boolean;
    hasVatRegistration?: boolean;
    vatRate?: number;
    termsTemplates?: any[];
    catalogueItems?: any[];
    initialData?: any;
    onChange: (payload: {
        items: any[];
        metadata: any;
        subtotal: number;
        total: number;
        taxAmount: number;
        validationErrors: string[];
    }) => void;
}

export function AeroWashQuoteBuilder({
    siteName = "",
    clientSelected = false,
    currencySymbol = "R",
    surveyCameraEnabled = false,
    thermalCameraEnabled = false,
    hasVatRegistration = false,
    vatRate = 15,
    termsTemplates = [],
    catalogueItems = [],
    initialData,
    onChange
}: AeroWashQuoteBuilderProps) {
    // Live Catalogue Mapping & Active State
    const catalogueMap = useMemo(() => {
        const map = new Map<number, any>();
        AEROWASH_CATALOGUE_ITEMS.forEach(item => {
            map.set(item.itemNumber, {
                ...item,
                isActive: true,
                metadata: null
            });
        });
        (catalogueItems || []).forEach(item => {
            map.set(item.itemNumber, item);
        });
        return map;
    }, [catalogueItems]);

    const getItem = (itemNumber: number) => {
        return catalogueMap.get(itemNumber);
    };

    const isItemActive = (itemNumber: number) => {
        const item = catalogueMap.get(itemNumber);
        return item ? item.isActive !== false : true;
    };

    const cleanItemLabel = (name?: string) => {
        if (!name) return '';
        return name.replace(/^Item\s+\d+:\s*/i, '').replace(/\s*–\s*\[Elevation\]/i, '').trim();
    };

    // 1. Elevations State (Blank by default for new quotes)
    const [elevations, setElevations] = useState<ElevationState[]>(() => {
        if (initialData?.elevations && initialData.elevations.length > 0) {
            return initialData.elevations;
        }
        return [];
    });

    // 2. Site Provisions State
    const [siteProvisions, setSiteProvisions] = useState<SiteProvisionsState>(() => {
        if (initialData?.siteProvisions) {
            return initialData.siteProvisions;
        }
        return {
            hasRoofClean: false,
            roofCleanPrice: 0,
            hasSolarClean: false,
            solarPanelCount: 0,
            solarWaterSource: 'CLIENT',
            hasSignage: false,
            signagePrice: 0,
            hasBirdFouling: false,
            birdFoulingPrice: 0,
            hasPostConstruction: false,
            postConstructionPrice: 0,
            hasSiteVisit: true,
            hasFacadeSurvey: false,
            facadeSurveyPrice: 0,
            hasThermalSurvey: false,
            thermalSurveyPrice: 0,
            hasPhotoRecord: true,
            photoRecordPrice: 0,
            hasOccupiedBuilding: true,
            hasOutOfWeekHours: false,
            outOfWeekHoursPrice: 0,
            hasWaterSupplySite: false,
            waterSupplySitePrice: 0,
            hasRegionalWater: false,
            regionalWaterZone: 'ATLANTIS',
            regionalWaterLitres: 0,
            hasExtendedTravel: false,
            extendedTravelPrice: 0
        };
    });

    // 3. Contract Programme State
    const [programme, setProgramme] = useState<'ONCE_OFF' | 'BIANNUAL' | 'QUARTERLY' | 'MONTHLY' | 'MONTHLY_QUARTERLY_COMBINED'>('ONCE_OFF');
    const [isLandmark, setIsLandmark] = useState(false);
    const [siteVisitDone, setSiteVisitDone] = useState(true);
    const [contractorSpecReceived, setContractorSpecReceived] = useState(false);

    // 3b. Site Visit Record & Photos State
    const [siteVisitDate, setSiteVisitDate] = useState<string>(() => {
        return initialData?.metadata?.siteVisitDate || initialData?.siteVisitDate || new Date().toISOString().slice(0, 10);
    });
    const [siteVisitAttendedBy, setSiteVisitAttendedBy] = useState<string>(() => {
        return initialData?.metadata?.siteVisitAttendedBy || initialData?.siteVisitAttendedBy || '';
    });
    const [siteVisitPhotos, setSiteVisitPhotos] = useState<SiteVisitPhoto[]>(() => {
        return initialData?.metadata?.siteVisitPhotos || initialData?.siteVisitPhotos || [];
    });

    // 3c. Condition Flags State
    const [conditionFlags, setConditionFlags] = useState<ConditionFlag[]>(() => {
        return initialData?.metadata?.conditionFlags || initialData?.conditionFlags || [];
    });

    // Condition Flag inline editor state
    const [isAddingFlag, setIsAddingFlag] = useState(false);
    const [flagElevation, setFlagElevation] = useState('');
    const [flagLocation, setFlagLocation] = useState('');
    const [flagConditionType, setFlagConditionType] = useState('GLASS_ETCHING');
    const [flagPhotoRefs, setFlagPhotoRefs] = useState<string[]>([]);
    const [flagCustomCondition, setFlagCustomCondition] = useState('');
    const [flagCustomConsequence, setFlagCustomConsequence] = useState('');
    const [flagCustomRestoration, setFlagCustomRestoration] = useState('');
    const [flagCustomWording, setFlagCustomWording] = useState('');
    const [isFlagWordingEdited, setIsFlagWordingEdited] = useState(false);
    const [warnNoPhotosSelected, setWarnNoPhotosSelected] = useState(false);

    const computedFlagWording = useMemo(() => {
        const preset = CONDITION_TYPE_PRESETS[flagConditionType] || CONDITION_TYPE_PRESETS.GLASS_ETCHING;
        const condition = flagConditionType === 'OTHER' ? flagCustomCondition : preset.condition;
        const consequence = flagConditionType === 'OTHER' ? flagCustomConsequence : preset.consequence;
        const restoration = flagConditionType === 'OTHER' ? flagCustomRestoration : preset.restoration;

        let formattedDate = 'site inspection';
        if (siteVisitDate) {
            const parts = siteVisitDate.split('-');
            if (parts.length === 3) {
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                formattedDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            } else {
                formattedDate = new Date(siteVisitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            }
        }

        return generateConditionFlagWording({
            date: formattedDate,
            condition,
            elevation: flagElevation || elevations[0]?.name || 'elevation',
            location: flagLocation || 'specified areas',
            photoRefs: flagPhotoRefs,
            consequence,
            restoration,
            isExcludedFromCleaning: preset.isExcludedFromCleaning || flagConditionType === 'CRACKED_GLAZING' || flagConditionType === 'LOOSE_RENDER_CLADDING'
        });
    }, [flagConditionType, flagCustomCondition, flagCustomConsequence, flagCustomRestoration, siteVisitDate, flagElevation, flagLocation, flagPhotoRefs, elevations]);

    useEffect(() => {
        if (!isFlagWordingEdited) {
            setFlagCustomWording(computedFlagWording);
        }
    }, [computedFlagWording, isFlagWordingEdited]);

    const handleStartAddFlag = () => {
        const defaultElev = elevations[0]?.name || '';
        setFlagElevation(defaultElev);
        setFlagLocation('');
        setFlagConditionType('GLASS_ETCHING');
        setFlagPhotoRefs([]);
        setFlagCustomCondition('');
        setFlagCustomConsequence('');
        setFlagCustomRestoration('');
        setIsFlagWordingEdited(false);
        setWarnNoPhotosSelected(false);
        setIsAddingFlag(true);
    };

    const handleSaveFlag = (force = false) => {
        if (!force && siteVisitPhotos.length > 0 && flagPhotoRefs.length === 0) {
            setWarnNoPhotosSelected(true);
            return;
        }
        setWarnNoPhotosSelected(false);

        const preset = CONDITION_TYPE_PRESETS[flagConditionType] || CONDITION_TYPE_PRESETS.GLASS_ETCHING;
        const conditionText = flagConditionType === 'OTHER' ? flagCustomCondition : preset.condition;
        const consequenceText = flagConditionType === 'OTHER' ? flagCustomConsequence : preset.consequence;
        const restorationText = flagConditionType === 'OTHER' ? flagCustomRestoration : preset.restoration;
        const elevTarget = flagElevation || elevations[0]?.name || '';

        const newFlag: ConditionFlag = {
            id: `flag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            elevation: elevTarget,
            location: flagLocation,
            conditionType: flagConditionType,
            conditionText,
            consequenceText,
            restorationText,
            photoRefs: [...flagPhotoRefs].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
            wording: flagCustomWording || computedFlagWording
        };

        setConditionFlags(prev => [...prev, newFlag]);

        // Auto-exclusion rule:
        if (preset.isExcludedFromCleaning || flagConditionType === 'CRACKED_GLAZING' || flagConditionType === 'LOOSE_RENDER_CLADDING') {
            if (flagLocation.trim()) {
                setElevations(prev => prev.map(e => {
                    if (e.name === elevTarget) {
                        const current = e.exclusions ? e.exclusions.trim() : '';
                        const loc = flagLocation.trim();
                        const updated = current
                            ? (current.toLowerCase().includes(loc.toLowerCase()) ? current : `${current}, ${loc}`)
                            : loc;
                        return { ...e, exclusions: updated };
                    }
                    return e;
                }));
            }
        }

        setIsAddingFlag(false);
        setIsFlagWordingEdited(false);
    };

    const handleDeleteFlag = (id: string) => {
        setConditionFlags(prev => prev.filter(f => f.id !== id));
    };

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDim = 1600;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        // Compress to JPEG with 0.80 quality up to 1600px for sharper defect evidence
                        const compressed = canvas.toDataURL('image/jpeg', 0.80);
                        resolve(compressed);
                    } else {
                        resolve(e.target?.result as string);
                    }
                };
                img.onerror = () => resolve(e.target?.result as string);
                img.src = e.target?.result as string;
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        });
    };

    const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileList = Array.from(files);
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const dataUrl = await compressImage(file);
            setSiteVisitPhotos(prev => {
                const nextNum = String(prev.length + 1).padStart(2, '0');
                return [
                    ...prev,
                    {
                        id: `photo-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
                        photoNumber: nextNum,
                        url: dataUrl,
                        caption: '',
                        elevation: elevations[0]?.name || ''
                    }
                ];
            });
        }
    };

    const handleAddBlankPhoto = () => {
        setSiteVisitPhotos(prev => {
            const nextNum = String(prev.length + 1).padStart(2, '0');
            return [
                ...prev,
                {
                    id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                    photoNumber: nextNum,
                    url: '',
                    caption: '',
                    elevation: elevations[0]?.name || ''
                }
            ];
        });
    };

    const handleUpdatePhoto = (id: string, updates: Partial<SiteVisitPhoto>) => {
        setSiteVisitPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    };

    const handleDeletePhoto = (id: string) => {
        setSiteVisitPhotos(prev => {
            const remaining = prev.filter(p => p.id !== id);
            return remaining.map((p, idx) => ({
                ...p,
                photoNumber: String(idx + 1).padStart(2, '0')
            }));
        });
    };

    // 4. Client View Toggle for Admin Verification
    const [previewMode, setPreviewMode] = useState<'BUILDER' | 'CLIENT_VIEW'>('BUILDER');
    const [checkedClientView, setCheckedClientView] = useState(false);

    // 5. Scope of Works State & Auto-Generation
    const [scopeOfWorks, setScopeOfWorks] = useState<string>(() => {
        if (initialData?.scopeOfWorks) return initialData.scopeOfWorks;
        if (initialData?.metadata?.scopeOfWorks) return initialData.metadata.scopeOfWorks;
        return '';
    });
    const [isScopeEdited, setIsScopeEdited] = useState(false);

    const autoGeneratedScope = useMemo(() => {
        return generateAeroWashScopeOfWorks({
            siteName,
            elevationNames: elevations.map(e => e.name),
            hasGlazing: elevations.some(e => e.selectedCleaning === 'GLAZING' || e.selectedCleaning === 'BOTH_ALTERNATIVES'),
            hasFullFacade: elevations.some(e => e.selectedCleaning === 'FULL_FACADE' || e.selectedCleaning === 'BOTH_ALTERNATIVES'),
            hasRoofClean: siteProvisions.hasRoofClean,
            hasSolarClean: siteProvisions.hasSolarClean,
            hasSignage: siteProvisions.hasSignage,
            hasBirdFouling: siteProvisions.hasBirdFouling,
            hasStainPreTreatment: elevations.some(e => e.hasPreTreatment),
            hasPostConstruction: siteProvisions.hasPostConstruction,
            hasFacadeSurvey: siteProvisions.hasFacadeSurvey,
            hasThermalSurvey: siteProvisions.hasThermalSurvey,
            hasHandClean: elevations.some(e => e.hasHandClean),
        });
    }, [elevations, siteProvisions, siteName]);

    useEffect(() => {
        if (!isScopeEdited) {
            setScopeOfWorks(autoGeneratedScope);
        }
    }, [autoGeneratedScope, isScopeEdited]);

    const handleRegenerateScope = () => {
        setScopeOfWorks(autoGeneratedScope);
        setIsScopeEdited(false);
    };

    // Elevation Presets for Admin Convenience
    const ELEVATION_PRESETS = ['North', 'South', 'East', 'West', 'Front', 'Rear', 'Street frontage', 'Courtyard'];

    // Elevation Actions
    const addElevation = () => {
        const id = `elev-${Date.now()}`;
        const nextName = ELEVATION_PRESETS.find(p => !elevations.some(e => e.name === p)) || `Elevation ${elevations.length + 1}`;
        setElevations(prev => [
            ...prev,
            {
                id,
                name: nextName,
                width: 25.0,
                height: 18.0,
                band: 'B',
                condition: 'Sound',
                selectedCleaning: 'FULL_FACADE',
                isMostlyGlassTower: false,
                hasBalconies: false,
                balconyPercent: 12,
                hasPreTreatment: false,
                preTreatmentPercent: 25,
                hasPreCoatingWash: false,
                hasExtendedSoiling: false,
                extendedSoilingPrice: 0,
                allowSoilingOverride: false,
                hasHandClean: false,
                handCleanPrice: 0
            }
        ]);
    };

    const removeElevation = (id: string) => {
        setElevations(prev => prev.filter(e => e.id !== id));
    };

    const updateElevation = (id: string, updates: Partial<ElevationState>) => {
        setElevations(prev =>
            prev.map(e => {
                if (e.id !== id) return e;
                const next = { ...e, ...updates };

                // If height changed and band wasn't explicitly changed in this update
                if ('height' in updates && !('band' in updates)) {
                    const bandInfo = getBandFromHeight(next.height);
                    next.band = bandInfo.band;
                }
                return next;
            })
        );
    };

    // Landmark rule: forces Once-off + Full Facade on the first quote
    useEffect(() => {
        if (isLandmark) {
            setProgramme('ONCE_OFF');
            setElevations(prev =>
                prev.map(e => ({
                    ...e,
                    selectedCleaning: 'FULL_FACADE'
                }))
            );
        }
    }, [isLandmark]);

    // Perform Calculation & Build Client Line Items
    const calculation = useMemo(() => {
        const errors: string[] = [];
        const warnings: string[] = [];
        let totalCalculatedArea = 0;
        let cleaningLinesTotal = 0;

        interface BuiltItem {
            name: string;
            description: string;
            area: string;
            amount: number;
            internalMetadata: any;
            isProvisional?: boolean;
            isAlternative?: boolean;
        }

        const clientItems: BuiltItem[] = [];

        // 1. Process Elevations
        for (const elev of elevations) {
            if (elev.condition === 'Heavy') {
                errors.push(`${elev.name}: Decline: needs restoration first (Condition is Heavy).`);
                continue;
            }

            const nominalArea = elev.width * elev.height;
            // If polygon area cross-check is present and within 5%, polygon area can be used as effective area
            let effectiveArea = nominalArea;
            if (elev.polygonArea && elev.polygonArea > 0) {
                const diffPct = Math.abs(elev.polygonArea - nominalArea) / nominalArea;
                if (diffPct > 0.05) {
                    warnings.push(`${elev.name}: Polygon measurement cross-check is ${(diffPct * 100).toFixed(1)}% off width × height. Re-measure before quoting.`);
                }
                // Use polygonArea if provided
                effectiveArea = elev.polygonArea;
            }

            totalCalculatedArea += effectiveArea;

            const bandInfo = RATE_CARD_BANDS[elev.band] || RATE_CARD_BANDS.D;
            const bandRate = bandInfo.rate;

            // Height edge warning
            const heightCheck = getBandFromHeight(elev.height);
            if (heightCheck.isNearEdge) {
                warnings.push(`${elev.name} height (${elev.height} m): ${heightCheck.edgeWarning}`);
            }

            // Catalogue item lookups & rates
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

            const name1 = cat1?.name ? (cat1.name.includes('[Elevation]') ? cat1.name.replace('[Elevation]', elev.name) : `${cat1.name} – ${elev.name}`) : `Exterior Glazing Maintenance Clean – ${elev.name}`;
            const desc1 = cat1?.clientDescription || AEROWASH_CATALOGUE_ITEMS[0].clientDescription;

            const name2 = cat2?.name ? (cat2.name.includes('[Elevation]') ? cat2.name.replace('[Elevation]', elev.name) : `${cat2.name} – ${elev.name}`) : `Full Facade Maintenance Clean – ${elev.name}`;
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
                    name: `Option A: ${name1}`,
                    description: desc1,
                    area: elev.name,
                    amount: glazingAmount,
                    isAlternative: true,
                    internalMetadata: { itemNumber: 1, width: elev.width, height: elev.height, band: elev.band, bandRate: effectiveBandRate }
                });
                clientItems.push({
                    name: `Option B: ${name2}`,
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
                const name3 = cat3?.name ? (cat3.name.includes('[Elevation]') ? cat3.name.replace('[Elevation]', elev.name) : `${cat3.name} – ${elev.name}`) : `Balcony & Detail Areas – ${elev.name}`;
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
                    errors.push(`${elev.name}: Stain & Growth Pre-Treatment requires "Site visit done" before quote can be sent.`);
                }
                const cat4 = getItem(4);
                const preTreatPct = (elev.preTreatmentPercent || 25) / 100;
                const rawPreTreat = elevCleaningAmount * preTreatPct;
                const preTreatAmount = roundToNearest50(rawPreTreat);
                cleaningLinesTotal += preTreatAmount;
                const name4 = cat4?.name ? (cat4.name.includes('[Elevation]') ? cat4.name.replace('[Elevation]', elev.name) : `${cat4.name} – ${elev.name}`) : `Stain & Growth Pre-Treatment – ${elev.name}`;
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
                    errors.push(`${elev.name}: Pre-Coating Facade Wash requires "Contractor specification received" tick before sending.`);
                }
                const cat9 = getItem(9);
                const preCoatingAmount = fullFacadeAmount;
                cleaningLinesTotal += preCoatingAmount;
                const name9 = cat9?.name ? (cat9.name.includes('[Elevation]') ? cat9.name.replace('[Elevation]', elev.name) : `${cat9.name} – ${elev.name}`) : `Pre-Coating Facade Wash – ${elev.name}`;
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
                    warnings.push(`${elev.name}: Extended Soiling Provision used with Stain & Growth Pre-Treatment on same elevation (possible double charge). Allow override to proceed.`);
                }
                if (elev.extendedSoilingPrice <= 0) {
                    errors.push(`${elev.name}: Extended Soiling Provision requires an amount before sending.`);
                }
                const cat16 = getItem(16);
                const soilingAmount = elev.extendedSoilingPrice;
                const name16 = cat16?.name ? (cat16.name.includes('[Elevation]') ? cat16.name.replace('[Elevation]', elev.name) : `${cat16.name} – ${elev.name}`) : `Extended Soiling Provision – ${elev.name}`;
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
                    errors.push(`${elev.name}: Low-Level & Detail Hand Clean requires a price before sending.`);
                }
                const cat23 = getItem(23);
                const handCleanAmount = elev.handCleanPrice || 0;
                cleaningLinesTotal += handCleanAmount;
                const name23 = cat23?.name ? (cat23.name.includes('[Elevation]') ? cat23.name.replace('[Elevation]', elev.name) : `${cat23.name} – ${elev.name}`) : `Low-Level & Detail Hand Clean – ${elev.name}`;
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
            const amt = prov.roofCleanPrice;
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
            const amt = prov.signagePrice;
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
            const amt = prov.birdFoulingPrice;
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
            const amt = prov.postConstructionPrice;
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
                amount: prov.facadeSurveyPrice,
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
                amount: prov.thermalSurveyPrice,
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
                amount: prov.photoRecordPrice > 0 ? prov.photoRecordPrice : 0,
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
                amount: prov.outOfWeekHoursPrice,
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
                amount: prov.waterSupplySitePrice,
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
                amount: prov.extendedTravelPrice,
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
                    amount: amt,
                    internalMetadata: { itemNumber: cItem.itemNumber }
                });
            }
        });

        // Subtotal before programme discounts
        let rawSubtotal = clientItems.reduce((sum, item) => sum + item.amount, 0);

        // Required Site Visit Rule:
        // Item 11 is required if item 4 is used, landmark flag is checked, or quote over R50,000
        const hasItem4 = elevations.some(e => e.hasPreTreatment);
        if ((hasItem4 || isLandmark || rawSubtotal > 50000) && !prov.hasSiteVisit) {
            errors.push('Site Visit & Facade Assessment (No charge) is required for this quote (over R50,000, landmark, or pre-treatment used).');
        }

        // Apply Programme Discounts
        const prog = CONTRACT_PROGRAMMES[programme] || CONTRACT_PROGRAMMES.ONCE_OFF;
        const discountRate = prog.discount;
        let subtotalAfterDiscount = rawSubtotal * (1 - discountRate);
        subtotalAfterDiscount = roundToNearest50(subtotalAfterDiscount);

        // Floor Rule: Effective rate never below R12/m² after all discounts
        if (totalCalculatedArea > 0) {
            const effectiveRate = subtotalAfterDiscount / totalCalculatedArea;
            if (effectiveRate < MINIMUM_FLOOR_RATE_PER_M2) {
                errors.push(`Effective rate R${effectiveRate.toFixed(2)}/m² is below the floor of R${MINIMUM_FLOOR_RATE_PER_M2.toFixed(2)}/m². Adjust scope or reduce discount.`);
            }
        }

        // Minimum Job Rule: R7,500
        let minimumJobRaised = false;
        let finalSubtotal = subtotalAfterDiscount;
        if (finalSubtotal > 0 && finalSubtotal < MINIMUM_JOB_AMOUNT) {
            minimumJobRaised = true;
            finalSubtotal = MINIMUM_JOB_AMOUNT;
            // Fold the difference into the client line amounts proportionally
            const scale = finalSubtotal / subtotalAfterDiscount;
            clientItems.forEach(item => {
                if (item.amount > 0) {
                    item.amount = roundToNearest50(item.amount * scale);
                }
            });
        }

        // VAT rule: No VAT line (AeroWash is not VAT-registered) until a VAT number is saved in Settings
        const rateFraction = (vatRate || 15) / 100;
        const taxRate = hasVatRegistration ? rateFraction : 0;
        const taxAmount = hasVatRegistration ? roundToNearest50(finalSubtotal * rateFraction) : 0;
        const finalTotal = finalSubtotal + taxAmount;

        return {
            clientItems,
            rawSubtotal,
            subtotal: finalSubtotal,
            total: finalTotal,
            taxRate,
            taxAmount,
            minimumJobRaised,
            programmeInfo: prog,
            totalCalculatedArea,
            errors,
            warnings
        };
    }, [elevations, siteProvisions, programme, isLandmark, siteVisitDone, contractorSpecReceived, surveyCameraEnabled, thermalCameraEnabled, hasVatRegistration, vatRate]);

    // Send payload up to parent
    useEffect(() => {
        const lineItemsPayload = calculation.clientItems.map((item, idx) => ({
            id: `item-${idx}`,
            description: `${item.name}\n${item.description}`,
            quantity: 1,
            unit: 'LOT',
            unitPrice: item.amount,
            total: item.amount,
            area: item.area,
            metadata: item.internalMetadata
        }));

        onChange({
            items: lineItemsPayload,
            metadata: {
                aerowashQuote: true,
                rateCardRevision: 13,
                scopeOfWorks: scopeOfWorks || autoGeneratedScope,
                elevations,
                siteProvisions,
                programme,
                isLandmark,
                siteVisitDone,
                siteVisitDate,
                siteVisitAttendedBy,
                siteVisitPhotos,
                conditionFlags,
                contractorSpecReceived,
                totalCalculatedArea: calculation.totalCalculatedArea,
                minimumJobRaised: calculation.minimumJobRaised,
                programmeInfo: calculation.programmeInfo,
                clientViewLines: calculation.clientItems
            },
            subtotal: calculation.subtotal,
            total: calculation.total,
            taxAmount: calculation.taxAmount,
            validationErrors: calculation.errors
        });
    }, [calculation, scopeOfWorks, autoGeneratedScope, siteVisitDone, siteVisitDate, siteVisitAttendedBy, siteVisitPhotos, conditionFlags]);

    return (
        <div className="space-y-6">
            {/* Step Strip */}
            <div className="bg-[#0F172A]/90 border border-white/10 rounded-2xl p-3 shadow-lg">
                <div className="flex items-center justify-between overflow-x-auto gap-2 py-1 scrollbar-none">
                    {[
                        { id: 'step-client', label: '1 Client', isComplete: Boolean(clientSelected || (siteName && siteName.trim())) },
                        { id: 'step-elevations', label: '2 Elevations', isComplete: elevations.length > 0 && elevations.some(e => (e.width || 0) > 0 && (e.height || 0) > 0) },
                        { id: 'step-site-visit', label: '3 Site visit', isComplete: siteVisitDone || conditionFlags.length > 0 || siteVisitPhotos.length > 0 || Boolean(siteVisitDate) },
                        { id: 'step-extras', label: '4 Extras', isComplete: true },
                        { id: 'step-contract', label: '5 Contract', isComplete: Boolean(programme) },
                        { id: 'step-preview', label: '6 Check client view', isComplete: previewMode === 'CLIENT_VIEW' || checkedClientView },
                        { id: 'step-save', label: '7 Save', isComplete: calculation.errors.length === 0 && elevations.length > 0 && (clientSelected || Boolean(siteName && siteName.trim())) }
                    ].map((step, idx) => {
                        const isDone = step.isComplete;
                        return (
                            <button
                                key={step.id}
                                type="button"
                                onClick={() => {
                                    if (step.id === 'step-preview') {
                                        setPreviewMode('CLIENT_VIEW');
                                        setCheckedClientView(true);
                                        setTimeout(() => {
                                            document.getElementById('step-preview')?.scrollIntoView({ behavior: 'smooth' });
                                        }, 100);
                                    } else if (step.id === 'step-client') {
                                        document.getElementById('client-select')?.scrollIntoView({ behavior: 'smooth' });
                                    } else if (step.id === 'step-save') {
                                        document.getElementById('save-quote-submit-btn')?.scrollIntoView({ behavior: 'smooth' });
                                    } else {
                                        setPreviewMode('BUILDER');
                                        setTimeout(() => {
                                            document.getElementById(step.id)?.scrollIntoView({ behavior: 'smooth' });
                                        }, 100);
                                    }
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                    isDone
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                        : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'
                                }`}
                            >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                    isDone ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white/10 text-gray-400'
                                }`}>
                                    {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                                </span>
                                <span>{step.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1E293B]/40 p-4 rounded-2xl border border-white/5">
                <div>
                    <h2 className="text-lg font-bold text-white">AeroWash Elevation & Catalogue Quote Builder</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Fixed-price facade quoting. Client output strips internal dimensions, rates, and bands.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant={previewMode === 'BUILDER' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPreviewMode('BUILDER')}
                        className="text-xs"
                    >
                        Builder View (Internal)
                    </Button>
                    <Button
                        type="button"
                        variant={previewMode === 'CLIENT_VIEW' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPreviewMode('CLIENT_VIEW')}
                        className="text-xs flex items-center gap-1.5"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Client View (Clean)
                    </Button>
                </div>
            </div>

            {/* Validation Errors & Warnings */}
            {calculation.errors.length > 0 && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 space-y-1 text-xs">
                    <div className="font-bold flex items-center gap-1.5 text-sm">
                        <ShieldAlert className="w-4 h-4 text-red-400" />
                        Quote Cannot Be Sent (Enforced Rules)
                    </div>
                    <ul className="list-disc list-inside space-y-0.5">
                        {calculation.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            {calculation.warnings.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1 text-xs">
                    <div className="font-bold flex items-center gap-1.5 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        Builder Notices & Laser Confirmations
                    </div>
                    <ul className="list-disc list-inside space-y-0.5">
                        {calculation.warnings.map((warn, i) => (
                            <li key={i}>{warn}</li>
                        ))}
                    </ul>
                </div>
            )}

            {previewMode === 'BUILDER' ? (
                <>
                    {/* SECTION 1: ELEVATIONS */}
                    <div id="step-elevations" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-primary" />
                                    Elevations & Facade Specs
                                </h3>
                                <p className="text-xs text-gray-400">
                                    One block per side of the building. Enter width and height in metres.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addElevation}
                                className="text-xs flex items-center gap-1 border-white/10 hover:border-primary"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Elevation
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {elevations.length === 0 ? (
                                <Card className="border-dashed border-2 border-white/10 bg-[#0F172A]/40 p-8 text-center rounded-2xl">
                                    <Building2 className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-60" />
                                    <h4 className="text-sm font-bold text-white mb-1">No Elevations Added Yet</h4>
                                    <p className="text-xs text-gray-400 max-w-md mx-auto mb-4">
                                        One block per side of the building. Enter width and height in metres to calculate facade areas and cleaning band rates.
                                    </p>
                                    <Button
                                        type="button"
                                        onClick={addElevation}
                                        className="bg-[#D05E00] hover:bg-[#B34E00] text-white font-bold text-xs"
                                    >
                                        <Plus className="w-4 h-4 mr-1.5" />
                                        Add First Elevation
                                    </Button>
                                </Card>
                            ) : (
                                elevations.map((elev, idx) => {
                                    const bandInfo = getBandFromHeight(elev.height);
                                    const isHeavy = elev.condition === 'Heavy';
                                    const nominalArea = elev.width * elev.height;
                                    const areaToUse = elev.polygonArea && elev.polygonArea > 0 ? elev.polygonArea : nominalArea;
                                    const bandRate = RATE_CARD_BANDS[elev.band]?.rate || 28;
                                    const glazingPrice = roundToNearest50(areaToUse * bandRate);
                                    const facadePrice = roundToNearest50(glazingPrice * (elev.isMostlyGlassTower ? 1 : 1.15));
                                    const isPreset = ELEVATION_PRESETS.includes(elev.name);
                                    const selectValue = isPreset ? elev.name : 'Other';

                                    return (
                                        <Card key={elev.id} className="border-white/10 bg-[#0F172A]/70 overflow-hidden">
                                            <CardHeader className="p-4 bg-white/[0.02] border-b border-white/5 flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={selectValue}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                if (val === 'Other') {
                                                                    if (isPreset) updateElevation(elev.id, { name: '' });
                                                                } else {
                                                                    updateElevation(elev.id, { name: val });
                                                                }
                                                            }}
                                                            className="h-8 text-xs font-bold bg-[#0F172A] border border-white/10 rounded-md px-2 text-white cursor-pointer"
                                                        >
                                                            {ELEVATION_PRESETS.map(preset => (
                                                                <option key={preset} value={preset}>{preset}</option>
                                                            ))}
                                                            <option value="Other">Other (custom)...</option>
                                                        </select>
                                                        {selectValue === 'Other' && (
                                                            <Input
                                                                placeholder="Elevation name"
                                                                value={elev.name}
                                                                onChange={e => updateElevation(elev.id, { name: e.target.value })}
                                                                className="h-8 text-xs font-bold w-36 bg-background/50 border-white/10"
                                                                autoFocus
                                                            />
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-400">
                                                        {nominalArea.toFixed(1)} m² nominal {elev.polygonArea ? `(${elev.polygonArea} m² measured)` : ''}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeElevation(elev.id)}
                                                        className="text-gray-400 hover:text-red-400 h-8 px-2"
                                                        title="Delete elevation"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </CardHeader>

                                            <CardContent className="p-4 space-y-4">
                                                {/* Dimensions & Band Row */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                                    <div>
                                                        <Label className="text-[11px] text-gray-400">Width (m)</Label>
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={elev.width ?? ''}
                                                            onChange={e => updateElevation(elev.id, { width: parseDecimalInput(e.target.value) })}
                                                            className="h-9 text-sm font-mono mt-1"
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label className="text-[11px] text-gray-400">Height (m)</Label>
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={elev.height ?? ''}
                                                            onChange={e => updateElevation(elev.id, { height: parseDecimalInput(e.target.value) })}
                                                            className="h-9 text-sm font-mono mt-1"
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label className="text-[11px] text-gray-400">Height Band</Label>
                                                        <select
                                                            value={elev.band}
                                                            onChange={e => updateElevation(elev.id, { band: e.target.value as any })}
                                                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs mt-1 font-mono font-bold"
                                                        >
                                                            <option value="A">Band A (≤10.5 m) – R16/m²</option>
                                                            <option value="B">Band B (10.5–21 m) – R20/m²</option>
                                                            <option value="C">Band C (21–35 m) – R24/m²</option>
                                                            <option value="D">Band D (35–52.5 m) – R28/m²</option>
                                                            <option value="E">Band E (&gt;52.5 m) – R34/m²</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <Label className="text-[11px] text-gray-400">Condition</Label>
                                                        <select
                                                            value={elev.condition === 'Sound' || elev.condition === 'Light' ? 'Sound' : (elev.condition === 'Heavy' ? 'Heavy' : 'Medium')}
                                                            onChange={e => {
                                                                const val = e.target.value as 'Sound' | 'Medium' | 'Heavy';
                                                                const updates: Partial<ElevationState> = { condition: val as any };
                                                                if (val === 'Medium') {
                                                                    updates.hasPreTreatment = true;
                                                                }
                                                                updateElevation(elev.id, updates);
                                                            }}
                                                            className={`w-full h-9 rounded-md border border-input px-3 text-xs mt-1 font-bold ${
                                                                isHeavy ? 'bg-red-500/20 text-red-300 border-red-500/50' : 'bg-background'
                                                            }`}
                                                        >
                                                            <option value="Sound">Normal (regular maintenance)</option>
                                                            <option value="Medium">Moderate (needs pre-treatment, site visit required)</option>
                                                            <option value="Heavy">Heavy (decline: needs restoration)</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <Label className="text-[11px] text-gray-400">Area (m²)</Label>
                                                        <div className="h-9 px-3 flex items-center justify-between rounded-md border border-primary/40 bg-primary/10 text-sm font-mono font-black text-primary mt-1">
                                                            <span>{nominalArea.toFixed(1)} m²</span>
                                                            <span className="text-[10px] text-gray-400 font-normal">Auto</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Optional Polygon Cross-Check */}
                                                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                                                    <span className="text-gray-400 text-[11px]">Check measurement (optional): area from Google Earth:</span>
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="Optional m²"
                                                        value={elev.polygonArea ?? ''}
                                                        onChange={e => updateElevation(elev.id, { polygonArea: e.target.value.trim() ? parseDecimalInput(e.target.value) : undefined })}
                                                        className="h-7 w-32 text-xs font-mono bg-background/50 border-white/10"
                                                    />
                                                {elev.polygonArea && elev.polygonArea > 0 ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-amber-300 font-mono">
                                                            Using measured {elev.polygonArea} m² ({Math.abs(elev.polygonArea - nominalArea) > 0 ? `${((Math.abs(elev.polygonArea - nominalArea) / (nominalArea || 1)) * 100).toFixed(1)}% diff` : 'match'})
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateElevation(elev.id, { polygonArea: undefined })}
                                                            className="text-[10px] text-gray-400 hover:text-white underline"
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* Edge Warning or Condition Heavy Warning */}
                                            {isHeavy && (
                                                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-bold flex items-center gap-2">
                                                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                                                    Decline: needs restoration first. Cannot quote maintenance cleaning on heavy condition.
                                                </div>
                                            )}

                                            {bandInfo.isNearEdge && !isHeavy && (
                                                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                                        <span>Height ({elev.height} m) is within 2 m of band edge: <strong>Confirm height with laser</strong>.</span>
                                                    </div>
                                                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200">Laser Required</span>
                                                </div>
                                            )}

                                            {/* Service Selection for Elevation */}
                                            <div className="pt-2 border-t border-white/5 space-y-3">
                                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                                    <span className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">Primary Service:</span>
                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name={`cleaning-${elev.id}`}
                                                            checked={elev.selectedCleaning === 'GLAZING'}
                                                            onChange={() => updateElevation(elev.id, { selectedCleaning: 'GLAZING' })}
                                                            className="text-primary"
                                                        />
                                                        <span>Glazing Only ({formatCurrency(glazingPrice, currencySymbol)})</span>
                                                    </label>

                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name={`cleaning-${elev.id}`}
                                                            checked={elev.selectedCleaning === 'FULL_FACADE'}
                                                            onChange={() => updateElevation(elev.id, { selectedCleaning: 'FULL_FACADE' })}
                                                            className="text-primary"
                                                        />
                                                        <span className="flex items-center gap-1">
                                                            Full Facade ({formatCurrency(facadePrice, currencySymbol)})
                                                            {!elev.isMostlyGlassTower && (
                                                                <span className="text-[10px] text-gray-400 font-normal ml-1">
                                                                    (rate under review)
                                                                </span>
                                                            )}
                                                        </span>
                                                    </label>

                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name={`cleaning-${elev.id}`}
                                                            checked={elev.selectedCleaning === 'BOTH_ALTERNATIVES'}
                                                            onChange={() => updateElevation(elev.id, { selectedCleaning: 'BOTH_ALTERNATIVES' })}
                                                            className="text-primary"
                                                        />
                                                        <span className="text-gray-300">Show Both as Alternatives (Option A & B)</span>
                                                    </label>
                                                </div>

                                                {/* Full facade mostly glass toggle */}
                                                {(elev.selectedCleaning === 'FULL_FACADE' || elev.selectedCleaning === 'BOTH_ALTERNATIVES') && (
                                                    <div className="ml-6 flex items-center gap-2 text-xs text-gray-300">
                                                        <input
                                                            type="checkbox"
                                                            id={`mostly-glass-${elev.id}`}
                                                            checked={elev.isMostlyGlassTower}
                                                            onChange={e => updateElevation(elev.id, { isMostlyGlassTower: e.target.checked })}
                                                            className="rounded border-gray-300 text-primary"
                                                        />
                                                        <Label htmlFor={`mostly-glass-${elev.id}`} className="cursor-pointer text-xs">
                                                            Mostly-glass tower (removes +15% facade uplift)
                                                        </Label>
                                                    </div>
                                                )}

                                                {/* Elevation Add-ons */}
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
                                                                <span>{cleanItemLabel(getItem(3)?.name) || 'Balconies & Detail Areas'}</span>
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
                                                                    {cleanItemLabel(getItem(4)?.name) || 'Stain & Growth Pre-Treatment'}
                                                                    <span className="text-[10px] text-gray-400 font-normal ml-1">
                                                                        (rate under review)
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
                                                                <span>{cleanItemLabel(getItem(9)?.name) || 'Pre-Coating Wash'}</span>
                                                            </label>
                                                            {elev.hasPreCoatingWash && (
                                                                <p className="text-[10px] text-gray-400 pl-6">
                                                                    Priced as Full Facade ({formatCurrency(facadePrice, currencySymbol)}). Contractor spec required.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Extended Soiling Provision */}
                                                    {isItemActive(16) && (
                                                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                                                            <label className="flex items-center gap-2 cursor-pointer font-bold">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={elev.hasExtendedSoiling}
                                                                    onChange={e => updateElevation(elev.id, { hasExtendedSoiling: e.target.checked })}
                                                                    className="rounded text-primary"
                                                                />
                                                                <span>{cleanItemLabel(getItem(16)?.name) || 'Extended Soiling Provision'}</span>
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
                                                                            <span>Allow override (double charge with Stain & Growth Pre-Treatment)</span>
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Low-Level & Detail Hand Clean */}
                                                    {isItemActive(23) && (
                                                        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                                                            <label className="flex items-center gap-2 cursor-pointer font-bold">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={elev.hasHandClean || false}
                                                                    onChange={e => updateElevation(elev.id, { hasHandClean: e.target.checked })}
                                                                    className="rounded text-primary"
                                                                />
                                                                <span>{cleanItemLabel(getItem(23)?.name) || 'Low-Level & Detail Hand Clean'}</span>
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
                                                </div>

                                                {/* Exclusions (if condition flags excluded areas) */}
                                                {elev.exclusions && (
                                                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between">
                                                        <div className="flex items-center gap-2 text-amber-300">
                                                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                                            <span><strong className="text-amber-200">Excluded from cleaning:</strong> {elev.exclusions}</span>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => updateElevation(elev.id, { exclusions: '' })}
                                                            className="text-gray-400 hover:text-white h-6 px-2 text-[10px]"
                                                        >
                                                            Clear
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            }))}
                        </div>
                    </div>

                    {/* SECTION: SITE INSPECTION & CONDITION FLAGS */}
                    <Card id="step-site-visit" className="border-white/10 bg-[#0F172A]/70">
                        <CardHeader className="p-4 bg-white/[0.02] border-b border-white/5 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                    <Camera className="w-4 h-4 text-primary" />
                                    Site Inspection & Condition Flags
                                </CardTitle>
                                <CardDescription className="text-xs text-gray-400">
                                    Record pre-existing defects and site access notes with photo evidence.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 rounded-lg border border-white/10 transition">
                                    <input
                                        type="checkbox"
                                        checked={siteVisitDone}
                                        onChange={e => setSiteVisitDone(e.target.checked)}
                                        className="rounded text-primary"
                                    />
                                    <span className="text-xs font-semibold text-white">Site visit completed</span>
                                </label>
                            </div>
                        </CardHeader>

                        <CardContent className="p-4 space-y-5">
                            {/* Site Visit Attendance Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <Label className="text-[11px] text-gray-400">Site Visit Date</Label>
                                    <Input
                                        type="date"
                                        value={siteVisitDate}
                                        onChange={e => setSiteVisitDate(e.target.value)}
                                        className="h-9 text-xs mt-1 bg-background/50 border-white/10"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[11px] text-gray-400">Attended By</Label>
                                    <Input
                                        type="text"
                                        placeholder="e.g. John Doe / Flight Operations"
                                        value={siteVisitAttendedBy}
                                        onChange={e => setSiteVisitAttendedBy(e.target.value)}
                                        className="h-9 text-xs mt-1 bg-background/50 border-white/10"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <div className="w-full">
                                        <Label className="text-[11px] text-gray-400">Photographs Upload</Label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <label className="cursor-pointer flex items-center justify-center gap-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 rounded-lg px-3 py-2 text-xs font-semibold transition flex-1">
                                                <Camera className="w-3.5 h-3.5" />
                                                <span>Upload Photos</span>
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    onChange={handleAddPhotos}
                                                    className="hidden"
                                                />
                                            </label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleAddBlankPhoto}
                                                className="h-9 text-xs border-white/10 hover:bg-white/5"
                                            >
                                                + Photo Entry
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Uploaded Photos Gallery */}
                            {siteVisitPhotos.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                                            Inspection Photographs ({siteVisitPhotos.length})
                                        </span>
                                        <span className="text-[11px] text-gray-400">
                                            Auto-numbered 01, 02, 03…
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {siteVisitPhotos.map(photo => (
                                            <div key={photo.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-mono font-bold text-xs">
                                                        Photo {photo.photoNumber}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-400"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>

                                                {/* Photo Thumbnail */}
                                                <div className="aspect-[4/3] rounded bg-black/40 overflow-hidden flex items-center justify-center border border-white/5">
                                                    {photo.url ? (
                                                        <img src={photo.url} alt={`Photo ${photo.photoNumber}`} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1 text-gray-500 text-[10px]">
                                                            <Camera className="w-5 h-5" />
                                                            <span>No image</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Elevation Select */}
                                                <div>
                                                    <select
                                                        value={photo.elevation || ''}
                                                        onChange={e => handleUpdatePhoto(photo.id, { elevation: e.target.value })}
                                                        className="w-full h-7 text-xs rounded bg-background/60 border border-white/10 px-2 text-gray-200"
                                                    >
                                                        <option value="">Select elevation...</option>
                                                        {elevations.map(e => (
                                                            <option key={e.id} value={e.name}>{e.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Caption Input */}
                                                <div>
                                                    <Input
                                                        placeholder="Optional caption..."
                                                        value={photo.caption || ''}
                                                        onChange={e => handleUpdatePhoto(photo.id, { caption: e.target.value })}
                                                        className="h-7 text-xs bg-background/60 border-white/10"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Condition Flags Section - only available once "Site visit done" is ticked */}
                            <div className="pt-4 border-t border-white/10 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-[#D05E00]" />
                                            Pre-Clean Condition Flags ({conditionFlags.length})
                                        </h4>
                                        <p className="text-[11px] text-gray-400">
                                            {siteVisitDone
                                                ? "Identified during site visit. Printed in orange notice boxes on quote & carried to job sheet."
                                                : "Enable 'Site visit completed' above to add pre-clean condition flags."}
                                        </p>
                                    </div>

                                    {siteVisitDone && !isAddingFlag && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleStartAddFlag}
                                            className="h-8 text-xs bg-[#D05E00] hover:bg-[#B34E00] text-white flex items-center gap-1.5"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add Condition Flag</span>
                                        </Button>
                                    )}
                                </div>

                                {/* Condition Flags Inline Form */}
                                {siteVisitDone && isAddingFlag && (
                                    <div className="p-4 rounded-xl bg-white/[0.03] border border-[#D05E00]/40 space-y-4">
                                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                                                New Condition Flag
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setIsAddingFlag(false)}
                                                className="h-7 text-xs text-gray-400 hover:text-white"
                                            >
                                                Cancel
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {/* Elevation Dropdown */}
                                            <div>
                                                <Label className="text-[11px] text-gray-400">Elevation</Label>
                                                <select
                                                    value={flagElevation}
                                                    onChange={e => {
                                                        setFlagElevation(e.target.value);
                                                        setIsFlagWordingEdited(false);
                                                    }}
                                                    className="w-full h-9 text-xs rounded-md bg-background/70 border border-white/10 px-2.5 text-gray-200 mt-1"
                                                >
                                                    {elevations.map(e => (
                                                        <option key={e.id} value={e.name}>{e.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Location */}
                                            <div>
                                                <Label className="text-[11px] text-gray-400">Location (free text)</Label>
                                                <Input
                                                    placeholder="e.g. levels 3 and 4"
                                                    value={flagLocation}
                                                    onChange={e => {
                                                        setFlagLocation(e.target.value);
                                                        setIsFlagWordingEdited(false);
                                                    }}
                                                    className="h-9 text-xs mt-1 bg-background/70 border-white/10"
                                                />
                                            </div>

                                            {/* Condition Type Dropdown */}
                                            <div>
                                                <Label className="text-[11px] text-gray-400">Condition Type</Label>
                                                <select
                                                    value={flagConditionType}
                                                    onChange={e => {
                                                        setFlagConditionType(e.target.value);
                                                        setIsFlagWordingEdited(false);
                                                    }}
                                                    className="w-full h-9 text-xs rounded-md bg-background/70 border border-white/10 px-2.5 text-gray-200 mt-1"
                                                >
                                                    {Object.values(CONDITION_TYPE_PRESETS).map(preset => (
                                                        <option key={preset.id} value={preset.id}>
                                                            {preset.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* If OTHER condition type: custom inputs */}
                                        {flagConditionType === 'OTHER' && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg bg-black/20 border border-white/5">
                                                <div>
                                                    <Label className="text-[10px] text-gray-400">Condition wording</Label>
                                                    <Input
                                                        placeholder="e.g. surface corrosion"
                                                        value={flagCustomCondition}
                                                        onChange={e => {
                                                            setFlagCustomCondition(e.target.value);
                                                            setIsFlagWordingEdited(false);
                                                        }}
                                                        className="h-8 text-xs mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[10px] text-gray-400">Consequence sentence</Label>
                                                    <Input
                                                        placeholder="e.g. Will not be removed by washing."
                                                        value={flagCustomConsequence}
                                                        onChange={e => {
                                                            setFlagCustomConsequence(e.target.value);
                                                            setIsFlagWordingEdited(false);
                                                        }}
                                                        className="h-8 text-xs mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[10px] text-gray-400">Restoration item</Label>
                                                    <Input
                                                        placeholder="e.g. specialized restoration"
                                                        value={flagCustomRestoration}
                                                        onChange={e => {
                                                            setFlagCustomRestoration(e.target.value);
                                                            setIsFlagWordingEdited(false);
                                                        }}
                                                        className="h-8 text-xs mt-1"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Photo References multi-select */}
                                        {siteVisitPhotos.length > 0 && (
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <Label className="text-[11px] text-gray-400">
                                                        Attach Photographs {flagPhotoRefs.length > 0 && `(${formatPhotoRefs(flagPhotoRefs)})`}
                                                    </Label>
                                                    <span className="text-[10px] text-gray-400">
                                                        Shown as range on quote e.g. 04–09
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-black/30 border border-white/10">
                                                    {siteVisitPhotos.map(p => {
                                                        const isSelected = flagPhotoRefs.includes(p.photoNumber);
                                                        return (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFlagPhotoRefs(prev => 
                                                                        isSelected
                                                                            ? prev.filter(ref => ref !== p.photoNumber)
                                                                            : [...prev, p.photoNumber]
                                                                    );
                                                                    setIsFlagWordingEdited(false);
                                                                    setWarnNoPhotosSelected(false);
                                                                }}
                                                                className={`px-3 py-1.5 text-xs rounded-lg font-mono font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
                                                                    isSelected
                                                                        ? 'bg-[#D05E00] text-white border-[#D05E00] ring-2 ring-[#D05E00]/40 shadow-[#D05E00]/30'
                                                                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:border-white/20'
                                                                }`}
                                                            >
                                                                {isSelected ? (
                                                                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                                                ) : (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                                                                )}
                                                                <span>Photo {p.photoNumber}</span>
                                                                {p.elevation && <span className="text-[10px] opacity-75 font-normal font-sans">({p.elevation})</span>}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Auto-generated wording preview & edit */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[11px] text-[#D05E00] font-bold">
                                                    Generated Notice Box Wording (Editable before saving)
                                                </Label>
                                                {isFlagWordingEdited && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsFlagWordingEdited(false);
                                                            setFlagCustomWording(computedFlagWording);
                                                        }}
                                                        className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                        <span>Reset to auto</span>
                                                    </button>
                                                )}
                                            </div>
                                            <textarea
                                                rows={3}
                                                value={flagCustomWording}
                                                onChange={e => {
                                                    setFlagCustomWording(e.target.value);
                                                    setIsFlagWordingEdited(true);
                                                }}
                                                className="w-full text-xs font-mono rounded-lg bg-black/40 border border-white/10 p-3 text-gray-200 focus:outline-none focus:border-[#D05E00] leading-relaxed"
                                            />
                                            {(flagConditionType === 'CRACKED_GLAZING' || flagConditionType === 'LOOSE_RENDER_CLADDING') && (
                                                <p className="text-[11px] text-amber-400 flex items-center gap-1 pt-1">
                                                    <AlertTriangle className="w-3.5 h-3.5" />
                                                    <span>{`Note: Saving this flag will automatically add "${flagLocation || 'this location'}" to ${flagElevation}'s exclusions.`}</span>
                                                </p>
                                            )}
                                        </div>

                                        {/* Warning when no photos are selected */}
                                        {warnNoPhotosSelected && (
                                            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-in fade-in">
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                                                    <span>No defect photos selected for this flag. Are you sure you want to proceed without attaching photos?</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => handleSaveFlag(true)}
                                                        className="h-7 px-3 text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold"
                                                    >
                                                        Save Anyway
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setWarnNoPhotosSelected(false)}
                                                        className="h-7 px-2 text-xs text-gray-400 hover:text-white"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Save Button */}
                                        <div className="flex justify-end gap-2 pt-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setIsAddingFlag(false);
                                                    setWarnNoPhotosSelected(false);
                                                }}
                                                className="h-8 text-xs text-gray-400"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => handleSaveFlag(false)}
                                                className="h-8 text-xs bg-[#D05E00] hover:bg-[#B34E00] text-white font-bold"
                                            >
                                                Save Condition Flag
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* List of active condition flags */}
                                {conditionFlags.length > 0 && (
                                    <div className="space-y-3">
                                        {conditionFlags.map(flag => (
                                            <div
                                                key={flag.id}
                                                className="bg-[#FFF7ED] border-l-4 border-[#D05E00] p-3.5 rounded-r-xl space-y-1.5 shadow-sm text-zinc-900"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-xs text-[#9A3412] tracking-wide uppercase">
                                                            Existing condition noted
                                                        </span>
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#D05E00]/15 text-[#9A3412]">
                                                            {flag.elevation}
                                                        </span>
                                                        {flag.location && (
                                                            <span className="text-[10px] text-[#7C2D12]">
                                                                · {flag.location}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteFlag(flag.id)}
                                                        className="h-6 w-6 p-0 text-red-700 hover:text-red-900 hover:bg-red-100"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-[#7C2D12] leading-relaxed">
                                                    {flag.wording}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* SECTION 2: BUILDING & SITE PROVISIONS */}
                    <Card id="step-extras" className="border-white/10 bg-[#0F172A]/70">
                        <CardHeader className="p-4 bg-white/[0.02] border-b border-white/5">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary" />
                                Building & Site Provisions
                            </CardTitle>
                            <CardDescription className="text-xs text-gray-400">
                                Select additional services or site requirements for this engagement.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                {/* Occupied Building Provision */}
                                {isItemActive(15) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasOccupiedBuilding}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasOccupiedBuilding: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(15)?.name) || 'Occupied Building Provision'}</span>
                                        </label>
                                        <p className="text-[11px] text-gray-400">
                                            {getItem(15)?.clientDescription || 'Automatic 10% provision of all cleaning lines for tenant notifications and interrupted access.'}
                                        </p>
                                    </div>
                                )}

                                {/* Site Visit & Facade Assessment (R0) */}
                                {isItemActive(11) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasSiteVisit}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasSiteVisit: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(11)?.name) || 'Site Visit & Facade Assessment'}</span>
                                        </label>
                                        <p className="text-[11px] text-emerald-400 font-bold">
                                            R0 – Shown as &quot;No charge&quot; on client quote
                                        </p>
                                    </div>
                                )}

                                {/* Service Photo Record */}
                                {isItemActive(14) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasPhotoRecord}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasPhotoRecord: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(14)?.name) || 'Service Photo Record'}</span>
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

                                {/* Roof Maintenance Clean */}
                                {isItemActive(5) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasRoofClean}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasRoofClean: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(5)?.name) || 'Roof Maintenance Clean'}</span>
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

                                {/* Solar Array Clean */}
                                {isItemActive(6) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasSolarClean}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasSolarClean: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(6)?.name) || 'Solar Array Clean'}</span>
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

                                {/* Signage & Entrance Features */}
                                {isItemActive(7) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasSignage}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasSignage: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(7)?.name) || 'Signage & Entrance Features'}</span>
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

                                {/* Bird Fouling Removal */}
                                {isItemActive(8) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasBirdFouling}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasBirdFouling: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(8)?.name) || 'Bird Fouling Removal'}</span>
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

                                {/* Post-Construction Exterior Clean */}
                                {isItemActive(10) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasPostConstruction}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasPostConstruction: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(10)?.name) || 'Post-Construction Exterior Clean'}</span>
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

                                {/* Facade Condition Survey (Settings Gated) */}
                                {surveyCameraEnabled && isItemActive(12) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasFacadeSurvey}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasFacadeSurvey: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(12)?.name) || 'Facade Condition Survey'}</span>
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

                                {/* Thermal Roof Survey (Settings Gated) */}
                                {thermalCameraEnabled && isItemActive(13) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasThermalSurvey}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasThermalSurvey: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(13)?.name) || 'Thermal Roof Survey'}</span>
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

                                {/* Out-of-Hours Service */}
                                {isItemActive(17) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasOutOfWeekHours}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasOutOfWeekHours: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(17)?.name) || 'Out-of-Hours Service'}</span>
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

                                {/* Water Supply – Site Provision */}
                                {isItemActive(18) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasWaterSupplySite}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasWaterSupplySite: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(18)?.name) || 'Water Supply – Site Provision'}</span>
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

                                {/* Regional Water Provision */}
                                {isItemActive(19) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasRegionalWater}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasRegionalWater: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(19)?.name) || 'Regional Water Provision'}</span>
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

                                {/* Extended Travel */}
                                {isItemActive(20) && (
                                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                            <input
                                                type="checkbox"
                                                checked={siteProvisions.hasExtendedTravel}
                                                onChange={e => setSiteProvisions(p => ({ ...p, hasExtendedTravel: e.target.checked }))}
                                                className="rounded text-primary"
                                            />
                                            <span>{cleanItemLabel(getItem(20)?.name) || 'Extended Travel'}</span>
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
                    </Card>

                    {/* SECTION 3: CONTRACT PROGRAMMES & PRE-SEND CHECKS */}
                    <div id="step-contract" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border-white/10 bg-[#0F172A]/70">
                            <CardHeader className="p-4 bg-white/[0.02] border-b border-white/5">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    Contract Programmes (Whole Quote)
                                </CardTitle>
                                <CardDescription className="text-xs text-gray-400">
                                    Choose whether this quotation is once-off or an ongoing maintenance contract.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3 text-xs">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="programme"
                                            value="ONCE_OFF"
                                            checked={programme === 'ONCE_OFF'}
                                            onChange={() => setProgramme('ONCE_OFF')}
                                        />
                                        <span className="font-bold">Once-off Service (No contract discount)</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="programme"
                                            value="BIANNUAL"
                                            checked={programme === 'BIANNUAL'}
                                            disabled={isLandmark}
                                            onChange={() => setProgramme('BIANNUAL')}
                                        />
                                        <span>Biannual Maintenance (2 visits/yr – 10% discount)</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="programme"
                                            value="QUARTERLY"
                                            checked={programme === 'QUARTERLY'}
                                            disabled={isLandmark}
                                            onChange={() => setProgramme('QUARTERLY')}
                                        />
                                        <span>Quarterly Maintenance (4 visits/yr – 15% discount)</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="programme"
                                            value="MONTHLY"
                                            checked={programme === 'MONTHLY'}
                                            disabled={isLandmark}
                                            onChange={() => setProgramme('MONTHLY')}
                                        />
                                        <span>Monthly Maintenance (12 visits/yr – 20% discount)</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="programme"
                                            value="MONTHLY_QUARTERLY_COMBINED"
                                            checked={programme === 'MONTHLY_QUARTERLY_COMBINED'}
                                            disabled={isLandmark}
                                            onChange={() => setProgramme('MONTHLY_QUARTERLY_COMBINED')}
                                        />
                                        <span>Monthly Glazing + Quarterly Full Facade (8 glazing + 4 full facade)</span>
                                    </label>
                                </div>

                                <div className="pt-2 border-t border-white/5">
                                    <label className="flex items-center gap-2 cursor-pointer text-amber-300 font-bold">
                                        <input
                                            type="checkbox"
                                            checked={isLandmark}
                                            onChange={e => setIsLandmark(e.target.checked)}
                                            className="rounded text-primary"
                                        />
                                        <span>Prestige building: first quote once-off only, no contract discount</span>
                                    </label>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Pre-Send Compliance Checks */}
                        <Card className="border-white/10 bg-[#0F172A]/70">
                            <CardHeader className="p-4 bg-white/[0.02] border-b border-white/5">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    Pre-Send Compliance Checklist
                                </CardTitle>
                                <CardDescription className="text-xs text-gray-400">
                                    Required before generating client PDF or sending.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3 text-xs">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={siteVisitDone}
                                        onChange={e => setSiteVisitDone(e.target.checked)}
                                        className="rounded text-primary"
                                    />
                                    <span>Site visit completed (Required if Pre-Treatment used or quote &gt; R50,000)</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={contractorSpecReceived}
                                        onChange={e => setContractorSpecReceived(e.target.checked)}
                                        className="rounded text-primary"
                                    />
                                    <span>Contractor specification received (Required if Pre-Coating Wash used)</span>
                                </label>

                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1 text-[11px] text-gray-400 font-mono">
                                    <div>Floor Rule: R{MINIMUM_FLOOR_RATE_PER_M2.toFixed(2)}/m² minimum effective rate</div>
                                    <div>Minimum Job: R{MINIMUM_JOB_AMOUNT.toLocaleString()} (Auto-raised if lower)</div>
                                    <div>Rounding: All line totals rounded up to the next R50</div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            ) : (
                /* SECTION 4: CLIENT VIEW (Strictly Clean, No Internal Fields) */
                <Card id="step-preview" className="border-white/10 bg-[#0F172A]/90 p-6 space-y-6">
                    <div className="border-b border-white/10 pb-4 flex justify-between items-center">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                                Client Facing Output Preview
                            </span>
                            <h3 className="text-lg font-bold text-white mt-1">
                                Quotation Breakdown (As seen by client)
                            </h3>
                            <p className="text-xs text-gray-400">
                                Stripped of m², heights, bands, rates, percentages, chemicals, and internal notes.
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-gray-400">Status</span>
                            <div className="text-sm font-bold text-primary">Fixed Price Quote</div>
                        </div>
                    </div>

                    {/* Scope of Works Block */}
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-wider text-primary">
                            SCOPE OF WORKS
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">
                            {scopeOfWorks || autoGeneratedScope}
                        </p>
                    </div>

                    {/* Client Lines Table */}
                    <div className="space-y-4">
                        {Array.from(new Set(calculation.clientItems.map(i => i.area))).map(areaName => {
                            const matchingFlags = conditionFlags.filter(f => f.elevation === areaName);
                            return (
                                <div key={areaName} className="space-y-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                                        {areaName}
                                    </h4>
                                    <div className="space-y-2">
                                        {calculation.clientItems
                                            .filter(item => item.area === areaName)
                                            .map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
                                                >
                                                    <div className="space-y-1 max-w-2xl">
                                                        <div className="text-sm font-bold text-white">{item.name}</div>
                                                        <div className="text-xs text-gray-400 leading-relaxed">
                                                            {item.description}
                                                        </div>
                                                    </div>
                                                    <div className="text-base font-bold text-white font-mono shrink-0">
                                                        {item.amount === 0 ? (
                                                            <span className="text-emerald-400">No charge</span>
                                                        ) : (
                                                            formatCurrency(item.amount, currencySymbol)
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                        {/* Orange Notice Box for Condition Flags under this elevation */}
                                        {matchingFlags.map(flag => (
                                            <div key={flag.id} className="bg-[#FFF7ED] border-l-4 border-[#D05E00] p-3.5 rounded-r-xl space-y-1 my-2 text-zinc-900">
                                                <div className="font-bold text-xs text-[#9A3412] tracking-wide uppercase">
                                                    Existing condition noted
                                                </div>
                                                <div className="text-xs text-[#7C2D12] leading-relaxed">
                                                    {flag.wording}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Totals Summary */}
                    <div className="border-t border-white/10 pt-4 flex justify-end">
                        <div className="w-80 space-y-2">
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>Subtotal</span>
                                <span className="font-mono text-white">{formatCurrency(calculation.subtotal, currencySymbol)}</span>
                            </div>

                            {/* VAT Line ONLY if VAT registered */}
                            {hasVatRegistration ? (
                                <div className="flex justify-between text-sm text-gray-400">
                                    <span>VAT ({vatRate}%)</span>
                                    <span className="font-mono text-white">{formatCurrency(calculation.taxAmount, currencySymbol)}</span>
                                </div>
                            ) : null}

                            <div className="border-t border-white/10 pt-2 flex justify-between text-lg font-black text-white">
                                <span>TOTAL DUE</span>
                                <span className="font-mono text-primary">{formatCurrency(calculation.total, currencySymbol)}</span>
                            </div>

                            {calculation.programmeInfo.id !== 'ONCE_OFF' && (
                                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs space-y-1 mt-2">
                                    <div className="font-bold text-white">{calculation.programmeInfo.name}</div>
                                    <div className="flex justify-between text-gray-300">
                                        <span>Visits per year:</span>
                                        <span className="font-bold">{calculation.programmeInfo.visitsPerYear}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-300">
                                        <span>Price per visit:</span>
                                        <span className="font-mono font-bold text-primary">
                                            {formatCurrency(calculation.total, currencySymbol)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-gray-400 text-[11px] pt-1 border-t border-white/5">
                                        <span>Annual Total:</span>
                                        <span className="font-mono font-bold text-white">
                                            {formatCurrency(calculation.total * calculation.programmeInfo.visitsPerYear, currencySymbol)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Appendix: Site Inspection Photographs */}
                    {siteVisitPhotos.length > 0 && (
                        <div className="border-t border-white/10 pt-6 space-y-4">
                            <div className="text-[11px] font-black uppercase tracking-wider text-primary">
                                APPENDIX: SITE INSPECTION PHOTOGRAPHS
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {siteVisitPhotos.map(photo => (
                                    <div key={photo.id} className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden p-3 space-y-2">
                                        <div className="aspect-[4/3] bg-black/40 rounded-lg flex items-center justify-center overflow-hidden border border-white/5">
                                            {photo.url ? (
                                                <img src={photo.url} alt={`Photo ${photo.photoNumber}`} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-gray-500 text-xs">No image</div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-primary font-mono">Photo {photo.photoNumber}</span>
                                            <span className="text-gray-400 text-[10px] truncate max-w-[120px]">{photo.elevation}</span>
                                        </div>
                                        {photo.caption && (
                                            <p className="text-[11px] text-gray-300 leading-tight">{photo.caption}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Bottom Live Summary Bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#1E293B] to-[#0F172A] border border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Calculated Area</span>
                        <div className="text-sm font-bold text-white font-mono">
                            {calculation.totalCalculatedArea.toFixed(1)} m²
                        </div>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Effective Rate</span>
                        <div className="text-sm font-bold text-white font-mono">
                            R{(calculation.totalCalculatedArea > 0 ? (calculation.subtotal / calculation.totalCalculatedArea) : 0).toFixed(2)}/m²
                        </div>
                    </div>
                    {calculation.minimumJobRaised && (
                        <>
                            <div className="h-8 w-px bg-white/10" />
                            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-bold uppercase font-mono">
                                Minimum Job Floor Applied (R7,500)
                            </span>
                        </>
                    )}
                </div>

                <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Total Quote Amount</span>
                    <div className="text-2xl font-black text-white font-mono">
                        {formatCurrency(calculation.total, currencySymbol)}
                    </div>
                </div>
            </div>
        </div>
    );
}
