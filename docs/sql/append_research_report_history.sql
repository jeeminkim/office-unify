-- Research Center 종목 리포트 이력·diff. read-only GET/diff는 insert 금지.
-- 적용: Supabase SQL Editor / 마이그레이션 파이프라인.

create table if not exists public.research_report_runs (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  request_id text,
  symbol text not null,
  name text,
  market text,
  report_type text not null default 'stock',
  report_date date not null default current_date,
  generated_at timestamptz not null default now(),
  provider text,
  status text not null default 'completed',
  stale_after_days int not null default 7,
  input_context jsonb not null default '{}'::jsonb,
  report_summary text,
  report_body text,
  structured_report jsonb not null default '{}'::jsonb,
  key_points jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  catalysts jsonb not null default '[]'::jsonb,
  valuation_notes jsonb not null default '[]'::jsonb,
  data_quality jsonb not null default '{}'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  quality_meta jsonb not null default '{}'::jsonb,
  report_hash text,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index if not exists research_report_runs_user_symbol_generated_idx
  on public.research_report_runs (user_key, symbol, generated_at desc);

create index if not exists research_report_runs_user_report_date_idx
  on public.research_report_runs (user_key, report_date desc);

create index if not exists research_report_runs_user_symbol_report_date_idx
  on public.research_report_runs (user_key, symbol, report_date desc);

create index if not exists research_report_runs_request_id_idx
  on public.research_report_runs (request_id)
  where request_id is not null;

create index if not exists research_report_runs_report_hash_idx
  on public.research_report_runs (user_key, report_hash)
  where report_hash is not null;

create unique index if not exists research_report_runs_idempotency_uidx
  on public.research_report_runs (user_key, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create table if not exists public.research_report_diffs (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  symbol text not null,
  previous_report_id uuid references public.research_report_runs(id) on delete set null,
  current_report_id uuid references public.research_report_runs(id) on delete cascade,
  diff_days int,
  diff_summary text,
  changed_points jsonb not null default '[]'::jsonb,
  new_risks jsonb not null default '[]'::jsonb,
  removed_risks jsonb not null default '[]'::jsonb,
  changed_catalysts jsonb not null default '[]'::jsonb,
  data_quality_changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists research_report_diffs_user_symbol_idx
  on public.research_report_diffs (user_key, symbol, created_at desc);

comment on table public.research_report_runs is 'Research 종목 리포트 이력; 재사용·7일 diff 정책.';
comment on table public.research_report_diffs is '리포트 간 deterministic diff 스냅샷.';
