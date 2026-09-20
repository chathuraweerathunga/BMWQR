-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('HOTEL', 'RESORT', 'GUESTHOUSE', 'VILLA', 'RESTAURANT', 'CAFE', 'SALON', 'SPA', 'GYM', 'COWORKING', 'OFFICE', 'APARTMENT', 'EVENT_VENUE', 'OTHER');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('BUSINESS_OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('ROOM', 'BUILDING', 'FLOOR', 'POOL', 'TABLE', 'BAR', 'PRIVATE_ROOM', 'SPA_ROOM', 'TREATMENT_ROOM', 'CHAIR', 'GYM_AREA', 'EQUIPMENT', 'LOCKER', 'DESK', 'MEETING_ROOM', 'UNIT', 'COMMON_AREA', 'PARKING', 'RECEPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "GuestStayStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "QRCodeStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BusinessType" NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'TRIAL',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "welcomeMessage" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "contactEmail" TEXT,
    "website" TEXT,
    "description" TEXT,
    "supportedLocales" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_memberships" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "parentLocationId" TEXT,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "status" "LocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "departmentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" TEXT,
    "defaultPriority" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "estimatedMinutes" INTEGER,
    "price" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_codes" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "QRCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "label" TEXT,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_stays" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "locationId" TEXT,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3) NOT NULL,
    "actualCheckOutAt" TIMESTAMP(3),
    "status" "GuestStayStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_stays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "guestStayId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "originQrCodeId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "guestStayId" TEXT,
    "locationId" TEXT NOT NULL,
    "serviceId" TEXT,
    "departmentId" TEXT,
    "assignedMembershipId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "createdByGuestId" TEXT,
    "createdByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_history" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "changedByUserId" TEXT,
    "changedByGuestId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requestId" TEXT,
    "guestStayId" TEXT,
    "guestId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requestId" TEXT,
    "uploaderUserId" TEXT,
    "uploaderGuestId" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateIndex
CREATE INDEX "businesses_status_idx" ON "businesses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "business_settings_businessId_key" ON "business_settings"("businessId");

-- CreateIndex
CREATE INDEX "business_memberships_businessId_role_status_idx" ON "business_memberships"("businessId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_memberships_businessId_id_key" ON "business_memberships"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "business_memberships_businessId_userId_key" ON "business_memberships"("businessId", "userId");

-- CreateIndex
CREATE INDEX "locations_businessId_type_idx" ON "locations"("businessId", "type");

-- CreateIndex
CREATE INDEX "locations_businessId_parentLocationId_idx" ON "locations"("businessId", "parentLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "locations_businessId_id_key" ON "locations"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_businessId_id_key" ON "departments"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_businessId_name_key" ON "departments"("businessId", "name");

-- CreateIndex
CREATE INDEX "services_businessId_isActive_idx" ON "services"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "services_businessId_id_key" ON "services"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_tokenHash_key" ON "qr_codes"("tokenHash");

-- CreateIndex
CREATE INDEX "qr_codes_businessId_locationId_idx" ON "qr_codes"("businessId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_businessId_id_key" ON "qr_codes"("businessId", "id");

-- CreateIndex
CREATE INDEX "guests_businessId_email_idx" ON "guests"("businessId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "guests_businessId_id_key" ON "guests"("businessId", "id");

-- CreateIndex
CREATE INDEX "guest_stays_businessId_status_idx" ON "guest_stays"("businessId", "status");

-- CreateIndex
CREATE INDEX "guest_stays_businessId_locationId_idx" ON "guest_stays"("businessId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_stays_businessId_id_key" ON "guest_stays"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_tokenHash_key" ON "guest_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "guest_sessions_businessId_guestStayId_idx" ON "guest_sessions"("businessId", "guestStayId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_businessId_id_key" ON "guest_sessions"("businessId", "id");

-- CreateIndex
CREATE INDEX "requests_businessId_status_idx" ON "requests"("businessId", "status");

-- CreateIndex
CREATE INDEX "requests_businessId_departmentId_status_idx" ON "requests"("businessId", "departmentId", "status");

-- CreateIndex
CREATE INDEX "requests_businessId_assignedMembershipId_status_idx" ON "requests"("businessId", "assignedMembershipId", "status");

-- CreateIndex
CREATE INDEX "requests_businessId_locationId_idx" ON "requests"("businessId", "locationId");

-- CreateIndex
CREATE INDEX "requests_businessId_createdAt_idx" ON "requests"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "requests_businessId_id_key" ON "requests"("businessId", "id");

-- CreateIndex
CREATE INDEX "request_status_history_businessId_requestId_createdAt_idx" ON "request_status_history"("businessId", "requestId", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_businessId_requestId_idx" ON "feedback"("businessId", "requestId");

-- CreateIndex
CREATE INDEX "feedback_businessId_rating_idx" ON "feedback"("businessId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_businessId_id_key" ON "feedback"("businessId", "id");

-- CreateIndex
CREATE INDEX "attachments_businessId_requestId_idx" ON "attachments"("businessId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_businessId_id_key" ON "attachments"("businessId", "id");

-- CreateIndex
CREATE INDEX "audit_logs_businessId_entityType_entityId_idx" ON "audit_logs"("businessId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_businessId_createdAt_idx" ON "audit_logs"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_memberships" ADD CONSTRAINT "business_memberships_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_memberships" ADD CONSTRAINT "business_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_memberships" ADD CONSTRAINT "business_memberships_businessId_departmentId_fkey" FOREIGN KEY ("businessId", "departmentId") REFERENCES "departments"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_businessId_parentLocationId_fkey" FOREIGN KEY ("businessId", "parentLocationId") REFERENCES "locations"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_businessId_departmentId_fkey" FOREIGN KEY ("businessId", "departmentId") REFERENCES "departments"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_businessId_locationId_fkey" FOREIGN KEY ("businessId", "locationId") REFERENCES "locations"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_businessId_guestId_fkey" FOREIGN KEY ("businessId", "guestId") REFERENCES "guests"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_businessId_locationId_fkey" FOREIGN KEY ("businessId", "locationId") REFERENCES "locations"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_businessId_guestStayId_fkey" FOREIGN KEY ("businessId", "guestStayId") REFERENCES "guest_stays"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_businessId_originQrCodeId_fkey" FOREIGN KEY ("businessId", "originQrCodeId") REFERENCES "qr_codes"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_businessId_guestStayId_fkey" FOREIGN KEY ("businessId", "guestStayId") REFERENCES "guest_stays"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_businessId_locationId_fkey" FOREIGN KEY ("businessId", "locationId") REFERENCES "locations"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_businessId_serviceId_fkey" FOREIGN KEY ("businessId", "serviceId") REFERENCES "services"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_businessId_departmentId_fkey" FOREIGN KEY ("businessId", "departmentId") REFERENCES "departments"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_businessId_assignedMembershipId_fkey" FOREIGN KEY ("businessId", "assignedMembershipId") REFERENCES "business_memberships"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_businessId_createdByGuestId_fkey" FOREIGN KEY ("businessId", "createdByGuestId") REFERENCES "guests"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_businessId_requestId_fkey" FOREIGN KEY ("businessId", "requestId") REFERENCES "requests"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_businessId_changedByGuestId_fkey" FOREIGN KEY ("businessId", "changedByGuestId") REFERENCES "guests"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_businessId_requestId_fkey" FOREIGN KEY ("businessId", "requestId") REFERENCES "requests"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_businessId_guestStayId_fkey" FOREIGN KEY ("businessId", "guestStayId") REFERENCES "guest_stays"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_businessId_guestId_fkey" FOREIGN KEY ("businessId", "guestId") REFERENCES "guests"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_businessId_requestId_fkey" FOREIGN KEY ("businessId", "requestId") REFERENCES "requests"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_businessId_uploaderGuestId_fkey" FOREIGN KEY ("businessId", "uploaderGuestId") REFERENCES "guests"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

