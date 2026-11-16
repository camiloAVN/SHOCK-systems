-- Fase 5 de la app de asistencia: areas, asignaciones y turnos.
-- Migracion SOLO ADITIVA: tres tablas nuevas; no modifica ni borra nada existente.

-- CreateTable
CREATE TABLE "attendance_areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_assignments" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_shifts" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_areas_isActive_idx" ON "attendance_areas"("isActive");

-- CreateIndex
CREATE INDEX "attendance_areas_projectId_idx" ON "attendance_areas"("projectId");

-- CreateIndex
CREATE INDEX "attendance_assignments_areaId_idx" ON "attendance_assignments"("areaId");

-- CreateIndex
CREATE INDEX "attendance_assignments_userId_idx" ON "attendance_assignments"("userId");

-- CreateIndex
CREATE INDEX "attendance_assignments_teamId_idx" ON "attendance_assignments"("teamId");

-- CreateIndex
CREATE INDEX "attendance_shifts_assignmentId_idx" ON "attendance_shifts"("assignmentId");

-- CreateIndex
CREATE INDEX "attendance_shifts_endsAt_idx" ON "attendance_shifts"("endsAt");

-- AddForeignKey
ALTER TABLE "attendance_areas" ADD CONSTRAINT "attendance_areas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_areas" ADD CONSTRAINT "attendance_areas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_assignments" ADD CONSTRAINT "attendance_assignments_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "attendance_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_assignments" ADD CONSTRAINT "attendance_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_assignments" ADD CONSTRAINT "attendance_assignments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_assignments" ADD CONSTRAINT "attendance_assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_shifts" ADD CONSTRAINT "attendance_shifts_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "attendance_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reglas que Prisma no expresa (CHECK)
ALTER TABLE "attendance_assignments" ADD CONSTRAINT "attendance_assignments_one_target_check" CHECK (("userId" IS NULL) <> ("teamId" IS NULL));
ALTER TABLE "attendance_areas" ADD CONSTRAINT "attendance_areas_radius_check" CHECK ("radiusMeters" > 0);
ALTER TABLE "attendance_shifts" ADD CONSTRAINT "attendance_shifts_order_check" CHECK ("endsAt" > "startsAt");
