-- CreateEnum
CREATE TYPE "SignupMethod" AS ENUM ('PASSWORD', 'MAGIC_LINK', 'OAUTH_GOOGLE', 'OAUTH_APPLE', 'OAUTH_FACEBOOK', 'DEMO', 'ADMIN_GRANT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signupMethod" "SignupMethod",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill updatedAt for existing rows (Prisma @updatedAt)
UPDATE "User" SET "updatedAt" = "createdAt" WHERE "updatedAt" = CURRENT_TIMESTAMP;
