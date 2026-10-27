BEGIN;

-- 1. Add surveyCameraEnabled and thermalCameraEnabled to CompanySettings
ALTER TABLE public."CompanySettings" 
ADD COLUMN IF NOT EXISTS "surveyCameraEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "thermalCameraEnabled" BOOLEAN NOT NULL DEFAULT false;

-- 2. Add metadata JSONB to Invoice and InvoiceItem
ALTER TABLE public."Invoice" 
ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE public."InvoiceItem" 
ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- 3. Create CatalogueItem table
CREATE TABLE IF NOT EXISTS public."CatalogueItem" (
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

-- 4. Foreign key and index on CatalogueItem
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CatalogueItem_companyId_fkey'
    ) THEN
        ALTER TABLE public."CatalogueItem" 
        ADD CONSTRAINT "CatalogueItem_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CatalogueItem_companyId_category_idx" ON public."CatalogueItem"("companyId", "category");

COMMIT;
