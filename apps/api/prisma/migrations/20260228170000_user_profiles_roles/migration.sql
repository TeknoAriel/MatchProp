-- AlterEnum: add REALTOR and INMOBILIARIA to UserRole
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'REALTOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'INMOBILIARIA';

-- CreateTable: UserProfile
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "dni" TEXT,
    "matricula" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "telegram" TEXT,
    "twitter" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "website" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- AlterTable: Organization - campos inmobiliaria
ALTER TABLE "Organization" ADD COLUMN "commercialName" TEXT;
ALTER TABLE "Organization" ADD COLUMN "address" TEXT;
ALTER TABLE "Organization" ADD COLUMN "phone" TEXT;
ALTER TABLE "Organization" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "Organization" ADD COLUMN "telegram" TEXT;
ALTER TABLE "Organization" ADD COLUMN "twitter" TEXT;
ALTER TABLE "Organization" ADD COLUMN "instagram" TEXT;
ALTER TABLE "Organization" ADD COLUMN "facebook" TEXT;
ALTER TABLE "Organization" ADD COLUMN "website" TEXT;

-- AlterTable: User - organizationId para agentes/corredores bajo inmobiliaria
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;

-- AddForeignKey: UserProfile -> User
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: User -> Organization
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
