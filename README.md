# Office Unify

Office Unify is a personal investment operations console built with Next.js.

It is not an auto-trading system and it does not place orders, rebalance a
portfolio, or automatically mutate a ledger. Its job is to help a human operator
see what needs attention today: portfolio data quality, Today Brief candidates,
research follow-ups, PB-style review, Action Items, watchlists, and judgment
retrospectives.

## What This App Does

- Shows a daily operating dashboard for investment review.
- Separates observation candidates from risk-review candidates.
- Connects research, PB review, committee follow-ups, journals, and Action Items.
- Highlights data readiness problems before they become decision problems.
- Keeps write actions explicit, confirmed, and traceable.
- Preserves read-only routes as read-only.

## What This App Does Not Do

- No automatic trading.
- No automatic order placement.
- No automatic rebalancing.
- No automatic ledger mutation from AI output.
- No hidden writes from GET/read-only routes.
- No button label should imply a stronger action than the button actually performs.

## Current Product Focus

### Personal Investment OS

The web app in `apps/web` is organized around a daily operations workflow:

- `CommandCenterSection`: the top operating summary for data blockers and urgent work.
- `TodayBriefSection`: the daily brief and the bounded candidate deck.
- `TodayCandidatesSection`: candidate framing for observation and risk review.
- `DataReadinessSection`: SQL, Google Finance, quote, and ops readiness.
- `ActionItemsSummarySection`: the top open follow-up tasks.
- `JudgmentReviewSummarySection`: judgment-retrospective preview.
- `WatchlistRecommendationSection`: explicit approve/reject flow for watchlist candidates.

Watchlist candidates are not written to `web_portfolio_watchlist` until the user
explicitly approves them. Navigation to Research, Watchlist, Journal, or PB pages
is not a write.

### Mobile Trust Repair

The mobile UI is treated as mobile-specific information architecture, not a
shrunk desktop navigation bar.

- Desktop navigation stays desktop-only.
- Mobile uses bottom navigation plus a More drawer.
- Long labels have mobile-specific short labels such as `Dev`, `원장`, `GF 설정`,
  `섹터`, `실현손익`, `목표`, `판단일지`, `매매일지`, and `작업함`.
- Mobile navigation labels are protected against one-character-per-line wrapping.

### Disclosure Truth Contract

The app uses a strict button-label contract for disclosure actions:

- `공시 확인` is shown only when the target is a verified disclosure or filing URL,
  such as DART, KIND, or an explicitly typed disclosure source reference.
- If the app only opens a Research Center seed, the label is `리스크 리서치` or
  `리포트 확인`.
- If no disclosure URL exists and the app only explains how to check manually,
  the label is `공시 확인 방법`.
- After-click hints explain whether the button opens an external filing page,
  opens research, or only provides a manual-check path.

### Risk Review Feedback

Risk-review candidates, such as corporate-action risk cards, are not presented as
buy candidates.

- Main candidate copy: `오늘 확인할 후보`.
- Risk candidate copy: `신규 판단 전 확인 필요한 리스크`.
- Reviewed risk copy: `점검 완료 · 관찰 모니터링`.
- `mark_reviewed` moves an active risk candidate out of the main candidate deck
  for the current feedback window.
- `hide_7d` suppresses normal deck display as user-hidden.
- `keep_observing` keeps the candidate visible and preserves repeat-exposure
  diagnostics.

### Action Item Hub

Action Items are the central place for follow-up work. They can include:

- source references
- source summaries
- checklists
- do-not-do constraints
- recommended next links
- step-by-step actions

Saving to Action Inbox happens only through explicit save buttons.

### Research, PB, Persona, And Committee

Research Center, Private Banker, Persona Chat, and Committee flows are designed
for structured thinking and follow-up work, not automatic execution.

- Long responses use fallback handling where needed.
- PB output is checked for required sections and unsafe directives.
- If PB output quality is warning or failed, the UI shows a small warning while
  preserving the body text.
- Persona Coach guidance is deterministic, dismissible, and compact on mobile.

## Monorepo Structure

- `apps/web`: Next.js App Router application.
- `packages/ai-office-engine`: AI orchestration, prompts, and report generation.
- `packages/supabase-access`: Supabase repository and access helpers.
- `packages/shared-types`: shared DTOs and contract types.
- `packages/shared-utils`: shared utility code.
- `docs`: architecture, SQL, operations, changelog, and roadmap docs.

## Local Setup

### Requirements

- Node.js 20 or newer
- npm workspaces

### Install

```bash
npm install
```

### Environment

Create `apps/web/.env.local` for your local environment.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SHEETS_SPREADSHEET_ID=
```

Do not expose service keys or model API keys with `NEXT_PUBLIC_`.

### Run

```bash
npm run dev
```

Default local URL:

```text
http://localhost:3000
```

## Validation Commands

Run from the repository root.

```bash
npm run lint
npm run typecheck
npm run test --workspace=apps/web
npm run build
npm run pre-live-smoke --workspace=apps/web -- --dry-run
```

`pre-live-smoke` dry-run does not call live HTTP endpoints. For live smoke, use
the origin and session cookie format printed by the script.

## Google Finance Sheet Repair

`/ops/google-finance-setup` remains read-only on GET. Confirmed repair is
available through the UI apply button or the local CLI.

```bash
npm run google-finance-repair --workspace=apps/web -- --dry-run
npm run google-finance-repair --workspace=apps/web -- --confirm
npm run google-finance-repair --workspace=apps/web -- --confirm --wait
```

Dry-run is the default. Confirmed writes require `GOOGLE_SERVICE_ACCOUNT_JSON`
and `GOOGLE_SHEETS_SPREADSHEET_ID` or `GOOGLE_SPREADSHEET_ID`. The service
account must have Editor access to the spreadsheet.

Repair is limited to `portfolio_quotes`, preserves non-empty cells by default,
and only fills missing headers, anchor rows, and blank GOOGLEFINANCE formulas. It
does not trade, order, rebalance, or mutate the Supabase ledger.

## Architecture Notes

### Thin Route Direction

API route files should stay close to request/response orchestration. Reusable
parsing, normalization, idempotency preparation, policy, and business logic
should live under `apps/web/lib/server/*` or package-level modules.

Recent helper boundaries include:

- `personaChatRouteRequest`
- `researchCenterGenerateRequest`
- `todayBriefRouteRequest`
- `todayBriefResponseService`
- dashboard components under `apps/web/app/components/dashboard/*`
- risk-review UI helpers under `apps/web/lib/todayCandidateRiskReviewPanelUi.ts`

### Domain Boundaries

- `/api/portfolio/watchlist/*`: portfolio and watchlist management.
- `/api/watchlist/recommendations/*`: watchlist recommendation lifecycle.
- `/research-center`: report generation and follow-up research.
- `/private-banker`: PB-style review, no automatic portfolio modification.
- `/persona-chat`: persona discussion and structured output.
- `/action-items`: explicit follow-up tracking.

Prefer an existing domain boundary over creating a parallel route tree.

## SQL And Data

SQL files live in `docs/sql`. Apply them manually in the documented order.

Useful references:

- `docs/sql/APPLY_ORDER.md`
- `docs/CURRENT_SYSTEM_BASELINE.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/ops/pre_live_checklist.md`

Missing optional SQL should degrade gracefully and show action hints instead of
silently failing.

## Documentation Map

- `docs/CHANGELOG.md`: shipped and uncommitted changes.
- `docs/CURRENT_SYSTEM_BASELINE.md`: current operating baseline.
- `docs/SYSTEM_ARCHITECTURE.md`: architecture and API map.
- `docs/evolution/ROADMAP_BACKLOG.md`: product evolution backlog.
- `docs/ops/pre_live_checklist.md`: pre-live validation checklist.
- `docs/ops/today_candidates.md`: Today Candidate and risk-review contract.
- `apps/web/README.md`: web app details.

## Maintenance Rules

- Keep route files thin.
- Keep GET/read-only routes free of new writes.
- Add smoke or contract tests for extracted helpers when behavior matters.
- Preserve existing API fields; prefer additive changes.
- Do not add SQL unless the task explicitly requires it.
- Do not commit generated logs or unrelated local artifacts.
- Keep button labels truthful to actual behavior.

