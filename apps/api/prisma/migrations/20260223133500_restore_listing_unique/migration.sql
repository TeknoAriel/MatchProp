-- Restore unique constraint lost when source column was migrated
CREATE UNIQUE INDEX IF NOT EXISTS "Listing_source_externalId_key" ON "Listing"("source", "externalId");
