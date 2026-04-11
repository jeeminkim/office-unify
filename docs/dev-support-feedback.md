# dev_support 피드백·저장·개인화

## 동작 요약

- **최고**: `web_dev_support_saved_best`에 Flow(Markdown)·Mermaid·SQL/TS 본문·예시·`raw_result` JSON을 저장한다.
- **괜찮음 / 아쉬움**: `web_dev_support_feedback`에만 기록하며, 이후 생성 시 `/api/dev-support/preference-hint`로 집계된 **힌트 문자열**이 `/api/generate`에 선택적으로 붙는다.
- 비로그인: 로컬 `localStorage` 피드백 카운트(`STORAGE_KEY_FEEDBACK_TIER`)만 증가. 서버 동기화는 Google 로그인(허용 계정) 후 가능.

## DB

`docs/sql/append_web_dev_support.sql` 적용 후 사용.

## API

| 경로 | 설명 |
|------|------|
| `GET /api/dev-support/preference-hint` | 로그인·허용 계정 시 최근 피드백 집계 힌트 |
| `POST /api/dev-support/feedback` | 피드백 저장; `rating: top`일 때만 `saved_best` 삽입 |

서비스 로직: `apps/web/lib/server/devSupportFeedbackService.ts`  
리포지토리: `packages/supabase-access/src/devSupportRepository.ts`

## 검증

- SQL 적용 후 홈에서 생성 → **최고** 클릭 → Supabase에 `web_dev_support_saved_best` 행 확인.
- 괜찮음/아쉬움 + 메모 후 다음 생성 요청에 `preferenceHint`가 붙는지(서버 로그 또는 응답 품질) 확인.
