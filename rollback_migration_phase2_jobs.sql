-- NOTE ON ENUM ROLLBACK:
-- PostgreSQL does not support dropping an enum value added via `ALTER TYPE public."Role" ADD VALUE 'CREW'`
-- (`ALTER TYPE ... DROP VALUE` does not exist in PostgreSQL). Therefore, the 'CREW' enum label cannot be
-- removed in-place and remains harmlessly in the "Role" type definition. Below, we safely reassign any
-- 'CREW' rows in "User" and "Invitation" back to 'MANAGER' before dropping all Phase 2 tables and columns.

BEGIN;

-- 1. Drop Phase 2 tables
DROP TABLE IF EXISTS public."JobSheet";
DROP TABLE IF EXISTS public."Drone";

-- 2. Drop Phase 2 columns on Project
ALTER TABLE public."Project"
  DROP COLUMN IF EXISTS "assignedCrewIds",
  DROP COLUMN IF EXISTS "pilotUserId",
  DROP COLUMN IF EXISTS "droneId";

-- 3. Drop Phase 2 weather & spray drift columns on CompanySettings
ALTER TABLE public."CompanySettings"
  DROP COLUMN IF EXISTS "weatherLimitsConfigured",
  DROP COLUMN IF EXISTS "sprayDriftWarnKmh",
  DROP COLUMN IF EXISTS "windWarnKmh",
  DROP COLUMN IF EXISTS "windLimitKmh",
  DROP COLUMN IF EXISTS "gustWarnKmh",
  DROP COLUMN IF EXISTS "gustLimitKmh",
  DROP COLUMN IF EXISTS "rainLimitMm";

-- 4. Reassign any 'CREW' users/invitations back to 'MANAGER'
UPDATE public."User" SET "role" = 'MANAGER'::public."Role" WHERE "role"::text = 'CREW';
UPDATE public."Invitation" SET "role" = 'MANAGER'::public."Role" WHERE "role"::text = 'CREW';

COMMIT;
