-- AlterEnum
ALTER TYPE "ListingSource" ADD VALUE 'KITEPROP_DIFUSION_YUMBLIN';

-- CreateTable
CREATE TABLE IF NOT EXISTS "IngestSourceConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "sourcesJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestSourceConfig_pkey" PRIMARY KEY ("id")
);
