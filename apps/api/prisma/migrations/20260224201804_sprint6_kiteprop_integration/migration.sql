-- CreateTable
CREATE TABLE "KitepropIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "baseUrl" TEXT NOT NULL,
    "leadCreatePath" TEXT NOT NULL DEFAULT '/leads',
    "authHeaderName" TEXT NOT NULL DEFAULT 'X-API-Key',
    "authFormat" TEXT NOT NULL DEFAULT 'ApiKey',
    "apiKeyEncrypted" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitepropIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KitepropIntegration_userId_idx" ON "KitepropIntegration"("userId");

-- CreateIndex
CREATE INDEX "KitepropIntegration_orgId_idx" ON "KitepropIntegration"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "KitepropIntegration_userId_key" ON "KitepropIntegration"("userId");
