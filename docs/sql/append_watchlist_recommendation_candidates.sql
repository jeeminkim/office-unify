-- 관심종목 등록 후보(승인 전 자동 등록 없음). 매수 추천 아님.
-- 적용: Supabase SQL Editor / 마이그레이션 파이프라인.

create table if not exists public.watchlist_recommendation_candidates (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  request_id text,
  symbol text not null,
  name text,
  market text,
  confidence text not null default 'unknown',
  data_status text not null default 'unknown',
  approval_status text not null default 'pending',
  reason_codes jsonb not null default '[]'::jsonb,
  display_reasons jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  do_not_do jsonb not null default '[]'::jsonb,
  next_checks jsonb not null default '[]'::jsonb,
  quality_meta jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists watchlist_recommendation_candidates_user_status_created_idx
  on public.watchlist_recommendation_candidates (user_key, approval_status, created_at desc);

create index if not exists watchlist_recommendation_candidates_user_symbol_created_idx
  on public.watchlist_recommendation_candidates (user_key, symbol, created_at desc);

create unique index if not exists watchlist_recommendation_candidates_pending_uidx
  on public.watchlist_recommendation_candidates (user_key, symbol)
  where approval_status = 'pending';

comment on table public.watchlist_recommendation_candidates is '관찰 후보 제안; approve API에서만 web_portfolio_watchlist write.';
