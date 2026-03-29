import type { PersonaKeyCommittee } from '../contracts/decisionContract';

/** 위원 가중치 (추후 DB/설정 이전 대비 단일 객체) */
export const COMMITTEE_MEMBER_WEIGHTS: Record<PersonaKeyCommittee, number> = {
  RAY: 1.0,
  HINDENBURG: 1.2,
  SIMONS: 1.2,
  DRUCKER: 0.8,
  CIO: 1.0
};

export function totalCommitteeWeight(): number {
  return (Object.values(COMMITTEE_MEMBER_WEIGHTS) as number[]).reduce((a, b) => a + b, 0);
}
