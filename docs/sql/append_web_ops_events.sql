-- 운영 로그 / 오류 / 개선 포인트 (Ops Events)
-- 목적: Vercel·브라우저에서 사라지는 경고·오류·degraded·사용자 개선 메모를 DB에 남겨 backlog로 관리.
-- 원칙: secret/token/원문 PII 저장 금지. 자동 복구가 아니라 관측·진단 보조. 앱 코드에서 로깅 실패는 swallow.
--
-- 적용: Supabase SQL Editor에서 실행.

create extension if not exists pgcrypto;

create or replace function public.set_web_ops_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.web_ops_events (
  id uuid primary key default gen_random_uuid(),
  user_key text null,
  event_type text not null
    check (event_type in (
      'error',
      'warning',
      'info',
      'improvement',
      'user_feedback',
      'degraded',
      'recovery'
    )),
  severity text not null default 'info'
    check (severity in ('debug', 'info', 'warn', 'error', 'critical')),
  domain text not null,
  route text null,
  component text null,
  message text not null,
  code text null,
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved', 'ignored', 'backlog')),
  action_hint text null,
  detail jsonb null,
  fingerprint text null,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolution_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_web_ops_events_updated_at on public.web_ops_events;
create trigger set_web_ops_events_updated_at
  before update on public.web_ops_events
  for each row execute function public.set_web_ops_events_updated_at();

create index if not exists idx_web_ops_events_user_last_seen
  on public.web_ops_events (user_key, last_seen_at desc);

create index if not exists idx_web_ops_events_domain_last_seen
  on public.web_ops_events (domain, last_seen_at desc);

create index if not exists idx_web_ops_events_severity_status
  on public.web_ops_events (severity, status);

-- fingerprint가 같으면 insert 대신 occurrence_count 증분(앱에서 upsert). 중복 insert 방지용.
drop index if exists idx_web_ops_events_fingerprint_unique;
create unique index idx_web_ops_events_fingerprint_unique
  on public.web_ops_events (fingerprint)
  where fingerprint is not null;

comment on table public.web_ops_events is
  '운영 관측 로그: 오류·경고·degraded·개선 메모. 주문/자동수정 대체 아님. 민감정보 저장 금지.';
