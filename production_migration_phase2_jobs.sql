BEGIN;

-- 1. Add CREW to Role enum (schema-qualified)
ALTER TYPE public."Role" ADD VALUE IF NOT EXISTS 'CREW';

-- 2. Weather & Spray Drift thresholds on CompanySettings (NULL until saved by owner)
ALTER TABLE public."CompanySettings"
  ADD COLUMN IF NOT EXISTS "weatherLimitsConfigured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sprayDriftWarnKmh" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "windWarnKmh" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "windLimitKmh" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gustWarnKmh" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gustLimitKmh" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rainLimitMm" DOUBLE PRECISION;

-- 3. Simple Drones fleet table (Name + Serial)
CREATE TABLE IF NOT EXISTS public."Drone" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "model" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Drone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Drone_companyId_isActive_idx" ON public."Drone"("companyId", "isActive");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND c.conname = 'Drone_companyId_fkey'
    ) THEN
        ALTER TABLE public."Drone"
        ADD CONSTRAINT "Drone_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Crew, Pilot & Aircraft assignment on Project
ALTER TABLE public."Project"
  ADD COLUMN IF NOT EXISTS "assignedCrewIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "pilotUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "droneId" TEXT;

-- 5. JobSheet table (including Phase 3 Flight Log feed columns)
CREATE TABLE IF NOT EXISTS public."JobSheet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "pilotUserId" TEXT,
    "droneId" TEXT,
    "elevationFlights" JSONB,
    "totalFlightMinutes" INTEGER,
    "checklist" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "timeLogs" JSONB,
    "elevationPhotos" JSONB,
    "issuesNotes" TEXT,
    "issuePhotos" JSONB,
    "signOffName" TEXT,
    "signOffSignature" TEXT,
    "signedOffAt" TIMESTAMP(3),
    "clientUnavailable" BOOLEAN NOT NULL DEFAULT false,
    "clientUnavailableReason" TEXT,
    "standbyFlagged" BOOLEAN NOT NULL DEFAULT false,
    "standbyReason" TEXT,
    "standbyNotes" TEXT,
    "standbyStatus" TEXT,
    "weatherSnapshot" JSONB,
    "completionReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobSheet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobSheet_projectId_key" ON public."JobSheet"("projectId");
CREATE INDEX IF NOT EXISTS "JobSheet_companyId_status_idx" ON public."JobSheet"("companyId", "status");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND c.conname = 'JobSheet_companyId_fkey'
    ) THEN
        ALTER TABLE public."JobSheet"
        ADD CONSTRAINT "JobSheet_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND c.conname = 'JobSheet_projectId_fkey'
    ) THEN
        ALTER TABLE public."JobSheet"
        ADD CONSTRAINT "JobSheet_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES public."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND c.conname = 'JobSheet_pilotUserId_fkey'
    ) THEN
        ALTER TABLE public."JobSheet"
        ADD CONSTRAINT "JobSheet_pilotUserId_fkey"
        FOREIGN KEY ("pilotUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND c.conname = 'JobSheet_droneId_fkey'
    ) THEN
        ALTER TABLE public."JobSheet"
        ADD CONSTRAINT "JobSheet_droneId_fkey"
        FOREIGN KEY ("droneId") REFERENCES public."Drone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

COMMIT;
