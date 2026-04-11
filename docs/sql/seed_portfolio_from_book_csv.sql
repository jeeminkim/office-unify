-- Book(KR_보유/US_보유/KR_관심/US_관심) CSV 기준 원장 일괄 반영용
--
-- ★ 필수: YOUR_OFFICE_USER_KEY 를 그대로 두고 실행하면 안 됩니다.
--   웹 앱은 Supabase Auth 의 user.id(UUID)를 문자열로 user_key로 씁니다.
--   치환값 확인: 브라우저에서 Google 로그인 후 GET /api/portfolio/me (JSON 의 userKey) 또는
--   Supabase SQL: SELECT id FROM auth.users WHERE email = '본인이메일';
--
-- 1) 아래 모든 'YOUR_OFFICE_USER_KEY' 를 위 UUID 문자열로 일괄 치환 (Find → Replace)
-- 2) Supabase SQL Editor에서 실행 — 또는 /portfolio-ledger 에서는 user_key 컬럼 없이 INSERT만 지원하므로
--    이 파일은 주로 SQL Editor 직접 실행용입니다.
--
-- 주의: 기존 동일 user_key 데이터를 먼저 삭제합니다.

BEGIN;

DELETE FROM web_portfolio_holdings WHERE user_key = 'YOUR_OFFICE_USER_KEY';
DELETE FROM web_portfolio_watchlist WHERE user_key = 'YOUR_OFFICE_USER_KEY';

-- ========== 보유: KR (Book KR_보유) ==========
INSERT INTO web_portfolio_holdings (user_key, market, symbol, name, sector, investment_memo, qty, avg_price, target_price, judgment_memo) VALUES
('YOUR_OFFICE_USER_KEY', 'KR', '140410', '메지온', '바이오', '일시적 조정이라 생각하고 비중을 실음', 530, 113078, 160000, '아쉬운 매수 타이밍'),
('YOUR_OFFICE_USER_KEY', 'KR', '010130', '고려아연', '원자재', '일시적 조정이라 생각하고 비중을 실음', 20, 1696750, 2000000, '아쉬운 매수 타이밍'),
('YOUR_OFFICE_USER_KEY', 'KR', '140670', '알에스오토메이션', '기계', '로봇 섹터 중 저평가라 판단', 1900, 21105, 25000, '아쉬운 매수 타이밍'),
('YOUR_OFFICE_USER_KEY', 'KR', '257720', '실리콘투', '화장품', '화장품 섹터 중 저평가라 판단', 968, 42600, 50000, '아쉬운 매수 타이밍'),
('YOUR_OFFICE_USER_KEY', 'KR', '214450', '파마리서치', '미용', '52주 신저가 부근에서 비중을 실음', 100, 333150, 400000, '아쉬운 매수 타이밍'),
('YOUR_OFFICE_USER_KEY', 'KR', '114810', '한솔아이원스', '반도체', '반도체 장비 중 저평가라 판단', 1800, 16188, 21000, '아쉬운 매수 타이밍'),
('YOUR_OFFICE_USER_KEY', 'KR', '204320', 'HL만도', '기계', '로봇관련 재평가 및 저 PBR', 500, 56100, 65000, '아쉬운 매수 타이밍'),
('YOUR_OFFICE_USER_KEY', 'KR', '196170', '알테오젠', '제약', '52주 신저가 부근에서 비중을 실음', 60, 386272, 450000, '아쉬운 매수 타이밍'),
('YOUR_OFFICE_USER_KEY', 'KR', '000660', 'SK하이닉스', '반도체', '반도체 중 1등, 메모리 호황', 20, 513000, 1300000, '매도 타이밍을 잡기 어려움'),
('YOUR_OFFICE_USER_KEY', 'KR', '498400', 'KODEX 200 타겟 위클리 커버드 콜', 'ETF', 'Kospi 상위 종목 비중', 855, 16536, 19800, '매도 타이밍을 잡기 어려움'),
('YOUR_OFFICE_USER_KEY', 'KR', '476060', '온코닉테라퓨틱스', '제약', '네수파립의 성장성 및 임상 확장 적용 기대감', 600, 17973, 25000, '매도 타이밍을 잡기 어려움'),
('YOUR_OFFICE_USER_KEY', 'KR', '195940', 'HK이노엔', '제약', '매출 대비 저평가', 250, 53330, 60000, '흐름을 판단하기 어려움'),
('YOUR_OFFICE_USER_KEY', 'KR', '028300', 'HLB', '제약', '3상 결과에 따른 단기 차익 실현', 200, 57188, 70000, '흐름을 판단하기 어려움'),
('YOUR_OFFICE_USER_KEY', 'KR', '0123G0', 'Tiger 미국AI전력SMR', 'ETF', '데이터 센터 수요 폭발로 인한 그리드 혁명 기대감', 2412, 8418, 10000, '아쉬운 매수 타이밍');

-- ========== 보유: US (Book US_보유) ==========
INSERT INTO web_portfolio_holdings (user_key, market, symbol, name, sector, investment_memo, qty, avg_price, target_price, judgment_memo) VALUES
('YOUR_OFFICE_USER_KEY', 'US', 'CONL', 'GraniteShares 2x Long COIN Daily ETF', '코인', '클래러티 법안 통과', 1299, 19, 30, '급격한 하락에 대처하지 못함'),
('YOUR_OFFICE_USER_KEY', 'US', 'NOW', 'Service Now', 'IT 서비스', '대기업(금융권) 독점적 사용 - 글로벌 기준', 57, 134.88, 180, '생각보다 약해진 IT 서비스 모멘텀'),
('YOUR_OFFICE_USER_KEY', 'US', 'SOLT', '2x solana ETF', '코인', '클래러티 법안 통과 및 이더리움 킬러', 61, 178.48, 178.48, '본점만 찾아도 다행이라 생각하고 있음');

-- ========== 관심: KR (Book KR_관심) ==========
INSERT INTO web_portfolio_watchlist (user_key, market, symbol, name, sector, investment_memo, interest_reason, desired_buy_range, observation_points, priority) VALUES
('YOUR_OFFICE_USER_KEY', 'KR', '033500', '동성화인텍', '기계/화학', '한국카본과 키맞추기', '한국카본과 키맞추기', '25,000 이하', '동성화인텍 및 수주 현황', '중'),
('YOUR_OFFICE_USER_KEY', 'KR', '007070', 'GS리테일', '유통', '관심종목', '편의점 사업 확장, 개인화 추세 증대', '20,000 이하', '민생지원금 타이밍에 맞춰 매수', '중'),
('YOUR_OFFICE_USER_KEY', 'KR', '228810', 'TIGER미디어컨텐츠', 'ETF', 'K-컨텐츠', '자원이 없는 나라의 유일한 원자재라 생각함', '4,500 이하', '주요 아티스트 복귀', '중'),
('YOUR_OFFICE_USER_KEY', 'KR', '279570', '케이뱅크', '금융', '상장 저평가', '상장이후 하락세 유지', '6,000 이하', '호재', '중'),
('YOUR_OFFICE_USER_KEY', 'KR', '453450', '그리드위즈', '전력서비스', '상장 이후 하락세', '그리드 혁명에 대한 기대감, 여름을 앞두고 전력 수요 증대', '18,000 이하', '실적 개선', '중'),
('YOUR_OFFICE_USER_KEY', 'KR', '317450', '명인제약', '제약', '상장 이후 하락세', '제약주식 중 저평가', '55,000 이하', '시장 관심 증대', '하'),
('YOUR_OFFICE_USER_KEY', 'KR', '091810', '티웨이 항공', '항공', '장기 하락세', '장기 하락 및 여름 휴가 시즌 도래', '880 이하', '유가 안정', '하');

-- ========== 관심: US (Book US_관심) ==========
INSERT INTO web_portfolio_watchlist (user_key, market, symbol, name, sector, investment_memo, interest_reason, desired_buy_range, observation_points, priority) VALUES
('YOUR_OFFICE_USER_KEY', 'US', 'NFLX', '넷플릭스', 'OTT', '장기하락세', '성장성', '92', '실적개선, 라인업', '중'),
('YOUR_OFFICE_USER_KEY', 'US', 'TSLA', '테슬라', '전기차', '하락흐름', '압도적기술력', '320', '실적개선', '중'),
('YOUR_OFFICE_USER_KEY', 'US', 'PANW', '팔로알토 네트웍스', '보안', '하락흐름', '기술력 보유', '160', '실적개선', '중');

COMMIT;

-- 잘못 실행해 user_key 가 문자열 YOUR_OFFICE_USER_KEY 로 들어간 경우, 실제 UUID로 옮기려면(예시):
-- BEGIN;
-- UPDATE web_portfolio_holdings SET user_key = '여기-본인-uuid' WHERE user_key = 'YOUR_OFFICE_USER_KEY';
-- UPDATE web_portfolio_watchlist SET user_key = '여기-본인-uuid' WHERE user_key = 'YOUR_OFFICE_USER_KEY';
-- COMMIT;
