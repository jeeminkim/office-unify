-- 사후 원장 반영 이력 테이블 (주문 실행 기록 아님)
create table if not exists public.web_portfolio_trade_events (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  market text not null,
  symbol text not null,
  name text,
  event_type text not null check (event_type in ('buy', 'sell', 'correct')),
  trade_date date not null default current_date,
  quantity numeric,
  price numeric,
  fee_krw numeric default 0,
  tax_krw numeric default 0,
  realized_pnl_krw numeric,
  realized_pnl_rate numeric,
  memo text,
  reason text,
  before_quantity numeric,
  before_avg_price numeric,
  after_quantity numeric,
  after_avg_price numeric,
  source text default 'portfolio_ledger',
  created_at timestamptz default now()
);

create index if not exists idx_web_portfolio_trade_events_user_created
  on public.web_portfolio_trade_events (user_key, created_at desc);

create index if not exists idx_web_portfolio_trade_events_user_symbol_date
  on public.web_portfolio_trade_events (user_key, market, symbol, trade_date desc);
