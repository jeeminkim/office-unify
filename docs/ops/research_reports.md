# Research Report history · diff (관찰용)

매수·매도 추천이 아니라 **리서치 이력·변화 관찰**용입니다. 자동 주문·자동매매 없음.

## DDL

- `docs/sql/append_research_report_history.sql` (`research_report_runs`, `research_report_diffs`)
- 적용 순서: `docs/sql/APPLY_ORDER.md` §8 순서 19

## 재사용 정책

| 조건 | 동작 |
|------|------|
| 당일 동일 symbol 성공 리포트 | 재생성 없이 기존 반환 · `reusedExistingReport: true` |
| 최근 7일 미만 | 기본 재사용 · `reportFreshness: reused_recent` |
| `forceRefresh: true` (UI 확인) | 새 생성 허용 |
| 7일 이상 | 새 생성 후 deterministic diff · `reportDiff` |
| 생성 실패 + 기존 있음 | fallback 표시 · `generationFailedButFallbackUsed` |

## API (read-only는 DB write 없음)

- `GET /api/research-center/reports?symbol=`
- `GET /api/research-center/reports/diff?symbol=&previousId=&currentId=`
- `POST /api/research-center/generate` — 생성·저장·diff 저장만 write

## UI

- 종목 입력 시 `GET /api/research-center/reports?symbol=` 로 최근 리포트 확인(read-only)
- 「그래도 새로 생성」→ `forceRefresh: true` on `POST /api/research-center/generate`
- 7일+ 재생성 시 응답 `reportDiff` · 「지난 리포트 이후 달라진 점」접이식
- `GET /api/research-center/reports/diff?symbol=&previousId=&currentId=` (read-only)

## Ops

`research_report_reused_existing`, `research_report_regenerated_with_diff`, `research_report_generation_failed_fallback_used`, `research_report_force_refresh_used` — fingerprint/cooldown/budget 동일 원칙.
