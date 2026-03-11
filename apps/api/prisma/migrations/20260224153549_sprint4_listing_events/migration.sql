-- CreateEnum
CREATE TYPE "ListingEventType" AS ENUM ('PRICE_CHANGED', 'STATUS_CHANGED', 'MEDIA_CHANGED', 'REFRESHED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'PRICE_DROP';
ALTER TYPE "AlertType" ADD VALUE 'BACK_ON_MARKET';

-- CreateTable
CREATE TABLE "ListingEvent" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "type" "ListingEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingEvent_listingId_createdAt_idx" ON "ListingEvent"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "ListingEvent_type_createdAt_idx" ON "ListingEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "ListingEvent" ADD CONSTRAINT "ListingEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
