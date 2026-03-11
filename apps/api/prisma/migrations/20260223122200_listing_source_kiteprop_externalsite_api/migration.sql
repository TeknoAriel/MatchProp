-- CreateEnum
CREATE TYPE "ListingSource_new" AS ENUM ('KITEPROP_API', 'KITEPROP_EXTERNALSITE', 'API_PARTNER_1');

-- AlterTable: migrate Listing.source
ALTER TABLE "Listing" ADD COLUMN "source_new" "ListingSource_new";

UPDATE "Listing" SET "source_new" = CASE
  WHEN "source"::text = 'KITEPROP' THEN 'KITEPROP_EXTERNALSITE'::"ListingSource_new"
  WHEN "source"::text = 'API_PARTNER_1' THEN 'API_PARTNER_1'::"ListingSource_new"
  WHEN "source"::text = 'API_PARTNER_2' THEN 'API_PARTNER_1'::"ListingSource_new"
  ELSE 'KITEPROP_EXTERNALSITE'::"ListingSource_new"
END;

ALTER TABLE "Listing" DROP COLUMN "source";
ALTER TABLE "Listing" RENAME COLUMN "source_new" TO "source";
ALTER TABLE "Listing" ALTER COLUMN "source" SET NOT NULL;

-- DropEnum
DROP TYPE "ListingSource";

-- RenameEnum
ALTER TYPE "ListingSource_new" RENAME TO "ListingSource";
