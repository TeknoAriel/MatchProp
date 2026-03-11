-- CreateEnum
CREATE TYPE "ListingSource" AS ENUM ('KITEPROP', 'API_PARTNER_1', 'API_PARTNER_2');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SwipeDecisionType" AS ENUM ('LIKE', 'NOPE');

-- CreateEnum
CREATE TYPE "SavedListType" AS ENUM ('FAVORITE', 'LATER');

-- CreateEnum
CREATE TYPE "LeadChannel" AS ENUM ('WHATSAPP', 'FORM', 'TOUR_REQUEST');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "source" "ListingSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "publisherRef" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "description" TEXT,
    "operationType" TEXT,
    "propertyType" TEXT,
    "currency" TEXT,
    "price" DOUBLE PRECISION,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaTotal" DOUBLE PRECISION,
    "areaCovered" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "addressText" TEXT,
    "locationText" VARCHAR(200),
    "heroImageUrl" TEXT,
    "photosCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAtSource" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingMedia" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PHOTO',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwipeDecision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "decision" "SwipeDecisionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwipeDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "listType" "SavedListType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "listingId" TEXT NOT NULL,
    "channel" "LeadChannel" NOT NULL,
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "targetPublisherRef" TEXT,
    "externalLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncWatermark" (
    "source" TEXT NOT NULL,
    "cursor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncWatermark_pkey" PRIMARY KEY ("source")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "retries" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Listing_status_lastSeenAt_idx" ON "Listing"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Listing_source_status_lastSeenAt_idx" ON "Listing"("source", "status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Listing_publisherRef_idx" ON "Listing"("publisherRef");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_source_externalId_key" ON "Listing"("source", "externalId");

-- CreateIndex
CREATE INDEX "ListingMedia_listingId_sortOrder_idx" ON "ListingMedia"("listingId", "sortOrder");

-- CreateIndex
CREATE INDEX "SwipeDecision_userId_createdAt_idx" ON "SwipeDecision"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SwipeDecision_listingId_userId_idx" ON "SwipeDecision"("listingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SwipeDecision_userId_listingId_key" ON "SwipeDecision"("userId", "listingId");

-- CreateIndex
CREATE INDEX "SavedItem_userId_listType_idx" ON "SavedItem"("userId", "listType");

-- CreateIndex
CREATE UNIQUE INDEX "SavedItem_userId_listingId_listType_key" ON "SavedItem"("userId", "listingId", "listType");

-- CreateIndex
CREATE INDEX "Lead_listingId_idx" ON "Lead"("listingId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "OutboxEvent_processedAt_idx" ON "OutboxEvent"("processedAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_type_idx" ON "OutboxEvent"("type");

-- AddForeignKey
ALTER TABLE "ListingMedia" ADD CONSTRAINT "ListingMedia_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwipeDecision" ADD CONSTRAINT "SwipeDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwipeDecision" ADD CONSTRAINT "SwipeDecision_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
