-- AlterTable: add payloadTemplate to KitepropIntegration
ALTER TABLE "KitepropIntegration" ADD COLUMN "payloadTemplate" TEXT;

-- CreateTable: KitepropOpenApiSpec
CREATE TABLE "KitepropOpenApiSpec" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "format" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitepropOpenApiSpec_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KitepropOpenApiSpec_userId_key" ON "KitepropOpenApiSpec"("userId");
CREATE INDEX "KitepropOpenApiSpec_userId_idx" ON "KitepropOpenApiSpec"("userId");
CREATE INDEX "KitepropOpenApiSpec_orgId_idx" ON "KitepropOpenApiSpec"("orgId");
