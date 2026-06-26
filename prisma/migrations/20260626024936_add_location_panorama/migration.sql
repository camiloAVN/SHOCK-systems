-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "markerOnLocationId" TEXT,
ADD COLUMN     "markerPitch" DOUBLE PRECISION,
ADD COLUMN     "markerYaw" DOUBLE PRECISION,
ADD COLUMN     "panoramaUrl" TEXT;

-- CreateIndex
CREATE INDEX "locations_markerOnLocationId_idx" ON "locations"("markerOnLocationId");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_markerOnLocationId_fkey" FOREIGN KEY ("markerOnLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
