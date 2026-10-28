-- ============================================================================
-- PRODUCTION MIGRATION SCRIPT
-- FEATURE: AeroWash Catalogue, Quote Terms, VAT Readiness & Justification Setting
-- TARGET: public schema
-- ============================================================================

BEGIN;

-- 1. Add feature toggle and VAT columns to CompanySettings
ALTER TABLE "public"."CompanySettings"
    ADD COLUMN IF NOT EXISTS "surveyCameraEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "thermalCameraEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "vatRegistrationDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "vatRate" DOUBLE PRECISION DEFAULT 15.0,
    ADD COLUMN IF NOT EXISTS "justificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "validityDays" INTEGER DEFAULT 30;

-- 2. Configure per-company justification & validity settings
-- AeroWash: Justification completely removed (false), Quotation validity = 45 days
-- LR Builders: Justification enabled for General Work, hidden for Tender (true)
UPDATE "public"."CompanySettings"
SET "justificationEnabled" = false,
    "validityDays" = 45
WHERE "companyId" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';

UPDATE "public"."CompanySettings"
SET "justificationEnabled" = true,
    "validityDays" = 30
WHERE "companyId" = '299c43ec-9578-4c45-91cb-a881a539e25d';

-- 3. Add JSONB metadata columns to Invoice and InvoiceItem
ALTER TABLE "public"."Invoice"
    ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE "public"."InvoiceItem"
    ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- 4. Create CatalogueItem table
CREATE TABLE IF NOT EXISTS "public"."CatalogueItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "clientDescription" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "pricingMethod" TEXT NOT NULL,
    "internalNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogueItem_pkey" PRIMARY KEY ("id")
);

-- Idempotent unique index on (companyId, itemNumber)
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogueItem_companyId_itemNumber_key"
    ON "public"."CatalogueItem"("companyId", "itemNumber");

CREATE INDEX IF NOT EXISTS "CatalogueItem_companyId_category_idx"
    ON "public"."CatalogueItem"("companyId", "category");

-- Idempotent Foreign Key Constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CatalogueItem_companyId_fkey'
    ) THEN
        ALTER TABLE "public"."CatalogueItem"
            ADD CONSTRAINT "CatalogueItem_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. Seed 22 AeroWash Catalogue Items
INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_1', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 1, 'Exterior Glazing Maintenance Clean – [Elevation]', 'Drone cleaning of all windows, glazing and frames across this face of the building, excluding balcony areas (see Balcony & Detail Areas). Removes dirt, pollution, salt and light grime, leaving the glazing visibly clean across the elevation.', 'CLEANING', 'ELEVATION_BAND', 'FULL elevation width × height (never glass area only) × band rate. Warn within 2 m of band edge: Confirm height with laser.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_2', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 2, 'Full Facade Maintenance Clean – [Elevation]', 'Drone cleaning of the full face of the building: windows, frames, walls, cladding and concrete surfaces, excluding balcony areas (see Balcony & Detail Areas). Completed in a single visit.', 'CLEANING', 'ELEVATION_UPLIFT_15', 'Item 1 +15% (PROVISIONAL). A "Mostly-glass tower" tickbox removes the uplift. Option to show items 1 and 2 side by side on client quote as alternatives.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_3', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 3, 'Balcony & Detail Areas – [Elevation]', 'Cleaning of balcony soffits, window reveals, returns and balustrade glass on this face of the building.', 'CLEANING', 'BALCONY_PERCENT', '% of that elevation area at its band rate, default 12% (range 10–15%).', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_4', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 4, 'Stain & Growth Pre-Treatment', 'Pre-treatment of organic growth and surface staining before the maintenance clean, where soiling is heavier than routine. Staining that has penetrated the substrate cannot be removed by cleaning.', 'CLEANING', 'PRE_TREATMENT_PERCENT', '% of the elevation price, default 25% (range 25–30%, PROVISIONAL). Requires "Site visit done" before the quote can be sent.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_5', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 5, 'Roof Maintenance Clean', 'Soft wash treatment of roof surfaces to remove organic growth, dirt and accumulated debris.', 'CLEANING', 'PRICE_ON_QUOTE', 'Soft wash treatment. Low pressure < 10 bar.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_6', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 6, 'Solar Array Maintenance Clean', 'Pure water clean of photovoltaic panel surfaces. No detergents or abrasives are used, and no contact is made with panel wiring or mountings.', 'CLEANING', 'SOLAR_PER_PANEL', 'Per panel: R6 client-supplied water / R10 AeroWash-supplied water. Ask panel count + water source.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_7', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 7, 'Signage & Entrance Features', 'Cleaning of building signage, entrance canopies and awnings.', 'CLEANING', 'PRICE_ON_QUOTE', NULL, true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_8', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 8, 'Bird Fouling Removal', 'Treatment and removal of bird fouling from facade surfaces, ledges and roof areas. Heavy or baked-on fouling is assessed on site and quoted separately.', 'CLEANING', 'PRICE_ON_QUOTE', 'Heavy/baked-on assessed on site.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_9', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 9, 'Pre-Coating Facade Wash', 'Facade wash in preparation for painting or protective coating, to the contractor''s written specification, which must be supplied before work starts. AeroWash is not responsible for coating adhesion or performance.', 'CLEANING', 'PRE_COATING_ELEVATION', 'Price as item 2 per elevation. Requires "Contractor specification received" tick before sending.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_10', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 10, 'Post-Construction Exterior Clean', 'Removal of construction dust, residue and marking from exterior surfaces following building or refurbishment work. Hardened cement, paint and adhesive residue are excluded.', 'CLEANING', 'PRICE_ON_QUOTE', NULL, true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_11', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 11, 'Site Visit & Facade Assessment', 'On-site visit to confirm scope, condition, access and water supply, with a photographic record of the building taken before work starts.', 'ASSESSMENT & REPORTING', 'NO_CHARGE', 'R0, shown as "No charge". Required before sending if: item 4 used, landmark flag, or quote over R50,000.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_12', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 12, 'Facade Condition Survey', 'High-resolution aerial photographic survey of the facade, supplied as a referenced report by elevation. Identifies visible defects, staining, sealant condition and areas needing attention.', 'ASSESSMENT & REPORTING', 'PRICE_ON_QUOTE', 'Hidden until "Survey camera enabled" in Settings.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_13', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 13, 'Thermal Roof Survey', 'Thermal imaging survey of roof surfaces, identifying areas of moisture retention and suspected membrane failure.', 'ASSESSMENT & REPORTING', 'PRICE_ON_QUOTE', 'Hidden until "Thermal camera enabled" in Settings.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_14', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 14, 'Service Photo Record', 'Photographic record of each elevation before and after service, supplied with the completion report.', 'ASSESSMENT & REPORTING', 'PRICE_ON_QUOTE', 'Price on quote (R0 allowed, shown as "Included").', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_15', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 15, 'Occupied Building Provision', 'Provision for working around building occupancy: advance tenant notification, restricted working windows, and interrupted access to elevations in use.', 'SITE CONDITIONS', 'OCCUPIED_PERCENT', '10% of the cleaning lines it applies to.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_16', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 16, 'Extended Soiling Provision', 'Provision for additional treatment time where accumulated soiling exceeds routine maintenance levels, confirmed on site before work starts.', 'SITE CONDITIONS', 'PRICE_ON_QUOTE', 'Price on quote. Warn if used with item 4 on the same elevation ("possible double charge"); allow override.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_17', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 17, 'Out-of-Hours Service', 'Service carried out outside standard working hours, during daylight, at the client''s request.', 'SITE CONDITIONS', 'PRICE_ON_QUOTE', 'Price on quote. Internal note: no night flying (no SACAA night approval).', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_18', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 18, 'Water Supply – Site Provision', 'Water supplied to site by AeroWash where no suitable point of supply is available within reach of the work area.', 'SITE CONDITIONS', 'PRICE_ON_QUOTE', 'Price on quote, NOT R0 default.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_19', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 19, 'Regional Water Provision', 'Additional water treatment for a spot-free finish where local water is high in dissolved solids.', 'SITE CONDITIONS', 'REGIONAL_WATER_PER_LITRE', 'Internal: Atlantis R0.30/L, Simon''s Town & desalination zones R0.85/L.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_20', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 20, 'Extended Travel', 'Travel provision for sites beyond the standard service area (see Terms).', 'SITE CONDITIONS', 'PRICE_ON_QUOTE', NULL, true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_21', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 21, 'Scheduled Maintenance Programme – [Biannual / Quarterly / Monthly]', 'Scheduled maintenance visits on fixed, pre-agreed dates.', 'CONTRACTS', 'CONTRACT_PROGRAMME_DISCOUNT', 'Discount: Biannual −10%, Quarterly −15%, Monthly −20%. Client sees price per visit + visits per year, no percentages.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_22', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 22, 'Monthly Glazing + Quarterly Full Facade Programme', 'Monthly window and glazing maintenance, with a full facade clean included every quarter in the same visit.', 'CONTRACTS', 'CONTRACT_COMBINED_PROGRAMME', '= 8 × item 1 + 4 × item 2 per year at the monthly rate, generated as recurring visits. Landmark flag forces Once-off + Full facade on first quote.', true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    'cwk_cat_aw_23', '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 23, 'Low-Level & Detail Hand Clean', 'Hand cleaning of ground-level glazing, entrances and detail areas that are not reachable by drone, completed as part of the same visit.', 'CLEANING', 'PRICE_ON_QUOTE', NULL, true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

-- 6. Seed / Update AeroWash Standard Quotation Terms (8 approved clauses)
DO $$
DECLARE
    v_template_id TEXT;
    v_version_num INTEGER;
BEGIN
    -- Check if AeroWash terms template exists
    SELECT "id" INTO v_template_id
    FROM "public"."terms_templates"
    WHERE "business_id" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9'
    ORDER BY "is_default" DESC, "updated_at" DESC
    LIMIT 1;

    IF v_template_id IS NULL THEN
        v_template_id := 'cwk_terms_aw_std';
        INSERT INTO "public"."terms_templates" (
            "id", "business_id", "name", "body", "is_default", "version", "created_at", "updated_at"
        ) VALUES (
            v_template_id, '70af7281-072d-4ed5-9f2e-af4d93e99ea9', 'AeroWash Standard Quotation Terms',
            '1. Scope and Fixed Price
Quotations are fixed price for the scope and elevations stated. Any variation or additional work is quoted separately before it is carried out. Prices exclude VAT. If AeroWash becomes VAT-registered, VAT will be added at the prevailing rate on invoices issued on or after the registration date.

2. Service Area
The standard service area is within 50 km of Parow, Cape Town. Sites beyond this carry an Extended Travel provision.

3. Weather
Work is weather-dependent. Where wind, rain or visibility make flying unsafe, AeroWash will reschedule at no charge to the next available date.

4. Client Responsibilities
The client provides access to the work area and a water supply point within reach of it (unless Water Supply – Site Provision is quoted), and notifies tenants where required.

5. Standby and Return Attendance
Where work cannot start, continue or be completed for reasons outside AeroWash''s control, including site access not being available or work being stopped at the client''s request, a standby or return attendance charge applies, agreed with you before it is invoiced.

6. Pre-existing Conditions
Existing damage, failed sealant, staining that has penetrated the substrate and other pre-existing defects are recorded before work starts and are not the responsibility of AeroWash.

7. SACAA and Daylight Operations
All flight operations are conducted in line with South African Civil Aviation Authority (SACAA) regulations, during daylight hours only.

8. Payment Terms and Validity
A 60% deposit is payable on acceptance to secure the booking. The balance is payable on completion. This quotation is valid for 45 days from the date of issue.',
            true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );

        INSERT INTO "public"."terms_template_versions" (
            "id", "template_id", "version", "name", "body", "created_at"
        ) VALUES (
            'cwk_terms_ver_aw_1', v_template_id, 1, 'AeroWash Standard Quotation Terms',
            '1. Scope and Fixed Price
Quotations are fixed price for the scope and elevations stated. Any variation or additional work is quoted separately before it is carried out. Prices exclude VAT. If AeroWash becomes VAT-registered, VAT will be added at the prevailing rate on invoices issued on or after the registration date.

2. Service Area
The standard service area is within 50 km of Parow, Cape Town. Sites beyond this carry an Extended Travel provision.

3. Weather
Work is weather-dependent. Where wind, rain or visibility make flying unsafe, AeroWash will reschedule at no charge to the next available date.

4. Client Responsibilities
The client provides access to the work area and a water supply point within reach of it (unless Water Supply – Site Provision is quoted), and notifies tenants where required.

5. Standby and Return Attendance
Where work cannot start, continue or be completed for reasons outside AeroWash''s control, including site access not being available or work being stopped at the client''s request, a standby or return attendance charge applies, agreed with you before it is invoiced.

6. Pre-existing Conditions
Existing damage, failed sealant, staining that has penetrated the substrate and other pre-existing defects are recorded before work starts and are not the responsibility of AeroWash.

7. SACAA and Daylight Operations
All flight operations are conducted in line with South African Civil Aviation Authority (SACAA) regulations, during daylight hours only.

8. Payment Terms and Validity
A 60% deposit is payable on acceptance to secure the booking. The balance is payable on completion. This quotation is valid for 45 days from the date of issue.',
            CURRENT_TIMESTAMP
        );
    ELSE
        SELECT COALESCE(MAX("version"), 1) + 1 INTO v_version_num
        FROM "public"."terms_template_versions"
        WHERE "template_id" = v_template_id;

        UPDATE "public"."terms_templates"
        SET "name" = 'AeroWash Standard Quotation Terms',
            "body" = '1. Scope and Fixed Price
Quotations are fixed price for the scope and elevations stated. Any variation or additional work is quoted separately before it is carried out. Prices exclude VAT. If AeroWash becomes VAT-registered, VAT will be added at the prevailing rate on invoices issued on or after the registration date.

2. Service Area
The standard service area is within 50 km of Parow, Cape Town. Sites beyond this carry an Extended Travel provision.

3. Weather
Work is weather-dependent. Where wind, rain or visibility make flying unsafe, AeroWash will reschedule at no charge to the next available date.

4. Client Responsibilities
The client provides access to the work area and a water supply point within reach of it (unless Water Supply – Site Provision is quoted), and notifies tenants where required.

5. Standby and Return Attendance
Where work cannot start, continue or be completed for reasons outside AeroWash''s control, including site access not being available or work being stopped at the client''s request, a standby or return attendance charge applies, agreed with you before it is invoiced.

6. Pre-existing Conditions
Existing damage, failed sealant, staining that has penetrated the substrate and other pre-existing defects are recorded before work starts and are not the responsibility of AeroWash.

7. SACAA and Daylight Operations
All flight operations are conducted in line with South African Civil Aviation Authority (SACAA) regulations, during daylight hours only.

8. Payment Terms and Validity
A 60% deposit is payable on acceptance to secure the booking. The balance is payable on completion. This quotation is valid for 45 days from the date of issue.',
            "version" = v_version_num,
            "is_default" = true,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = v_template_id;

        INSERT INTO "public"."terms_template_versions" (
            "id", "template_id", "version", "name", "body", "created_at"
        ) VALUES (
            'cwk_terms_ver_aw_' || v_version_num, v_template_id, v_version_num, 'AeroWash Standard Quotation Terms',
            '1. Scope and Fixed Price
Quotations are fixed price for the scope and elevations stated. Any variation or additional work is quoted separately before it is carried out. Prices exclude VAT. If AeroWash becomes VAT-registered, VAT will be added at the prevailing rate on invoices issued on or after the registration date.

2. Service Area
The standard service area is within 50 km of Parow, Cape Town. Sites beyond this carry an Extended Travel provision.

3. Weather
Work is weather-dependent. Where wind, rain or visibility make flying unsafe, AeroWash will reschedule at no charge to the next available date.

4. Client Responsibilities
The client provides access to the work area and a water supply point within reach of it (unless Water Supply – Site Provision is quoted), and notifies tenants where required.

5. Standby and Return Attendance
Where work cannot start, continue or be completed for reasons outside AeroWash''s control, including site access not being available or work being stopped at the client''s request, a standby or return attendance charge applies, agreed with you before it is invoiced.

6. Pre-existing Conditions
Existing damage, failed sealant, staining that has penetrated the substrate and other pre-existing defects are recorded before work starts and are not the responsibility of AeroWash.

7. SACAA and Daylight Operations
All flight operations are conducted in line with South African Civil Aviation Authority (SACAA) regulations, during daylight hours only.

8. Payment Terms and Validity
A 60% deposit is payable on acceptance to secure the booking. The balance is payable on completion. This quotation is valid for 45 days from the date of issue.',
            CURRENT_TIMESTAMP
        );
    END IF;

    -- Ensure any other terms for AeroWash are non-default
    UPDATE "public"."terms_templates"
    SET "is_default" = false
    WHERE "business_id" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9'
      AND "id" <> v_template_id;
END $$;

COMMIT;
