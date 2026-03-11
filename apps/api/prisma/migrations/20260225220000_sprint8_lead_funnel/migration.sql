-- Sprint 8 T1: Lead PENDING/ACTIVE/CLOSED funnel + activación + LeadEvent + User.premiumUntil

-- 1) User.premiumUntil
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "premiumUntil" TIMESTAMP(3);

-- 2) ActivationReason enum
CREATE TYPE "ActivationReason" AS ENUM ('PAID_BY_AGENCY', 'PREMIUM_USER', 'MANUAL_ADMIN');

-- 3) Lead: activationReason, activatedAt
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "activationReason" "ActivationReason";
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);

-- 4) LeadEvent table
CREATE TABLE IF NOT EXISTS "LeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadEvent_leadId_createdAt_idx" ON "LeadEvent"("leadId", "createdAt");

ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Migrate LeadStatus enum: NEW/QUEUED/SENT/FAILED -> PENDING/ACTIVE/CLOSED
CREATE TYPE "LeadStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'CLOSED');

ALTER TABLE "Lead" ADD COLUMN "status_new" "LeadStatus_new";

UPDATE "Lead" SET "status_new" = CASE "status"::text
    WHEN 'NEW' THEN 'PENDING'::"LeadStatus_new"
    WHEN 'QUEUED' THEN 'PENDING'::"LeadStatus_new"
    WHEN 'SENT' THEN 'ACTIVE'::"LeadStatus_new"
    WHEN 'FAILED' THEN 'PENDING'::"LeadStatus_new"
    ELSE 'PENDING'::"LeadStatus_new"
END;

ALTER TABLE "Lead" DROP COLUMN "status";
ALTER TABLE "Lead" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "Lead" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "LeadStatus";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
