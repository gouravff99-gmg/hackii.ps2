-- Additive, non-destructive migration: service categories + pool capacity.
-- Existing rows default to CAR (current behaviour) and remain valid.

CREATE TYPE "VehicleCategory" AS ENUM ('BIKE', 'CAR', 'POOL');

ALTER TABLE "Driver"
  ADD COLUMN "vehicleCategory" "VehicleCategory" NOT NULL DEFAULT 'CAR',
  ADD COLUMN "poolEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "seatCapacity" INTEGER NOT NULL DEFAULT 4;

ALTER TABLE "Ride"
  ADD COLUMN "category" "VehicleCategory" NOT NULL DEFAULT 'CAR';

CREATE INDEX "Driver_vehicleCategory_status_idx" ON "Driver"("vehicleCategory", "status");
CREATE INDEX "Ride_category_requestedAt_idx" ON "Ride"("category", "requestedAt");
