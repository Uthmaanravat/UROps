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

-- 4. Rollback AeroWash terms template / restore previous version if existing
DO $$
DECLARE
    v_template_id TEXT;
    v_prev_ver INTEGER;
    v_prev_name TEXT;
    v_prev_body TEXT;
BEGIN
    -- Delete the version added by migration
    DELETE FROM "public"."terms_template_versions"
    WHERE "id" LIKE 'cwk_terms_ver_aw_%';

    -- Find the AeroWash template
    SELECT "id" INTO v_template_id
    FROM "public"."terms_templates"
    WHERE "business_id" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9'
    LIMIT 1;

    IF v_template_id IS NOT NULL THEN
        -- Find highest remaining version in terms_template_versions
        SELECT "version", "name", "body" INTO v_prev_ver, v_prev_name, v_prev_body
        FROM "public"."terms_template_versions"
        WHERE "template_id" = v_template_id
        ORDER BY "version" DESC
        LIMIT 1;

        IF v_prev_ver IS NOT NULL THEN
            -- Restore previous version
            UPDATE "public"."terms_templates"
            SET "version" = v_prev_ver,
                "name" = v_prev_name,
                "body" = v_prev_body,
                "updated_at" = CURRENT_TIMESTAMP
            WHERE "id" = v_template_id;
        ELSE
            -- Only delete template if it was created from scratch by this migration
            DELETE FROM "public"."terms_templates"
            WHERE "id" = 'cwk_terms_aw_std';
        END IF;
    END IF;
END $$;

COMMIT;
