# Toss Securities Open API 운영 가이드

## 1. 서버 환경 변수

`apps/web/.env.local` 또는 Vercel Project Settings에 아래 값을 서버 전용으로 설정합니다.

```bash
TOSS_CLIENT_ID=
TOSS_CLIENT_SECRET=
TOSS_ACCOUNT_SEQ=

# 선택값
TOSS_API_BASE_URL=https://openapi.tossinvest.com
TOSS_API_TIMEOUT_MS=10000
```

- `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`: 토스증권 개발자 콘솔에서 발급된 Client Credentials입니다.
- `TOSS_ACCOUNT_SEQ`: 계좌 목록 응답의 `accountSeq`입니다. 비워 두면 `BROKERAGE` 계좌를 우선 선택합니다.
- 과거 변수명 `TOSS_API_KEY`, `TOSS_API_SECRET_KEY`, `TOSS_API_ACCOUNT_SEQ`도 일시적으로 지원하지만 신규 배포는 위 공식형 이름을 사용합니다.
- 어떤 값도 `NEXT_PUBLIC_` 접두어로 만들지 않습니다.
- API 자격증명과 전체 계좌번호는 Supabase에 저장하지 않습니다.

## 2. SQL 적용

`append_web_portfolio_ledger.sql` 적용 이후 다음 파일을 Supabase SQL Editor에서 수동 실행합니다.

```text
docs/sql/append_toss_investment_os.sql
```

생성·보강되는 영역:

- `web_portfolio_holdings`: Toss source/sync metadata
- `toss_asset_sync_runs`: 동기화 실행 감사 로그
- `toss_holding_snapshots`: 시점별 보유 스냅샷
- `toss_trade_imports`: 향후 주문·체결 이력의 멱등 적재 대상
- `toss_investor_style_profiles`: 거래 근거 기반 투자 스타일 분석 결과
- `toss_trade_proposals`: shadow 또는 사용자 확인형 제안

SQL 미적용 상태에서 원장 동기화를 누르면 API는 `toss_sync_schema_missing`과 적용 파일 안내를 반환합니다.

## 3. 자산 조회 실패 진단

`GET /api/assets/toss`는 민감정보를 제외하고 아래 값을 반환합니다.

- `operation`: auth / accounts / holdings / exchange_rate 등 실패 단계
- `upstreamStatus`: 토스 API HTTP 상태
- `requestId`: 토스가 응답 헤더로 제공한 경우에만 표시
- `actionHint`: 운영자가 취할 조치

대표 점검 순서:

1. `toss_api_not_configured`: Vercel 환경 변수 설정과 재배포 확인
2. auth 401/403: Client ID/Secret 및 앱 권한 확인
3. accounts 실패: 계좌 목록 권한과 연결 상태 확인
4. `toss_configured_account_not_found`: `TOSS_ACCOUNT_SEQ` 확인
5. holdings 실패: `X-Tossinvest-Account`에 선택된 accountSeq가 전달되는지 확인
6. 429: `Retry-After` 이후 재시도
7. timeout: 토스 상태와 서버 egress 확인

## 4. 원장 동기화 정책

`POST /api/assets/toss/sync`는 반드시 아래 요청이어야 합니다.

```json
{ "confirm": true }
```

동작:

- 현재 Toss 보유 종목을 `web_portfolio_holdings`에 upsert
- 현재 보유 목록에서 사라진 기존 Toss 행은 삭제하지 않고 `closed`, 수량 0으로 처리
- 모든 실행을 `toss_asset_sync_runs`에 기록
- 보유 원문 정규화 결과를 `toss_holding_snapshots`에 저장

`GET` 요청은 원장을 변경하지 않습니다.

## 5. 주문·체결 및 투자 스타일의 다음 단계

주문·체결 API는 공식 OpenAPI JSON 계약을 기준으로 endpoint와 필드를 확정한 뒤 구현합니다.

권장 순서:

1. 주문·체결 read-only importer와 외부 거래 ID 멱등성
2. 실현손익·보유기간·추격매수·손절/익절 습관 등 결정론적 지표
3. `toss_investor_style_profiles` 생성
4. 페르소나는 우선 `shadow` 제안만 생성
5. 실제 주문은 별도의 주문 정책, 금액 한도, 중복 방지, 장 운영시간 검증, 사용자 최종 확인을 통과한 경우에만 후속 단계로 검토

기존 PB의 원칙 기반 판단 구조는 유지하고, API 데이터는 PB의 근거 계층으로 추가합니다. 자동 주문 권한과 판단 페르소나는 같은 모듈에 두지 않습니다.
