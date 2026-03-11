-- Idempotent: solo aplica si la primera migración (20260225000000) no corrió.
-- Evita P3018 (column already exists) y colisiones de tabla/índices.

-- AlterTable (IF NOT EXISTS desde PG 9.6)
ALTER TABLE "KitepropIntegration" ADD COLUMN IF NOT EXISTS "payloadTemplate" TEXT;

-- CreateTable (IF NOT EXISTS desde PG 9.5)
CREATE TABLE IF NOT EXISTS "KitepropOpenApiSpec" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "format" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitepropOpenApiSpec_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS desde PG 9.5)
CREATE UNIQUE INDEX IF NOT EXISTS "KitepropOpenApiSpec_userId_key" ON "KitepropOpenApiSpec"("userId");
CREATE INDEX IF NOT EXISTS "KitepropOpenApiSpec_userId_idx" ON "KitepropOpenApiSpec"("userId");
CREATE INDEX IF NOT EXISTS "KitepropOpenApiSpec_orgId_idx" ON "KitepropOpenApiSpec"("orgId");
