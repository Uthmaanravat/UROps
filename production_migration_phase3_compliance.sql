BEGIN;

-- 1. Create Phase 3 Enums (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'FlightPurpose'
    ) THEN
        CREATE TYPE public."FlightPurpose" AS ENUM (
            'COMMERCIAL_OPS',
            'SITE_RECON',
            'TRAINING',
            'MAINTENANCE_TEST',
            'OTHER'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'MaintenanceType'
    ) THEN
        CREATE TYPE public."MaintenanceType" AS ENUM (
            'SCHEDULED_SERVICE',
            'UNSCHEDULED_REPAIR',
            'WASH_RIG_INSPECTION',
            'FIRMWARE_CALIBRATION'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'BatteryStatus'
    ) THEN
        CREATE TYPE public."BatteryStatus" AS ENUM (
            'ACTIVE',
            'MAINTENANCE_DUE',
            'SWOLLEN_QUARANTINE',
            'RETIRED'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'ComplianceDocCategory'
    ) THEN
        CREATE TYPE public."ComplianceDocCategory" AS ENUM (
            'RPL',
            'INSURANCE',
            'COIDA',
            'TAX_CLEARANCE',
            'ABEOD_AGREEMENT',
            'COMPANY_REG',
            'BBBEE',
            'BANK_CONFIRMATION',
            'SAFETY_HSE_PLAN',
            'OTHER'
        );
    END IF;
END $$;

-- 2. Add Compliance settings to CompanySettings & enable for AeroWash
ALTER TABLE public."CompanySettings"
  ADD COLUMN IF NOT EXISTS "complianceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "complianceAlertEmails" TEXT;

UPDATE public."CompanySettings"
SET "complianceEnabled" = true
WHERE "companyId" = '70af7281-072d-4ed5-9f2e-af4d93e99ea9';

-- 3. Extend Phase 2 Drone table with SACAA & Maintenance tracking columns
ALTER TABLE public."Drone"
  ADD COLUMN IF NOT EXISTS "sacaaRegNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "commissionDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "airworthinessStatus" TEXT NOT NULL DEFAULT 'SERVICEABLE',
  ADD COLUMN IF NOT EXISTS "lastMaintenanceDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextMaintenanceDueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "maintenanceIntervalDays" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS "maintenanceIntervalMinutes" INTEGER NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS "flightMinutesAtLastService" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "manualBaseFlightMinutes" INTEGER NOT NULL DEFAULT 0;

-- 4. FlightLogEntry table (JobSheet-synced + standalone flights)
CREATE TABLE IF NOT EXISTS public."FlightLogEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobSheetId" TEXT,
    "projectId" TEXT,
    "pilotUserId" TEXT,
    "pilotNameSnapshot" TEXT,
    "droneId" TEXT,
    "droneNameSnapshot" TEXT,
    "flightDate" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "sorties" INTEGER NOT NULL DEFAULT 1,
    "purpose" public."FlightPurpose" NOT NULL DEFAULT 'COMMERCIAL_OPS',
    "siteLocation" TEXT,
    "weatherSummary" TEXT,
    "batteryIdsUsed" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "incidentOccurred" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'JOB_SHEET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlightLogEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FlightLogEntry_jobSheetId_key" ON public."FlightLogEntry"("jobSheetId");
CREATE INDEX IF NOT EXISTS "FlightLogEntry_companyId_flightDate_idx" ON public."FlightLogEntry"("companyId", "flightDate" DESC);
CREATE INDEX IF NOT EXISTS "FlightLogEntry_companyId_pilotUserId_idx" ON public."FlightLogEntry"("companyId", "pilotUserId");
CREATE INDEX IF NOT EXISTS "FlightLogEntry_companyId_droneId_idx" ON public."FlightLogEntry"("companyId", "droneId");

-- 5. DroneMaintenanceLog table
CREATE TABLE IF NOT EXISTS public."DroneMaintenanceLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "droneId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" TEXT NOT NULL,
    "type" public."MaintenanceType" NOT NULL DEFAULT 'SCHEDULED_SERVICE',
    "airframeMinutesAtService" INTEGER NOT NULL DEFAULT 0,
    "workSummary" TEXT NOT NULL,
    "partsReplaced" TEXT,
    "cost" DOUBLE PRECISION,
    "nextDueDate" TIMESTAMP(3),
    "nextDueAirframeMinutes" INTEGER,
    "attachmentStoragePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DroneMaintenanceLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DroneMaintenanceLog_companyId_droneId_performedAt_idx"
  ON public."DroneMaintenanceLog"("companyId", "droneId", "performedAt" DESC);

-- 6. DroneBattery table
CREATE TABLE IF NOT EXISTS public."DroneBattery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignedDroneId" TEXT,
    "pairGroup" TEXT,
    "label" TEXT NOT NULL,
    "model" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "initialCycles" INTEGER NOT NULL DEFAULT 0,
    "currentCycles" INTEGER NOT NULL DEFAULT 0,
    "maxRecommendedCycles" INTEGER NOT NULL DEFAULT 200,
    "healthPercent" INTEGER,
    "lastChargedAt" TIMESTAMP(3),
    "lastInspectionDate" TIMESTAMP(3),
    "nextInspectionDueDate" TIMESTAMP(3),
    "status" public."BatteryStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DroneBattery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DroneBattery_companyId_label_key" ON public."DroneBattery"("companyId", "label");
CREATE INDEX IF NOT EXISTS "DroneBattery_companyId_status_idx" ON public."DroneBattery"("companyId", "status");

-- 7. BatteryChargeLog table
CREATE TABLE IF NOT EXISTS public."BatteryChargeLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "flightLogId" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedByUserId" TEXT,
    "loggedByName" TEXT,
    "cyclesAdded" INTEGER NOT NULL DEFAULT 1,
    "cycleCountAfter" INTEGER NOT NULL,
    "healthPercent" INTEGER,
    "voltageDeviationMv" INTEGER,
    "swellingObserved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatteryChargeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BatteryChargeLog_batteryId_loggedAt_idx" ON public."BatteryChargeLog"("batteryId", "loggedAt" DESC);
CREATE INDEX IF NOT EXISTS "BatteryChargeLog_companyId_loggedAt_idx" ON public."BatteryChargeLog"("companyId", "loggedAt" DESC);

-- 8. ComplianceDocument table
CREATE TABLE IF NOT EXISTS public."ComplianceDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" public."ComplianceDocCategory" NOT NULL,
    "pilotUserId" TEXT,
    "droneId" TEXT,
    "title" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "issuingAuthority" TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "alertDaysBefore" INTEGER NOT NULL DEFAULT 30,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "includeInVendorPack" BOOLEAN NOT NULL DEFAULT true,
    "vendorPackOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" TEXT,
    "lastAlertStage" TEXT,
    "lastAlertSentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ComplianceDocument_companyId_category_isArchived_idx"
  ON public."ComplianceDocument"("companyId", "category", "isArchived");
CREATE INDEX IF NOT EXISTS "ComplianceDocument_companyId_expiryDate_idx"
  ON public."ComplianceDocument"("companyId", "expiryDate");

-- 9. Foreign Keys (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'FlightLogEntry_companyId_fkey') THEN
        ALTER TABLE public."FlightLogEntry" ADD CONSTRAINT "FlightLogEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'FlightLogEntry_jobSheetId_fkey') THEN
        ALTER TABLE public."FlightLogEntry" ADD CONSTRAINT "FlightLogEntry_jobSheetId_fkey" FOREIGN KEY ("jobSheetId") REFERENCES public."JobSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'FlightLogEntry_projectId_fkey') THEN
        ALTER TABLE public."FlightLogEntry" ADD CONSTRAINT "FlightLogEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'FlightLogEntry_pilotUserId_fkey') THEN
        ALTER TABLE public."FlightLogEntry" ADD CONSTRAINT "FlightLogEntry_pilotUserId_fkey" FOREIGN KEY ("pilotUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'FlightLogEntry_droneId_fkey') THEN
        ALTER TABLE public."FlightLogEntry" ADD CONSTRAINT "FlightLogEntry_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES public."Drone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'DroneMaintenanceLog_companyId_fkey') THEN
        ALTER TABLE public."DroneMaintenanceLog" ADD CONSTRAINT "DroneMaintenanceLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'DroneMaintenanceLog_droneId_fkey') THEN
        ALTER TABLE public."DroneMaintenanceLog" ADD CONSTRAINT "DroneMaintenanceLog_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES public."Drone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'DroneBattery_companyId_fkey') THEN
        ALTER TABLE public."DroneBattery" ADD CONSTRAINT "DroneBattery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'DroneBattery_assignedDroneId_fkey') THEN
        ALTER TABLE public."DroneBattery" ADD CONSTRAINT "DroneBattery_assignedDroneId_fkey" FOREIGN KEY ("assignedDroneId") REFERENCES public."Drone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'BatteryChargeLog_companyId_fkey') THEN
        ALTER TABLE public."BatteryChargeLog" ADD CONSTRAINT "BatteryChargeLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'BatteryChargeLog_batteryId_fkey') THEN
        ALTER TABLE public."BatteryChargeLog" ADD CONSTRAINT "BatteryChargeLog_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES public."DroneBattery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'BatteryChargeLog_flightLogId_fkey') THEN
        ALTER TABLE public."BatteryChargeLog" ADD CONSTRAINT "BatteryChargeLog_flightLogId_fkey" FOREIGN KEY ("flightLogId") REFERENCES public."FlightLogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'ComplianceDocument_companyId_fkey') THEN
        ALTER TABLE public."ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'ComplianceDocument_pilotUserId_fkey') THEN
        ALTER TABLE public."ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_pilotUserId_fkey" FOREIGN KEY ("pilotUserId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.conname = 'ComplianceDocument_droneId_fkey') THEN
        ALTER TABLE public."ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES public."Drone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 10. Private Supabase Storage bucket & authenticated-only RLS policy for compliance documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'compliance-documents',
    'compliance-documents',
    false,
    26214400,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Allow authenticated ops on compliance-documents'
    ) THEN
        CREATE POLICY "Allow authenticated ops on compliance-documents"
        ON storage.objects
        FOR ALL
        TO authenticated
        USING (bucket_id = 'compliance-documents')
        WITH CHECK (bucket_id = 'compliance-documents');
    END IF;
END $$;

COMMIT;
