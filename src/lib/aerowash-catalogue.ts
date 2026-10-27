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
    category: 'CLEANING' | 'ASSESSMENT & REPORTING' | 'SITE CONDITIONS';
    pricingMethod: string;
    internalNotes?: string;
    isProvisional?: boolean;
    requiresElevation?: boolean;
    requiresSiteVisitDone?: boolean;
    requiresContractorSpec?: boolean;
    settingsKeyRequired?: 'surveyCameraEnabled' | 'thermalCameraEnabled';
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
        pricingMethod: 'PRICE_ON_QUOTE',
        internalNotes: 'Price on quote. Warn if used with item 4 on the same elevation ("possible double charge"); allow override.'
    },
    {
        itemNumber: 17,
        name: 'Out-of-Hours Service',
        clientDescription:
            'Service carried out outside standard working hours, during daylight, at the client\'s request.',
        category: 'SITE CONDITIONS',
        pricingMethod: 'PRICE_ON_QUOTE',
        internalNotes: 'Price on quote. Internal note: no night flying (no SACAA night approval).'
    },
    {
        itemNumber: 18,
        name: 'Water Supply – Site Provision',
        clientDescription:
            'Water supplied to site by AeroWash where no suitable point of supply is available within reach of the work area.',
        category: 'SITE CONDITIONS',
        pricingMethod: 'PRICE_ON_QUOTE'
    },
    {
        itemNumber: 19,
        name: 'Regional Water Provision',
        clientDescription:
            'Additional water treatment for a spot-free finish where local water is high in dissolved solids.',
        category: 'SITE CONDITIONS',
        pricingMethod: 'REGIONAL_WATER_PER_LITRE',
        internalNotes: 'Per litre: Atlantis R0.30/L; Simon\'s Town & desalination zones R0.85/L. Builder asks estimated litres.'
    },
    {
        itemNumber: 20,
        name: 'Extended Travel',
        clientDescription:
            'Travel provision for sites beyond the standard service area (see Terms).',
        category: 'SITE CONDITIONS',
        pricingMethod: 'PRICE_ON_QUOTE'
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

export const AEROWASH_STANDARD_TERMS_BODY = `1. Scope and Fixed Price
Quotations are fixed price based on the scope, elevations and dimensions agreed at the time of quotation. Any variation or additional works requested will be quoted separately before execution. Prices exclude VAT. If AeroWash becomes VAT-registered, VAT will be added at the prevailing rate on invoices issued after the registration date.

2. Service Area
The standard service area is within 50 km of Parow, Cape Town. Sites beyond this carry an Extended Travel provision.

3. Weather
Work is weather-dependent. Where wind, rain or visibility make flying unsafe, AeroWash will reschedule at no charge to the next available date.

4. Client Responsibilities
The client provides access to the work area and a water supply point within reach of it (unless Water Supply – Site Provision is quoted), and notifies tenants where required.

5. Standby and Return Attendance
Where work cannot start, continue or be completed for reasons outside AeroWash's control, including site access not being available or work being stopped at the client's request, a standby or return attendance charge applies, agreed with you before it is invoiced.

6. Pre-existing Conditions
Existing damage, failed sealant, staining that has penetrated the substrate and other pre-existing defects are recorded before work starts and are not the responsibility of AeroWash.

7. SACAA and Daylight Operations Only
All flight operations are conducted in accordance with South African Civil Aviation Authority (SACAA) regulations during approved daylight hours only.

8. Payment Terms and Validity
Payment terms: 
Quote validity: `;
