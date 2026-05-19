# Google Finance / Sheets 설정

## 인증

- **권장:** `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_SHEETS_SPREADSHEET_ID`
- JWT scope: `https://www.googleapis.com/auth/spreadsheets` (read+write)
- 서비스 계정 이메일을 스프레드시트 **Editor**로 공유해야 Repair·sync write가 동작합니다.
- **API key만**으로는 비공개 스프레드시트 write가 어렵습니다.

## Read-only 점검

- `GET /api/system/google-finance-setup` — anchor·탭·repair **plan** 포함, **write 0**
- Yahoo fallback only ≠ Sheets OK

## Repair Assistant (confirmed write only)

- UI **「Sheets 자동 보강/복구」** 섹션은 항상 표시(write 불가 시 disabled).
- `repairPlan`은 GET 응답에 포함되며 Sheets를 수정하지 않습니다.
- `POST /api/system/google-finance-setup/repair/apply` — **`confirm: true`일 때만** write
- 기본 `overwrite: false` — 값이 있는 셀은 건드리지 않음
- 1차 대상 탭: `portfolio_quotes` (헤더 + 샘플 GOOGLEFINANCE 수식)
- **`append_missing_anchor_rows`**: 기존 행은 유지하고 SPY/QQQ/TSLA 등 누락 anchor만 아래에 append
- 제외: `research_*`, `holdings_dashboard`, log/cache 탭

## Anchor read-back vs row OK

- `portfolio_quotes` **parsed rows OK**와 **Sheets anchor OK**는 별도 지표입니다.
- simplified layout(`symbol`, `google_ticker`, `price`, …)을 anchor source로 인정합니다.
- rows OK > 0인데 anchor OK = 0이면 **anchor symbol 매칭 실패** — 정규화·누락 행 append를 확인하세요.

## 수동 fallback

- 화면의 「portfolio_quotes 샘플 표 복사」로 A1 붙여넣기 가능
- Repair write 불가·unsafe plan일 때 수동 적용 권장

## 점검 순서

1. `portfolio_quotes` 탭·헤더·price 확인  
2. 시세 새로고침 → 상태 확인 → Today Brief  
3. anchor 0/18이면 Action Item으로 설정 점검 저장  
