# 환경 변수 운영 원칙 (apps/web)

## 위치

- 로컬: `apps/web/.env.local` (Git에 커밋하지 않음)
- 배포: 호스팅(Vercel 등) 비밀 저장소에 동일 키 설정

## 규칙

1. **서버 전용 비밀**(`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `OFFICE_UNIFY_*` 등)에는 **`NEXT_PUBLIC_` 접두사를 붙이지 않는다.** 브라우저 번들에 포함되면 안 된다.
2. 클라이언트에 필요한 공개 값만 `NEXT_PUBLIC_`를 사용한다. Supabase Auth는 **`NEXT_PUBLIC_SUPABASE_URL`** + **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**(anon, 공개 키)로 세션을 맞추고, **DB에 대한 민감한 쓰기는 서버에서만 `SUPABASE_SERVICE_ROLE_KEY`로 수행**한다.
3. 예시 파일이 필요하면 `.env.example`에 **키 이름만** 두고 값은 비우거나 placeholder만 사용한다.
4. 저장소에는 실제 토큰·키 문자열을 넣지 않는다.

## persona chat 관련 (참고)

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Auth 세션(쿠키), persona chat API 라우트에서 사용자 식별
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: 서버 전용 Supabase(DB; 기존 repository + `web_persona_chat_requests` 멱등 테이블)
- `GEMINI_API_KEY`: 서버에서만 Gemini 호출 — **Dev_Support** (`/api/generate`)와 **persona-chat** 공통. 브라우저·`NEXT_PUBLIC_`로 노출하지 않는다.
- `OPENAI_API_KEY`: 서버에서만 OpenAI 호출 (**Private Banker / J. Pierpont** 전용)
- `OFFICE_UNIFY_PORTFOLIO_READ_SECRET` 등: 포트폴리오 등 **다른 API**용 Bearer(선택)

## 시스템 상태판 (`/system-status`)

개인용 투자 콘솔은 `/api/system/status`로 아래 항목의 존재/접근 가능 여부를 진단한다.

- Env 존재 여부:
  - `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `GEMINI_API_KEY`
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_SHEETS_SPREADSHEET_ID`
  - `OFFICE_UNIFY_PORTFOLIO_READ_SECRET`
- 단일 사용자 게이트:
  - `allowed-user.ts`의 허용 계정 상수 체크
- DB 테이블 접근:
  - `web_portfolio_holdings`
  - `web_persona_chat_requests`
  - `trend_memory_topics`
  - `trade_journal_entries`

응답은 값 자체를 반환하지 않고 상태(`ok|warn|error|not_configured`)만 노출한다.

## 포트폴리오 시세/환율 조회 (서버 런타임)

- `/api/portfolio/summary`는 서버에서 공개 시세 엔드포인트(Yahoo quote, `KRW=X`)를 사용해 현재가/평가금액을 계산할 수 있다.
- 별도 API key를 요구하지 않는 경로를 우선 사용하며, 실패 시 `quoteAvailable=false` + warning으로 degrade한다.
- 시세/환율 실패 시 임의 가격을 생성하지 않는다.
