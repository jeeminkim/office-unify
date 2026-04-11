# 투자위원회 턴제 토론 (committee-discussion)

## 목적

Hindenburg → James Simons → CIO → Peter Drucker 순으로 **한 라운드씩** 발언하고, 선택적으로 라운드를 이어 가거나 종료 시 CIO·Drucker **정리 발언**을 생성한다.  
Supabase 웹 포트폴리오 원장은 해당 페르소나 시스템 프롬프트에 서버가 조회해 붙인다(조일현 제외).

## 인증

`requirePersonaChatAuth()` — Google 세션 + 허용된 계정. 클라이언트에 API 키 없음.

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/committee-discussion/round` | 1라운드(4인 발언). body: `topic`, `roundNote?`, `priorTranscript?` |
| POST | `/api/committee-discussion/closing` | CIO·Drucker 정리. body: `topic`, `transcript` |
| POST | `/api/committee-discussion/report` | **조일현 Markdown — 사용자가 UI에서 명시적으로 요청할 때만** 호출. body: `topic`, `transcript` |

구현 진입점은 `apps/web/lib/server/runCommitteeDiscussion.ts`, 오케스트레이션은 `packages/ai-office-engine`의 `committeeDiscussionOrchestrator.ts`.

## 조일현 보고서

- 서버는 **이 API가 호출될 때만** LLM으로 `.md`를 생성한다. 토론·정리 발언 완료와 **자동 연동 없음**.
- 환경: `GEMINI_API_KEY`, `OPENAI_API_KEY`(조일현 OpenAI 경로 및 폴백).

## 검증

- `npm run typecheck --workspace=apps/web`
- 로그인 후 `/committee-discussion`에서 최소 1라운드 → 필요 시 종료 → **「조일현 보고서」 버튼**으로만 report API 호출 확인(네트워크 탭).
