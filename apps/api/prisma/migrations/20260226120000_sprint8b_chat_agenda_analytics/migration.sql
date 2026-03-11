-- Sprint 8b: Publisher AGENT, Message, Visit, AnalyticsEvent, Kiteprop pending/active

-- 1) PublisherType: add AGENT
ALTER TYPE "PublisherType" ADD VALUE IF NOT EXISTS 'AGENT';

-- 2) Message (chat solo ACTIVE)
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Message_leadId_createdAt_idx" ON "Message"("leadId", "createdAt");
ALTER TABLE "Message" ADD CONSTRAINT "Message_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Visit (agenda solo ACTIVE)
CREATE TABLE IF NOT EXISTS "Visit" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Visit_leadId_scheduledAt_idx" ON "Visit"("leadId", "scheduledAt");
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) AnalyticsEvent
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "userId" TEXT,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventName_createdAt_idx" ON "AnalyticsEvent"("eventName", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");

-- 5) KitepropIntegration: payloadTemplatePending, payloadTemplateActive
ALTER TABLE "KitepropIntegration" ADD COLUMN IF NOT EXISTS "payloadTemplatePending" TEXT;
ALTER TABLE "KitepropIntegration" ADD COLUMN IF NOT EXISTS "payloadTemplateActive" TEXT;

-- 6) LeadDeliveryAttempt: payloadStage para idempotencia por etapa
ALTER TABLE "LeadDeliveryAttempt" ADD COLUMN IF NOT EXISTS "payloadStage" TEXT;
