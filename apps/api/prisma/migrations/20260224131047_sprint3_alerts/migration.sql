-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('NEW_LISTING');

-- CreateTable
CREATE TABLE "AlertSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedSearchId" TEXT,
    "filtersJson" JSONB,
    "type" "AlertType" NOT NULL DEFAULT 'NEW_LISTING',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL DEFAULT 'NEW_LISTING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertSubscription_userId_isEnabled_idx" ON "AlertSubscription"("userId", "isEnabled");

-- CreateIndex
CREATE INDEX "AlertDelivery_subscriptionId_idx" ON "AlertDelivery"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertDelivery_subscriptionId_listingId_type_key" ON "AlertDelivery"("subscriptionId", "listingId", "type");

-- AddForeignKey
ALTER TABLE "AlertSubscription" ADD CONSTRAINT "AlertSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSubscription" ADD CONSTRAINT "AlertSubscription_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AlertSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
