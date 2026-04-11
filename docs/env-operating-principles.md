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
