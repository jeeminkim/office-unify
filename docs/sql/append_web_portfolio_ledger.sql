-- 웹 포트폴리오 원장: 보유(web_portfolio_holdings) + 관심(web_portfolio_watchlist)
-- CSV(Book KR/US 보유·관심) 컬럼에 대응. Supabase에 수동 적용 후 앱에서 사용.

CREATE TABLE IF NOT EXISTS web_portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('KR', 'US')),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT,
  investment_memo TEXT,
  qty NUMERIC,
  avg_price NUMERIC,
  target_price NUMERIC,
  judgment_memo TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_key, market, symbol)
);

CREATE TABLE IF NOT EXISTS web_portfolio_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('KR', 'US')),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT,
  investment_memo TEXT,
  interest_reason TEXT,
  desired_buy_range TEXT,
  observation_points TEXT,
  priority TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_key, market, symbol)
);

CREATE INDEX IF NOT EXISTS idx_web_portfolio_holdings_user ON web_portfolio_holdings (user_key);
CREATE INDEX IF NOT EXISTS idx_web_portfolio_watchlist_user ON web_portfolio_watchlist (user_key);

COMMENT ON TABLE web_portfolio_holdings IS '보유 종목 원장(웹). qty/avg_price/target_price 등 CSV Book(보유) 대응.';
COMMENT ON TABLE web_portfolio_watchlist IS '관심 종목 원장(웹). 관심이유·희망매수구간 등 CSV Book(관심) 대응.';
