-- AlterTable: add User.activeSearchId (optional FK to SavedSearch)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeSearchId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_activeSearchId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_activeSearchId_fkey" FOREIGN KEY ("activeSearchId") REFERENCES "SavedSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
