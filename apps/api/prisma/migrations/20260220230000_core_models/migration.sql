-- DropForeignKey
ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT IF EXISTS "AnalyticsEvent_userId_fkey";
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_searchId_fkey";
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_propertyId_fkey";
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_userId_fkey";
ALTER TABLE "Interaction" DROP CONSTRAINT IF EXISTS "Interaction_searchId_fkey";
ALTER TABLE "Interaction" DROP CONSTRAINT IF EXISTS "Interaction_propertyId_fkey";
ALTER TABLE "Interaction" DROP CONSTRAINT IF EXISTS "Interaction_userId_fkey";
ALTER TABLE "Property" DROP CONSTRAINT IF EXISTS "Property_agencyId_fkey";
ALTER TABLE "Search" DROP CONSTRAINT IF EXISTS "Search_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "AnalyticsEvent";
DROP TABLE IF EXISTS "Lead";
DROP TABLE IF EXISTS "Interaction";
DROP TABLE IF EXISTS "Search";
DROP TABLE IF EXISTS "Property";
DROP TABLE IF EXISTS "Agency";
DROP TABLE IF EXISTS "User";

-- DropEnum
DROP TYPE IF EXISTS "InteractionAction";
DROP TYPE IF EXISTS "LeadStatus";
DROP TYPE IF EXISTS "ActivationType";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'ARS');

-- CreateEnum
CREATE TYPE "Operation" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "SwipeDirection" AS ENUM ('LIKE', 'DISLIKE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "locationText" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaM2" INTEGER,
    "operation" "Operation" NOT NULL DEFAULT 'SALE',
    "propertyType" "PropertyType" NOT NULL DEFAULT 'APARTMENT',
    "photos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minPrice" INTEGER,
    "maxPrice" INTEGER,
    "currency" TEXT,
    "operation" TEXT,
    "propertyTypes" JSONB,
    "bedroomsMin" INTEGER,
    "bathroomsMin" INTEGER,
    "areaMin" INTEGER,
    "locationText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Swipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "direction" "SwipeDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Swipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Preference_userId_key" ON "Preference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Swipe_userId_propertyId_key" ON "Swipe"("userId", "propertyId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
