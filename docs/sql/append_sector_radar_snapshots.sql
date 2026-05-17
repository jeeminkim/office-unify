-- Sector Radar 스냅샷(run + item). preview/read-only 경로에서는 insert 금지.
-- 적용: Supabase SQL Editor / 마이그레이션 파이프라인.

create table if not exists public.sector_radar_runs (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  request_id text,
  run_date date not null default current_date,
  generated_at timestamptz not null default now(),
  status text not null default 'ok',
  provider text,
  degraded boolean not null default false,
  reason_code text,
  summary text,
  quality_meta jsonb not null default '{}'::jsonb,
  input_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sector_radar_runs_user_generated_idx
  on public.sector_radar_runs (user_key, generated_at desc);

create index if not exists sector_radar_runs_user_run_date_idx
  on public.sector_radar_runs (user_key, run_date desc);

create table if not exists public.sector_radar_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.sector_radar_runs(id) on delete cascade,
  user_key text not null,
  sector_key text,
  sector_name text,
  theme_key text,
  theme_name text,
  rank int,
  symbol text,
  name text,
  market text,
  asset_type text,
  ticker text,
  google_ticker text,
  quote_symbol text,
  score numeric,
  confidence text,
  data_status text,
  item_bucket text,
  selected_reasons jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  missing_evidence jsonb not null default '[]'::jsonb,
  quote_quality jsonb not null default '{}'::jsonb,
  raw_item jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sector_radar_items_run_id_idx
  on public.sector_radar_items (run_id);

create index if not exists sector_radar_items_user_symbol_idx
  on public.sector_radar_items (user_key, symbol);

comment on table public.sector_radar_runs is 'Sector Radar 요약 스냅샷 헤더; Today Candidate sourceRefs 연계용.';
comment on table public.sector_radar_items is 'Sector Radar 스냅샷 항목(ETF/앵커 등).';
