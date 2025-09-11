-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('MATERIAL_CHANGE', 'NEW_FILING', 'EARNINGS_UPDATE', 'GUIDANCE_CHANGE');

-- CreateEnum
CREATE TYPE "AlertMethod" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FILING_INGESTION', 'ALERT_DISPATCH', 'PRICE_UPDATE', 'DIFF_GENERATION');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaterialitySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "materialityThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "formTypes" TEXT[] DEFAULT ARRAY['10-K', '10-Q', '8-K']::TEXT[],
    "stripeCustomerId" TEXT,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "subscriptionTier" TEXT,
    "subscriptionEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cik" TEXT NOT NULL,
    "industry" TEXT,
    "sector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_companies" (
    "watchlistId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_companies_pkey" PRIMARY KEY ("watchlistId","companyId")
);

-- CreateTable
CREATE TABLE "filings" (
    "id" TEXT NOT NULL,
    "accessionNo" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "filedDate" TIMESTAMP(3) NOT NULL,
    "reportDate" TIMESTAMP(3),
    "description" TEXT,
    "documentUrl" TEXT NOT NULL,
    "rawData" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "summary" TEXT,
    "keyHighlights" TEXT[],
    "overallImpact" TEXT,
    "totalChanges" INTEGER NOT NULL DEFAULT 0,
    "materialChanges" INTEGER NOT NULL DEFAULT 0,
    "jobId" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diffs" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "oldContent" TEXT,
    "newContent" TEXT,
    "summary" TEXT,
    "impact" TEXT,
    "materialityScore" DOUBLE PRECISION,
    "sectionOrder" INTEGER,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "method" "AlertMethod" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_watchlist_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "alertTypes" "AlertType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_watchlist_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiality_tags" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "severity" "MaterialitySeverity" NOT NULL,
    "description" TEXT,
    "filingId" TEXT NOT NULL,
    "diffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materiality_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_symbol_key" ON "companies"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "companies_cik_key" ON "companies"("cik");

-- CreateIndex
CREATE UNIQUE INDEX "filings_accessionNo_key" ON "filings"("accessionNo");

-- CreateIndex
CREATE INDEX "filings_companyId_filedDate_idx" ON "filings"("companyId", "filedDate");

-- CreateIndex
CREATE INDEX "filings_formType_filedDate_idx" ON "filings"("formType", "filedDate");

-- CreateIndex
CREATE INDEX "filings_processed_createdAt_idx" ON "filings"("processed", "createdAt");

-- CreateIndex
CREATE INDEX "diffs_filingId_materialityScore_idx" ON "diffs"("filingId", "materialityScore");

-- CreateIndex
CREATE INDEX "diffs_sectionType_changeType_idx" ON "diffs"("sectionType", "changeType");

-- CreateIndex
CREATE UNIQUE INDEX "user_watchlist_settings_userId_ticker_key" ON "user_watchlist_settings"("userId", "ticker");

-- CreateIndex
CREATE INDEX "jobs_status_nextRetryAt_idx" ON "jobs"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");

-- CreateIndex
CREATE INDEX "materiality_tags_filingId_severity_idx" ON "materiality_tags"("filingId", "severity");

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_companies" ADD CONSTRAINT "watchlist_companies_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_companies" ADD CONSTRAINT "watchlist_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filings" ADD CONSTRAINT "filings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diffs" ADD CONSTRAINT "diffs_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_watchlist_settings" ADD CONSTRAINT "user_watchlist_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiality_tags" ADD CONSTRAINT "materiality_tags_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "filings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiality_tags" ADD CONSTRAINT "materiality_tags_diffId_fkey" FOREIGN KEY ("diffId") REFERENCES "diffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;