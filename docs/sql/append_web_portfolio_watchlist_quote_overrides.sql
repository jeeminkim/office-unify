-- 관심종목: Google Sheets GOOGLEFINANCE / Yahoo fallback용 ticker override (additive)
ALTER TABLE public.web_portfolio_watchlist
ADD COLUMN IF NOT EXISTS google_ticker text;

ALTER TABLE public.web_portfolio_watchlist
ADD COLUMN IF NOT EXISTS quote_symbol text;

COMMENT ON COLUMN public.web_portfolio_watchlist.google_ticker IS
'Google Sheets GOOGLEFINANCE용 수동 ticker override. 예: KRX:005930, NASDAQ:TSLA';

COMMENT ON COLUMN public.web_portfolio_watchlist.quote_symbol IS
'일반 quote provider용 수동 symbol override. Yahoo 등 fallback provider에서 사용 가능';
