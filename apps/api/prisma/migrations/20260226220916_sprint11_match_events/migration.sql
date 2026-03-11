-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "matchesCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'DEMO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchEvent_listingId_idx" ON "MatchEvent"("listingId");

-- CreateIndex
CREATE INDEX "MatchEvent_createdAt_idx" ON "MatchEvent"("createdAt");
