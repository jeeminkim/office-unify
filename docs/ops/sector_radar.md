# Sector Radar — 스냅샷 · UI

관찰·복기용입니다. 매수 권유·자동 주문 없음.

## 스냅샷 저장

- DDL: `docs/sql/append_sector_radar_snapshots.sql` (APPLY_ORDER §8 순서 18)
- **write:** `POST /api/sector-radar/summary` 경로의 명시 저장 또는 `POST /api/sector-radar/snapshot`
- **read-only:** `GET /api/sector-radar/runs`, `GET /api/sector-radar/items?runId=`
- preview/read-only summary 경로에서는 snapshot insert 없음

## UI

- `/sector-radar` 페이지 「최근 스냅샷」접이식: run 목록(시각·status·degraded·itemCount·summary) → run별 items

## Today Candidates 연계

- 실시간 summary가 degraded/empty일 때만 최신 DB snapshot에서 seed(최대 3)
- `decisionTrace.sourceRefs`: `sector_radar_snapshot`
- stale snapshot: `missingEvidence` `sector_radar_snapshot_stale`

## 후속(선택)

- `sector_radar_item_feedback` 테이블·POST feedback API
