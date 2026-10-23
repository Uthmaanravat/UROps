-- ==============================================================================
-- ROLLBACK SCRIPT FOR PRODUCTION MIGRATION
-- Project: UROps (ur-ops.vercel.app)
-- Target: public."CompanySettings"
-- ==============================================================================

BEGIN;

-- 1. Revert AeroWash theme back to 'light-orange'
UPDATE public."CompanySettings" 
SET "theme" = 'light-orange' 
WHERE "companyId" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';

-- 2. Drop newly added columns from CompanySettings
ALTER TABLE public."CompanySettings" 
DROP COLUMN IF EXISTS "tendersEnabled",
DROP COLUMN IF EXISTS "registrationNumber";

COMMIT;
