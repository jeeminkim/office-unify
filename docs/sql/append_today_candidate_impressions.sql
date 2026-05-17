-- Today Candidates 노출 이력(관심종목 반복·미국 후보 absent 등 진단용). 매수 추천·자동 주문 없음.
-- 적용: Supabase SQL Editor / 마이그레이션 파이프라인.

create table if not exists public.today_candidate_impressions (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  request_id text,
  run_date date not null default current_date,
  generated_at timestamptz not null default now(),
  source_route text not null default 'today-brief',
  symbol text,
  name text,
  market text,
  candidate_bucket text,
  decision_status text,
  score numeric,
  judgment_quality_level text,
  is_user_watchlist boolean not null default false,
  is_user_holding boolean not null default false,
  is_us_candidate boolean not null default false,
  is_sector_radar_candidate boolean not null default false,
  is_corporate_action_risk boolean not null default false,
  selected_rank int,
  selected_reasons jsonb not null default '[]'::jsonb,
  suppressed_reasons jsonb not null default '[]'::jsonb,
  rejected_reasons jsonb not null default '[]'::jsonb,
  missing_evidence jsonb not null default '[]'::jsonb,
  decision_trace jsonb not null default '{}'::jsonb,
  quality_meta jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index if not exists today_candidate_impressions_user_run_date_idx
  on public.today_candidate_impressions (user_key, run_date desc);

create index if not exists today_candidate_impressions_user_symbol_run_date_idx
  on public.today_candidate_impressions (user_key, symbol, run_date desc);

create index if not exists today_candidate_impressions_user_watchlist_run_date_idx
  on public.today_candidate_impressions (user_key, is_user_watchlist, run_date desc)
  where is_user_watchlist = true;

create index if not exists today_candidate_impressions_user_us_run_date_idx
  on public.today_candidate_impressions (user_key, is_us_candidate, run_date desc)
  where is_us_candidate = true;

create index if not exists today_candidate_impressions_request_id_idx
  on public.today_candidate_impressions (request_id)
  where request_id is not null;

create index if not exists today_candidate_impressions_candidate_bucket_idx
  on public.today_candidate_impressions (user_key, candidate_bucket, run_date desc);

create unique index if not exists today_candidate_impressions_idempotency_uidx
  on public.today_candidate_impressions (user_key, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

comment on table public.today_candidate_impressions is 'Today Brief 최종 노출 후보 이력; read-only API에서는 insert 금지.';
