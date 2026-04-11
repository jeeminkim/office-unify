# PB / 트레이딩 원칙 지식 베이스

운영 규칙의 **정본(authoritative)** 은 코드에 고정되어 있습니다.

- `packages/ai-office-engine/src/privateBanker/privateBankerPrompt.ts` — `Private banker.txt` 및 `트레이딩 원칙 V1.txt` 요지를 반영한 시스템 프롬프트.
- `packages/ai-office-engine/src/privateBanker/privateBankerLongTerm.ts` — PB 전용 장기 기억 JSON(`private_banker_v1`) 및 `persona_memory` 네임스페이스 키(`j-pierpont-lt`).
- `packages/ai-office-engine/src/privateBanker/privateBankerResponseFormat.ts` — PB 응답 최소 형식 검증·서버 보정(선택).
- `packages/ai-office-engine/src/committee/committeePrompt.ts` · `committeeResponseFormat.ts` — 투자위원회(persona-chat 5인) 공통 계약·최소 보정.
- Dev_Support 생성은 서버 `GEMINI_API_KEY`만 사용(`apps/web/app/api/generate/route.ts`). 클라이언트에 키를 넣지 않는다.
- 포트폴리오 원장 테이블: `docs/sql/append_web_portfolio_ledger.sql` — 적용 후 `/portfolio-ledger`에서 INSERT/DELETE 검증·반영.
- 레거시 `persona_memory` 행(`j-pierpont`) 수동 정리: `docs/sql/cleanup_legacy_j_pierpont_persona_memory_optional.sql`, `docs/persona-long-term-memory-strategy.md`.
- 원문 파일은 로컬에서 관리하고, 규칙·문구를 바꿀 때는 **위 파일들**을 수정한다.
