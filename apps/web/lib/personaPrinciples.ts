export const PERSONAL_INVESTMENT_OS_PRINCIPLE =
  "This product is a personal investment operating system for observation, risk review, judgment review, and repeated-mistake reduction. It is not a stock recommendation engine.";

export const OBSERVATION_REVIEW_PURPOSE_KO =
  "후보 관찰, 리스크 확인, 판단 복기, 반복 실수 감소를 위한 운영 보조입니다.";

export const NOT_TRADE_INSTRUCTION_KO =
  "매수/매도 지시가 아니라 확인할 관점과 다음 체크를 정리합니다.";

export const NO_AUTO_EXECUTION_KO =
  "자동매매, 자동주문, 자동 리밸런싱은 실행하지 않습니다.";

export const PERSONA_SECTION_LABELS = {
  check: "확인할 것",
  doNotDo: "지금 하면 안 되는 것",
  nextChecks: "다음 확인 체크리스트",
  missingEvidence: "부족한 근거",
  riskFlags: "리스크 플래그",
  observationMemo: "관찰 메모",
  retrospectivePoint: "복기 포인트",
} as const;

export const PERSONA_ROLE_INSTRUCTION_SNIPPETS = {
  privateBanker: `${OBSERVATION_REVIEW_PURPOSE_KO} ${NOT_TRADE_INSTRUCTION_KO} ${NO_AUTO_EXECUTION_KO}`,
  committee: `각 페르소나는 관점 제공자와 검증자입니다. ${NOT_TRADE_INSTRUCTION_KO}`,
  personaChat: `페르소나는 매수/매도 지시자가 아니라 관점 제공자입니다. ${NO_AUTO_EXECUTION_KO}`,
  researchToPb: `Research 결과를 PB 확인 질문으로 바꿉니다. ${NOT_TRADE_INSTRUCTION_KO}`,
  dailyNote: `오늘 확인할 메모 초안입니다. ${NO_AUTO_EXECUTION_KO}`,
  judgmentReview: `수익률 평가가 아니라 판단 과정 복기입니다. ${NO_AUTO_EXECUTION_KO}`,
} as const;

export type PersonaForbiddenPhraseCategory =
  | "imperative_trade"
  | "auto_execution"
  | "guarantee"
  | "recommendation";

export type PersonaForbiddenPhrase = {
  phrase: string;
  category: PersonaForbiddenPhraseCategory;
};

export const PERSONA_FORBIDDEN_PHRASES: readonly PersonaForbiddenPhrase[] = [
  { phrase: "자동매매", category: "auto_execution" },
  { phrase: "자동 주문", category: "auto_execution" },
  { phrase: "자동주문", category: "auto_execution" },
  { phrase: "자동 리밸런싱", category: "auto_execution" },
  { phrase: "주문 실행", category: "auto_execution" },
  { phrase: "지금 매수", category: "imperative_trade" },
  { phrase: "지금 매도", category: "imperative_trade" },
  { phrase: "지금 사라", category: "imperative_trade" },
  { phrase: "즉시 매수", category: "imperative_trade" },
  { phrase: "즉시 매도", category: "imperative_trade" },
  { phrase: "반드시 사세요", category: "imperative_trade" },
  { phrase: "강력 매수", category: "recommendation" },
  { phrase: "무조건 매수", category: "imperative_trade" },
  { phrase: "매수 추천", category: "recommendation" },
  { phrase: "매도 추천", category: "recommendation" },
  { phrase: "수익 보장", category: "guarantee" },
  { phrase: "확실한 수익", category: "guarantee" },
  { phrase: "목표 수익 보장", category: "guarantee" },
  { phrase: "buy now", category: "imperative_trade" },
  { phrase: "sell now", category: "imperative_trade" },
  { phrase: "automatic trading", category: "auto_execution" },
  { phrase: "auto order", category: "auto_execution" },
  { phrase: "auto rebalance", category: "auto_execution" },
  { phrase: "guaranteed profit", category: "guarantee" },
] as const;

export const PERSONA_FORBIDDEN_PHRASE_TEXTS = PERSONA_FORBIDDEN_PHRASES.map((p) => p.phrase);

export const PERSONA_TRADE_DIRECTIVE_BLOCK_RE =
  /자동매매|자동\s*주문|자동주문|자동\s*리밸런싱|주문\s*실행|매수\s*추천|매도\s*추천|즉시\s*매수|즉시\s*매도|지금\s*매수|지금\s*매도|지금\s*사라|반드시\s*사세요|강력\s*매수|무조건\s*매수|수익(?:을)?\s*보장|확실한\s*수익|목표\s*수익\s*보장|buy\s+now|sell\s+now|automatic\s+trading|auto\s+order|auto\s+rebalance|guaranteed\s+profit/i;

const PERSONA_TRADE_DIRECTIVE_BLOCK_GLOBAL_RE =
  /자동매매|자동\s*주문|자동주문|자동\s*리밸런싱|주문\s*실행|매수\s*추천|매도\s*추천|즉시\s*매수|즉시\s*매도|지금\s*매수|지금\s*매도|지금\s*사라|반드시\s*사세요|강력\s*매수|무조건\s*매수|수익(?:을)?\s*보장|확실한\s*수익|목표\s*수익\s*보장|buy\s+now|sell\s+now|automatic\s+trading|auto\s+order|auto\s+rebalance|guaranteed\s+profit/gi;

const SAFE_NEGATED_CAVEAT_RE =
  /하지\s*않|실행되지\s*않|지원하지\s*않|아닙니다|아님|없습니다|없음|금지|무관|not\s+supported|does\s+not|do\s+not|is\s+not|are\s+not|no\s+automatic|not\s+a\s+buy\s+recommendation|not\s+trade\s+advice/i;

export function buildNoTradeCaveatKo(): string {
  return `${OBSERVATION_REVIEW_PURPOSE_KO} ${NOT_TRADE_INSTRUCTION_KO}`;
}

export function buildActionBoundaryKo(): string {
  return `${NO_AUTO_EXECUTION_KO} 저장이나 변경은 사용자가 명시 버튼을 누를 때만 수행됩니다.`;
}

export function buildCheckDoNotDoNextChecksInstructionKo(): string {
  return `${PERSONA_SECTION_LABELS.check} / ${PERSONA_SECTION_LABELS.doNotDo} / ${PERSONA_SECTION_LABELS.nextChecks}를 분리해 작성합니다.`;
}

export function containsForbiddenPersonaPhrase(text: string): boolean {
  return PERSONA_TRADE_DIRECTIVE_BLOCK_RE.test(text);
}

export function isSafeNegatedCaveat(text: string): boolean {
  return containsForbiddenPersonaPhrase(text) && SAFE_NEGATED_CAVEAT_RE.test(text);
}

export function containsUnsafeDirective(text: string): boolean {
  const sentences = text
    .split(/(?<=[.!?。！？])|\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
  const parts = sentences.length > 0 ? sentences : [text];
  return parts.some((part) => containsForbiddenPersonaPhrase(part) && !isSafeNegatedCaveat(part));
}

export function scrubUnsafePersonaPhrases(text: string, replacement = "—"): string {
  return text.replace(PERSONA_TRADE_DIRECTIVE_BLOCK_GLOBAL_RE, replacement);
}

export function summarizePersonaPrincipleCoverage(input: {
  hasNoTradeCaveat?: boolean;
  hasNoAutoExecution?: boolean;
  hasCheckDoNotDoNextChecks?: boolean;
  hasPersonalizationContext?: boolean;
  hasActionBridge?: boolean;
}): {
  status: "ok" | "partial" | "missing";
  missing: string[];
} {
  const checks = {
    hasNoTradeCaveat: "no_trade_caveat",
    hasNoAutoExecution: "no_auto_execution",
    hasCheckDoNotDoNextChecks: "check_do_not_do_next_checks",
    hasPersonalizationContext: "personalization_context",
    hasActionBridge: "action_bridge",
  } as const;
  const missing = Object.entries(checks)
    .filter(([key]) => !input[key as keyof typeof input])
    .map(([, label]) => label);
  return {
    status: missing.length === 0 ? "ok" : missing.length === Object.keys(checks).length ? "missing" : "partial",
    missing,
  };
}
