-- Feed por defecto (date_desc): ORDER BY createdAt DESC, id DESC con status = ACTIVE
CREATE INDEX "Listing_status_createdAt_id_idx" ON "Listing"("status", "createdAt", "id");
