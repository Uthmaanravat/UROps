const fs = require('fs');
const path = require('path');
const { AEROWASH_CATALOGUE_ITEMS, AEROWASH_STANDARD_TERMS_BODY } = require('../src/lib/aerowash-catalogue');

const aerowashCompanyId = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';

const approvedTermsBody = AEROWASH_STANDARD_TERMS_BODY;

function generateSql() {
    let sql = `-- ============================================================================
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
WHERE "companyId" = '${aerowashCompanyId}';

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
`;

    for (const item of AEROWASH_CATALOGUE_ITEMS) {
        const id = `cwk_cat_aw_${item.itemNumber}`;
        const name = item.name.replace(/'/g, "''");
        const clientDesc = item.clientDescription.replace(/'/g, "''");
        const category = item.category.replace(/'/g, "''");
        const pricingMethod = item.pricingMethod.replace(/'/g, "''");
        const internalNotes = item.internalNotes ? `'${item.internalNotes.replace(/'/g, "''")}'` : 'NULL';

        sql += `INSERT INTO "public"."CatalogueItem" (
    "id", "companyId", "itemNumber", "name", "clientDescription", "category", "pricingMethod", "internalNotes", "isActive", "updatedAt"
) VALUES (
    '${id}', '${aerowashCompanyId}', ${item.itemNumber}, '${name}', '${clientDesc}', '${category}', '${pricingMethod}', ${internalNotes}, true, CURRENT_TIMESTAMP
)
ON CONFLICT ("companyId", "itemNumber") DO UPDATE SET
    "name" = EXCLUDED."name",
    "clientDescription" = EXCLUDED."clientDescription",
    "category" = EXCLUDED."category",
    "pricingMethod" = EXCLUDED."pricingMethod",
    "internalNotes" = EXCLUDED."internalNotes",
    "isActive" = true,
    "updatedAt" = CURRENT_TIMESTAMP;\n\n`;
    }

    const escapedTerms = approvedTermsBody.replace(/'/g, "''");

    sql += `-- 6. Seed / Update AeroWash Standard Quotation Terms (8 approved clauses)
DO $$
DECLARE
    v_template_id TEXT;
    v_version_num INTEGER;
BEGIN
    -- Check if AeroWash terms template exists
    SELECT "id" INTO v_template_id
    FROM "public"."terms_templates"
    WHERE "business_id" = '${aerowashCompanyId}'
    ORDER BY "is_default" DESC, "updated_at" DESC
    LIMIT 1;

    IF v_template_id IS NULL THEN
        v_template_id := 'cwk_terms_aw_std';
        INSERT INTO "public"."terms_templates" (
            "id", "business_id", "name", "body", "is_default", "version", "created_at", "updated_at"
        ) VALUES (
            v_template_id, '${aerowashCompanyId}', 'AeroWash Standard Quotation Terms',
            '${escapedTerms}',
            true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );

        INSERT INTO "public"."terms_template_versions" (
            "id", "template_id", "version", "name", "body", "created_at"
        ) VALUES (
            'cwk_terms_ver_aw_1', v_template_id, 1, 'AeroWash Standard Quotation Terms',
            '${escapedTerms}',
            CURRENT_TIMESTAMP
        );
    ELSE
        SELECT COALESCE(MAX("version"), 1) + 1 INTO v_version_num
        FROM "public"."terms_template_versions"
        WHERE "template_id" = v_template_id;

        UPDATE "public"."terms_templates"
        SET "name" = 'AeroWash Standard Quotation Terms',
            "body" = '${escapedTerms}',
            "version" = v_version_num,
            "is_default" = true,
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = v_template_id;

        INSERT INTO "public"."terms_template_versions" (
            "id", "template_id", "version", "name", "body", "created_at"
        ) VALUES (
            'cwk_terms_ver_aw_' || v_version_num, v_template_id, v_version_num, 'AeroWash Standard Quotation Terms',
            '${escapedTerms}',
            CURRENT_TIMESTAMP
        );
    END IF;

    -- Ensure any other terms for AeroWash are non-default
    UPDATE "public"."terms_templates"
    SET "is_default" = false
    WHERE "business_id" = '${aerowashCompanyId}'
      AND "id" <> v_template_id;
END $$;

COMMIT;
`;

    return sql;
}

function generateRollbackSql() {
    return `-- ============================================================================
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
    DROP COLUMN IF EXISTS "justificationEnabled",
    DROP COLUMN IF EXISTS "validityDays";

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
    WHERE "business_id" = '${aerowashCompanyId}'
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
`;
}

const prodSql = generateSql();
const rollbackSql = generateRollbackSql();

fs.writeFileSync(path.resolve('scripts/production_migration.sql'), prodSql, 'utf8');
fs.writeFileSync(path.resolve('scripts/rollback_migration.sql'), rollbackSql, 'utf8');

console.log('Generated production_migration.sql and rollback_migration.sql successfully!');
