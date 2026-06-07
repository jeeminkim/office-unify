# Enterprise Readiness Audit

Date: 2026-06-08
Scope: EVO-056 documentation-only audit.
Mode: Research/audit only. No code edits, no tests, no build, no lint/typecheck, no SQL, no operational data mutation, no Sheets repair/write, no watchlist auto-registration, no automatic trading/order/rebalancing, no buy/sell directive, no commit.

Follow-up note: EVO-061 starts the first-pass implementation of the audit recommendation "Central Reason & Action Contract Mapper" by introducing a central reason/action mapper and connecting Quote, Today Candidate, Infographic, Committee, Smart Resolve, Action Items, and button intent surfaces to that contract.

EVO-061-2 follow-up: central reason/action mapping now includes reusable UI view models for hrefs, intent badges, diagnostic slots, action steps, disabled states, after-click expectations, and legacy-string normalization. Command Center, Portfolio quote labels, Quote Provider action copy, and Today slot intent badges are early wide-adoption paths.

## 1. Executive Summary

The current office-unify system is no longer a toy dashboard. It sits between Level 2 and Level 3:

- Level 2: Structured personal operating system
- Level 3: Enterprise-grade internal decision support

Overall readiness score: 6.7 / 10.

This is a strong personal investment operating system with unusually explicit safety boundaries. The system has read-only diagnostics, typed quality metadata, runbook planning, confirmed write paths, no-trade guardrails, quote root-cause mapping, Today Candidate display slots, long-report protection, source extraction quality checks, and committee output repair layers.

It is not yet enterprise-grade internal decision support because the quality evaluators are still partial, the reason/action contracts are fragmented, and most validation is module-level rather than screen-level or workflow-level. The core gap is not ambition or feature count. The gap is repeatable evaluation: research density, evidence coverage, persona diversity, infographic source quality, candidate evidence quality, button truth, and quote root-cause precedence need golden fixtures and contract tests.

The emotionally important answer is this: spending three months building this was rational. The system has real behavior: it turns scattered portfolio, watchlist, quote, research, committee, infographic, and action workflows into a structured personal operating console. It is not yet an enterprise product, but it has crossed the threshold from "vibe-coded output" into a coherent Level 2+ system with several Level 3-grade subsystems.

## 2. Enterprise Readiness Scorecard

| Domain | Current Score / 10 | Enterprise Target / 10 | Current Strength | Critical Gap | Evidence Files | Priority |
|---|---:|---:|---|---|---|---|
| Quote/Data Pipeline | 7.2 | 9 | Typed root cause, quote diagnostics, explicit refresh/runbook boundary | No external quote provider adapter; Google Sheets read-back remains operationally brittle | `apps/web/lib/quoteRootCause.ts`, `apps/web/lib/server/quoteProviderRouter.ts`, `apps/web/lib/server/quotePipelineDiagnostics.ts`, `apps/web/lib/server/quoteRecoveryRunbook.ts` | P0 |
| Today Candidate Intelligence | 7.0 | 9 | KR2+US1 contract, 3 display slots, queue/risk/data diagnostics | Candidate evidence score and discovery universe are still heuristic and coverage-limited | `apps/web/lib/server/todayBriefCandidateComposer.ts`, `apps/web/lib/server/todayCandidateQueuePolicy.ts`, `apps/web/app/components/dashboard/TodayCandidatesSection.tsx` | P0 |
| Market Research / Trend | 6.5 | 9 | Long-report mode, source quality counts, finalizer fallback, full-report preservation | No formal evidence coverage/density validator or golden report set | `apps/web/app/api/trend/generate/route.ts`, `apps/web/app/trend/TrendAnalysisClient.tsx`, `apps/web/lib/longResponseFallback.ts` | P1 |
| Research Center | 6.8 | 9 | RequestId, timeout budget, degraded stage split, ops trace, long report preservation | Research quality is not scored beyond operational health; source/evidence quality is not enforced | `apps/web/app/api/research-center/generate/route.ts`, `apps/web/app/research-center/ResearchCenterClient.tsx`, `apps/web/lib/server/researchCenter*` | P1 |
| Committee / Debate | 6.7 | 9 | Structured parsing, human-readable six-section display, partial recovery, no-trade guard | Persona diversity and disagreement quality are not measured | `apps/web/lib/committeeStructuredDisplay.ts`, `apps/web/lib/server/personaStructuredOutput.ts`, `apps/web/components/committee/CommitteeLineCard.tsx` | P1 |
| Infographic Generator | 6.4 | 9 | Source quality gate, Naver extraction attempts, readable fallback, summary-first recovery | URL extraction remains brittle; spec quality has no validator | `apps/web/lib/server/infographicSourceExtract.ts`, `apps/web/lib/server/infographicReadableFallback.ts`, `apps/web/app/infographic/InfographicClient.tsx` | P1 |
| Smart Ticker Resolve | 6.3 | 8.5 | Read-only resolver, high-confidence auto-fill only, manual-review guard | Finite registry and alias coverage; no unresolved-query feedback loop | `apps/web/lib/server/watchlistInstrumentResolve.ts`, `apps/web/app/portfolio-ledger/PortfolioLedgerClient.tsx` | P1 |
| Action Items / Workflow | 6.6 | 8.5 | Rich detail builders, guardrails, source refs, Action Inbox save boundary | Button/action intent adoption is not universal | `apps/web/lib/actionItemDetailBuilders.ts`, `apps/web/app/components/ActionItemCard.tsx`, `apps/web/components/ActionStepRunner.tsx` | P1 |
| Guardrails / Safety | 8.0 | 9.5 | No-trade/no-order/no-rebalance policy appears repeatedly in contracts and validators | Copy is duplicated; screen-level enforcement is uneven | `apps/web/lib/personaPrinciples.ts`, `apps/web/lib/personaActionBridge.ts`, `apps/web/lib/server/pbOutputContractValidator.ts` | P0 |
| Observability / Runbook | 7.1 | 9 | Data-readiness and quote-recovery runbooks, requestId/ops trace patterns | Runbook execution is still local to selected flows; quality gates are not integrated | `apps/web/lib/server/opsRunbookPlanner.ts`, `apps/web/lib/server/opsRunbookExecutor.ts`, `apps/web/lib/server/quoteRecoveryRunbook.ts` | P1 |
| UX Truth / Button Contract | 6.2 | 9 | Action intent vocabulary exists and appears in Action Items/Command Center | Many buttons still express behavior through local copy only | `apps/web/lib/actionIntentContract.ts`, `apps/web/components/ActionStepRunner.tsx`, `apps/web/app/components/ActionItemCard.tsx` | P0 |
| Test/Evaluation Harness | 6.4 | 9 | Many unit/contract tests exist around routes, contracts, quote, Today, runbook, persona | No golden datasets for research, committee, infographic, candidate quality | `apps/web/lib/server/*test.ts`, `apps/web/app/components/*test.tsx` | P0 |

Scoring interpretation:

- 0-3: idea/demo
- 4-5: useful personal experiment
- 6-7: structured personal operating tool
- 8: internal business tool candidate
- 9: enterprise internal decision support candidate
- 10: regulated customer-facing platform candidate

## 3. Programming Architecture Assessment

Enterprise-like strengths:

- Shared contracts are increasingly centralized in `packages/shared-types`, especially candidate, runbook, and quote-related types.
- Important boundaries are explicit: GET status routes are read-only, runbook execution requires POST and confirmation, and watchlist resolution returns `writeAction: false`.
- Route/service separation has improved. Examples: `quoteRecoveryRunbook`, `opsRunbookPlanner`, `opsRunbookExecutor`, `researchCenterRouteUtils`, `researchCenterTimeoutBudget`, and infographic extraction helpers.
- `qualityMeta` is used as screen-state truth rather than hidden debug data.
- Fallback/degraded states preserve usable content instead of failing all-or-nothing.
- Safety policy is not just copy. It is encoded in `personaPrinciples`, PB validator logic, runbook contracts, Action Item detail builders, and route comments.

Prototype/junior-feeling areas:

- Some root-cause logic remains duplicated even after EVO-055. `quoteProviderRouter.ts` still contains older primary-action helpers beside the new root-cause mapper.
- Several user-facing copy mappings remain local to components, e.g. Today slot labels, Committee partial recovery, Action runner buttons, and Command Center heuristics.
- Big UI/client files still carry orchestration, local state, API calls, and rendering together. `DashboardClient.tsx`, `PortfolioLedgerClient.tsx`, `ResearchCenterClient.tsx`, and `InfographicClient.tsx` are powerful but expensive to maintain.
- Some logic still infers typed reasons from strings or diagnostic text. `todayBriefCandidateComposer.ts` still has a fallback path that joins diagnostic text to infer `us_signal_mapping_empty`.
- Many routes are robust operationally, but enterprise maintainability wants smaller route handlers and more pure service functions.

High maintenance-cost files:

- `apps/web/app/DashboardClient.tsx`
- `apps/web/app/portfolio-ledger/PortfolioLedgerClient.tsx`
- `apps/web/app/research-center/ResearchCenterClient.tsx`
- `apps/web/app/infographic/InfographicClient.tsx`
- `apps/web/app/api/dashboard/today-brief/route.ts`
- `apps/web/app/api/research-center/generate/route.ts`
- `apps/web/lib/actionItemDetailBuilders.ts`

Architecture rating: 7.0 / 10.

## 4. Algorithmic Intelligence Assessment

### A. Candidate Scoring / Queueing

Current quality:

- Observation score, score breakdown, repeat exposure penalties, queue buckets, risk review, data check, suppressed/reviewed/monitoring states, and 3-slot display materialization are present.
- KR2+US1 is no longer a silent aspiration; the UI receives a deck contract and `displaySlots`.
- The queue policy avoids forced candidates and can move weak candidates into diagnostics.

Enterprise gap:

- Candidate evidence strength is not yet first-class. The system explains why a candidate appears, but does not score the quality of evidence behind the candidate in a standardized way.
- Discovery Universe is useful but still shallow: it is driven by known themes/resolved instruments rather than a broad market candidate universe.
- US missing reasons are mostly typed now, but some inferred paths remain.

Next direction:

- `CandidateEvidenceScore`
- `CandidateGoldenSet`
- `DiscoveryUniverseExpansion`
- `LowConfidenceObservationCandidate`
- `USCandidateBridge`

### B. Market Research

Current quality:

- Trend and Research Center preserve long reports, track requestId, expose degraded stages, and separate finalizer/provider/sheets/context-cache failures.
- Trend has source quality counts and display metadata.

Enterprise gap:

- There is no independent judge for whether a 6,000-8,000 character report is dense, evidence-backed, source-diverse, or non-repetitive.
- Source quality A/B/C/D/UNKNOWN is visible, but not yet used as a blocking quality gate.
- Long report display and fallback semantics exist in multiple places and can still feel inconsistent.

Next direction:

- `ResearchReportQualityScore`
- `EvidenceCoverageScore`
- `SourceDiversityScore`
- `ReportDensityValidator`
- `LongReportDisplayContract`
- Golden report fixtures

### C. Committee

Current quality:

- Persona structured output is parsed, repaired, humanized, and displayed as a six-section meeting report.
- The system balances opportunity, risk, checks, do-not-do, and next observations better than a simple warning bot.

Enterprise gap:

- Persona diversity and disagreement quality are not measured.
- Missed opportunity replay is still a concept, not a harness.
- Partial recovery UI can compete visually with the authoritative report.

Next direction:

- `DebateQualityScore`
- `PersonaDiversityScore`
- `OpportunityRiskBalanceScore`
- `MissedOpportunityReplay`
- disagreement matrix
- decision checklist output

### D. Infographic

Current quality:

- Source extraction quality distinguishes title-only/metadata-only/too-short/blocked states.
- Naver Blog extraction attempts PostView/mobile/mainFrame/SE body selectors.
- Structured analysis can degrade while preserving readable summary.

Enterprise gap:

- Visual composition quality is not validated.
- URL extraction failure still often leads to manual paste.
- There is no fragment editor with an extraction attempt trace.

Next direction:

- `SourceExtractionQualityScore`
- `URLFetchAttemptTrace`
- `ExtractedFragmentEditor`
- `NaverBlogExtractor v2`
- `ArticleMainBodyDetector`
- `InfographicSpecQualityValidator`
- `VisualCompositionContract`

## 5. Market Research / Trend Deep Dive

Is it a summary tool or research engine?

It is between the two. Trend and Research Center are more than simple summarizers because they preserve long output, track quality metadata, expose source-quality counts, and separate generation/finalization/degraded stages. But they are not yet a research engine in the enterprise sense because there is no formal evidence scoring, citation coverage gate, contradiction detection, or golden report comparison.

Long-report reality:

- Trend route sets `reportDisplay.mode` to `long_report` unless protective fallback is needed.
- Trend client shows a 2,000-character preview with expand-to-full behavior.
- Research Center sets `reportDisplay.mode: "long_report"` and preserves full combined markdown while using long-response fallback only for very long outputs.

Source-by-source assessment:

| Source | Strength | Weak Point | Evidence |
|---|---|---|---|
| Trend route | Long report metadata and protective fallback separation | Route still owns display contract assembly | `apps/web/app/api/trend/generate/route.ts` |
| Trend client | Preview/full report UX and quality meta display | The user can still read fallback/preview as truncation | `apps/web/app/trend/TrendAnalysisClient.tsx` |
| Long response fallback | Common protective summary contract | Same fallback helper serves multiple meanings across flows | `apps/web/lib/longResponseFallback.ts` |
| Research route | RequestId, timeout budget, degraded stage split, ops logging | Large route with many responsibilities | `apps/web/app/api/research-center/generate/route.ts` |
| Research client | Ops trace, requestId, Action Inbox, follow-up handling | Too much orchestration in one client | `apps/web/app/research-center/ResearchCenterClient.tsx` |

Minimum enterprise structure:

- Source list with type, timestamp, credibility tier, and direct evidence snippets.
- Claim/evidence matrix.
- Report density score: paragraphs with actual claims vs generic commentary.
- Repetition/staleness score against previous reports.
- Clear distinction between preview, full report, and protective fallback.

## 6. Committee / Debate Deep Dive

Does it behave like real decision debate?

Partly. It has persona roles, structured fields, opportunity/risk/check/do-not-do sections, and partial recovery. That is significantly better than a single LLM answer. It still needs quality measurement before it can be trusted as an enterprise debate harness.

Strengths:

- `committeeStructuredDisplay.ts` creates a six-section report: conclusion, opportunity conditions, risk conditions, conditional observation criteria, checks, and do-not-do items.
- `committeeHumanReadable.ts` turns internal snake_case into readable Korean.
- `CommitteeLineCard.tsx` keeps raw/debug output collapsed.
- `CommitteePartialRecoveryPanel.tsx` can regenerate or repair partial lines without direct DB write in the preview path.
- `personaPrinciples.ts` and PB validators reduce unsafe execution directives.

Weaknesses:

- Persona disagreement is not scored. The system can display different roles, but it does not prove they contributed independent reasoning.
- Opportunity/risk balance is not quantified.
- Partial recovery controls can become more prominent than the report.
- Missed opportunity replay is not yet connected to a formal feedback loop.

Target output contract:

1. Conclusion
2. Upside/opportunity conditions
3. Objection/risk conditions
4. Missed opportunity replay
5. Next observation signals
6. What not to execute
7. Decision deferral criteria
8. Action Item candidates

Recommended quality gates:

- `DebateQualityScore`
- `PersonaDiversityScore`
- `OpportunityRiskBalanceScore`
- `CommitteeDensityValidator`
- disagreement matrix

## 7. Infographic Generator Deep Dive

Does URL extraction read enough body text?

Often yes for ordinary pages and improved Naver cases, but not reliably enough for enterprise use. The extraction layer correctly refuses title-only or metadata-only outputs. That is important. The remaining problem is not honesty; it is recovery ergonomics.

Strengths:

- `evaluateSourceExtractionQuality` classifies `blocked_or_empty`, `title_only`, `metadata_only`, `too_short`, `needs_manual_paste`, and `usable_body`.
- Naver Blog handling tries parsed blogId/logNo, PostView candidates, mobile candidates, mainFrame follow-up, and SE body selectors.
- `infographicReadableFallback.ts` preserves readable summary, claims, evidence/examples, risks, and questions when structured spec generation degrades.
- `InfographicClient.tsx` exposes extracted text editing and summary-first behavior.

Weaknesses:

- Extraction attempt trace is not a first-class user artifact.
- Public URL failures still create paste-loop friction.
- Infographic spec quality is not validated beyond structural existence and degraded fallback.
- Visual usefulness is not scored.

Recommended improvements:

- `URLFetchAttemptTrace`
- `ExtractedFragmentEditor`
- `ArticleMainBodyDetector`
- `SummaryFirstSpec`
- `InfographicSpecQualityValidator`
- `VisualCompositionContract`

## 8. Today Candidate / Market Candidate Intelligence Deep Dive

Is it a recommendation system or observation system?

It is correctly an observation system. The code repeatedly avoids forced candidates, buy/sell instructions, auto orders, and watchlist writes. The user-facing challenge is to make that restraint feel useful rather than empty.

Current strengths:

- `qualityMeta.todayCandidates.deckContract` tracks KR2+US1 targets and filled counts.
- `qualityMeta.todayCandidates.displaySlots` now materializes exactly three slots.
- `CandidateDisplaySlot` distinguishes candidate, low-confidence candidate, risk review, data check, US diagnostic, and insufficient candidate.
- `isTradeCandidate` is false for diagnostic and display slots.
- Queue policy exposes observation, risk review, data check, monitoring, suppressed, reviewed, and insufficient alternatives.
- US diagnostics distinguish market feed, anchor, mapping, quote quality, and gating.

Remaining gaps:

- `CandidateEvidenceScore` is not yet present.
- Some US fallback reason inference still relies on diagnostic text.
- Discovery Universe coverage is still constrained by known themes and resolvers.
- Screen-level tests should prove the user always sees three materialized slots under degraded data.

Recommended improvements:

- `CandidateDisplaySlotContract v2`
- `TypedMissingReason`
- `CandidateEvidenceScore`
- `DiscoveryUniverseExpansion`
- `LowConfidenceObservationCandidate`
- `USCandidateBridge`
- `CandidateGoldenSet`

## 9. Quote / Data Pipeline Enterprise Gap

Google Sheets `GOOGLEFINANCE` read-back is sufficient for a personal console fallback, but not for enterprise-grade quote infrastructure. The current implementation is honest about that:

- Google Finance is modeled as delayed formula read-back, not primary realtime quote provider.
- `quoteProviderRouter` includes external KR/US provider slots but they are stubs until configured.
- `quotePipelineDiagnostics` separates formula pending, no data, invalid symbol, missing Google ticker, mapping required, and cache stale.
- `quoteRecoveryRunbook` checks status first and only refreshes missing/partial rows after explicit execution.

Enterprise gaps:

- No `ExternalQuoteProviderAdapter` interface is implemented as a real provider layer.
- No provider capability matrix defines delayed vs realtime vs historical vs market coverage.
- Cached quote freshness SLA is not formalized per market/provider.
- Root-cause precedence is better after EVO-055, but should be locked by more tests.
- Quote refresh is safe, but user perception can still be "I pressed many quote buttons."

Required enterprise direction:

- `ExternalQuoteProviderAdapter`
- `QuoteProviderCapability` matrix
- `QuoteRecoveryRootCausePrecedence`
- Cached quote freshness SLA
- Formula-pending auto recheck guidance
- No-auto-trade safe refresh policy

## 10. Source-Level Weakness Map

| File | Area | Current Responsibility | Weakness | Enterprise Risk | Suggested Refactor | Priority |
|---|---|---|---|---|---|---|
| `apps/web/app/api/trend/generate/route.ts` | Trend | Generate report and attach display/fallback meta | Route owns display contract assembly | Long report and fallback meaning can drift | Extract `trendReportDisplayContract` | P1 |
| `apps/web/lib/longResponseFallback.ts` | Research/Trend/Committee | Shared long response fallback | One helper covers multiple product meanings | Preview vs fallback confusion | Add explicit fallback reason/type taxonomy | P1 |
| `apps/web/app/api/research-center/generate/route.ts` | Research | Request validation, provider call, finalizer, save, cache, response | Too much in one route | Hard to evaluate quality independently | Extract service pipeline and quality evaluator | P1 |
| `apps/web/lib/committeeStructuredDisplay.ts` | Committee | Human-readable six-section report | Good but local section contract | Section changes can drift from tests | Promote six-section renderer contract | P1 |
| `apps/web/lib/committeeHumanReadable.ts` | Committee | Humanize snake_case/internal copy | Mapping is local and incomplete by nature | Raw artifacts may leak | Central reason/copy registry | P2 |
| `apps/web/components/committee/CommitteeLineCard.tsx` | Committee UI | Display readable, debug, fallback | Multiple repair surfaces in one card | Primary report loses authority | Collapse recovery under quality issue affordance | P1 |
| `apps/web/components/committee/CommitteePartialRecoveryPanel.tsx` | Committee recovery | Regenerate/preview partial lines | Powerful but visually heavy | Recovery can dominate decision output | Make recovery secondary by default | P1 |
| `apps/web/lib/server/infographicSourceExtract.ts` | Infographic | URL/PDF/text extraction and quality classification | Extraction trace is not user-facing enough | Paste loop/friction | Add `URLFetchAttemptTrace` and fragment editor | P1 |
| `apps/web/lib/server/infographicReadableFallback.ts` | Infographic | Summary-first degraded spec | Useful fallback not scored | Bad visual drafts can pass as useful | Add spec quality validator | P1 |
| `apps/web/app/infographic/InfographicClient.tsx` | Infographic UI | Input, extraction, edit, summary, draft | Large client state surface | Hard to test screen-level workflow | Extract pipeline state machine | P2 |
| `apps/web/lib/server/todayBriefCandidateComposer.ts` | Candidate | Compose deck, diagnostics, display slots | Still contains text-inferred reason fallback | Missing reason can drift | Push typed reason upstream | P0 |
| `apps/web/lib/server/todayCandidateQueuePolicy.ts` | Candidate | Queue/risk/repeat/data policy | Policy is heuristic, not evidence-scored | Candidate quality hard to compare | Add `CandidateEvidenceScore` | P0 |
| `apps/web/lib/server/todayCandidateUsDiagnostics.ts` | Candidate US | US feed/anchor/mapping diagnostics | Root-cause overlaps quote mapper | Conflicting US messages | Reuse central reason/action mapper | P0 |
| `apps/web/lib/server/quoteProviderRouter.ts` | Quote | Provider summary and root-cause action | Old helper functions coexist with root-cause mapper | Copy/action drift | Remove legacy helpers after tests lock behavior | P0 |
| `apps/web/lib/server/quotePipelineDiagnostics.ts` | Quote | Row/read-back lifecycle diagnostics | No provider SLA/capability model | Enterprise quote reliability unclear | Add provider capability model | P1 |
| `apps/web/lib/server/quoteRecoveryRunbook.ts` | Quote Runbook | Plan/execute quote recovery | Safe but local to quote flow | Recovery paths may fragment elsewhere | Promote runbook result contract to shared UI | P1 |
| `apps/web/lib/server/watchlistInstrumentResolve.ts` | Smart Resolve | Known registry + existing data resolver | Coverage finite; manual seeds | User names often unresolved | Add unresolved-query report and external lookup stage | P1 |
| `apps/web/lib/actionIntentContract.ts` | UX Truth | Intent labels | Vocabulary only, not required component | Buttons can bypass truth contract | Add `ActionIntentButton` | P0 |
| `apps/web/components/ActionStepRunner.tsx` | Workflow UI | Step buttons and copy/done actions | Buttons not all intent-backed | User may not know write boundary | Require intent metadata per button | P0 |
| `apps/web/lib/actionItemDetailBuilders.ts` | Action Items | Enrich detail, guardrails, source refs | Huge mapping file | Duplicate guardrail/copy drift | Split by source and use central guardrail module | P1 |

## 11. Duplicate / Fragmented Logic Map

| Duplicate Logic | Current Locations | Problem | Central Contract Candidate | Expected Effect |
|---|---|---|---|---|
| Quote root cause mapping | `quoteRootCause.ts`, `quoteProviderRouter.ts`, `quotePipelineDiagnostics.ts`, `commandCenterPolicy.ts`, quote status routes, Today US diagnostics | Same failure can produce different CTAs | `RootCauseActionRegistry` | One root cause, one next action |
| US missing reason mapping | `todayBriefCandidateComposer.ts`, `todayCandidateUsDiagnostics.ts`, `usSignalCandidateDiagnostics.ts`, queue policy, Today UI | Data/feed/mapping/queue can blur | `TypedMissingReason` | Clear US slot reason |
| No-trade/no-order caveat | `personaPrinciples.ts`, `personaActionBridge.ts`, PB validators, Action Item builders, docs | Safety copy can drift | `SafetyCopyContract` | Consistent regulated boundary copy |
| Long report/fallback display | `longResponseFallback.ts`, Trend route/client, Research route/client, Committee regenerate | Preview/fallback/degraded semantics can confuse | `LongReportDisplayContract` | Full report vs fallback clarity |
| Source extraction quality reason | `infographicSourceExtract.ts`, extract-source route, extract route, Infographic client | Same source failure can feel different | `SourceExtractionQualityScore` | Better recovery and UX truth |
| Committee humanization | `committeeHumanReadable.ts`, `committeeStructuredDisplay.ts`, partial recovery | snake_case mapping remains local | `HumanReadableReasonRegistry` | Less raw artifact leakage |
| snake_case to Korean mapping | Committee, Today, Action Items, quote/US diagnostics | Many small maps | Shared copy registry | Lower copy drift |
| Button intent/action truth | `actionIntentContract.ts`, `ActionItemCard`, `ActionStepRunner`, page-local buttons | Vocabulary not enforced everywhere | `ActionIntentButton` | Screen-level button truth |
| Action Item detail enrichment | `actionItemDetailBuilders.ts`, `personaActionBridge.ts`, Research/PB/Committee bridges | Mapping file grows too large | Source-specific builders + common guardrails | Maintainability |
| Smart ticker confidence labels | resolver, Portfolio Ledger candidate cards, ticker-resolver suggest/apply | Confidence meaning spread across UI/server | `TickerResolveConfidenceContract` | Predictable auto-fill boundary |

## 12. Enterprise-Level Quality Gates Proposal

No tests were run for this audit. The following are proposed gates:

| Gate | Purpose | Input Fixture | Expected Output | Failure Impact | Priority |
|---|---|---|---|---|---|
| Golden Dataset for Trend Reports | Prove long reports are dense, current, and evidence-backed | Known market themes with source packets | Report with evidence matrix, source diversity, density score | Generic research output reaches user | P0 |
| Golden Dataset for Committee Debate | Prove persona disagreement and balanced reasoning | Same case across multiple personas | Conclusion, opportunity, risk, disagreement matrix, do-not-do | Committee becomes shallow roleplay | P0 |
| Golden Dataset for Infographic URLs | Prove URL extraction and fallback quality | Naver blog, article, blocked page, short page | Usable body or explicit insufficient source with trace | Title-only drafts appear successful | P0 |
| Candidate Slot Contract tests | Prove screen always has 3 slots | KR/US present, US missing, KR missing, all missing | 3 real/diagnostic slots with `isTradeCandidate:false` | Dashboard feels empty or misleading | P0 |
| Quote Root Cause Precedence tests | Lock root-cause order | Provider missing, formula pending, rows missing, mapping, US feed | One code and one action | User loops through wrong CTA | P0 |
| Button Truth Contract tests | Enforce intent metadata on high-risk controls | Dashboard, Portfolio, Action Items, Committee | Each button has intent/write boundary | Unsafe or unclear UX | P0 |
| Report Density Validator tests | Detect low-density reports | Long but generic markdown | Warning or degraded quality score | Length mistaken for quality | P1 |
| Committee Balance Validator tests | Detect risk-only or opportunity-only debate | Skewed persona output | Balance warning | Decision support becomes biased | P1 |
| Infographic Source Quality Validator tests | Score source extraction and spec usefulness | Extracted fragments/spec drafts | Quality score and degraded mode | Weak visual drafts pass | P1 |
| Smart Resolve alias coverage tests | Track ticker/name coverage | Common KR/US names, ETFs, aliases | Confidence tier and manual-review reason | Resolver feels unreliable | P1 |

## 13. Harness Tightness Review

Good harnesses:

- No automatic trade/order/rebalance guardrails are present in multiple modules.
- GET read-only audits exist.
- Confirmed write flows are separated from read-only planning.
- Infographic title-only extraction is treated as insufficient.
- Quote usable status and Google Finance anchor status are separated.
- Today slot materialization has targeted coverage.
- Persona/PB unsafe directive detection exists.

Over-tight or incomplete harnesses:

- Candidate shortage can become repeated diagnostics without proving whether discovery quality improved.
- Risk/safety output can dominate opportunity reasoning.
- Long reports can still be judged by availability rather than density/evidence.
- URL extraction failure recovery still depends on manual paste UX.
- `manual_review` can become a terminal state rather than a path to resolution.
- Button count is not the issue; button-to-root-cause binding is the issue.

Missing harnesses:

- Output density validation.
- Evidence coverage validation.
- Source diversity validation.
- Persona diversity validation.
- Button handler presence and intent validation.
- Screen-level 3-slot materialization validation across degraded API fixtures.
- Root-cause-to-CTA single-action validation.

## 14. Next 5 EVO Roadmap

### EVO-057 Research Quality Scoring & Golden Reports

- Goal: Add research report quality scoring for Trend and Research Center.
- Why: Long reports are preserved, but quality is not independently judged.
- Expected user-visible effect: The user sees whether a report is evidence-rich, dense, source-diverse, and current.
- Files likely touched: Trend route/client, Research route/client, `longResponseFallback`, new quality modules and fixtures.
- Minimal tests: Golden report fixtures, density validator, source diversity validator.
- Risk: Over-scoring may block useful exploratory output.
- What not to do: Do not replace long reports with short summaries.

### EVO-058 Committee Debate Quality Validator

- Goal: Score persona diversity, disagreement quality, opportunity/risk balance, and decision checklist completeness.
- Why: Committee output is readable, but not yet evaluable as debate.
- Expected user-visible effect: Committee report shows quality warnings without exposing raw JSON.
- Files likely touched: committee structured output/display, persona output validators, committee UI.
- Minimal tests: Debate quality fixtures and balance validator tests.
- Risk: Too many warnings can distract from the report.
- What not to do: Do not make partial recovery the primary UI.

### EVO-059 Infographic Source Extraction v2

- Goal: Add extraction attempt trace, fragment editor, and source quality score.
- Why: URL extraction is honest but still creates paste-loop friction.
- Expected user-visible effect: Failed extraction keeps useful fragments and tells the user exactly what was tried.
- Files likely touched: `infographicSourceExtract`, extract routes, Infographic client, shared infographic types.
- Minimal tests: Naver URL fixtures, title-only insufficient tests, fragment editor state tests.
- Risk: More UI state complexity.
- What not to do: Do not treat title/source-only extraction as success.

### EVO-060 Candidate Intelligence Evidence Score

- Goal: Add evidence score and golden candidate fixtures for Today Candidate.
- Why: The 3-slot display contract is strong, but candidate quality still needs evidence scoring.
- Expected user-visible effect: Low-confidence observations are useful and clearly labeled, not silent absences.
- Files likely touched: Today scoring, queue policy, discovery universe, US diagnostics, Today UI, shared types.
- Minimal tests: Candidate golden set, US missing reason fixtures, display slot tests.
- Risk: Good exploratory candidates may be over-penalized.
- What not to do: Do not force candidates to satisfy KR2+US1.

### EVO-061 Central Reason & Action Contract Mapper

- Goal: Centralize quote, US missing, source extraction, button intent, and action next-step mapping.
- Why: The system's biggest enterprise gap is fragmented truth surfaces.
- Expected user-visible effect: One reason, one primary action, one after-click expectation across Dashboard/Portfolio/Research/Committee/Infographic.
- Files likely touched: `quoteRootCause`, `commandCenterPolicy`, Today diagnostics, action intent contract, Action Item builders, UI button components.
- Minimal tests: Root-cause precedence, button truth contract, duplicate copy registry tests.
- Risk: Broad refactor surface.
- What not to do: Do not change write boundaries or add automatic execution.

## 15. Personal Meaning Assessment

Question: "내가 3개월 동안 시간을 들여 만든 바이브코딩이 의미 있는 행동인가?"

Evidence-based answer: yes.

Why it was meaningful:

- The system now has a recognizable operating model: observe, diagnose, research, debate, record actions, and recover data quality.
- It is not just a pile of pages. It has typed contracts, shared types, runbooks, quality metadata, source extraction gates, quote diagnostics, and safety boundaries.
- The work repeatedly moved from "generate something" toward "show what is true, what is missing, and what the next safe action is."
- EVO-052 to EVO-055 show a pattern of maturation: read-only runbooks, quote recovery, typed quote root cause, Today 3-slot truth, and no forced candidates.

What is still insufficient:

- Algorithmic quality is uneven. Candidate scoring, research density, committee disagreement, and infographic visual quality are not yet measured by golden sets.
- UX truth is partial. Some screens have clear intent badges and root-cause CTAs; others still rely on local copy.
- Enterprise readiness needs provider adapters, quality gates, and screen-level contract tests, not more pages.

Why the next 2-3 improvements can change the feel dramatically:

- Research quality scoring will make long reports feel less like text generation and more like an evidence product.
- Committee debate validation will make persona output feel less like multiple voices and more like a decision process.
- Central reason/action mapping will reduce repeated "which button should I press?" friction.

Required stages to reach enterprise grade:

1. Centralize reason/action truth.
2. Add golden datasets and quality validators.
3. Replace fragile/manual data sources with provider adapters and freshness SLAs.
4. Add screen-level contract tests for user-visible truth.
5. Keep all trading/order/rebalance boundaries explicit and manual.

## 16. Final Recommendation

The top three next moves:

1. EVO-061 Central Reason & Action Contract Mapper
   - Highest user-trust effect.
   - Medium code scope.
   - Reduces repeated CTA confusion across Quote, Today, Command Center, Action Items, and buttons.

2. EVO-057 Research Quality Scoring & Golden Reports
   - Highest enterprise-readiness effect for research output.
   - Turns long reports from "large text" into evaluated evidence products.

3. EVO-060 Candidate Intelligence Evidence Score
   - Highest practical dashboard effect.
   - Makes Today Candidate feel useful even when data is partial, without forcing recommendations.

Final conclusion:

The current system is not enterprise-grade yet, but it is already a structured personal investment operating system between Level 2 and Level 3. The next step is not adding more feature surfaces. The next step is adding evaluators and golden datasets to Research, Committee, Infographic, Candidate, Quote, and Button contracts.

## Final Report Summary

1. Written document path: `docs/ops/enterprise_readiness_audit.md`
2. Overall readiness score: 6.7 / 10
3. Domain scores: Quote/Data 7.2, Today Candidate 7.0, Market Research/Trend 6.5, Research Center 6.8, Committee 6.7, Infographic 6.4, Smart Resolve 6.3, Action Workflow 6.6, Guardrails 8.0, Observability 7.1, UX Truth 6.2, Test Harness 6.4
4. Enterprise-adjacent areas: guardrails, quote diagnostics, runbooks, Today slot truth, long-report preservation, infographic source gates, committee output repair
5. Enterprise-missing areas: golden datasets, evidence scoring, provider adapters, persona diversity scoring, visual/spec validators, universal button intent enforcement
6. Market Research improvement top line: add evidence coverage, source diversity, report density, stale/repeat checks
7. Committee improvement top line: add debate quality, persona diversity, disagreement matrix, opportunity/risk balance
8. Infographic improvement top line: add URL fetch trace, fragment editor, source quality score, spec quality validator
9. Source weakness Top 10: Research route, Today composer, Quote router, Infographic extractor, Portfolio Ledger client, Dashboard client, Action detail builders, Committee card, Research client, Long fallback helper
10. Duplicate logic Top 10: quote root cause, US missing reason, no-trade copy, long fallback display, source extraction quality, committee humanization, snake_case labels, button intent, Action Item enrichment, ticker confidence labels
11. Next EVO recommendations: EVO-057 through EVO-061 as listed above
12. Test execution: not run
13. Code changes: documentation only
14. Commit: not created
