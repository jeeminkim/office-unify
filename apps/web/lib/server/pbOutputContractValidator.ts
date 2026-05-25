import {
  NO_AUTO_EXECUTION_KO,
  NOT_TRADE_INSTRUCTION_KO,
  PERSONA_FORBIDDEN_PHRASES,
  containsForbiddenPersonaPhrase,
  containsUnsafeDirective,
  isSafeNegatedCaveat,
} from '@/lib/personaPrinciples';

export type PbOutputContractSource =
  | 'pb_message'
  | 'pb_weekly_review'
  | 'pb_daily_note_preview'
  | 'research_send_to_pb';

export type PbOutputContractInput = {
  source: PbOutputContractSource;
  text?: string;
  sections?: string[];
  items?: unknown[];
  personalizationUsed?: boolean;
  longResponseFallbackUsed?: boolean;
};

export type PbOutputContractAudit = {
  status: 'ok' | 'warning' | 'failed';
  source: PbOutputContractSource;
  requiredSections: {
    hasSourceSummary: boolean;
    hasRiskReview: boolean;
    hasDoNotDo: boolean;
    hasNextChecks: boolean;
    hasNoTradeCaveat: boolean;
    hasNoAutoExecutionCaveat: boolean;
  };
  policy: {
    unsafeDirectiveCount: number;
    forbiddenPhraseCount: number;
    safeCaveatDetected: boolean;
    warnings: string[];
  };
  quality: {
    missingSections: string[];
    weakSections: string[];
    recommendedAction: 'none' | 'show_warning' | 'fallback_summary' | 'manual_review';
  };
};

export type PbOutputContractAuditSummary = {
  status: PbOutputContractAudit['status'];
  source: PbOutputContractSource;
  missingSections: string[];
  unsafeDirectiveCount: number;
  forbiddenPhraseCount: number;
  safeCaveatDetected: boolean;
  recommendedAction: PbOutputContractAudit['quality']['recommendedAction'];
};

type PbDailyLikeItem = {
  noteSummary?: unknown;
  noteDetail?: unknown;
  pbPerspective?: unknown;
  riskFlags?: unknown;
  nextChecks?: unknown;
  doNotDo?: unknown;
  notTradeInstruction?: unknown;
};

const SECTION_MATCHERS = {
  sourceSummary: [
    /정보\s*상태/i,
    /source\s*summary/i,
    /source\s*context/i,
    /근거\s*요약/i,
    /관찰\s*메모/i,
    /행동\s*분류/i,
  ],
  riskReview: [
    /리스크/i,
    /risk/i,
    /보유\s*집중도/i,
    /관찰해야\s*할\s*신호/i,
    /부족한\s*근거/i,
  ],
  doNotDo: [
    /하면\s*안\s*되는/i,
    /하지\s*말/i,
    /do\s*not\s*do/i,
    /do-not-do/i,
  ],
  nextChecks: [
    /다음\s*확인/i,
    /next\s*check/i,
    /확인\s*체크/i,
    /관찰해야\s*할\s*신호/i,
    /지금\s*해야\s*할\s*행동/i,
  ],
} as const;

function normalizeStrings(input: PbOutputContractInput): string[] {
  const texts = [input.text, ...(input.sections ?? [])].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  for (const item of input.items ?? []) {
    if (!item || typeof item !== 'object') continue;
    const o = item as PbDailyLikeItem;
    for (const value of [o.noteSummary, o.noteDetail, o.pbPerspective]) {
      if (typeof value === 'string' && value.trim()) texts.push(value);
    }
    for (const value of [o.riskFlags, o.nextChecks, o.doNotDo]) {
      if (!Array.isArray(value)) continue;
      for (const line of value) {
        if (typeof line === 'string' && line.trim()) texts.push(line);
      }
    }
  }
  return texts;
}

function splitSentences(texts: string[]): string[] {
  return texts
    .flatMap((text) => text.split(/(?<=[.!?。！？])|\n|;/))
    .map((text) => text.trim())
    .filter(Boolean);
}

function hasSection(text: string, sections: string[], matchers: readonly RegExp[]): boolean {
  return matchers.some((matcher) => matcher.test(text) || sections.some((section) => matcher.test(section)));
}

function hasDailyItemArray(items: unknown[] | undefined, key: 'nextChecks' | 'doNotDo'): boolean {
  return Boolean(
    items?.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const value = (item as PbDailyLikeItem)[key];
      return Array.isArray(value) && value.some((line) => typeof line === 'string' && line.trim().length > 0);
    }),
  );
}

function hasDailySummary(items: unknown[] | undefined): boolean {
  return Boolean(
    items?.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const o = item as PbDailyLikeItem;
      return [o.noteSummary, o.pbPerspective].some((value) => typeof value === 'string' && value.trim().length > 0);
    }),
  );
}

function hasDailyRiskReview(items: unknown[] | undefined): boolean {
  return Boolean(
    items?.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const o = item as PbDailyLikeItem;
      return (
        (Array.isArray(o.riskFlags) && o.riskFlags.length > 0) ||
        (Array.isArray(o.doNotDo) && o.doNotDo.length > 0) ||
        (Array.isArray(o.nextChecks) && o.nextChecks.length > 0)
      );
    }),
  );
}

function hasDailyNotTrade(items: unknown[] | undefined): boolean {
  return Boolean(items?.some((item) => item && typeof item === 'object' && (item as PbDailyLikeItem).notTradeInstruction === true));
}

function hasNoTradeCaveat(text: string, safeCaveatDetected: boolean): boolean {
  return (
    text.includes(NOT_TRADE_INSTRUCTION_KO) ||
    /매수\s*추천.{0,20}아(?:님|닙니다)|매수\/매도\s*지시.{0,20}아(?:님|닙니다)|not\s+(?:a\s+)?(?:buy\s+)?recommendation|not\s+trade\s+advice/i.test(
      text,
    ) ||
    safeCaveatDetected
  );
}

function hasNoAutoExecutionCaveat(text: string): boolean {
  return (
    text.includes(NO_AUTO_EXECUTION_KO) ||
    /자동\s*(?:매매|주문|리밸런싱).{0,28}(?:하지\s*않|실행되지\s*않|없습니다|아닙니다|무관|금지)/i.test(text) ||
    /(?:automatic\s+trading|auto\s+order|auto\s+rebalance).{0,36}(?:not\s+supported|does\s+not|do\s+not|is\s+not|are\s+not)/i.test(
      text,
    )
  );
}

function countForbiddenPhrases(sentences: string[]): number {
  return sentences.reduce((count, sentence) => {
    if (isSafeNegatedCaveat(sentence)) return count;
    const directMatches = PERSONA_FORBIDDEN_PHRASES.filter((entry) =>
        sentence.toLocaleLowerCase().includes(entry.phrase.toLocaleLowerCase()),
      ).length;
    return count + (directMatches > 0 ? directMatches : containsForbiddenPersonaPhrase(sentence) ? 1 : 0);
  }, 0);
}

export function auditPbOutputContract(input: PbOutputContractInput): PbOutputContractAudit {
  const texts = normalizeStrings(input);
  const text = texts.join('\n');
  const sections = input.sections ?? [];
  const sentences = splitSentences(texts);
  const safeCaveatDetected = sentences.some((sentence) => isSafeNegatedCaveat(sentence));
  const unsafeSentences = sentences.filter(
    (sentence) => containsForbiddenPersonaPhrase(sentence) && containsUnsafeDirective(sentence),
  );

  const isDaily = input.source === 'pb_daily_note_preview';
  const requiredSections = {
    hasSourceSummary: isDaily ? hasDailySummary(input.items) : hasSection(text, sections, SECTION_MATCHERS.sourceSummary),
    hasRiskReview: isDaily ? hasDailyRiskReview(input.items) : hasSection(text, sections, SECTION_MATCHERS.riskReview),
    hasDoNotDo: isDaily ? hasDailyItemArray(input.items, 'doNotDo') : hasSection(text, sections, SECTION_MATCHERS.doNotDo),
    hasNextChecks: isDaily ? hasDailyItemArray(input.items, 'nextChecks') : hasSection(text, sections, SECTION_MATCHERS.nextChecks),
    hasNoTradeCaveat: hasDailyNotTrade(input.items) || hasNoTradeCaveat(text, safeCaveatDetected),
    hasNoAutoExecutionCaveat: hasNoAutoExecutionCaveat(text),
  };

  const missingSections = Object.entries(requiredSections)
    .filter(([, present]) => !present)
    .map(([key]) => key);
  const weakSections = [
    input.personalizationUsed === false ? 'personalization_context_unused' : null,
    input.longResponseFallbackUsed ? 'long_response_fallback_used' : null,
  ].filter((value): value is string => Boolean(value));
  const forbiddenPhraseCount = countForbiddenPhrases(sentences);
  const unsafeDirectiveCount = unsafeSentences.length;
  const warnings = [
    unsafeDirectiveCount > 0 ? 'unsafe_directive_detected' : null,
    missingSections.length > 0 ? 'required_pb_sections_missing' : null,
    forbiddenPhraseCount > 0 ? 'forbidden_phrase_detected' : null,
  ].filter((value): value is string => Boolean(value));

  const status: PbOutputContractAudit['status'] =
    unsafeDirectiveCount > 0 ? 'failed' : missingSections.length > 0 || weakSections.length > 0 ? 'warning' : 'ok';
  const recommendedAction: PbOutputContractAudit['quality']['recommendedAction'] =
    unsafeDirectiveCount > 0
      ? 'manual_review'
      : input.longResponseFallbackUsed
        ? 'fallback_summary'
        : missingSections.length > 0 || weakSections.length > 0
          ? 'show_warning'
          : 'none';

  return {
    status,
    source: input.source,
    requiredSections,
    policy: {
      unsafeDirectiveCount,
      forbiddenPhraseCount,
      safeCaveatDetected,
      warnings,
    },
    quality: { missingSections, weakSections, recommendedAction },
  };
}

export function summarizePbOutputContractAudit(audit: PbOutputContractAudit): PbOutputContractAuditSummary {
  return {
    status: audit.status,
    source: audit.source,
    missingSections: audit.quality.missingSections,
    unsafeDirectiveCount: audit.policy.unsafeDirectiveCount,
    forbiddenPhraseCount: audit.policy.forbiddenPhraseCount,
    safeCaveatDetected: audit.policy.safeCaveatDetected,
    recommendedAction: audit.quality.recommendedAction,
  };
}

export function buildPbOutputContractAuditSummary(input: PbOutputContractInput): PbOutputContractAuditSummary {
  try {
    return summarizePbOutputContractAudit(auditPbOutputContract(input));
  } catch {
    return {
      status: 'warning',
      source: input.source,
      missingSections: ['output_contract_audit_unavailable'],
      unsafeDirectiveCount: 0,
      forbiddenPhraseCount: 0,
      safeCaveatDetected: false,
      recommendedAction: 'show_warning',
    };
  }
}
