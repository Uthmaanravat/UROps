// Rate Card Rev 13 - AeroWash Catalogue Definitions & Pricing Logic

export interface BandInfo {
    band: 'A' | 'B' | 'C' | 'D' | 'E';
    minHeight: number;
    maxHeight: number;
    rate: number; // R per m²
    edgeWarning?: string;
    isNearEdge?: boolean;
}

export const RATE_CARD_BANDS: Record<'A' | 'B' | 'C' | 'D' | 'E', { min: number; max: number; rate: number }> = {
    A: { min: 0, max: 10.5, rate: 16 },
    B: { min: 10.5, max: 21.0, rate: 20 },
    C: { min: 21.0, max: 35.0, rate: 24 },
    D: { min: 35.0, max: 52.5, rate: 28 },
    E: { min: 52.5, max: 999.0, rate: 34 }
};

export const BAND_EDGES = [10.5, 21.0, 35.0, 52.5];

export function getBandFromHeight(height: number): BandInfo {
    const h = Math.max(0, height);
    let band: 'A' | 'B' | 'C' | 'D' | 'E' = 'A';

    if (h <= 10.5) {
        band = 'A';
    } else if (h <= 21.0) {
        band = 'B';
    } else if (h <= 35.0) {
        band = 'C';
    } else if (h <= 52.5) {
        band = 'D';
    } else {
        band = 'E';
    }

    // Warn within 2 m of a band edge
    let isNearEdge = false;
    let edgeWarning: string | undefined;

    for (const edge of BAND_EDGES) {
        if (Math.abs(h - edge) <= 2.0) {
            isNearEdge = true;
            edgeWarning = 'Confirm height with laser';
            break;
        }
    }

    return {
        band,
        minHeight: RATE_CARD_BANDS[band].min,
        maxHeight: RATE_CARD_BANDS[band].max,
        rate: RATE_CARD_BANDS[band].rate,
        isNearEdge,
        edgeWarning
    };
}

export function roundToNearest50(amount: number): number {
    if (amount <= 0) return 0;
    return Math.ceil(amount / 50) * 50;
}
export const roundToNext50 = roundToNearest50;

export interface CatalogueItemDef {
    itemNumber: number;
    name: string;
    clientDescription: string;
    category: 'CLEANING' | 'ASSESSMENT & REPORTING' | 'SITE CONDITIONS' | 'CONTRACTS';
    pricingMethod: string;
    internalNotes?: string;
    isProvisional?: boolean;
    requiresElevation?: boolean;
    requiresSiteVisitDone?: boolean;
    requiresContractorSpec?: boolean;
    settingsKeyRequired?: 'surveyCameraEnabled' | 'thermalCameraEnabled';
    adminHelpText?: string;
}

export const AEROWASH_CATALOGUE_ITEMS: CatalogueItemDef[] = [
    // CATEGORY: CLEANING
    {
        itemNumber: 1,
        name: 'Exterior Glazing Maintenance Clean – [Elevation]',
        clientDescription:
            'Drone cleaning of all windows, glazing and frames across this face of the building, excluding balcony areas (see Balcony & Detail Areas). Removes dirt, pollution, salt and light grime, leaving the glazing visibly clean across the elevation.',
        category: 'CLEANING',
        pricingMethod: 'ELEVATION_BAND',
        internalNotes: 'FULL elevation width × height (never glass area only) × band rate. Warn within 2 m of band edge: Confirm height with laser.',
        requiresElevation: true
    },
    {
        itemNumber: 2,
        name: 'Full Facade Maintenance Clean – [Elevation]',
        clientDescription:
            'Drone cleaning of the full face of the building: windows, frames, walls, cladding and concrete surfaces, excluding balcony areas (see Balcony & Detail Areas). Completed in a single visit.',
        category: 'CLEANING',
        pricingMethod: 'ELEVATION_UPLIFT_15',
        internalNotes: 'Item 1 +15% (PROVISIONAL). A "Mostly-glass tower" tickbox removes the uplift. Option to show items 1 and 2 side by side on client quote as alternatives.',
        isProvisional: true,
        requiresElevation: true
    },
    {
        itemNumber: 3,
        name: 'Balcony & Detail Areas – [Elevation]',
        clientDescription:
            'Cleaning of balcony soffits, window reveals, returns and balustrade glass on this face of the building.',
        category: 'CLEANING',
        adminHelpText: 'Cleaning of balconies, window edges and balcony glass. Tick when this side has balconies: 10% = a few, 12% = about half the floors, 15% = nearly every floor.',
        pricingMethod: 'BALCONY_PERCENT',
        internalNotes: '% of that elevation area at its band rate, default 12% (range 10–15%).',
        requiresElevation: true
    },
    {
        itemNumber: 4,
        name: 'Stain & Growth Pre-Treatment',
        clientDescription:
            'Pre-treatment of organic growth and surface staining before the maintenance clean, where soiling is heavier than routine. Staining that has penetrated the substrate cannot be removed by cleaning.',
        category: 'CLEANING',
        adminHelpText: 'Treating green growth or dark stains before cleaning. Tick only when the building is dirtier than normal (green patches, black streaks, not cleaned in 1–2 years). Needs a site visit first. Not for normal dirt.',
        pricingMethod: 'PRE_TREATMENT_PERCENT',
        internalNotes: '% of the elevation price, default 25% (range 25–30%, PROVISIONAL). Requires "Site visit done" before the quote can be sent.',
        isProvisional: true,
        requiresSiteVisitDone: true
    },
    {
        itemNumber: 5,
        name: 'Roof Maintenance Clean',
        clientDescription:
            'Soft wash treatment of roof surfaces to remove organic growth, dirt and accumulated debris.',
        category: 'CLEANING',
        pricingMethod: 'PRICE_ON_QUOTE',
        internalNotes: 'Soft wash treatment. Low pressure < 10 bar.'
    },
    {
        itemNumber: 6,
        name: 'Solar Array Maintenance Clean',
        clientDescription:
            'Pure water clean of photovoltaic panel surfaces. No detergents or abrasives are used, and no contact is made with panel wiring or mountings.',
        category: 'CLEANING',
        pricingMethod: 'SOLAR_PER_PANEL',
        internalNotes: 'Per panel: R6 client-supplied water / R10 AeroWash-supplied water. Ask panel count + water source.'
    },
    {
        itemNumber: 7,
        name: 'Signage & Entrance Features',
        clientDescription:
            'Cleaning of building signage, entrance canopies and awnings.',
        category: 'CLEANING',
        pricingMethod: 'PRICE_ON_QUOTE'
    },
    {
        itemNumber: 8,
        name: 'Bird Fouling Removal',
        clientDescription:
            'Treatment and removal of bird fouling from facade surfaces, ledges and roof areas. Heavy or baked-on fouling is assessed on site and quoted separately.',
        category: 'CLEANING',
        pricingMethod: 'PRICE_ON_QUOTE',
        internalNotes: 'Heavy/baked-on assessed on site.'
    },
    {
        itemNumber: 9,
        name: 'Pre-Coating Facade Wash',
        clientDescription:
            'Facade wash in preparation for painting or protective coating, to the contractor\'s written specification, which must be supplied before work starts. AeroWash is not responsible for coating adhesion or performance.',
        category: 'CLEANING',
        adminHelpText: 'Washing a building before it gets painted. Tick only when a painting contractor/client asks for it. Needs their written specification.',
        pricingMethod: 'PRE_COATING_ELEVATION',
        internalNotes: 'Price as item 2 per elevation. Requires "Contractor specification received" tick before sending.',
        requiresContractorSpec: true,
        requiresElevation: true
    },
    {
        itemNumber: 10,
        name: 'Post-Construction Exterior Clean',
        clientDescription:
            'Removal of construction dust, residue and marking from exterior surfaces following building or refurbishment work. Hardened cement, paint and adhesive residue are excluded.',
        category: 'CLEANING',
        pricingMethod: 'PRICE_ON_QUOTE'
    },

    // CATEGORY: ASSESSMENT & REPORTING
    {
        itemNumber: 11,
        name: 'Site Visit & Facade Assessment',
        clientDescription:
            'On-site visit to confirm scope, condition, access and water supply, with a photographic record of the building taken before work starts.',
        category: 'ASSESSMENT & REPORTING',
        pricingMethod: 'NO_CHARGE',
        internalNotes: 'R0, shown as "No charge". Required before sending if: item 4 used, landmark flag, or quote over R50,000.'
    },
    {
        itemNumber: 12,
        name: 'Facade Condition Survey',
        clientDescription:
            'High-resolution aerial photographic survey of the facade, supplied as a referenced report by elevation. Identifies visible defects, staining, sealant condition and areas needing attention.',
        category: 'ASSESSMENT & REPORTING',
        pricingMethod: 'PRICE_ON_QUOTE',
        settingsKeyRequired: 'surveyCameraEnabled',
        internalNotes: 'Hidden until "Survey camera enabled" in Settings.'
    },
    {
        itemNumber: 13,
        name: 'Thermal Roof Survey',
        clientDescription:
            'Thermal imaging survey of roof surfaces, identifying areas of moisture retention and suspected membrane failure.',
        category: 'ASSESSMENT & REPORTING',
        pricingMethod: 'PRICE_ON_QUOTE',
        settingsKeyRequired: 'thermalCameraEnabled',
        internalNotes: 'Hidden until "Thermal camera enabled" in Settings.'
    },
    {
        itemNumber: 14,
        name: 'Service Photo Record',
        clientDescription:
            'Photographic record of each elevation before and after service, supplied with the completion report.',
        category: 'ASSESSMENT & REPORTING',
        pricingMethod: 'PRICE_ON_QUOTE',
        internalNotes: 'Price on quote (R0 allowed, shown as "Included").'
    },

    // CATEGORY: SITE CONDITIONS
    {
        itemNumber: 15,
        name: 'Occupied Building Provision',
        clientDescription:
            'Provision for working around building occupancy: advance tenant notification, restricted working windows, and interrupted access to elevations in use.',
        category: 'SITE CONDITIONS',
        pricingMethod: 'OCCUPIED_PERCENT',
        internalNotes: '10% of the cleaning lines it applies to.'
    },
    {
        itemNumber: 16,
        name: 'Extended Soiling Provision',
        clientDescription:
            'Provision for additional treatment time where accumulated soiling exceeds routine maintenance levels, confirmed on site before work starts.',
        category: 'SITE CONDITIONS',
        adminHelpText: 'Extra time for very heavy dirt, confirmed at the site visit. Do not tick together with Pre-Treatment on the same side.',
        pricingMethod: 'PRICE_ON_QUOTE',
        internalNotes: 'Price on quote. Warn if used with item 4 on the same elevation ("possible double charge"); allow override.'
    },
    {
        itemNumber: 17,
        name: 'Out-of-Hours Service',
        clientDescription:
            'Service carried out outside standard working hours, during daylight, at the client\'s request.',
        category: 'SITE CONDITIONS',
        adminHelpText: 'Tick when the building has active occupants, retail entrances, or open balconies requiring cordons and traffic marshals.',
        pricingMethod: 'PRICE_ON_QUOTE',
        internalNotes: 'Price on quote. Internal note: no night flying (no SACAA night approval).'
    },
    {
        itemNumber: 18,
        name: 'Water Supply – Site Provision',
        clientDescription:
            'Water supplied to site by AeroWash where no suitable point of supply is available within reach of the work area.',
        category: 'SITE CONDITIONS',
        adminHelpText: 'Tick when operations must occur outside standard weekday hours (e.g. night work or weekend cleaning).',
        pricingMethod: 'PRICE_ON_QUOTE',
        internalNotes: 'Price on quote, NOT R0 default.'
    },
    {
        itemNumber: 19,
        name: 'Regional Water Provision',
        clientDescription:
            'Additional water treatment for a spot-free finish where local water is high in dissolved solids.',
        category: 'SITE CONDITIONS',
        adminHelpText: 'Additional water treatment for Atlantis (R0.30/L) or Simon\'s Town/desalination zones (R0.85/L).',
        pricingMethod: 'REGIONAL_WATER_PER_LITRE',
        internalNotes: 'Internal: Atlantis R0.30/L, Simon\'s Town & desalination zones R0.85/L.'
    },
    {
        itemNumber: 20,
        name: 'Extended Travel',
        clientDescription:
            'Travel provision for sites beyond the standard service area (see Terms).',
        category: 'SITE CONDITIONS',
        adminHelpText: 'Travel provision for sites beyond the standard service area.',
        pricingMethod: 'PRICE_ON_QUOTE'
    },
    {
        itemNumber: 21,
        name: 'Scheduled Maintenance Programme – [Biannual / Quarterly / Monthly]',
        clientDescription:
            'Scheduled maintenance visits on fixed, pre-agreed dates.',
        category: 'CONTRACTS',
        pricingMethod: 'CONTRACT_PROGRAMME_DISCOUNT',
        internalNotes: 'Discount: Biannual −10%, Quarterly −15%, Monthly −20%. Client sees price per visit + visits per year, no percentages.'
    },
    {
        itemNumber: 22,
        name: 'Monthly Glazing + Quarterly Full Facade Programme',
        clientDescription:
            'Monthly window and glazing maintenance, with a full facade clean included every quarter in the same visit.',
        category: 'CONTRACTS',
        pricingMethod: 'CONTRACT_COMBINED_PROGRAMME',
        internalNotes: '= 8 × item 1 + 4 × item 2 per year at the monthly rate, generated as recurring visits. Landmark flag forces Once-off + Full facade on first quote.'
    },
    {
        itemNumber: 23,
        name: 'Low-Level & Detail Hand Clean',
        clientDescription:
            'Hand cleaning of ground-level glazing, entrances and detail areas that are not reachable by drone, completed as part of the same visit.',
        category: 'CLEANING',
        pricingMethod: 'PRICE_ON_QUOTE',
        adminHelpText: 'Hand cleaning of what the drone cannot reach: ground-floor glass below ~3 m, entrance doors, deep window recesses.'
    },
    {
        itemNumber: 24,
        name: 'Specialist Access Restoration Clean – [Elevation]',
        clientDescription:
            'Restoration clean of heavily soiled facade areas using specialist access methods, carried out ahead of the AeroWash maintenance programme.',
        category: 'CLEANING',
        pricingMethod: 'SUBCONTRACTOR_MARKUP',
        internalNotes: 'Subcontractor cost + markup % (default 20%, editable in Settings), rounded up to next R50. Client sees only amount. Requires subcontractor name, quote reference, quote amount, and subcontractor insurance confirmed tick.',
        requiresElevation: true,
        adminHelpText: 'Restoration clean using specialist access (rope access / scaffolding) ahead of regular AeroWash maintenance. Use when elevation condition is Heavy.'
    }
];

// CONTRACT PROGRAMMES (applied to the whole quote, not a line item)
export const CONTRACT_PROGRAMMES = {
    ONCE_OFF: { id: 'ONCE_OFF', name: 'Once-off Service', discount: 0, visitsPerYear: 1 },
    BIANNUAL: { id: 'BIANNUAL', name: 'Scheduled Maintenance Programme – Biannual', discount: 0.10, visitsPerYear: 2 },
    QUARTERLY: { id: 'QUARTERLY', name: 'Scheduled Maintenance Programme – Quarterly', discount: 0.15, visitsPerYear: 4 },
    MONTHLY: { id: 'MONTHLY', name: 'Scheduled Maintenance Programme – Monthly', discount: 0.20, visitsPerYear: 12 },
    MONTHLY_QUARTERLY_COMBINED: {
        id: 'MONTHLY_QUARTERLY_COMBINED',
        name: 'Monthly Glazing + Quarterly Full Facade Programme',
        discount: 0.20,
        visitsPerYear: 12,
        glazingVisits: 8,
        fullFacadeVisits: 4
    }
};

export const CONTRACT_PROGRAMME_DESCRIPTIONS = {
    BIANNUAL: 'Scheduled maintenance visits on fixed, pre-agreed dates (2 visits per year).',
    QUARTERLY: 'Scheduled maintenance visits on fixed, pre-agreed dates (4 visits per year).',
    MONTHLY: 'Scheduled maintenance visits on fixed, pre-agreed dates (12 visits per year).',
    MONTHLY_QUARTERLY_COMBINED: 'Monthly window and glazing maintenance, with a full facade clean included every quarter in the same visit (8 glazing visits + 4 full facade visits per year).'
};

// BUILDER RULES CONSTANTS
export const MINIMUM_JOB_AMOUNT = 7500;
export const MINIMUM_FLOOR_RATE_PER_M2 = 12.0;

// AEROWASH STANDARD TERMS
export const AEROWASH_STANDARD_TERMS_NAME = 'AeroWash Standard Quotation Terms';

export const AEROWASH_STANDARD_TERMS_BODY = `INCLUDED
Auto-list the items on this quote by name, then always add:
• Pre- and post-clean photographic record
• All labour, equipment and remote pilot crew

EXCLUDED
Auto-list first, in bold: exclusions ticked on the quote's elevations + cracked/damaged condition-flag locations. Then always:
• Internal faces of glass, unless separately agreed
• Hardened cement, paint and adhesive residue
• Repair of existing damage, failed sealant or penetrated staining

CONDITIONS OF ACCESS
• The client provides access to the work area and a water supply point within reach of it (unless Water Supply – Site Provision is quoted), and notifies tenants where required.
• All flight operations are conducted in line with South African Civil Aviation Authority (SACAA) regulations, during daylight hours only.
• Work is weather-dependent. Where wind, rain or visibility make flying unsafe, AeroWash will reschedule at no charge to the next available date.
• The standard service area is within 50 km of Parow, Cape Town. Sites beyond this carry an Extended Travel provision.

COMMERCIAL TERMS
• Quotations are fixed price for the scope and elevations stated.
• A 60% deposit is payable on acceptance to secure the booking.
• The balance is payable on completion.
• This quotation is valid for 45 days from the date of issue.
• Any variation or additional work is quoted separately before it is carried out.
• AeroWash (Pty) Ltd is not VAT-registered. No VAT charged.
• Where work cannot start, continue or be completed for reasons outside AeroWash's control, including site access not being available or work being stopped at the client's request, a standby or return attendance charge applies, agreed with you before it is invoiced.
• Existing damage, failed sealant, staining that has penetrated the substrate and other pre-existing defects are recorded before work starts and are not the responsibility of AeroWash.

NOTE ON INTRODUCTORY ALLOWANCE
Note on the introductory allowance. [Item names] are shown above at their standard value and are included at no charge on this first engagement only, as an introduction to our service. They will be quoted at standard rates on subsequent works.

ACCEPTANCE
To proceed, sign below and return, or confirm by email to info@aerowash.co.za.`;


/**
 * Auto-generates a client-facing Scope of Works description from selected items and site info.
 * Hard rule: Plain client language, NO passes, pressures, chemicals, water type/volumes.
 */
export function generateAeroWashScopeOfWorks(params: {
    siteName?: string;
    elevationNames?: string[];
    hasGlazing?: boolean;
    hasFullFacade?: boolean;
    hasRoofClean?: boolean;
    hasSolarClean?: boolean;
    hasSignage?: boolean;
    hasBirdFouling?: boolean;
    hasStainPreTreatment?: boolean;
    hasPostConstruction?: boolean;
    hasFacadeSurvey?: boolean;
    hasThermalSurvey?: boolean;
    hasHandClean?: boolean;
}): string {
    const siteStr = params.siteName ? ` at ${params.siteName}` : '';
    const elevStr = params.elevationNames && params.elevationNames.length > 0
        ? params.elevationNames.join(', ')
        : 'the exposed building elevations';

    const sentences: string[] = [];

    // Base sentence
    const cleanType = params.hasFullFacade ? 'full facade and window' : 'exterior maintenance';
    sentences.push(
        `Exterior maintenance cleaning of ${elevStr}${siteStr}, delivered by drone with no scaffolding, cradles, ladders or rope access and no obstruction of trading or parking.`
    );

    if (params.hasRoofClean) {
        sentences.push('Includes soft wash treatment of roof surfaces to remove organic growth and accumulated debris.');
    }
    if (params.hasSolarClean) {
        sentences.push('Includes pure water cleaning of the solar photovoltaic panel array.');
    }
    if (params.hasSignage) {
        sentences.push('Includes cleaning of building signage, entrance features and canopies.');
    }
    if (params.hasBirdFouling) {
        sentences.push('Includes targeted treatment and removal of bird fouling from facade surfaces, ledges and roof areas.');
    }
    if (params.hasStainPreTreatment) {
        sentences.push('Includes pre-treatment of organic growth and surface staining across affected facade areas.');
    }
    if (params.hasPostConstruction) {
        sentences.push('Includes removal of construction dust and residue from exterior surfaces.');
    }
    if (params.hasFacadeSurvey) {
        sentences.push('Includes high-resolution aerial photographic condition survey of the building envelope.');
    }
    if (params.hasThermalSurvey) {
        sentences.push('Includes thermal imaging survey of roof surfaces to inspect membrane integrity.');
    }
    if (params.hasHandClean) {
        sentences.push('Includes low-level and detail hand cleaning of ground-level glazing, entrances and architectural features.');
    }

    return sentences.join(' ');
}

// ============================================================================
// SITE INSPECTION & CONDITION FLAGS (AeroWash)
// ============================================================================

export interface SiteVisitPhoto {
    id: string;
    photoNumber: string; // "01", "02", etc.
    url: string;
    caption?: string;
    elevation?: string;
}

export interface ConditionTypePreset {
    id: string;
    label: string;
    condition: string;
    consequence: string;
    restoration: string;
    isExcludedFromCleaning?: boolean;
}

export const CONDITION_TYPE_PRESETS: Record<string, ConditionTypePreset> = {
    GLASS_ETCHING: {
        id: 'GLASS_ETCHING',
        label: 'Glass etching',
        condition: 'existing surface etching to the glass',
        consequence: 'This condition is in the glass and cannot be removed by cleaning. These panels will be washed but will retain a visible cloudy appearance afterwards.',
        restoration: 'glass restoration or replacement'
    },
    HARD_WATER: {
        id: 'HARD_WATER',
        label: 'Hard water / mineral staining',
        condition: 'mineral deposit staining to the glass',
        consequence: 'Deposits bonded to the glass may not be fully removed by maintenance cleaning and may remain visible afterwards.',
        restoration: 'glass restoration'
    },
    SCRATCHED_GLASS: {
        id: 'SCRATCHED_GLASS',
        label: 'Scratched glass',
        condition: 'existing scratching to the glass',
        consequence: 'Scratches are permanent damage and will remain visible after cleaning.',
        restoration: 'glass replacement'
    },
    FAILED_SEALANT: {
        id: 'FAILED_SEALANT',
        label: 'Failed or perished sealant',
        condition: 'failed or perished sealant to window and panel joints',
        consequence: 'Water may enter through these joints during washing. AeroWash will avoid direct spray on affected joints where practical.',
        restoration: 'sealant repair'
    },
    PENETRATED_STAINING: {
        id: 'PENETRATED_STAINING',
        label: 'Penetrated staining',
        condition: 'staining that has penetrated the substrate',
        consequence: 'This staining is within the surface and cannot be removed by cleaning.',
        restoration: 'surface restoration or repainting'
    },
    RUST_STREAKING: {
        id: 'RUST_STREAKING',
        label: 'Rust streaking',
        condition: 'rust streaking from fixings and metalwork',
        consequence: 'The source of the staining remains and streaking may return after cleaning.',
        restoration: 'metalwork repair or treatment'
    },
    EFFLORESCENCE: {
        id: 'EFFLORESCENCE',
        label: 'Efflorescence',
        condition: 'efflorescence (salt deposits) on masonry',
        consequence: 'Efflorescence is caused by moisture within the wall and may reappear after cleaning.',
        restoration: 'damp treatment'
    },
    CRACKED_GLAZING: {
        id: 'CRACKED_GLAZING',
        label: 'Cracked or damaged glazing',
        condition: 'cracked or damaged glazing',
        consequence: 'Affected panels will be excluded from cleaning to avoid further damage.',
        restoration: 'glass replacement',
        isExcludedFromCleaning: true
    },
    LOOSE_RENDER_CLADDING: {
        id: 'LOOSE_RENDER_CLADDING',
        label: 'Loose or damaged render/cladding',
        condition: 'loose or damaged render or cladding',
        consequence: 'Affected areas will be excluded from cleaning to avoid further damage.',
        restoration: 'facade repair',
        isExcludedFromCleaning: true
    },
    OTHER: {
        id: 'OTHER',
        label: 'Other',
        condition: '',
        consequence: '',
        restoration: ''
    }
};

export interface ConditionFlag {
    id: string;
    elevation: string;
    location: string;
    conditionType: string;
    conditionText?: string;
    consequenceText?: string;
    restorationText?: string;
    photoRefs: string[];
    wording: string;
}

/**
 * Formats a list of photo numbers into a range or list string (e.g. ['04', '05', '06', '07', '08', '09'] -> "04–09")
 */
export function formatPhotoRefs(refs: string[]): string {
    if (!refs || refs.length === 0) return '';
    const sorted = [...refs].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const nums = sorted.map(s => parseInt(s, 10));

    let isContiguous = nums.length > 1;
    for (let i = 1; i < nums.length; i++) {
        if (nums[i] !== nums[i - 1] + 1) {
            isContiguous = false;
            break;
        }
    }

    if (isContiguous && sorted.length >= 2) {
        return `${sorted[0]}–${sorted[sorted.length - 1]}`;
    }
    return sorted.join(', ');
}

/**
 * Returns formatted photograph reference parenthetical:
 * 1 photo: " (photograph 01 attached)"
 * multiple: " (photographs 01–02 attached)"
 */
export function formatPhotoSentenceRef(refs?: string[]): string {
    if (!refs || refs.length === 0) return '';
    const refStr = formatPhotoRefs(refs);
    if (!refStr) return '';
    if (refs.length === 1) {
        return ` (photograph ${refStr} attached)`;
    }
    return ` (photographs ${refStr} attached)`;
}

/**
 * Lowercases location text mid-sentence, unless it's a proper noun or level reference (e.g. "Level 4").
 */
export function formatLocationForSentence(text: string): string {
    if (!text) return '';
    const trimmed = text.trim();

    // Preserve words that are references to levels, floors, blocks, or acronyms
    return trimmed.replace(/\b([A-Za-z0-9–\-]+)\b/g, (match) => {
        const lower = match.toLowerCase();
        // Preserved capitalized words or user's exact case for level/floor
        if (['level', 'levels', 'floor', 'floors', 'block', 'unit', 'bay', 'tower'].includes(lower)) {
            return match;
        }
        // Roman numerals or acronyms
        if (/^(ii|iii|iv|v|vi|vii|viii|ix|x|hvac|cctv|db)$/i.test(match)) {
            return match.toUpperCase();
        }
        // If it starts with a number or digit (e.g. "2nd", "3rd"), leave as is
        if (/^\d/.test(match)) return match;
        // Default: lowercase mid-sentence (e.g. "Cracked Windows" -> "cracked windows")
        return lower;
    });
}

/**
 * Smarter wording generator for AeroWash condition flags:
 * - Natural phrasing reusing user's location input
 * - Lowercases mid-sentence words, keeps "Level 4", etc.
 * - Detects item vs place (e.g. "2 cracked windows" vs "Level 4" / "east end, levels 2–3")
 * - Distinguishes singular/plural ("This" vs "These")
 * - Full date format ("28 October 2026")
 * - Singular/plural photo reference ("photograph 01 attached" vs "photographs 01–02 attached")
 */
export function generateConditionFlagWording(params: {
    date: string;
    condition: string;
    elevation: string;
    location: string;
    photoRefs?: string[];
    consequence?: string;
    restoration?: string;
    isExcludedFromCleaning?: boolean;
}): string {
    const rawLoc = (params.location || '').trim();
    const formattedLoc = formatLocationForSentence(rawLoc);
    const photoStr = formatPhotoSentenceRef(params.photoRefs);

    // Format full date (e.g. "28 October 2026")
    let displayDate = params.date;
    if (displayDate && !isNaN(new Date(displayDate).getTime()) && displayDate.includes('-')) {
        displayDate = new Date(displayDate).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    // Determine if location is an ITEM/OBJECT (e.g. "2 cracked windows", "1 scratched panel")
    // vs a PLACE (e.g. "Level 4", "east end, levels 2–3", "Ground floor")
    const isPlacePrefix = /^(level|levels|floor|floors|bay|section|elevation|ground|roof|parapet|east|west|north|south|top|bottom|corner)/i.test(rawLoc);
    const startsWithCount = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\b/i.test(rawLoc);
    const hasItemNoun = /\b(window|windows|panel|panels|pane|panes|glass|render|cladding|joint|joints|seal|seals|tile|tiles|bracket|brackets|downpipe|gutter)\b/i.test(rawLoc);

    const isItem = startsWithCount || (hasItemNoun && !isPlacePrefix);

    // Check singular vs plural
    const isSingular = /^(\b1\b|one|a\b|an\b)/i.test(rawLoc) || (!startsWithCount && !/s\b/i.test(rawLoc));
    const pronoun = isSingular ? 'This' : 'These';

    // Target noun for place consequences (e.g. "The affected glazing", "The affected cladding")
    let affectedSubject = 'glazing';
    if (/render|cladding/i.test(params.condition) || /render|cladding/i.test(rawLoc)) {
        affectedSubject = 'cladding';
    } else if (/sealant|joint/i.test(params.condition) || /sealant|joint/i.test(rawLoc)) {
        affectedSubject = 'sealant joints';
    } else if (/efflorescence|masonry|brick/i.test(params.condition)) {
        affectedSubject = 'masonry';
    } else if (/metal|rust/i.test(params.condition)) {
        affectedSubject = 'metalwork';
    }

    let sentence1 = '';
    let consequenceSentence = '';

    const conditionLower = (params.condition || '').toLowerCase();

    if (isItem) {
        // Sentence 1: "Pre-clean inspection on [date] recorded [location] on the [elevation] (photographs...)"
        sentence1 = `Pre-clean inspection on ${displayDate} recorded ${formattedLoc} on the ${params.elevation}${photoStr}.`;

        // Consequence:
        if (params.isExcludedFromCleaning || conditionLower.includes('cracked') || conditionLower.includes('loose') || (params.consequence && params.consequence.toLowerCase().includes('excluded'))) {
            consequenceSentence = `${pronoun} will be excluded from cleaning to avoid further damage.`;
        } else if (conditionLower.includes('scratch') || conditionLower.includes('etch') || conditionLower.includes('permanent')) {
            consequenceSentence = `${pronoun} will remain visible after cleaning.`;
        } else if (params.consequence) {
            consequenceSentence = params.consequence
                .replace(/^Affected (panels|areas) will be/i, `${pronoun} will be`)
                .replace(/^These panels will be/i, `${pronoun} will be`)
                .replace(/^Scratches are permanent damage and will/i, `${pronoun} will`);
        }
    } else {
        // Location is a place: "Level 4", "east end, levels 2–3"
        // Sentence 1: "Pre-clean inspection on [date] recorded [condition] on the [elevation], [location] (photographs...)"
        const conditionText = params.condition || 'cracked or damaged glazing';
        sentence1 = `Pre-clean inspection on ${displayDate} recorded ${conditionText} on the ${params.elevation}, ${formattedLoc}${photoStr}.`;

        // Consequence for a place:
        if (params.isExcludedFromCleaning || conditionLower.includes('cracked') || conditionLower.includes('loose') || (params.consequence && params.consequence.toLowerCase().includes('excluded'))) {
            consequenceSentence = `The affected ${affectedSubject} will be excluded from cleaning to avoid further damage.`;
        } else if (conditionLower.includes('scratch')) {
            consequenceSentence = `The affected ${affectedSubject} will remain visible after cleaning.`;
        } else if (conditionLower.includes('etching')) {
            consequenceSentence = `The affected ${affectedSubject} will be washed but will retain a visible cloudy appearance afterwards.`;
        } else if (conditionLower.includes('sealant')) {
            consequenceSentence = `AeroWash will avoid direct spray on affected joints where practical.`;
        } else if (params.consequence) {
            consequenceSentence = params.consequence.replace(/^Affected (panels|areas)/i, `The affected ${affectedSubject}`);
        }
    }

    // Restoration sentence:
    let restorationSentence = '';
    if (params.restoration && params.restoration.trim()) {
        restorationSentence = `No allowance for ${params.restoration.trim()} is included in this quotation.`;
    }

    const full = [sentence1, consequenceSentence, restorationSentence].filter(Boolean).join(' ');
    return full.replace(/\s+/g, ' ').trim();
}

