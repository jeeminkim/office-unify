/**
 * Private Banker 응답 — 최소 문자열 검증 + 안전한 후처리 보정 (PB 전용).
 * 무한 재시도·무거운 파서 없음. 허위 수치·매매 판단을 만들지 않는다.
 */

import { PERSONA_CHAT_ASSISTANT_TARGET_MAX_CHARS } from '@office-unify/shared-types';

const MAX_TOTAL_CHARS = PERSONA_CHAT_ASSISTANT_TARGET_MAX_CHARS + 400;

export type PrivateBankerFormatRemediation = {
  text: string;
  /** 사용자에게 보일 아주 짧은 안내(선택) */
  note: string | null;
  /** 내부 디버그용(선택) */
  missingLabels?: string[];
};

function hasActionClassification(text: string): boolean {
  return /\[\s*행동\s*분류\s*:/i.test(text) || /\[\s*행동\s*분류\s*\]/i.test(text);
}

function hasInfoState(text: string): boolean {
  return /\[\s*정보\s*상태/i.test(text);
}

function hasBuyTypeLine(text: string): boolean {
  return /\[\s*매수\s*유형/i.test(text);
}

function hasFooterNow(text: string): boolean {
  return /지금\s*해야\s*할\s*행동/i.test(text);
}

function hasFooterDont(text: string): boolean {
  return /하면\s*안\s*되는\s*행동/i.test(text);
}

function hasFooterWatch(text: string): boolean {
  return /관찰(?:해야\s*)?할\s*신호/i.test(text);
}

/**
 * [행동 분류: …] 앞부분에서 신규/추가 매수 여부 추정 (느슨한 문자열 매칭).
 */
export function inferBuyIntentFromPbReply(text: string): boolean {
  const head = text.slice(0, 600);
  const m = head.match(/\[행동\s*분류\s*:\s*([^\]\n]+)\]/i);
  const cls = (m?.[1] ?? '').trim();
  if (cls.includes('신규매수') || cls.includes('추가매수')) return true;
  if (/신규\s*매수|추가\s*매수/.test(cls)) return true;
  return false;
}

export type PrivateBankerFormatCheck = {
  ok: boolean;
  missing: string[];
  buyTypeRequired: boolean;
};

export function checkPrivateBankerReplyFormat(text: string): PrivateBankerFormatCheck {
  const buyTypeRequired = inferBuyIntentFromPbReply(text);
  const missing: string[] = [];
  if (!hasActionClassification(text)) missing.push('행동 분류');
  if (!hasInfoState(text)) missing.push('정보 상태');
  if (buyTypeRequired && !hasBuyTypeLine(text)) missing.push('매수 유형');
  if (!hasFooterNow(text)) missing.push('지금 해야 할 행동');
  if (!hasFooterDont(text)) missing.push('하면 안 되는 행동');
  if (!hasFooterWatch(text)) missing.push('관찰해야 할 신호');
  return { ok: missing.length === 0, missing, buyTypeRequired };
}

function buildPrependMissing(params: {
  needAction: boolean;
  needInfo: boolean;
  needBuyType: boolean;
}): string {
  const lines: string[] = [];
  if (params.needAction) {
    lines.push(
      '[행동 분류: 미확인 — 서버 형식 보정] 모델 응답에 분류 라인이 없어 표기했습니다. 사용자 입력·최신 원장에 맞게 스스로 분류하세요.',
    );
  }
  if (params.needInfo) {
    lines.push(
      '[정보 상태: 미확인 — 서버 형식 보정] 확인됨/추론/미확인은 사용자가 이번에 제공한 자료 기준으로만 정리하세요. 기억·추정으로 원장을 대체하지 마세요.',
    );
  }
  if (params.needBuyType) {
    lines.push(
      '[매수 유형: 미분류 — 서버 형식 보정] 신규/추가 매수 논의는 반등·재평가·실적 추세·이벤트 중 하나로 먼저 분류한 뒤 진행하세요.',
    );
  }
  return lines.join('\n');
}

function buildAppendFooter(): string {
  return [
    '',
    '---',
    '**지금 해야 할 행동** (서버 형식 보정)',
    '- 본문 결론을 확인하고, 부족한 정보는 최신 원장에서 보완하세요.',
    '',
    '**하면 안 되는 행동** (서버 형식 보정)',
    '- 미확인 수치·사실을 단정하거나, 그에 기반한 매매를 실행하지 마세요.',
    '',
    '**관찰해야 할 신호** (서버 형식 보정)',
    '- 사용자가 제시한 최신 자료에서 가격·비중·이벤트·무효화 조건을 추적하세요.',
  ].join('\n');
}

/**
 * 누락 섹션을 안전한 문구로 보강. 재호출 없음. 길이 초과 시 본문 유지 + 짧은 형식 안내만 덧붙인다.
 */
export function remediatePrivateBankerReply(raw: string): PrivateBankerFormatRemediation {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      text: '[행동 분류: 미확인 — 서버 형식 보정]\n[정보 상태: 미확인 — 서버 형식 보정]\n응답이 비어 있어 판단 보조를 제공할 수 없습니다. 입력과 최신 원장을 다시 보내 주세요.',
      note: '빈 응답에 최소 형식만 추가했습니다.',
      missingLabels: ['전체'],
    };
  }

  const check = checkPrivateBankerReplyFormat(trimmed);
  if (check.ok) {
    return { text: trimmed, note: null };
  }

  const needAction = !hasActionClassification(trimmed);
  const needInfo = !hasInfoState(trimmed);
  const needBuyType = check.buyTypeRequired && !hasBuyTypeLine(trimmed);

  let out = trimmed;
  if (needAction || needInfo || needBuyType) {
    const prepend = buildPrependMissing({ needAction, needInfo, needBuyType });
    out = `${prepend}\n\n${out}`;
  }

  const needFooter = !hasFooterNow(out) || !hasFooterDont(out) || !hasFooterWatch(out);
  if (needFooter) {
    out += buildAppendFooter();
  }

  if (out.length > MAX_TOTAL_CHARS) {
    const fallbackNote =
      '\n\n[형식 보정] 일부 필수 섹션(행동 분류·정보 상태·하단 행동 안내 등)이 누락되었을 수 있습니다. 위 본문은 참고용이며, 최신 원장과 시스템 규칙을 우선하세요.';
    out = `${trimmed}${fallbackNote}`;
    if (out.length > MAX_TOTAL_CHARS) {
      out = `${trimmed.slice(0, MAX_TOTAL_CHARS - 120)}…${fallbackNote}`;
    }
  }

  return {
    text: out.trim(),
    note: '일부 필수 섹션이 서버에서 안전하게 보정되었습니다.',
    missingLabels: check.missing,
  };
}
