-- Sprint 7: estado último test Kiteprop
ALTER TABLE "KitepropIntegration" ADD COLUMN IF NOT EXISTS "lastTestOk" BOOLEAN;
ALTER TABLE "KitepropIntegration" ADD COLUMN IF NOT EXISTS "lastTestHttpStatus" INTEGER;
ALTER TABLE "KitepropIntegration" ADD COLUMN IF NOT EXISTS "lastTestAt" TIMESTAMP(3);
