-- Fase 3 de la app de asistencia: consentimiento en el servidor y telefono vinculado.
-- Migracion SOLO ADITIVA: dos tablas nuevas.

-- CreateTable
CREATE TABLE "consent_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installationId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "consent_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeUserId" TEXT,
    "installationId" TEXT NOT NULL,
    "platform" TEXT,
    "deviceModel" TEXT,
    "appVersion" TEXT,
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unboundAt" TIMESTAMP(3),
    "unboundById" TEXT,
    "unboundReason" TEXT,

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_acceptances_userId_version_idx" ON "consent_acceptances"("userId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_devices_activeUserId_key" ON "mobile_devices"("activeUserId");

-- CreateIndex
CREATE INDEX "mobile_devices_userId_idx" ON "mobile_devices"("userId");

-- CreateIndex
CREATE INDEX "mobile_devices_installationId_idx" ON "mobile_devices"("installationId");

-- AddForeignKey
ALTER TABLE "consent_acceptances" ADD CONSTRAINT "consent_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_activeUserId_fkey" FOREIGN KEY ("activeUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_unboundById_fkey" FOREIGN KEY ("unboundById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

