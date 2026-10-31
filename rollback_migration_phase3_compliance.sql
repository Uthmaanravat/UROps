BEGIN;

-- 1. Drop Phase 3 tables in dependency order
DROP TABLE IF EXISTS public."ComplianceDocument";
DROP TABLE IF EXISTS public."BatteryChargeLog";
DROP TABLE IF EXISTS public."DroneBattery";
DROP TABLE IF EXISTS public."DroneMaintenanceLog";
DROP TABLE IF EXISTS public."FlightLogEntry";

-- 2. Drop Phase 3 columns added to Drone
ALTER TABLE public."Drone"
  DROP COLUMN IF EXISTS "sacaaRegNumber",
  DROP COLUMN IF EXISTS "commissionDate",
  DROP COLUMN IF EXISTS "airworthinessStatus",
  DROP COLUMN IF EXISTS "lastMaintenanceDate",
  DROP COLUMN IF EXISTS "nextMaintenanceDueDate",
  DROP COLUMN IF EXISTS "maintenanceIntervalDays",
  DROP COLUMN IF EXISTS "maintenanceIntervalMinutes",
  DROP COLUMN IF EXISTS "flightMinutesAtLastService",
  DROP COLUMN IF EXISTS "manualBaseFlightMinutes";

-- 3. Drop Phase 3 columns added to CompanySettings
ALTER TABLE public."CompanySettings"
  DROP COLUMN IF EXISTS "complianceEnabled",
  DROP COLUMN IF EXISTS "complianceAlertEmails";

-- 4. Drop Phase 3 Enums
DROP TYPE IF EXISTS public."ComplianceDocCategory";
DROP TYPE IF EXISTS public."BatteryStatus";
DROP TYPE IF EXISTS public."MaintenanceType";
DROP TYPE IF EXISTS public."FlightPurpose";

-- 5. Remove storage policy on compliance-documents (bucket left intact if objects exist)
DROP POLICY IF EXISTS "Allow authenticated ops on compliance-documents" ON storage.objects;

COMMIT;
