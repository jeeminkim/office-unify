# web_ops_events Fingerprint Upsert RPC

`web_ops_events`는 여러 서버 인스턴스에서 동시에 기록될 수 있으므로, 앱 레벨 `select -> update/insert`만으로는 동일 fingerprint 중복 row가 생길 수 있습니다.

## 적용 파일

- SQL: `docs/sql/append_web_ops_events_upsert_rpc.sql`
- RPC: `public.upsert_web_ops_event_by_fingerprint`
- 앱 공통 유틸: `apps/web/lib/server/upsertOpsEventByFingerprint.ts`

## 상태 정책

- 기존 `resolved`가 같은 fingerprint로 재발하면 `open`으로 reopen
- 기존 `ignored`는 재발해도 `ignored` 유지
- 그 외(`open`, `investigating`, `backlog`)는 상태 유지

## 수동 적용

Supabase SQL Editor에서 `docs/sql/append_web_ops_events_upsert_rpc.sql`을 수동 실행합니다.
앱 코드는 RPC가 없어도 fallback으로 계속 동작합니다.

## 운영 확인 SQL

```sql
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'web_ops_events'
  and indexdef ilike '%fingerprint%';
```

```sql
select
  routine_schema,
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'upsert_web_ops_event_by_fingerprint';
```

```sql
select
  fingerprint,
  code,
  count(*) as row_count,
  sum(coalesce(occurrence_count, 1)) as occurrence_total,
  max(last_seen_at) as last_seen_at
from public.web_ops_events
where fingerprint is not null
group by fingerprint, code
having count(*) > 1
order by row_count desc, last_seen_at desc;
```

```sql
select
  domain,
  code,
  status,
  occurrence_count,
  first_seen_at,
  last_seen_at,
  fingerprint,
  message,
  detail
from public.web_ops_events
where domain in ('sector_radar', 'trend', 'portfolio_watchlist')
order by last_seen_at desc
limit 50;
```

today candidates 도메인 확인:

```sql
select
  domain,
  code,
  status,
  occurrence_count,
  fingerprint,
  last_seen_at,
  detail
from public.web_ops_events
where domain = 'today_candidates'
order by last_seen_at desc
limit 100;
```
