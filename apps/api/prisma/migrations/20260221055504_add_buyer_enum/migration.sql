-- Add BUYER to UserRole enum (must run in separate migration - PostgreSQL requires commit before use)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BUYER';
