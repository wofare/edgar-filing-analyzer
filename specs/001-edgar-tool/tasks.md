# Tasks: WhatChanged — SEC Filing Diff & Alert System

**Input**: Design documents from `/specs/001-edgar-tool/`
**Prerequisites**: plan.md ✓, spec.md ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Extract: Next.js 14, TypeScript, Prisma, PostgreSQL, OpenAI API
2. Load optional design documents:
   → data-model.md: Not available - will generate core entities from spec
   → contracts/: Not available - will generate API contracts from functional requirements
   → research.md: Not available - will use plan.md technical context
3. Generate tasks by category:
   → Setup: Next.js project, dependencies, database, linting
   → Tests: contract tests, integration tests for core workflows
   → Core: libraries (edgar-client, diff-engine, summarization, etc.)
   → Integration: database connections, API routes, UI components
   → Polish: E2E tests, performance optimization, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web application**: `src/app/`, `src/components/`, `src/lib/`, `src/models/`
- Database: `prisma/schema.prisma`, `prisma/migrations/`
- Tests: `tests/contract/`, `tests/integration/`, `tests/e2e/`

## Phase 3.1: Setup
- [x] T001 Create Next.js 14 project structure with TypeScript and App Router
- [x] T002 Initialize package.json with dependencies (Next.js, Prisma, Auth.js, OpenAI, Stripe)
- [x] T003 [P] Configure ESLint, Prettier, and TypeScript strict mode
- [x] T004 [P] Set up Prisma with PostgreSQL connection
- [x] T005 [P] Configure environment variables and validation

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T006 [P] Contract test GET /api/stocks/[ticker]/overview in tests/contract/test_stocks_overview.ts
- [x] T007 [P] Contract test GET /api/price/[symbol] in tests/contract/test_price_data.ts
- [x] T008 [P] Contract test POST /api/ingest in tests/contract/test_filing_ingest.ts
- [x] T009 [P] Contract test GET /api/filings in tests/contract/test_filings_list.ts
- [x] T010 [P] Contract test GET /api/filings/[cik]/[accession] in tests/contract/test_filing_diff.ts
- [x] T011 [P] Contract test GET/POST /api/settings/alerts in tests/contract/test_alert_settings.ts
- [x] T012 [P] Contract test POST /api/stripe/webhook in tests/contract/test_stripe_webhook.ts
- [x] T013 [P] Integration test filing ingestion workflow in tests/integration/test_filing_workflow.ts
- [x] T014 [P] Integration test alert dispatch system in tests/integration/test_alert_system.ts
- [x] T015 [P] Integration test price data fallback in tests/integration/test_price_fallback.ts

## Phase 3.3: Database & Models (ONLY after tests are failing)
- [x] T016 Create Prisma schema with User, Company, Filing, Diff, Alert entities in prisma/schema.prisma
- [x] T017 Generate initial database migration
- [x] T018 [P] User model and validation in src/models/user.ts
- [x] T019 [P] Company model and validation in src/models/company.ts
- [x] T020 [P] Filing model and validation in src/models/filing.ts
- [x] T021 [P] Alert model and validation in src/models/alert.ts

## Phase 3.4: Core Libraries (ONLY after models complete)
- [x] T022 [P] SEC EDGAR client with rate limiting in src/lib/edgar-client/index.ts
- [x] T023 [P] Filing diff engine in src/lib/diff-engine/index.ts
- [x] T024 [P] OpenAI summarization service in src/lib/summarization/index.ts
- [x] T025 [P] Alert dispatcher with email/SMS in src/lib/alerts/index.ts
- [x] T026 [P] Multi-provider price adapter in src/lib/price-adapter/index.ts
- [x] T027 [P] CLI interfaces for each library (edgar-client CLI, diff-engine CLI, etc.)

## Phase 3.5: API Routes Implementation
- [x] T028 GET /api/stocks/[ticker]/overview endpoint in src/app/api/stocks/[ticker]/overview/route.ts
- [x] T029 GET /api/price/[symbol] endpoint in src/app/api/price/[symbol]/route.ts
- [x] T030 POST /api/ingest endpoint in src/app/api/ingest/route.ts
- [x] T031 GET /api/filings endpoint in src/app/api/filings/route.ts
- [x] T032 GET /api/filings/[cik]/[accession] endpoint in src/app/api/filings/[cik]/[accession]/route.ts
- [x] T033 GET/POST /api/settings/alerts endpoints in src/app/api/settings/alerts/route.ts
- [x] T034 POST /api/stripe/webhook endpoint in src/app/api/stripe/webhook/route.ts
- [x] T035 Error handling and logging middleware
- [x] T036 Request validation and rate limiting

## Phase 3.6: UI Components & Pages
- [x] T037 [P] Landing page in src/app/page.tsx
- [x] T038 [P] Stock overview page in src/app/stocks/[ticker]/page.tsx
- [x] T039 [P] Dashboard page in src/app/dashboard/page.tsx
- [x] T040 [P] Overview card component in src/components/overview-card.tsx
- [x] T041 [P] Price chart component in src/components/charts/price-chart.tsx
- [x] T042 [P] Filing diff viewer in src/components/filing-diff-viewer.tsx
- [x] T043 [P] Alert settings form in src/components/forms/alert-settings.tsx
- [x] T044 [P] shadcn/ui components setup in src/components/ui/
- [x] T045 Authentication setup with Auth.js

## Phase 3.7: Integration & Services
- [ ] T046 Database connection and Prisma client setup in src/lib/db.ts
- [ ] T047 Background job system for filing ingestion
- [ ] T048 Cron jobs for periodic EDGAR polling
- [ ] T049 Email service integration (SendGrid/AWS SES)
- [ ] T050 SMS service integration (Twilio)
- [ ] T051 Stripe subscription handling
- [ ] T052 User authentication and authorization
- [ ] T053 CORS and security headers configuration

## Phase 3.8: Polish & Production Readiness
- [ ] T054 [P] Unit tests for validation logic in tests/unit/test_validation.ts
- [ ] T055 [P] Unit tests for business logic in tests/unit/test_business_logic.ts
- [ ] T056 [P] E2E tests with Playwright in tests/e2e/
- [ ] T057 [P] Performance optimization (Overview page render < 2s)
- [ ] T058 [P] Error monitoring and logging (Sentry/DataDog)
- [ ] T059 [P] Database indexing and query optimization
- [ ] T060 [P] API documentation generation
- [ ] T061 [P] Environment-specific configurations (dev/staging/prod)
- [ ] T062 Deployment configuration (Vercel/Docker)
- [ ] T063 Manual testing scenarios from quickstart.md

## Dependencies
- Setup (T001-T005) before everything
- Tests (T006-T015) before implementation (T016-T063)
- Models (T016-T021) before libraries (T022-T027)
- Libraries (T022-T027) before API routes (T028-T036)
- API routes (T028-T036) before UI components (T037-T045)
- Core implementation before integration (T046-T053)
- Everything before polish (T054-T063)

**Key blocking dependencies**:
- T016 (Prisma schema) blocks T017-T021, T046
- T022-T026 (libraries) block T028-T034 (API routes)
- T028-T034 (API routes) block T037-T043 (UI components)
- T046 (DB connection) blocks T047-T053 (integration services)

## Parallel Example
```
# Launch contract tests T006-T012 together:
Task: "Contract test GET /api/stocks/[ticker]/overview in tests/contract/test_stocks_overview.ts"
Task: "Contract test GET /api/price/[symbol] in tests/contract/test_price_data.ts"
Task: "Contract test POST /api/ingest in tests/contract/test_filing_ingest.ts"
Task: "Contract test GET /api/filings in tests/contract/test_filings_list.ts"
Task: "Contract test GET /api/filings/[cik]/[accession] in tests/contract/test_filing_diff.ts"

# Launch model creation T018-T021 together after T016-T017:
Task: "User model and validation in src/models/user.ts"
Task: "Company model and validation in src/models/company.ts" 
Task: "Filing model and validation in src/models/filing.ts"
Task: "Alert model and validation in src/models/alert.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Follow TDD: RED-GREEN-Refactor cycle
- Use real dependencies (PostgreSQL, OpenAI API) in integration tests
- Maintain SEC rate limits (10 req/s)
- Focus on performance goals (Overview render p75 < 2s)

## Task Generation Rules
*Applied during generation*

1. **From Functional Requirements**:
   - Each API endpoint → contract test task [P] + implementation task
   - User workflows → integration test scenarios
   
2. **From Technical Stack**:
   - Next.js 14 → App Router page tasks
   - Prisma → schema and model tasks
   - Libraries → individual library implementation tasks [P]
   
3. **From Business Logic**:
   - SEC filing ingestion → ingestion workflow tests
   - Alert system → alert dispatch tests  
   - Price data → fallback behavior tests

4. **Ordering**:
   - Setup → Tests → Models → Libraries → API → UI → Integration → Polish
   - Dependencies strictly enforced

## Validation Checklist
*GATE: Checked during generation*

- [x] All API endpoints have corresponding contract tests
- [x] All core entities have model tasks (User, Company, Filing, Alert)
- [x] All tests come before implementation (TDD enforced)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Libraries follow constitution (each as separate library with CLI)
- [x] Performance and observability requirements included