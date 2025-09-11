# Feature Specification: WhatChanged — SEC Filing Diff & Alert System

**Feature Branch**: `001-edgar-tool`  
**Created**: 2025-09-08  
**Status**: Draft → Ready for Planning  
**Input**: "WhatChanged — A SEC filing diff and alert system"

## 0) Executive Summary

WhatChanged lets users follow tickers and instantly see what actually changed in new SEC filings—plus a beautiful Overview page per stock with a quick TL;DR, "So What?" impact bullets, and a modern price chart. Alerts are opt-in. The core hook: speed to insight, not just documents.

**Primary users**: Traders, buy/sell-side analysts, compliance teams, sophisticated retail.

**Primary outcomes**:
- Reduce time to "material understanding" from hours → < 60 seconds after filing ingestion.
- Drive willingness to pay via Overview pages that summarize impactful changes (not boilerplate).

## 1) Scope: Goals & Non-Goals

### Goals
- Rapid detection of material changes in 10-K/10-Q/8-K filings and presentation in a concise, actionable format.
- Overview page per ticker that surfaces: price trend, TL;DR of latest filing, "So What?" implications, recent filings, and materiality tags—"everything you need at a glance."
- Reliable, opt-in alerts (email/SMS) for material changes within ≤5 minutes of detection.
- Clear "Not financial advice" positioning and compliance-friendly UX.

### Non-Goals
- No trade execution, order routing, or investment recommendations.
- No real-time tape reading or Level II data.
- No vendor-specific implementation commitments in this spec (providers are abstracted).

## 2) Success Metrics (KPIs)

- **Time-to-insight**: median time from filing available → TL;DR & Overview updated: ≤ 60s (p95 ≤ 180s).
- **Alert timeliness**: median alert send ≤ 5 min from detection (p95 ≤ 10 min).
- **Conversion**: Free → Paid trial start rate ≥ 8%; Trial → Paid conversion ≥ 40%.
- **Engagement**: p75 session time on Overview ≥ 90s; monthly returning user rate ≥ 55%.
- **Reliability**: API success rate ≥ 99.5% (monthly); ingestion error rate < 5%.
- **Accuracy perception**: ≥ 85% user survey agreement that summaries reflect real filing changes.

## 3) Personas & Jobs-to-be-Done

- **Active Trader ("Speed")** — needs immediate signals (guidance, risk adds, buybacks) to gauge sentiment shift.
- **Equity Analyst ("Thesis")** — needs a structured view of what changed to maintain models and narratives.
- **Compliance/IR ("Disclosure")** — needs auditability: what changed, when, and why flagged as material.

## 4) User Scenarios & Acceptance Tests *(mandatory)*

### Primary User Story
As a financial professional, I follow specific tickers and want to instantly understand what changed in new filings and why it might matter, without reading the full document.

### Acceptance Scenarios

#### Watch & Detect
**Given** AAPL is on my watchlist, **when** a new 10-Q posts, **then** the system ingests, compares to the prior 10-Q, extracts material changes, and updates AAPL's Overview with a TL;DR + impact bullets within 60s.

#### Overview Value
**Given** I open /stocks/AAPL, **then** I see: (a) price chart with quick ranges, (b) TL;DR bullets of the latest filing, (c) "So What?" impact bullets, (d) chips for material changes (e.g., "Guidance ↑", "New Risk"), (e) recent filings list, and (f) a persistent Not financial advice disclaimer.

#### Diff Depth
**Given** I click a filing item, **then** I see a Git-like inline diff (additions green, deletions red), section nav, and the same TL;DR at the top, plus a Back to Overview link.

#### No Material Change
**Given** a filing has no material changes, **when** processing completes, **then** the Overview updates with "No material changes detected," the filing is marked processed, and no alert is sent.

#### Alerts (Opt-in)
**Given** I've enabled email and SMS alerts, **when** a material change is detected, **then** both alerts arrive with a direct link to the Overview/Diff within 5 minutes.

#### No Prior Comparable
**Given** no prior comparable filing exists, **then** Overview shows a TL;DR of the current filing without comparative tags, and the Diff view indicates baseline comparison is unavailable.

#### Provider Failure Fallbacks
**Given** filing source, summarization, or price data providers are unavailable, **then** the Overview remains usable with graceful placeholders and explanatory notes; ingestion is retried and logged.

### Edge Cases
SEC API latency/rate limit; malformed filings; duplicated/resubmitted filings; LLM failure/timeout; price API missing; user exceeds plan limits; first-time filer (no baseline).

## 5) Functional Requirements *(testable)*

### A) Watchlist & Overview (the hook)

- **FR-001**: Users can add/remove tickers to a personal watchlist; limits enforced by plan.
- **FR-002**: /stocks/[ticker] Overview must render within < 2s (p75) with skeletons and fallbacks.
- **FR-003**: Overview shows price chart with range toggles (1D/5D/1M/6M/1Y). If price provider missing/unavailable, show a tasteful placeholder and note.
- **FR-004**: Overview shows Latest Filing TL;DR (4–6 bullets, ≤120 words) and "So What?" (≤3 concise bullets).
- **FR-005**: Overview shows Material Change chips derived from extraction (e.g., Guidance, Risk, Buyback, Debt/Covenants, Going-Concern).
- **FR-006**: Overview shows Recent Filings list (min 3) with form type, accepted date, and link to Diff.
- **FR-007**: Overview includes persistent Not financial advice disclaimer.

### B) SEC Data Processing

- **FR-010**: System fetches new filings (10-K/10-Q/8-K) for watched tickers from the authoritative SEC public interface, honoring the documented user-agent and rate limits.
- **FR-011**: System maintains a canonical map of Ticker ↔ CIK (10-digit, zero-padded).
- **FR-012**: Filings are parsed and normalized into structured sections suitable for diffing.
- **FR-013**: New filings are compared against the most recent comparable (10-K vs prior 10-K; 10-Q vs prior 10-Q; 8-K vs prior 8-K if applicable).
- **FR-014**: Deduplicate: the same accession number must not be processed twice; resubmissions must supersede prior records deterministically.

### C) Diff, Materiality & Classification

- **FR-020**: Provide Git-style inline diffs with additions/deletions per section; include section navigation.
- **FR-021**: Compute a Materiality Score (0–100) using rule-based signals (e.g., guidance change magnitude, new risk factors, buyback/dividend initiation or change, debt covenant changes, going-concern language).
- **FR-022**: Tag each filing with Material Change categories (multi-select taxonomy).
- **FR-023**: If no prior comparable exists, mark as Baseline and skip materiality scoring.

### D) Summarization & Impact (AI with graceful fallback)

- **FR-030**: Generate a TL;DR from extracted diffs emphasizing guidance, risks, liquidity/covenants, capital allocation, going-concern, and notable MD&A tone shifts.
- **FR-031**: Generate "So What?" bullets that neutrally describe potential narrative implications; must not contain advice or probabilities.
- **FR-032**: If summarization unavailable, fallback to structured bullets from extraction rules and surface a banner indicating the fallback.
- **FR-033**: Cap costs via prompt/response limits; redact PII and avoid sending unnecessary text to providers.

### E) Alerts (opt-in; channel-agnostic)

- **FR-040**: Users can enable/disable alerts per account and choose channels (email/SMS).
- **FR-041**: Alerts are sent only for material changes above a configurable threshold.
- **FR-042**: Median alert dispatch ≤ 5 minutes from detection; include deep links to Overview and Diff.
- **FR-043**: Track delivery attempts and status for audit; never send to disabled channels.

### F) Plans & Entitlements

- **FR-050**: Plan tiers (example baseline; can be tuned in pricing):
  - **Free**: 1 watchlist ticker, manual ingest, Overview + Diff, delayed price (or placeholder).
  - **Pro**: up to 10 tickers, faster price refresh, auto-ingest, alerts (1 channel), export.
  - **Trader+**: 50+ tickers, both channels, priority ingestion, deeper history & exports.
- **FR-051**: Enforce plan limits server-side; show upsell CTAs in UI when limits hit.

### G) Admin & Audit

- **FR-060**: Admins can view ingestion jobs, error logs, and last success per ticker.
- **FR-061**: All alert sends are auditable (who/what/when/channel/status).

## 6) Non-Functional Requirements (NFRs)

### Reliability & Performance
- **NFR-001** Availability SLO ≥ 99.5% monthly for user-facing APIs and Overview pages.
- **NFR-002** Ingestion job p95 completion time ≤ 180s per new filing; error rate < 5%.
- **NFR-003** Overview initial render p75 < 2s with skeletons; critical interaction p95 < 4s.

### Security & Privacy
- **NFR-010** Data is encrypted in transit and at rest; secrets managed securely.
- **NFR-011** Opt-in consent for alerts; unsubscribe is one-click.
- **NFR-012** Retain filing-derived text indefinitely; retain alert logs ≥ 12 months; redact user contact data on deletion.
- **NFR-013** LLM prompts must avoid user PII; provider choice must be contractually permissible for financial text processing.

### Compliance & Legal
- **NFR-020** Prominent "Not financial advice" in Overview and emails/SMS.
- **NFR-021** Honor SEC fair-use and rate-limit guidelines; identify with compliant user-agent.
- **NFR-022** Accessibility: WCAG 2.1 AA for core flows.

### Observability
- **NFR-030** Structured logs for ingestion, summarization, and alert pipelines with correlation IDs.
- **NFR-031** Metrics: ingestion latency, queue depth, alert send latency, error rates, provider timeouts.
- **NFR-032** Tracing across fetch → parse → diff → summarize → store → alert.

### Product Analytics
- **NFR-040** Track Overview chart interactions, TL;DR expansions, clicks to Diff, alert opt-ins, paywall hits.
- **NFR-041** Run A/B tests on Overview layout (e.g., chip placement, chart ranges).

## 7) Information Architecture & UX *(WHAT, not HOW)*

- **Home**: clear value prop; pricing; sign-in.
- **Dashboard**: Watchlist manager; Watched Stocks cards (mini sparkline, last filing date, quick link to Overview); Latest Filings table.
- **Overview /stocks/[ticker]**:
  - Header with price snapshot, add/remove watchlist, Run Ingest.
  - Chart card with range toggles; volume optional; graceful placeholder without provider.
  - Latest Filing TL;DR and "So What?" bullets; Material Change chips.
  - Recent Filings list (links to Diff).
  - Disclaimer pinned.
- **Diff page**: inline diffs, section nav, TL;DR at top, back-to-Overview.

## 8) Data Entities *(conceptual)*

- **User**: email, (optional) phone, alert prefs, plan tier, createdAt.
- **Company**: ticker, name, CIK, optional sector/industry/logo.
- **Watchlist**: user ↔ company; createdAt; optional filters (form types).
- **Filing**: companyId, form, accession, acceptedAt, title, source URLs, comparableFilingId.
- **Section**: filingId, title, order, text.
- **Diff**: sectionId, changeType (add/del/modify), before/after, snippet, score.
- **Extraction**: filingId, categories [Guidance/Risk/Buyback/Debt/Going-Concern/Other], materialityScore, impactTags, tldrBullets, soWhatBullets.
- **Alert**: userId, filingId, channel, status, sentAt, payloadMeta.
- **Job/Progress**: jobId, status, percent, startedAt, finishedAt, lastError.

## 9) Risks & Mitigations

- **Provider outages** → Multi-provider fallbacks; retry with backoff; user-facing placeholders.
- **False positives/negatives in "materiality"** → Iterative tuning; analyst feedback loop; allow user suppression/feedback on tags.
- **Cost overrun (LLM/alerts)** → Token budgeting, batching, thresholding; daily caps; visible cost dashboards.
- **Abuse (spam alerts)** → Opt-in verification; rate limits per account; unsubscribe link; per-channel throttles.
- **Legal perception** → Prominent disclaimers; avoid advice language; neutral tone.

## 10) Pricing & Packaging *(business-level)*

- **Free**: 1 ticker, Overview + Diff, manual ingest, no alerts, delayed/placeholder price data.
- **Pro** ($/mo): 10 tickers, auto-ingest, one alert channel, faster price refresh, export PDF.
- **Trader+** ($/mo): 50+ tickers, both channels, priority processing, extended history, CSV/API export.

*(Numbers are placeholders; finalize via market testing.)*

## 11) Open Questions / Clarifications

- **[NEEDS CLARIFICATION]** Price data scope: intraday vs EOD for free users? Volume overlays included?
- **[NEEDS CLARIFICATION]** Materiality threshold defaults: what score triggers alerts out-of-the-box?
- **[NEEDS CLARIFICATION]** Auto-ingest cadence: continuous polling vs scheduled windows?
- **[NEEDS CLARIFICATION]** History depth: how many prior filings per company to store/compare?
- **[NEEDS CLARIFICATION]** Enterprise needs: SSO, audit exports, SLA tiers?
- **[NEEDS CLARIFICATION]** Data retention policy specifics (beyond alert logs 12 months).
- **[NEEDS CLARIFICATION]** Trial length & paywall copy for best conversion.

## 12) Review & Acceptance Checklist

### Content Quality
- [x] Describes WHAT and WHY; avoids vendor-specific HOW.
- [x] Written for business stakeholders; measurable outcomes included.

### Requirement Completeness
- [x] Functional and non-functional requirements are testable.
- [x] KPIs & SLOs defined (TTI, alert latency, availability).
- [x] Edge cases and fallbacks included.

### Uncertainties
- [x] Open Questions remain (see §11). Proceed with planning; resolve during grooming.

### Definition of Done (phase 1)
- Users can: add a ticker → ingest → view Overview (chart + TL;DR + So What + chips + recent filings) → click to Diff.
- Alerts: opt-in only, dispatched on material changes, with audit trail.
- Performance: Overview p75 < 2s; ingestion p95 ≤ 180s.
- Reliability: monthly API success ≥ 99.5%; ingestion error < 5%.
- Legal: Not-advice disclaimer visible in Overview and notifications.

## 13) Execution Flow *(for spec-generation workflows)*

1. Parse user brief → if empty → ERROR "No feature description provided."
2. Extract actors, actions, data, constraints; map to personas/JTBD.
3. Identify ambiguities → add to §11 as [NEEDS CLARIFICATION].
4. Draft user scenarios & acceptance tests; ensure each is testable.
5. Compile functional & non-functional requirements with measurable targets.
6. Define key entities (conceptual); avoid tech-specific schemas.
7. Add KPIs, SLOs, risks, pricing; confirm disclaimers/compliance.
8. Run checklist:
   - Missing mandatory sections? → ERROR
   - Any vague requirement? → add metric or move to §11
   - Any implementation detail? → generalize provider/layer
9. Output status:
   - If any [NEEDS CLARIFICATION] → Status "Draft (with uncertainties)"
   - Else → Status "Ready for Planning"

---

**STATUS**: Draft (with uncertainties) → Ready for Planning once §11 items are resolved.

*If you want, I can also produce a 1-page investor/product brief (go-to-market pitch) and an engineering milestone plan (MVP → GA in 3 sprints) based on this spec.*