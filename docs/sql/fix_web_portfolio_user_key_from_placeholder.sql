-- =============================================================================
-- 시드 오류 복구: 잘못된 user_key 로 들어간 원장을 실제 로그인 UUID로 일괄 변경
--
-- [1] 로컬에서 userKey 확인
--     저장소 루트: npm run dev
--     브라우저에서 Google 로그인 후:
--       http://localhost:3000/api/portfolio/me
--     또는 콘솔:
--       fetch('/api/portfolio/me',{credentials:'include'}).then(r=>r.json()).then(console.log)
--     → "userKey" 문자열을 복사 (Supabase Auth user.id)
--
-- [2] 아래 DO 블록에서 old_key / new_key 두 줄만 수정
--     ★ new_key 한 줄에만 /api/portfolio/me 의 UUID 를 넣는다 (UPDATE 문에는 UUID 를 또 쓰지 않음 — SET user_key = new_key 가 그 값을 씀).
--     ★ IF 조건은 수정하지 말 것(플레이스홀더 문자열과 비교하는 줄).
--
-- [3] UNIQUE(user_key, market, symbol) 충돌 시 UPDATE 가 실패할 수 있음.
--     이미 new_key 쪽에 같은 종목이 있으면 행을 정리한 뒤 재실행.
-- =============================================================================

DO $$
DECLARE
  old_key text := 'YOUR_OFFICE_USER_KEY';  -- DB에 잘못 들어가 있는 값
  new_key text := 'REPLACE_ME_PASTE_UUID_FROM_API_PORTFOLIO_ME';  -- 여기만 UUID 로 교체
BEGIN
  -- 플레이스홀더 그대로 두고 실행한 경우만 막음 (실제 UUID 와는 절대 같지 않음)
  IF new_key = 'REPLACE_ME_PASTE_UUID_FROM_API_PORTFOLIO_ME' THEN
    RAISE EXCEPTION 'new_key 에 /api/portfolio/me 의 userKey(UUID)를 붙여 넣고 다시 실행하세요.';
  END IF;

  UPDATE web_portfolio_holdings
  SET user_key = new_key
  WHERE user_key = old_key;

  UPDATE web_portfolio_watchlist
  SET user_key = new_key
  WHERE user_key = old_key;
END $$;

-- 실행 후 확인
-- SELECT user_key, COUNT(*) AS n FROM web_portfolio_holdings GROUP BY user_key;
-- SELECT user_key, COUNT(*) AS n FROM web_portfolio_watchlist GROUP BY user_key;
