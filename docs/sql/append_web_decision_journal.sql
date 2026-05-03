-- 비거래 의사결정 일지 (Decision Journal)
-- 목적: 실제 매수/매도를 실행하지 않은 판단(사지 않음·팔지 않음·관망 등)을 기록.
-- 금지: 이 테이블은 주문/체결 기록이 아님. Trade Journal(실행 거래)과 구분.
--
-- 적용: Supabase SQL Editor에서 실행 후 앱에서 사용.

create extension if not exists pgcrypto;

create or replace function public.set_web_decision_journal_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.web_decision_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  market text,
  symbol text,
  name text,
  decision_type text not null
    check (decision_type in (
      'considered_buy',
      'skipped_buy',
      'considered_sell',
      'skipped_sell',
      'considered_add',
      'skipped_add',
      'hold',
      'wait',
      'other'
    )),
  decision_date date not null default (current_date),
  context_price numeric,
  sector_score numeric,
  sector_zone text,
  portfolio_weight numeric,
  reason text not null,
  expected_trigger text,
  invalidation_condition text,
  review_after_days integer not null default 30,
  review_due_date date,
  later_outcome text not null default 'pending'
    check (later_outcome in ('pending', 'good_decision', 'bad_decision', 'mixed', 'unknown')),
  outcome_note text,
  linked_trade_journal_id uuid null,
  linked_holding_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_web_decision_journal_entries_updated_at on public.web_decision_journal_entries;
create trigger set_web_decision_journal_entries_updated_at
  before update on public.web_decision_journal_entries
  for each row execute function public.set_web_decision_journal_updated_at();

create index if not exists idx_web_decision_journal_user_decision_date
  on public.web_decision_journal_entries (user_key, decision_date desc);

create index if not exists idx_web_decision_journal_user_market_symbol
  on public.web_decision_journal_entries (user_key, market, symbol);

create index if not exists idx_web_decision_journal_user_review_due
  on public.web_decision_journal_entries (user_key, review_due_date);

comment on table public.web_decision_journal_entries is
  '비거래 의사결정 로그: 실행하지 않은 매수/매도/추가/관망 등의 이유. 주문·체결 기록 아님.';
