CREATE TYPE "DriverOnboardingStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'DOCUMENTS_SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REVOKED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE "DriverDocumentType" AS ENUM (
  'DRIVING_LICENSE',
  'TRANSPORT_BADGE',
  'AADHAAR',
  'PAN',
  'PROFILE_PHOTO',
  'POLICE_VERIFICATION',
  'VEHICLE_RC',
  'INSURANCE',
  'PERMIT',
  'FITNESS_CERTIFICATE',
  'PUC_CERTIFICATE',
  'OWNER_NOC',
  'BANK_PROOF',
  'LIVE_SELFIE'
);

CREATE TYPE "DocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "DriverOnboarding" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "status" "DriverOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "safetyChecklist" JSONB NOT NULL DEFAULT '{}',
  "safetyTrainingComplete" BOOLEAN NOT NULL DEFAULT false,
  "bankAccountEncrypted" TEXT,
  "bankAccountLast4" TEXT,
  "bankIfsc" TEXT,
  "adminComments" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DriverOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DriverOnboardingDocument" (
  "id" TEXT NOT NULL,
  "onboardingId" TEXT NOT NULL,
  "type" "DriverDocumentType" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
  "expiryDate" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "reviewedById" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "DriverOnboardingDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DriverVerificationHistory" (
  "id" TEXT NOT NULL,
  "onboardingId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverVerificationHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriverOnboarding_driverId_key" ON "DriverOnboarding"("driverId");
CREATE UNIQUE INDEX "DriverOnboardingDocument_storageKey_key" ON "DriverOnboardingDocument"("storageKey");
CREATE UNIQUE INDEX "DriverOnboardingDocument_onboardingId_type_key" ON "DriverOnboardingDocument"("onboardingId", "type");
CREATE INDEX "DriverOnboardingDocument_status_expiryDate_idx" ON "DriverOnboardingDocument"("status", "expiryDate");
CREATE INDEX "DriverVerificationHistory_onboardingId_createdAt_idx" ON "DriverVerificationHistory"("onboardingId", "createdAt");
CREATE INDEX "DriverVerificationHistory_actorId_createdAt_idx" ON "DriverVerificationHistory"("actorId", "createdAt");

ALTER TABLE "DriverOnboarding"
  ADD CONSTRAINT "DriverOnboarding_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverOnboardingDocument"
  ADD CONSTRAINT "DriverOnboardingDocument_onboardingId_fkey"
  FOREIGN KEY ("onboardingId") REFERENCES "DriverOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverOnboardingDocument"
  ADD CONSTRAINT "DriverOnboardingDocument_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DriverVerificationHistory"
  ADD CONSTRAINT "DriverVerificationHistory_onboardingId_fkey"
  FOREIGN KEY ("onboardingId") REFERENCES "DriverOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverVerificationHistory"
  ADD CONSTRAINT "DriverVerificationHistory_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
