BEGIN;

-- 1. Drop CatalogueItem table
DROP TABLE IF EXISTS public."CatalogueItem";

-- 2. Drop metadata from Invoice and InvoiceItem
ALTER TABLE public."InvoiceItem" DROP COLUMN IF EXISTS "metadata";
ALTER TABLE public."Invoice" DROP COLUMN IF EXISTS "metadata";

-- 3. Drop surveyCameraEnabled and thermalCameraEnabled from CompanySettings
ALTER TABLE public."CompanySettings" 
DROP COLUMN IF EXISTS "surveyCameraEnabled",
DROP COLUMN IF EXISTS "thermalCameraEnabled";

COMMIT;
