-- AlterTable
ALTER TABLE "IngestSourceConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SendGridConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AssistantConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" VARCHAR(50),
    "apiKeyEncrypted" TEXT,
    "model" VARCHAR(100),
    "baseUrl" VARCHAR(500),
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "conversationalModel" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantConfig_pkey" PRIMARY KEY ("id")
);
