-- Performance optimization indexes for the WhatChanged application
-- These indexes are designed to optimize common query patterns

-- User table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON "User" (email) WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_stripe_customer 
ON "User" ("stripeCustomerId") WHERE "stripeCustomerId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verification 
ON "User" ("emailVerificationToken") WHERE "emailVerificationToken" IS NOT NULL;

-- Company table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_symbol_active 
ON "Company" (symbol) WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_cik 
ON "Company" (cik);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_industry_active 
ON "Company" (industry, symbol) WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_price_update 
ON "Company" ("lastPriceUpdate") WHERE "isActive" = true;

-- Filing table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_filings_company_filed_date 
ON "Filing" ("companyId", "filedDate" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_filings_ticker_date 
ON "Filing" (ticker, "filedDate" DESC) WHERE "isProcessed" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_filings_form_type_date 
ON "Filing" ("formType", "filedDate" DESC) WHERE "isProcessed" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_filings_cik_accession 
ON "Filing" (cik, "accessionNo");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_filings_filed_date_processed 
ON "Filing" ("filedDate" DESC) WHERE "isProcessed" = true;

-- Watchlist table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_watchlists_user_active 
ON "Watchlist" ("userId") WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_watchlists_company_active 
ON "Watchlist" ("companyId") WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_watchlists_user_company_active 
ON "Watchlist" ("userId", "companyId") WHERE "isActive" = true;

-- Alert table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_user_created 
ON "Alert" ("userId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_status_scheduled 
ON "Alert" (status, "scheduledFor") WHERE status IN ('PENDING', 'PROCESSING');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_filing_user 
ON "Alert" ("filingId", "userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_type_created 
ON "Alert" (type, "createdAt" DESC);

-- Subscription table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_user 
ON "Subscription" ("userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_stripe_id 
ON "Subscription" ("stripeSubscriptionId") WHERE "stripeSubscriptionId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_status_active 
ON "Subscription" (status) WHERE status IN ('active', 'trialing');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_period_end 
ON "Subscription" ("currentPeriodEnd") WHERE status IN ('active', 'trialing');

-- Job table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_scheduled 
ON "Job" (status, "scheduledFor", priority DESC) 
WHERE status = 'PENDING' AND "scheduledFor" <= NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_type_created 
ON "Job" (type, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_completed 
ON "Job" (status, "completedAt" DESC) WHERE status IN ('COMPLETED', 'FAILED');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_retry_count 
ON "Job" ("retryCount", "scheduledFor") WHERE status = 'FAILED' AND "retryCount" < "maxRetries";

-- FilingDiff table indexes (if it exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_filing_diffs_filing_materiality 
ON "FilingDiff" ("filingId", "materialityScore" DESC) WHERE "materialityScore" >= 0.7;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_filing_diffs_section_materiality 
ON "FilingDiff" (section, "materialityScore" DESC) WHERE "materialityScore" >= 0.7;

-- UserPreference table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_user 
ON "UserPreference" ("userId");

-- Payment table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_stripe_customer 
ON "Payment" ("stripeCustomerId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created_status 
ON "Payment" ("createdAt" DESC, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_intent_id 
ON "Payment" ("stripePaymentIntentId") WHERE "stripePaymentIntentId" IS NOT NULL;

-- SMS and Email log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sms_logs_sent_at 
ON "SmsLog" ("sentAt" DESC) WHERE status = 'sent';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_sent_at 
ON "EmailLog" ("sentAt" DESC) WHERE status = 'sent';

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_watchlist_user 
ON "Watchlist" ("userId", "companyId", "isActive") 
INCLUDE ("alertsEnabled", "materialityThreshold");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_filings_company_recent 
ON "Filing" ("companyId", "isProcessed", "filedDate" DESC) 
WHERE "isProcessed" = true AND "filedDate" >= NOW() - INTERVAL '30 days';

-- Full-text search indexes (if using PostgreSQL text search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_search 
ON "Company" USING gin(to_tsvector('english', name || ' ' || symbol || ' ' || COALESCE(industry, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_filings_content_search 
ON "Filing" USING gin(to_tsvector('english', COALESCE(summary, '') || ' ' || COALESCE("keyHighlights"::text, '')))
WHERE "isProcessed" = true;

-- Partial indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_verified_active 
ON "User" ("emailVerified", "createdAt" DESC) 
WHERE "isActive" = true AND "emailVerified" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_recent_pending 
ON "Alert" ("createdAt" DESC, status) 
WHERE "createdAt" >= NOW() - INTERVAL '7 days' AND status = 'PENDING';

-- Indexes for analytical queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_filings_analytics 
ON "Filing" ("filedDate"::date, "formType", "companyId") 
WHERE "isProcessed" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_analytics 
ON "Alert" (type, "createdAt"::date, status);

-- Performance monitoring indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_performance 
ON "Job" (type, status, "startedAt", "completedAt") 
WHERE "startedAt" IS NOT NULL;

-- Cleanup indexes for maintenance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_cleanup 
ON "Job" ("completedAt", status) 
WHERE status IN ('COMPLETED', 'FAILED') AND "completedAt" < NOW() - INTERVAL '7 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_cleanup 
ON "Alert" ("createdAt", status) 
WHERE status = 'SENT' AND "createdAt" < NOW() - INTERVAL '90 days';

-- Notification delivery indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_delivery 
ON "Alert" ("userId", status, "scheduledFor") 
WHERE status IN ('PENDING', 'PROCESSING') 
AND "scheduledFor" <= NOW() + INTERVAL '5 minutes';

-- User activity tracking indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity 
ON "Watchlist" ("userId", "createdAt" DESC) 
WHERE "isActive" = true;

-- Database statistics update
-- Run this after creating indexes to update query planner statistics
ANALYZE "User";
ANALYZE "Company";
ANALYZE "Filing";
ANALYZE "Watchlist";
ANALYZE "Alert";
ANALYZE "Subscription";
ANALYZE "Job";
ANALYZE "Payment";

-- Comments for documentation
COMMENT ON INDEX idx_companies_symbol_active IS 'Optimizes company lookups by symbol for active companies';
COMMENT ON INDEX idx_filings_company_filed_date IS 'Optimizes chronological filing queries per company';
COMMENT ON INDEX idx_watchlists_user_active IS 'Optimizes user watchlist queries';
COMMENT ON INDEX idx_alerts_status_scheduled IS 'Optimizes alert queue processing';
COMMENT ON INDEX idx_jobs_status_scheduled IS 'Optimizes job queue processing with priority';
COMMENT ON INDEX idx_filings_company_recent IS 'Optimizes recent filings queries (30-day window)';

-- Index maintenance notes
-- These indexes should be monitored for:
-- 1. Usage statistics: pg_stat_user_indexes
-- 2. Size growth: pg_indexes_size
-- 3. Bloat: pg_stat_all_indexes
-- 4. Lock contention during concurrent creation
-- 
-- Maintenance commands:
-- REINDEX INDEX CONCURRENTLY idx_name; -- To rebuild if bloated
-- DROP INDEX CONCURRENTLY idx_name; -- To remove unused indexes