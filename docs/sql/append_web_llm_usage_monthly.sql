-- OpenAI 월간 호출·추정 비용 집계(서버 라우트 예산/강제용). Supabase SQL Editor에서 적용.

CREATE TABLE IF NOT EXISTS web_llm_usage_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global',
  period_ym TEXT NOT NULL,
  openai_calls INTEGER NOT NULL DEFAULT 0 CHECK (openai_calls >= 0),
  openai_usd_estimate NUMERIC(14, 6) NOT NULL DEFAULT 0 CHECK (openai_usd_estimate >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, period_ym)
);

CREATE INDEX IF NOT EXISTS idx_web_llm_usage_monthly_period ON web_llm_usage_monthly (period_ym);

COMMENT ON TABLE web_llm_usage_monthly IS 'OpenAI 호출 수·추정 USD(토큰 기준) 월간 누적. KST YYYY-MM.';

CREATE OR REPLACE FUNCTION increment_openai_usage(
  p_scope TEXT,
  p_period_ym TEXT,
  p_calls INTEGER,
  p_usd NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_calls IS NULL OR p_calls < 0 OR p_usd IS NULL OR p_usd < 0 THEN
    RAISE EXCEPTION 'invalid increment';
  END IF;
  INSERT INTO web_llm_usage_monthly (scope, period_ym, openai_calls, openai_usd_estimate)
  VALUES (p_scope, p_period_ym, p_calls, p_usd)
  ON CONFLICT (scope, period_ym) DO UPDATE SET
    openai_calls = web_llm_usage_monthly.openai_calls + EXCLUDED.openai_calls,
    openai_usd_estimate = web_llm_usage_monthly.openai_usd_estimate + EXCLUDED.openai_usd_estimate,
    updated_at = now();
END;
$$;
