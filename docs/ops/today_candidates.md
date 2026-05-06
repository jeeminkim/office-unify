# Today Candidates (아침 관찰 후보)

홈 대시보드의 `오늘의 3줄 브리핑`에 개인화 관찰 후보를 추가한다.

## 원칙

- 매수 권유 기능이 아니라 관찰 우선순위 정리 기능
- 모든 후보에 `매수 권유 아님` 고지 노출
- 미국시장 신호는 한국 종목 관찰 후보 도출의 참고값
- 데이터 부족 시 후보를 억지로 만들지 않고 NO_DATA/fallback 표시

## 후보 축

- 내 관심사 기반: watchlist/보유/Trend memory/Sector Radar 기반
- 미국시장 기반 한국주식: 오전 데이터 신호와 rule map 매핑

## 관심종목 추가

- API: `POST /api/portfolio/watchlist/add-candidate`
- 중복이면 `already_exists`, 신규면 `added`
- 중복 판정: stockCode/symbol/googleTicker/quoteSymbol/name+market
- 추가 성공 후 best-effort 후처리:
  - sector match 보정(`watchlistSectorMatcher`)
  - ticker 정규화(`google_ticker`, `quote_symbol`)
  - 가능 시 `sector_match_*`, `sector_keywords` 메타 저장
  - 후처리 실패는 추가 성공을 롤백하지 않고 `postProcess.warnings`와 ops log에 남김

## Ops 이벤트 코드

- `today_candidates_generated`
- `today_candidates_us_market_no_data`
- `today_candidate_detail_opened`
- `today_candidate_watchlist_add_success`
- `today_candidate_watchlist_already_exists`
- `today_candidate_watchlist_add_failed`
- `today_candidate_watchlist_add_postprocess_success`
- `today_candidate_watchlist_add_postprocess_partial`
- `today_candidate_watchlist_add_postprocess_failed`
- `today_candidates_ops_summary_unavailable`

## 점수 해석

- 후보 score는 **매수 점수**가 아니라 **관찰 우선순위**다.
- 점수 산정은 관심종목 연계, 섹터 흐름, 미국장 신호, 데이터 신뢰도, 과열 리스크를 함께 반영한다.
- high score라도 매수 권유가 아니며, 추격매수 신호로 해석하면 안 된다.

## 운영 요약 API

- `GET /api/dashboard/today-candidates/ops-summary?days=7`
- `today_candidates` domain의 최근 이벤트를 생성/중복/no_data/실패 기준으로 집계한다.
