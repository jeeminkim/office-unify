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
| POST | `/api/committee-discussion/followups/extract` | 후속작업 draft 추출(JSON). body: `topic`, `transcript`, `closing?`, `joMarkdown?`, `committeeTurnId` |
| POST | `/api/committee-discussion/followups/save` | 사용자가 검토한 후속작업 1건 저장. body: `committeeTurnId`, `sourceReportKind`, `item`, `originalDraftJson?` |

구현 진입점은 `apps/web/lib/server/runCommitteeDiscussion.ts`, 오케스트레이션은 `packages/ai-office-engine`의 `committeeDiscussionOrchestrator.ts`.

## 조일현 보고서

- 서버는 **이 API가 호출될 때만** LLM으로 `.md`를 생성한다. 토론·정리 발언 완료와 **자동 연동 없음**.
- 환경: `GEMINI_API_KEY`, `OPENAI_API_KEY`(조일현 OpenAI 경로 및 폴백).

## 후속작업 계층 (2차 안정화)

- 조일현 Markdown은 **사람용 산출물**이고, 후속작업은 **별도 JSON 계약**으로 추출한다.
- `report` API에 JSON 추출 책임을 섞지 않는다(역할 분리).
- 저장 전 단계에서 extractor 결과를 서버에서 검증한다:
  - 필수 필드(title, itemType, priority, rationale, acceptanceCriteria 등)
  - 모호한 제목/즉시 실행 지시 차단
  - 중복 title 제거
- 검증 실패 항목은 저장 금지 + `warnings`로 UI에 표시한다.
- 저장은 사용자가 카드별로 명시 클릭했을 때만 수행되며, `committeeTurnId`에 연결된다.
- **자동 매매/자동 주문/자동 원장 반영은 금지**한다.

## 저장 테이블

- `committee_followup_items`: 후속작업 본문(상태 추적 가능)
- `committee_followup_artifacts`: 원본 draft JSON/추가 산출물 저장
- DDL: `docs/sql/append_web_committee_followups.sql`

## 검증

- `npm run typecheck --workspace=apps/web`
- 로그인 후 `/committee-discussion`에서 최소 1라운드 → 필요 시 종료 → **「조일현 보고서」 버튼**으로만 report API 호출 확인(네트워크 탭).
- 같은 화면에서 **「후속작업 추출」** 호출 → draft 카드 확인 → 카드별 저장 요청 시에만 `followups/save`가 호출되는지 확인.
