# ai_office

Discord + Node.js + TypeScript + Supabase based investment office bot.

## Run

1. Set environment variables in `.env`
2. Install dependencies
3. Build and run

```bash
npm install
npm run build
npm start
```

## PM2

```bash
pm2 start dist/index.js --name ai-office --interpreter node
pm2 logs ai-office
pm2 restart ai-office
```

## Supabase Schema Apply

1. Open Supabase SQL editor
2. Run `schema.sql`
3. Verify tables: `stocks`, `portfolio`, `expenses`, `cashflow`, `user_settings`, `chat_history`

## Operational Stability Patch Runbook

Apply the additional SQL for usage tracking and feedback integrity before running the latest runtime.

```sql
-- OpenAI usage tracking + trace extension
-- file: openai_budget_migration.sql

-- Feedback integrity (unique + mapping metadata)
-- file: feedback_integrity_migration.sql
```

Build and run:

```bash
npm run build
npm start
```

## Self-check Commands

Run these checks after deploy/restart:

```bash
# Operational schema type contract (chat_history.id = number)
npm run check:schema-contract

# Phase 1 layer exports (interaction / application / contracts / repositories smoke)
npm run check:phase1-structure

# Runtime E2E smoke against real Supabase (requires PHASE1_TEST_DISCORD_USER_ID or TEST_DISCORD_USER_ID)
npm run check:runtime-e2e

# Phase 2 decision engine (committee vote + risk veto + idempotency; apply docs/sql/append_phase2_decision_tables.sql then append_phase2_decision_tables_hardening.sql for full persistence)
npm run check:decision-engine

# OpenAI mixed provider + budget/fallback + claim pipeline
node dist/openai_phase1_self_check.js

# Discord response safety (chunking/route/degraded message)
node dist/discord_response_self_check.js

# UI/UX feedback flow stability (duplicate/idempotent/mapping fallback)
node dist/uiux_stability_self_check.js

# Quote error classification and breakdown aggregation checks
node dist/quote_logging_self_check.js

# Logger category sink + KST daily file routing checks
node dist/logging_self_check.js
```

Quick log checks:

```bash
# PM2 runtime
pm2 logs ai-office

# Category file logs (KST daily files)
# logs/openai/openai.log_YYYYMMDD
# logs/quote/quote.log_YYYYMMDD
# logs/interaction/interaction.log_YYYYMMDD
```

## Notes

- Portfolio identity key is `discord_user_id`
- Mode setting is persisted in `user_settings`
- Main panel state file is `state/discord-panel.json`

## Docs

- [System Architecture](docs/SYSTEM_ARCHITECTURE.md): 실행 흐름/모듈 구조/LLM fallback 구조
- [System Review](docs/SYSTEM_REVIEW.md): 현재 구조 평가와 리팩토링 필요성
- [Operations Runbook](docs/OPERATIONS_RUNBOOK.md): 운영/장애 대응 표준 절차
- [Environment](docs/ENVIRONMENT.md): 환경변수 기준/민감정보 원칙
- [Database Schema](docs/DATABASE_SCHEMA.md): 주요 테이블/관계/확인 필요 항목
- [Test Checklist](docs/TEST_CHECKLIST.md): 배포 전후 테스트 체크리스트
- [Roadmap](docs/ROADMAP.md): 단계별 목표/완료조건/리스크
- [Changelog](docs/CHANGELOG.md): 변경 이력 기록
- [Documentation Policy](docs/DOCUMENTATION_POLICY.md): 코드-문서 동시 갱신 강제 규칙

## Documentation Rule

- 코드 변경 전후로 관련 문서 영향 범위를 반드시 판단하고 함께 갱신합니다.
- `docs/CHANGELOG.md`는 의미 있는 코드 변경 시 항상 업데이트합니다.
- 문서 갱신 누락 시 작업 완료로 간주하지 않습니다.
