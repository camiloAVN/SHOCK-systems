-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('SECTOR', 'CUADRANTE', 'RACK', 'NIVEL', 'POSICION');

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "locationId" TEXT;

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "fullPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_parentId_idx" ON "locations"("parentId");

-- CreateIndex
CREATE INDEX "locations_type_idx" ON "locations"("type");

-- CreateIndex
CREATE UNIQUE INDEX "locations_parentId_code_key" ON "locations"("parentId", "code");

-- CreateIndex
CREATE INDEX "inventory_items_locationId_idx" ON "inventory_items"("locationId");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
