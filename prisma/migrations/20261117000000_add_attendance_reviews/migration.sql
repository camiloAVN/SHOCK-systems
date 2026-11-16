-- CreateEnum
CREATE TYPE "AttendanceReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "attendance_mark_reviews" (
    "id" TEXT NOT NULL,
    "markId" TEXT NOT NULL,
    "decision" "AttendanceReviewDecision" NOT NULL,
    "note" TEXT NOT NULL,
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_mark_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_overtime_decisions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "decision" "AttendanceReviewDecision" NOT NULL,
    "computedMinutes" INTEGER NOT NULL,
    "approvedMinutes" INTEGER NOT NULL,
    "note" TEXT,
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_overtime_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_mark_reviews_markId_key" ON "attendance_mark_reviews"("markId");

-- CreateIndex
CREATE INDEX "attendance_mark_reviews_createdAt_idx" ON "attendance_mark_reviews"("createdAt");

-- CreateIndex
CREATE INDEX "attendance_overtime_decisions_shiftId_idx" ON "attendance_overtime_decisions"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_overtime_decisions_userId_shiftId_key" ON "attendance_overtime_decisions"("userId", "shiftId");

-- AddForeignKey
ALTER TABLE "attendance_mark_reviews" ADD CONSTRAINT "attendance_mark_reviews_markId_fkey" FOREIGN KEY ("markId") REFERENCES "attendance_marks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_mark_reviews" ADD CONSTRAINT "attendance_mark_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_overtime_decisions" ADD CONSTRAINT "attendance_overtime_decisions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_overtime_decisions" ADD CONSTRAINT "attendance_overtime_decisions_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "attendance_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_overtime_decisions" ADD CONSTRAINT "attendance_overtime_decisions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Reglas en la base: los minutos aprobados nunca superan los calculados
ALTER TABLE "attendance_overtime_decisions" ADD CONSTRAINT "attendance_overtime_minutes_check" CHECK ("computedMinutes" >= 0 AND "approvedMinutes" >= 0 AND "approvedMinutes" <= "computedMinutes");
