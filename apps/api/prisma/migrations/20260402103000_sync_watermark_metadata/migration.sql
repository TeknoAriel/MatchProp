-- Ingest: ETag + acumulación de externalIds para bajas al cerrar sync (Properstar)
ALTER TABLE "SyncWatermark" ADD COLUMN "metadata" JSONB;
