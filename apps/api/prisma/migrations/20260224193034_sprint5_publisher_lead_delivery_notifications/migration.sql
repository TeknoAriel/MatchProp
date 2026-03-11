-- CreateEnum
CREATE TYPE "PublisherType" AS ENUM ('ORG', 'OWNER');

-- CreateEnum
CREATE TYPE "PublisherEndpointKind" AS ENUM ('WEBHOOK', 'KITEPROP');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('FEED', 'LIST', 'ASSISTANT', 'DETAIL');

-- CreateEnum
CREATE TYPE "LeadDeliveryAttemptKind" AS ENUM ('WEBHOOK', 'KITEPROP', 'CONSOLE');

-- CreateEnum
CREATE TYPE "LeadDeliveryAttemptStatus" AS ENUM ('OK', 'FAIL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LEAD_SENT', 'ALERT_NEW_LISTING', 'ALERT_PRICE_DROP', 'ALERT_BACK_ON_MARKET');

-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'QUEUED';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "publisherId" TEXT,
ADD COLUMN     "source" "LeadSource",
ALTER COLUMN "channel" SET DEFAULT 'FORM';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "publisherId" TEXT;

-- CreateTable
CREATE TABLE "Publisher" (
    "id" TEXT NOT NULL,
    "type" "PublisherType" NOT NULL,
    "orgId" TEXT,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublisherEndpoint" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "kind" "PublisherEndpointKind" NOT NULL,
    "webhookUrl" TEXT,
    "webhookSecretHash" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublisherEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" "LeadDeliveryAttemptKind" NOT NULL,
    "status" "LeadDeliveryAttemptStatus" NOT NULL,
    "httpStatus" INTEGER,
    "responseBodySnippet" VARCHAR(500),
    "retries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Publisher_type_idx" ON "Publisher"("type");

-- CreateIndex
CREATE INDEX "Publisher_orgId_idx" ON "Publisher"("orgId");

-- CreateIndex
CREATE INDEX "Publisher_userId_idx" ON "Publisher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PublisherEndpoint_publisherId_kind_key" ON "PublisherEndpoint"("publisherId", "kind");

-- CreateIndex
CREATE INDEX "LeadDeliveryAttempt_leadId_createdAt_idx" ON "LeadDeliveryAttempt"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_userId_idx" ON "Lead"("userId");

-- CreateIndex
CREATE INDEX "Lead_publisherId_idx" ON "Lead"("publisherId");

-- CreateIndex
CREATE INDEX "Listing_publisherId_idx" ON "Listing"("publisherId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublisherEndpoint" ADD CONSTRAINT "PublisherEndpoint_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDeliveryAttempt" ADD CONSTRAINT "LeadDeliveryAttempt_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
