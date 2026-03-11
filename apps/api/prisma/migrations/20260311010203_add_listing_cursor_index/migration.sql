-- AlterTable
ALTER TABLE "ListingMatchCandidate" ALTER COLUMN "score" SET DEFAULT 1;

-- CreateIndex
CREATE INDEX "Listing_status_lastSeenAt_id_idx" ON "Listing"("status", "lastSeenAt", "id");
