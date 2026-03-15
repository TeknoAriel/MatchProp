-- AlterTable
ALTER TABLE "AssistantConfig" ADD COLUMN     "passwordEncrypted" TEXT,
ADD COLUMN     "tokenEncrypted" TEXT,
ADD COLUMN     "username" VARCHAR(200);
