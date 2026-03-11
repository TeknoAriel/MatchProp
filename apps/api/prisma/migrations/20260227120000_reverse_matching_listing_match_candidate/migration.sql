-- Reverse-matching: ListingMatchCandidate (persistencia candidatos listing ↔ búsqueda activa)

CREATE TABLE IF NOT EXISTS "ListingMatchCandidate" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "savedSearchId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingMatchCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ListingMatchCandidate_listingId_savedSearchId_key"
    ON "ListingMatchCandidate"("listingId", "savedSearchId");

CREATE INDEX IF NOT EXISTS "ListingMatchCandidate_listingId_idx"
    ON "ListingMatchCandidate"("listingId");

CREATE INDEX IF NOT EXISTS "ListingMatchCandidate_savedSearchId_createdAt_idx"
    ON "ListingMatchCandidate"("savedSearchId", "createdAt");
