-- SendGrid config para Magic Link, habilitable desde settings en prod
CREATE TABLE "SendGridConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "apiKeyEncrypted" TEXT,
    "fromEmail" TEXT DEFAULT 'noreply@matchprop.com',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SendGridConfig_pkey" PRIMARY KEY ("id")
);
