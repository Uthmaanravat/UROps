-- ============================================================================
-- ROLLBACK SCRIPT
-- FEATURE: AeroWash Catalogue, Quote Terms, VAT Readiness & Justification Setting
-- TARGET: public schema
-- ============================================================================

BEGIN;

-- 1. Remove CatalogueItem table
DROP TABLE IF EXISTS "public"."CatalogueItem" CASCADE;

-- 2. Remove JSONB metadata columns from Invoice and InvoiceItem
ALTER TABLE "public"."Invoice"
    DROP COLUMN IF EXISTS "metadata";

ALTER TABLE "public"."InvoiceItem"
    DROP COLUMN IF EXISTS "metadata";

-- 3. Remove columns from CompanySettings
ALTER TABLE "public"."CompanySettings"
    DROP COLUMN IF EXISTS "surveyCameraEnabled",
    DROP COLUMN IF EXISTS "thermalCameraEnabled",
    DROP COLUMN IF EXISTS "vatRegistrationDate",
    DROP COLUMN IF EXISTS "vatRate",
    DROP COLUMN IF EXISTS "justificationEnabled";

-- 4. Rollback AeroWash terms template if created by migration
DELETE FROM "public"."terms_template_versions"
WHERE "id" LIKE 'cwk_terms_ver_aw_%';

DELETE FROM "public"."terms_templates"
WHERE "id" = 'cwk_terms_aw_std';

COMMIT;
