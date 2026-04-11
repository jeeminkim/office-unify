/**
 * 투자위원회(5인) 응답 — 최소 문자열 검증 + 안전한 후처리 보정.
 * PB(privateBankerResponseFormat)와 패턴은 비슷하되 규칙·섹션은 분리한다.
 */

import { PERSONA_CHAT_ASSISTANT_TARGET_MAX_CHARS } from '@office-unify/shared-types';
import { isCommitteePersonaSlug } from './committeePrompt';

const MAX_TOTAL_CHARS = PERSONA_CHAT_ASSISTANT_TARGET_MAX_CHARS + 400;

/** 앞쪽 대량 prepend 대신 끝에 한 줄 안내만 붙인다(공통 골격 위주 출력과 충돌 완화). */
const COMMITTEE_SOFT_REMEDIATION_SLUGS = new Set<string>([
  'ray-dalio',
  'jim-simons',
  'hindenburg',
  'drucker',
  'cio',
]);

function softRemediationFooter(slug: string): string {
  if (slug === 'ray-dalio') {
    return '[형식 안내] 가능하면 응답에 [핵심 리스크], [깨질 수 있는 전제], [리스크 관리 행동]을 소제목으로 넣어 주세요.';
  }
  if (slug === 'jim-simons') {
    return '[형식 안내] 가능하면 응답에 [패턴/기회], [왜 지금인지], [유효기간]을 소제목으로 넣어 주세요.';
  }
  if (slug === 'hindenburg') {
    return '[형식 안내] 가능하면 응답에 [반대 논리], [이 판단이 틀릴 수 있는 이유], [즉시 경계할 신호]를 소제목으로 넣어 주세요.';
  }
  if (slug === 'drucker') {
    return '[형식 안내] 가능하면 응답에 [실행 우선순위], [지금 할 일], [하지 말아야 할 일]을 소제목으로 넣어 주세요.';
  }
  if (slug === 'cio') {
    return '[형식 안내] 가능하면 응답에 [최종 결론], [선택 이유], [모니터링 포인트]를 소제목으로 넣어 주세요.';
  }
  return '';
}

/** 대괄호 라벨이 본문에 있는지(공백 허용) */
function hasLabeledSection(text: string, inner: string): boolean {
  const esc = inner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\[[^\\]]*${esc}[^\\]]*\\]`).test(text);
}

/** 공통 4요소를 느슨하게 확인 */
function hasCommonFourLoose(text: string): boolean {
  const t = text.slice(0, 1800);
  const hasConclusion = /결론|핵심\s*관점|핵심\s*포인트|핵심\s*요약/i.test(t);
  const hasWhy = /왜|근거|이유|배경/i.test(t);
  const hasRisk = /리스크|반대|하방|약점|우려/i.test(t);
  const hasAction = /행동|관찰|모니터|다음\s*단계|지금/i.test(t);
  return hasConclusion && hasWhy && hasRisk && hasAction;
}

const PERSONA_REQUIRED: Record<string, string[]> = {
  'ray-dalio': ['핵심 리스크', '깨질 수 있는 전제', '리스크 관리 행동'],
  'jim-simons': ['패턴/기회', '왜 지금인지', '유효기간'],
  drucker: ['실행 우선순위', '지금 할 일', '하지 말아야 할 일'],
  cio: ['최종 결론', '선택 이유', '모니터링 포인트'],
  hindenburg: ['반대 논리', '이 판단이 틀릴 수 있는 이유', '즉시 경계할 신호'],
};

function missingPersonaSections(slug: string, text: string): string[] {
  const keys = PERSONA_REQUIRED[slug];
  if (!keys) return [];
  return keys.filter((k) => !hasLabeledSection(text, k));
}

export type CommitteeFormatRemediation = {
  text: string;
  note: string | null;
};

export function remediateCommitteePersonaReply(slug: string, raw: string): CommitteeFormatRemediation {
  if (!isCommitteePersonaSlug(slug)) {
    return { text: raw.trim(), note: null };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      text: '[형식 보정] 응답이 비어 있습니다. 질문과 맥락을 다시 보내 주세요.',
      note: '빈 응답에 최소 안내만 추가했습니다.',
    };
  }

  const missing = missingPersonaSections(slug, trimmed);
  const commonOk = hasCommonFourLoose(trimmed);

  if (missing.length === 0 && commonOk) {
    return { text: trimmed, note: null };
  }

  /**
   * 위원회 5인(Ray Dalio, James Simons, Hindenburg, Drucker, CIO)은 공통 골격 위주로 쓰는 경우가 많아,
   * 필수 세 제목이 없을 때 앞에 긴 보정 블록을 붙이면 답변이 읽기 어렵다.
   * — 본문은 그대로 두고, 필요 시 끝에 한 줄 안내만 붙인다.
   */
  if (COMMITTEE_SOFT_REMEDIATION_SLUGS.has(slug)) {
    const footer = softRemediationFooter(slug);
    let out = trimmed;
    if ((missing.length > 0 || !commonOk) && footer) {
      out += `\n\n${footer}`;
    }
    if (out.length > MAX_TOTAL_CHARS) {
      out = `${trimmed.slice(0, MAX_TOTAL_CHARS - 120)}…\n[형식 안내]`;
    }
    return {
      text: out.trim(),
      note:
        missing.length > 0 || !commonOk
          ? '응답 형식 보정을 완화했습니다(위원회 필수 대괄호 생략 시).'
          : null,
    };
  }

  const prepend: string[] = [];
  for (const label of missing) {
    prepend.push(
      `[${label} — 서버 형식 보정] 본문에서 해당 항목을 직접 요약하세요. 확인되지 않은 사실은 단정하지 마세요.`,
    );
  }

  let out = prepend.length ? `${prepend.join('\n')}\n\n${trimmed}` : trimmed;

  if (!commonOk) {
    out += `\n\n[형식 보정] 공통 골격(핵심 관점·근거·리스크·행동/관찰)이 드러나지 않았을 수 있습니다. 위 본문을 기준으로 각각 한 줄씩 스스로 점검하세요.`;
  }

  if (out.length > MAX_TOTAL_CHARS) {
    out = `${trimmed}\n\n[형식 보정] 일부 필수 대괄호 섹션이 누락되었을 수 있습니다. 본문과 투자위원회 계약을 우선하세요.`;
    if (out.length > MAX_TOTAL_CHARS) {
      out = `${trimmed.slice(0, MAX_TOTAL_CHARS - 80)}…\n[형식 보정]`;
    }
  }

  const note =
    missing.length > 0 || !commonOk
      ? '일부 필수 섹션이 서버에서 안전하게 보정되었습니다.'
      : null;

  return { text: out.trim(), note };
}
