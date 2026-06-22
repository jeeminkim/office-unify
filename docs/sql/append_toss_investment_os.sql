-- Toss Securities Open API integration foundation.
-- Apply manually in Supabase SQL Editor after append_web_portfolio_ledger.sql.
-- This migration stores no API credentials and no full account number.

ALTER TABLE public.web_portfolio_holdings
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.web_portfolio_holdings
  ADD COLUMN IF NOT EXISTS source_account_seq BIGINT;
ALTER TABLE public.web_portfolio_holdings
  ADD COLUMN IF NOT EXISTS source_synced_at TIMESTAMPTZ;
ALTER TABLE public.web_portfolio_holdings
  ADD COLUMN IF NOT EXISTS source_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.web_portfolio_holdings
  ADD COLUMN IF NOT EXISTS source_fingerprint TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'web_portfolio_holdings_source_check'
       AND conrelid = 'public.web_portfolio_holdings'::regclass
  ) THEN
    ALTER TABLE public.web_portfolio_holdings
      ADD CONSTRAINT web_portfolio_holdings_source_check
      CHECK (source IN ('manual', 'toss'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'web_portfolio_holdings_source_status_check'
       AND conrelid = 'public.web_portfolio_holdings'::regclass
  ) THEN
    ALTER TABLE public.web_portfolio_holdings
      ADD CONSTRAINT web_portfolio_holdings_source_status_check
      CHECK (source_status IN ('active', 'closed', 'stale'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_web_portfolio_holdings_toss_source
  ON public.web_portfolio_holdings (user_key, source, source_account_seq, source_status);

CREATE TABLE IF NOT EXISTS public.toss_asset_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  account_seq BIGINT NOT NULL,
  account_type TEXT,
  sync_mode TEXT NOT NULL DEFAULT 'apply' CHECK (sync_mode IN ('preview', 'apply')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  holding_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  closed_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_toss_asset_sync_runs_user_started
  ON public.toss_asset_sync_runs (user_key, started_at DESC);

CREATE TABLE IF NOT EXISTS public.toss_holding_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id UUID NOT NULL REFERENCES public.toss_asset_sync_runs(id) ON DELETE CASCADE,
  user_key TEXT NOT NULL,
  account_seq BIGINT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('KR', 'US')),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  average_purchase_price NUMERIC,
  last_price NUMERIC,
  purchase_amount NUMERIC,
  market_value NUMERIC,
  profit_loss NUMERIC,
  profit_loss_rate NUMERIC,
  daily_profit_loss NUMERIC,
  daily_profit_loss_rate NUMERIC,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sync_run_id, market, symbol)
);

CREATE INDEX IF NOT EXISTS idx_toss_holding_snapshots_user_symbol
  ON public.toss_holding_snapshots (user_key, market, symbol, observed_at DESC);

-- Order/fill import target. The importer must use the canonical Toss OpenAPI contract
-- and external identifiers for idempotency before writing here.
CREATE TABLE IF NOT EXISTS public.toss_trade_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  account_seq BIGINT NOT NULL,
  external_order_id TEXT,
  external_trade_id TEXT,
  market TEXT NOT NULL CHECK (market IN ('KR', 'US')),
  symbol TEXT NOT NULL,
  name TEXT,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  order_type TEXT,
  status TEXT,
  quantity NUMERIC NOT NULL,
  filled_quantity NUMERIC,
  order_price NUMERIC,
  filled_price NUMERIC,
  fee_amount NUMERIC,
  tax_amount NUMERIC,
  currency TEXT,
  ordered_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS toss_trade_imports_external_trade_uidx
  ON public.toss_trade_imports (user_key, account_seq, external_trade_id)
  WHERE external_trade_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS toss_trade_imports_external_order_uidx
  ON public.toss_trade_imports (user_key, account_seq, external_order_id, symbol, side, ordered_at)
  WHERE external_order_id IS NOT NULL AND external_trade_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_toss_trade_imports_user_executed
  ON public.toss_trade_imports (user_key, executed_at DESC, imported_at DESC);

CREATE TABLE IF NOT EXISTS public.toss_investor_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  account_seq BIGINT NOT NULL,
  analysis_window_days INTEGER NOT NULL,
  trade_count INTEGER NOT NULL DEFAULT 0,
  preferred_markets JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferred_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_sectors JSONB NOT NULL DEFAULT '[]'::jsonb,
  behavior_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  style_labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  summary TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_key, account_seq, analysis_window_days)
);

CREATE INDEX IF NOT EXISTS idx_toss_investor_style_profiles_user_generated
  ON public.toss_investor_style_profiles (user_key, generated_at DESC);

-- Persona output is advisory/shadow by default. Order execution is deliberately
-- separated and requires a later explicit execution policy and user confirmation.
CREATE TABLE IF NOT EXISTS public.toss_trade_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  account_seq BIGINT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('KR', 'US')),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL', 'HOLD', 'WATCH')),
  proposal_mode TEXT NOT NULL DEFAULT 'shadow' CHECK (proposal_mode IN ('shadow', 'confirm_required')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed')),
  suggested_quantity NUMERIC,
  suggested_price NUMERIC,
  rationale TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  style_profile_id UUID REFERENCES public.toss_investor_style_profiles(id) ON DELETE SET NULL,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS toss_trade_proposals_idempotency_uidx
  ON public.toss_trade_proposals (user_key, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_toss_trade_proposals_user_status
  ON public.toss_trade_proposals (user_key, status, created_at DESC);

COMMENT ON TABLE public.toss_asset_sync_runs IS 'Toss holdings preview/apply audit. Credentials and full account numbers are never stored.';
COMMENT ON TABLE public.toss_holding_snapshots IS 'Immutable Toss holdings snapshots used for portfolio history and analysis.';
COMMENT ON TABLE public.toss_trade_imports IS 'Idempotent imported Toss order/fill history for investor behavior analysis.';
COMMENT ON TABLE public.toss_investor_style_profiles IS 'Deterministic investor-style profile derived from imported trades.';
COMMENT ON TABLE public.toss_trade_proposals IS 'Advisory or confirmation-required persona proposals; not an automatic order ledger.';

-- Readiness check
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     'toss_asset_sync_runs',
     'toss_holding_snapshots',
     'toss_trade_imports',
     'toss_investor_style_profiles',
     'toss_trade_proposals'
   )
 ORDER BY table_name;
