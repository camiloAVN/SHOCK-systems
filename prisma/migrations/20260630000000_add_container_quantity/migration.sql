-- AlterTable
-- Additive, nullable column: existing rows get NULL, no data loss.
ALTER TABLE "inventory_items" ADD COLUMN "containerQuantity" INTEGER;
