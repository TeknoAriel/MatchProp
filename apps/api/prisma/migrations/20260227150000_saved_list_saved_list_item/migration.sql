-- CreateTable
CREATE TABLE IF NOT EXISTS "SavedList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SavedListItem" (
    "id" TEXT NOT NULL,
    "savedListId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SavedList_userId_idx" ON "SavedList"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SavedListItem_savedListId_listingId_key" ON "SavedListItem"("savedListId", "listingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SavedListItem_savedListId_idx" ON "SavedListItem"("savedListId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SavedList_userId_fkey'
  ) THEN
    ALTER TABLE "SavedList" ADD CONSTRAINT "SavedList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SavedListItem_savedListId_fkey'
  ) THEN
    ALTER TABLE "SavedListItem" ADD CONSTRAINT "SavedListItem_savedListId_fkey" FOREIGN KEY ("savedListId") REFERENCES "SavedList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SavedListItem_listingId_fkey'
  ) THEN
    ALTER TABLE "SavedListItem" ADD CONSTRAINT "SavedListItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
