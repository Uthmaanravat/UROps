-- PRODUCTION MIGRATION SQL FOR INVITATION & COMPANY AUDIT LOG
BEGIN;

CREATE TABLE IF NOT EXISTS public."Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" public."Role" NOT NULL DEFAULT 'MANAGER',
    "companyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Invitation_tokenHash_key" UNIQUE ("tokenHash"),
    CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Invitation_companyId_idx" ON public."Invitation"("companyId");
CREATE INDEX IF NOT EXISTS "Invitation_tokenHash_idx" ON public."Invitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON public."Invitation"("email");

CREATE TABLE IF NOT EXISTS public."CompanyAuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetEmail" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAuditLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CompanyAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CompanyAuditLog_companyId_idx" ON public."CompanyAuditLog"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyAuditLog_createdAt_idx" ON public."CompanyAuditLog"("createdAt" DESC);

COMMIT;
