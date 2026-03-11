-- CreateIndex
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");

-- CreateIndex
CREATE INDEX "Property_price_idx" ON "Property"("price");

-- CreateIndex
CREATE INDEX "Property_operation_propertyType_idx" ON "Property"("operation", "propertyType");

-- CreateIndex
CREATE INDEX "Swipe_userId_createdAt_idx" ON "Swipe"("userId", "createdAt");
