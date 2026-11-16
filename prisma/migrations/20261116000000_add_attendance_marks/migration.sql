-- Fase 6 de la app de asistencia: marcaciones y bloqueos de turno.
-- Migracion SOLO ADITIVA: dos enums y dos tablas nuevas; no modifica ni borra nada existente.

-- CreateEnum
CREATE TYPE "AttendanceMarkType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "AttendanceMarkStatus" AS ENUM ('VALID', 'PENDING_REVIEW', 'FACE_MISMATCH', 'REJECTED');

-- CreateTable
CREATE TABLE "attendance_marks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "clientMarkId" TEXT NOT NULL,
    "type" "AttendanceMarkType" NOT NULL,
    "status" "AttendanceMarkStatus" NOT NULL,
    "reasons" TEXT[],
    "officialAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyMeters" DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION,
    "mocked" BOOLEAN NOT NULL DEFAULT false,
    "similarity" DOUBLE PRECISION,
    "selfieKey" TEXT,
    "selfieBytes" INTEGER,
    "livenessMethod" TEXT NOT NULL,
    "livenessAttemptId" TEXT NOT NULL,
    "installationId" TEXT,
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_shift_locks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "activeKey" TEXT,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockedAt" TIMESTAMP(3),
    "unlockedById" TEXT,
    "unlockNote" TEXT,

    CONSTRAINT "attendance_shift_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_marks_livenessAttemptId_key" ON "attendance_marks"("livenessAttemptId");

-- CreateIndex
CREATE INDEX "attendance_marks_shiftId_userId_officialAt_idx" ON "attendance_marks"("shiftId", "userId", "officialAt");

-- CreateIndex
CREATE INDEX "attendance_marks_status_officialAt_idx" ON "attendance_marks"("status", "officialAt");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_marks_userId_clientMarkId_key" ON "attendance_marks"("userId", "clientMarkId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_shift_locks_activeKey_key" ON "attendance_shift_locks"("activeKey");

-- CreateIndex
CREATE INDEX "attendance_shift_locks_shiftId_userId_idx" ON "attendance_shift_locks"("shiftId", "userId");

-- CreateIndex
CREATE INDEX "attendance_shift_locks_unlockedAt_idx" ON "attendance_shift_locks"("unlockedAt");

-- AddForeignKey
ALTER TABLE "attendance_marks" ADD CONSTRAINT "attendance_marks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_marks" ADD CONSTRAINT "attendance_marks_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "attendance_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_marks" ADD CONSTRAINT "attendance_marks_livenessAttemptId_fkey" FOREIGN KEY ("livenessAttemptId") REFERENCES "liveness_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_shift_locks" ADD CONSTRAINT "attendance_shift_locks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_shift_locks" ADD CONSTRAINT "attendance_shift_locks_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_shift_locks" ADD CONSTRAINT "attendance_shift_locks_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "attendance_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
