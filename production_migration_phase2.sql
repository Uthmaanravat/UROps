BEGIN;

-- 1. Add reactiveEnabled to CompanySettings
ALTER TABLE public."CompanySettings" ADD COLUMN IF NOT EXISTS "reactiveEnabled" BOOLEAN NOT NULL DEFAULT false;

-- 2. Enable reactiveEnabled for LR Builders (299c43ec-9578-4c45-91cb-a881a539e25d)
UPDATE public."CompanySettings" 
SET "reactiveEnabled" = true 
WHERE "companyId" = '299c43ec-9578-4c45-91cb-a881a539e25d';

-- 3. Add recurrence rule and job specs fields to Project
ALTER TABLE public."Project" ADD COLUMN IF NOT EXISTS "parentProjectId" TEXT;
ALTER TABLE public."Project" ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public."Project" ADD COLUMN IF NOT EXISTS "recurrenceRule" JSONB;
ALTER TABLE public."Project" ADD COLUMN IF NOT EXISTS "jobSpecs" JSONB;

-- 4. Foreign key constraint for parentProjectId self-relation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Project_parentProjectId_fkey'
    ) THEN
        ALTER TABLE public."Project" 
        ADD CONSTRAINT "Project_parentProjectId_fkey" 
        FOREIGN KEY ("parentProjectId") REFERENCES public."Project"("id") ON DELETE SET NULL;
    END IF;
END $$;

COMMIT;
