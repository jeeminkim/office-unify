import type { PersonaWebKey } from '@office-unify/shared-types';

/** 투자위원회(웹 persona-chat) 5인 — PB와 별도 계약 */
export const COMMITTEE_PERSONA_SLUGS = [
  'ray-dalio',
  'jim-simons',
  'drucker',
  'cio',
  'hindenburg',
] as const;

/** 턴제 토론 API — 조일현 제외, 발언 순서 고정 */
export const COMMITTEE_DISCUSSION_SPEAKER_ORDER = ['hindenburg', 'jim-simons', 'cio', 'drucker'] as const;

const SLUG_SET = new Set<string>(COMMITTEE_PERSONA_SLUGS);

export function isCommitteePersonaSlug(slug: string): boolean {
  return SLUG_SET.has(slug.trim().toLowerCase());
}

/** 시스템 프롬프트에 덧붙이는 출력 계약(공통 + 역할별 대괄호 제목) */
export function getCommitteeSystemPromptAppend(personaKey: PersonaWebKey): string | null {
  const slug = String(personaKey).trim().toLowerCase();
  if (!SLUG_SET.has(slug)) return null;

  const roleLines: Record<string, string> = {
    'ray-dalio': `[핵심 리스크]
[깨질 수 있는 전제]
[리스크 관리 행동]`,
    'jim-simons': `[패턴/기회]
[왜 지금인지]
[유효기간]`,
    drucker: `[실행 우선순위]
[지금 할 일]
[하지 말아야 할 일]`,
    cio: `[최종 결론]
[선택 이유]
[모니터링 포인트]`,
    hindenburg: `[반대 논리]
[이 판단이 틀릴 수 있는 이유]
[즉시 경계할 신호]`,
  };

  const extra = roleLines[slug];
  if (!extra) return null;

  return `[투자위원회 응답 계약]
다음 구조를 따른다. 대괄호 표기는 응답 안에 제목으로 반드시 포함한다.

[공통 골격]
1) 핵심 관점 또는 결론
2) 왜 그렇게 보는지
3) 가장 중요한 리스크 또는 반대 포인트
4) 지금 행동 또는 관찰 포인트

[이 페르소나 필수 섹션 제목]
${extra}

[형식]
- 한국어, 전체는 과도하게 길지 않게.
- 투자 단정·매매 지시는 하지 않는다.`;
}
