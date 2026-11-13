-- Fase 4 de la app de asistencia: registro facial y prueba de vida.
-- Migracion SOLO ADITIVA: un enum y dos tablas nuevas.

-- CreateEnum
CREATE TYPE "FaceEnrollmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'REVOKED');

-- CreateTable
CREATE TABLE "face_enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeUserId" TEXT,
    "status" "FaceEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "imageKey" TEXT,
    "imageBytes" INTEGER,
    "livenessMethod" TEXT NOT NULL,
    "livenessAttemptId" TEXT NOT NULL,
    "challengeSteps" TEXT[],
    "quality" JSONB,
    "installationId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "imageDeletedAt" TIMESTAMP(3),

    CONSTRAINT "face_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liveness_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "steps" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liveness_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "face_enrollments_activeUserId_key" ON "face_enrollments"("activeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "face_enrollments_livenessAttemptId_key" ON "face_enrollments"("livenessAttemptId");

-- CreateIndex
CREATE INDEX "face_enrollments_userId_idx" ON "face_enrollments"("userId");

-- CreateIndex
CREATE INDEX "face_enrollments_status_submittedAt_idx" ON "face_enrollments"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "liveness_attempts_userId_createdAt_idx" ON "liveness_attempts"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_activeUserId_fkey" FOREIGN KEY ("activeUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_enrollments" ADD CONSTRAINT "face_enrollments_livenessAttemptId_fkey" FOREIGN KEY ("livenessAttemptId") REFERENCES "liveness_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liveness_attempts" ADD CONSTRAINT "liveness_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

