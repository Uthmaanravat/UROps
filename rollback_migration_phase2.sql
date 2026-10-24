BEGIN;

-- 1. Remove foreign key and columns from Project
ALTER TABLE public."Project" DROP CONSTRAINT IF EXISTS "Project_parentProjectId_fkey";
ALTER TABLE public."Project" DROP COLUMN IF EXISTS "parentProjectId";
ALTER TABLE public."Project" DROP COLUMN IF EXISTS "isRecurring";
ALTER TABLE public."Project" DROP COLUMN IF EXISTS "recurrenceRule";
ALTER TABLE public."Project" DROP COLUMN IF EXISTS "jobSpecs";

-- 2. Remove reactiveEnabled from CompanySettings
ALTER TABLE public."CompanySettings" DROP COLUMN IF EXISTS "reactiveEnabled";

COMMIT;
