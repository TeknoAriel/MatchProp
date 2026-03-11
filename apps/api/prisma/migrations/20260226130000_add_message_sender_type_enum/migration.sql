-- Create MessageSenderType enum for Message.senderType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageSenderType') THEN
    CREATE TYPE "MessageSenderType" AS ENUM ('BUYER', 'PUBLISHER', 'SYSTEM');
  END IF;
END
$$;

-- Alter Message.senderType to use enum (if still text)
ALTER TABLE "Message" ALTER COLUMN "senderType" TYPE "MessageSenderType" USING "senderType"::"MessageSenderType";
