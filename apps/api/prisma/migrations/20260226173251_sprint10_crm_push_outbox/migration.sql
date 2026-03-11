-- CreateEnum
CREATE TYPE "CrmPushStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "ListingSource" ADD VALUE 'CRM_WEBHOOK';

-- CreateTable
CREATE TABLE "CrmPushOutbox" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "matchesCount" INTEGER NOT NULL DEFAULT 0,
    "topSearchIds" JSONB,
    "status" "CrmPushStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmPushOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmPushOutbox_status_nextAttemptAt_idx" ON "CrmPushOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "CrmPushOutbox_listingId_idx" ON "CrmPushOutbox"("listingId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
