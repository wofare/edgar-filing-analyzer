# Implementation Plan: WhatChanged — SEC Filing Diff & Alert System

**Branch**: `001-edgar-tool` | **Date**: 2025-09-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/caleb/newProject/edgarTool/specs/001-edgar-tool/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
WhatChanged is a SaaS platform that monitors SEC EDGAR filings and provides intelligent diff analysis with real-time alerts. Primary requirement: Deliver instant, glanceable insight into SEC filings changes via beautiful Overview pages per ticker with TL;DR summaries, "So What?" impact bullets, and material change chips. Technical approach: Next.js 14 web application with PostgreSQL database, OpenAI summarization, and multi-provider data adapters with graceful fallbacks.

## Technical Context
**Language/Version**: TypeScript (strict) with Node.js 18/20  
**Primary Dependencies**: Next.js 14 (App Router), Prisma ORM, Auth.js, OpenAI API, Stripe  
**Storage**: PostgreSQL 16 (managed or Docker), optional Redis caching  
**Testing**: Jest/Vitest for unit tests, Playwright for E2E tests  
**Target Platform**: Web application (Vercel/Node deployment)  
**Project Type**: web - determines frontend+backend structure  
**Performance Goals**: Overview render p75 < 2s, ingestion p95 ≤ 180s, API success ≥ 99.5%  
**Constraints**: SEC rate limits (10 req/s), LLM token budgets, alert dispatch ≤5 min  
**Scale/Scope**: Multi-tenant SaaS, 100+ concurrent users, subscription tiers, financial compliance

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (Next.js web app with frontend+backend in same project)
- Using framework directly? Yes (Next.js App Router, Prisma, no wrapper abstractions)
- Single data model? Yes (Prisma schema with entities from spec)
- Avoiding patterns? Yes (no Repository/UoW, direct Prisma usage)

**Architecture**:
- EVERY feature as library? Yes - SEC ingestion, diff engine, summarization, alerts as separate libs
- Libraries listed: 
  - edgar-client (SEC EDGAR API client with rate limiting)
  - diff-engine (filing comparison and materiality scoring)
  - summarization-service (OpenAI integration with fallbacks)
  - alert-dispatcher (email/SMS delivery with audit)
  - price-adapter (multi-provider price data with caching)
- CLI per library: Each library exposes CLI with --help/--version/--format
- Library docs: llms.txt format planned for each library

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes - tests written first, fail, then implement
- Git commits show tests before implementation? Yes - commit tests separately
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes - actual PostgreSQL, real OpenAI API calls in staging
- Integration tests for: new libraries, SEC API integration, Stripe webhooks, OpenAI calls
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? Yes - JSON logs with correlation IDs
- Frontend logs → backend? Yes - unified logging stream via API routes
- Error context sufficient? Yes - ingestion errors, LLM failures, provider outages

**Versioning**:
- Version number assigned? 1.0.0 (initial release)
- BUILD increments on every change? Yes - automated in CI/CD
- Breaking changes handled? Yes - database migrations, backward-compatible APIs

## Project Structure

### Documentation (this feature)
```
specs/001-edgar-tool/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (frontend + backend detected)
src/
├── app/                 # Next.js App Router pages
│   ├── page.tsx         # Landing page
│   ├── dashboard/       # User dashboard
│   ├── stocks/          # Stock overview pages
│   └── api/             # API routes
├── components/          # React components
│   ├── ui/              # shadcn/ui components
│   ├── charts/          # Price chart components
│   └── forms/           # Form components
├── lib/                 # Core libraries
│   ├── edgar-client/    # SEC EDGAR integration
│   ├── diff-engine/     # Filing diff analysis
│   ├── summarization/   # AI summarization
│   ├── alerts/          # Alert dispatcher
│   └── price-adapter/   # Price data adapter
├── models/              # Prisma client and types
└── utils/               # Shared utilities

tests/
├── contract/            # API contract tests
├── integration/         # Full workflow tests
└── e2e/                 # End-to-end Playwright tests

prisma/
├── schema.prisma        # Database schema
└── migrations/          # Database migrations
```

**Structure Decision**: Web application structure due to Next.js frontend + API backend

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - SEC EDGAR API documentation and rate limiting specifics
   - OpenAI GPT-4 pricing and token optimization strategies
   - Stripe subscription webhook handling patterns
   - Multi-provider price data integration approaches
   - Next.js App Router server components best practices
   - Prisma migration strategies for multi-tenant data

2. **Generate and dispatch research agents**:
   ```
   Task: "Research SEC EDGAR API rate limits and compliance requirements"
   Task: "Find best practices for OpenAI API cost optimization in financial applications"
   Task: "Research Stripe subscription webhooks integration patterns"
   Task: "Find multi-provider data adapter patterns with graceful fallbacks"
   Task: "Research Next.js App Router performance optimization for data-heavy pages"
   Task: "Find Prisma schema patterns for financial data with audit trails"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - User, Company, Watchlist, Filing, Section, Diff, Extraction, Alert, Job entities
   - Validation rules from functional requirements
   - State transitions for ingestion jobs and alerts

2. **Generate API contracts** from functional requirements:
   - GET /api/stocks/:ticker/overview (FR-002)
   - GET /api/price/:symbol (price chart data)
   - POST /api/ingest (manual filing ingestion)
   - GET /api/filings (recent filings list)
   - GET /api/filings/:cik/:accession (diff viewer)
   - GET/POST /api/settings/alerts (alert preferences)
   - POST /api/stripe/webhook (subscription updates)
   - Output OpenAPI schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Watch & Detect → integration test scenario
   - Overview Value → UI integration test
   - Alert opt-in → notification system test
   - Provider failures → fallback behavior test

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh claude` for Claude Code
   - Add Next.js, Prisma, OpenAI, Stripe context
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to `/home/caleb/newProject/edgarTool/CLAUDE.md`

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Database schema → Models → Services → API routes → UI components
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md covering:
1. Database setup and migrations
2. Core library development (edgar-client, diff-engine, etc.)
3. API route implementation
4. UI component development
5. Integration and E2E tests
6. Deployment and monitoring setup

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations detected - all complexity is justified by business requirements*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [ ] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*