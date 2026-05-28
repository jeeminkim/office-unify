import type {
  ActionGuardrail,
  ActionItemDetailJson,
  ActionItemRecommendedLink,
  ActionItemSourceRef,
  ActionItemStep,
  PbOutputContractAuditSummary,
  PersonaActionBridgeSource,
} from '@office-unify/shared-types';
import { analyzeActionItemDetailCompleteness, scrubDetailText } from '@/lib/actionItemDetailCompleteness';

export type { PersonaActionBridgeSource };

export type PersonaActionBridgeInput = {
  source: PersonaActionBridgeSource;
  title?: string;
  sourceSummary?: string;
  riskFlags?: string[];
  missingEvidence?: string[];
  doNotDo?: string[];
  nextChecks?: string[];
  recommendedNextLinks?: ActionItemRecommendedLink[];
  sourceRefs?: ActionItemSourceRef[];
  symbol?: string;
  name?: string;
  market?: string;
  originalQuestion?: string;
  outputContract?: PbOutputContractAuditSummary;
  outputContractWarnings?: Array<{ code?: string; kind?: string; message?: string }>;
  gatingReason?: string;
  anchorOk?: boolean;
  googleFinanceAnchorOk?: boolean;
};

export type PersonaActionBridgeResult = {
  detail: ActionItemDetailJson;
  actionSteps: ActionItemStep[];
  guardrails: ActionGuardrail[];
  recommendedNextLinks: ActionItemRecommendedLink[];
  completeness: {
    score: number;
    level: 'full' | 'high' | 'medium' | 'low';
    missingFields: string[];
  };
  warnings: string[];
};

const DEFAULT_GUARDRAIL_LABELS = [
  'Do not treat this as a buy or sell instruction.',
  'Do not execute orders or rebalancing without explicit user action.',
];

const EXECUTION_DIRECTIVE_RE =
  /\b(buy now|sell now|place a buy order|place a sell order|execute buy|execute sell|auto rebalance)\b|(?:즉시|지금)\s*(?:매수|매도)|(?:매수|매도)\s*주문\s*실행|자동\s*(?:주문\s*실행|리밸런싱)/i;

const SAFE_CAVEAT_RE =
  /매수\/매도 관련 뉴스 확인|매수 의견이 아닌 리스크 확인|주문은 실행되지 않습니다|자동 주문은 실행되지 않습니다|not a buy recommendation|not an order/i;

function bridgeLevel(score: number): PersonaActionBridgeResult['completeness']['level'] {
  if (score >= 85) return 'full';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function normalizeText(value: unknown, max = 160): string | undefined {
  const text = scrubDetailText(String(value ?? ''), max).trim();
  return text || undefined;
}

function dedupeStrings(values: Array<unknown>, max = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = normalizeText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function sourceHref(source: PersonaActionBridgeSource, symbol?: string): string {
  const q = symbol ? encodeURIComponent(symbol) : '';
  switch (source) {
    case 'pb_message':
    case 'pb_weekly_review':
    case 'pb_daily_note':
      return '/private-banker';
    case 'committee_roadmap':
    case 'committee_regenerate':
      return '/committee-discussion';
    case 'research_report':
      return q ? `/research-center?symbol=${q}` : '/research-center';
    case 'daily_review_note':
      return '/daily-review';
    case 'judgment_review':
      return '/judgment-review';
    case 'today_candidate':
    case 'us_diagnostics':
      return '/';
    case 'long_response_fallback':
      return '/action-items';
    default:
      return '/action-items';
  }
}

function dedupeLinks(links: ActionItemRecommendedLink[]): ActionItemRecommendedLink[] {
  const seen = new Set<string>();
  const out: ActionItemRecommendedLink[] = [];
  for (const link of links) {
    const key = link.actionKey ? `action:${link.actionKey}` : `href:${link.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out.slice(0, 10);
}

function recommendedLinks(input: PersonaActionBridgeInput): ActionItemRecommendedLink[] {
  const q = input.symbol ? encodeURIComponent(input.symbol) : '';
  const base: ActionItemRecommendedLink[] = [
    { kind: 'source', label: 'Source', actionKey: 'open_source', href: sourceHref(input.source, input.symbol) },
    { kind: 'research', label: 'Research', actionKey: 'open_research', href: q ? `/research-center?symbol=${q}` : '/research-center' },
    { kind: 'pb', label: 'Ask PB', actionKey: 'open_pb', href: '/private-banker' },
    { kind: 'committee', label: 'Committee', actionKey: 'open_committee', href: '/committee-discussion' },
    { kind: 'journal', label: 'Journal', actionKey: 'open_journal', href: q ? `/trade-journal?symbol=${q}` : '/trade-journal' },
    { kind: 'retrospective', label: 'Retrospective', actionKey: 'open_retrospective', href: '/trade-journal' },
  ];

  if (input.source === 'us_diagnostics') {
    base.unshift(
      { kind: 'source', label: 'Watchlist', actionKey: 'open_watchlist', href: '/watchlist' },
      { kind: 'source', label: 'Sector Radar', actionKey: 'open_sector_radar', href: '/sector-radar' },
      { kind: 'source', label: 'Google Finance setup', actionKey: 'open_google_finance_setup', href: '/ops/google-finance-setup' },
      { kind: 'source', label: 'Action Items', actionKey: 'open_source', href: '/action-items' },
    );
  }

  return dedupeLinks([...(input.recommendedNextLinks ?? []), ...base]);
}

function missingSectionStep(section: string): string {
  switch (section) {
    case 'hasNextChecks':
    case 'missingNextChecks':
      return 'PB 답변의 다음 확인 항목 보강';
    case 'hasDoNotDo':
    case 'missingDoNotDo':
      return '하지 말아야 할 행동 기준 보강';
    case 'hasRiskReview':
    case 'missingRiskReview':
      return '리스크 검토 항목 보강';
    case 'hasConclusion':
    case 'missingConclusion':
      return 'PB 결론 요약 보강';
    case 'hasSourceSummary':
    case 'missingSummary':
      return '답변 요약 보강';
    case 'hasSourceRefs':
    case 'missingSourceRefs':
      return '출처 참조 보강';
    default:
      return `PB 출력 품질 보강: ${section}`;
  }
}

function usDiagnosticsChecks(input: PersonaActionBridgeInput): string[] {
  if (input.source !== 'us_diagnostics' || input.gatingReason !== 'us_signal_mapping_empty') return [];
  return [
    'Watchlist에서 관심종목 sector/theme 비어 있는 항목 확인',
    'Sector Radar mapping 확인',
    'US→KR theme registry에서 연결 규칙 확인',
    'quote_quality_low 종목의 ticker/시세 품질 확인',
    '다음 Today Brief에서 usCoverage/gatingReason 재확인',
  ];
}

function sourceLabel(source: PersonaActionBridgeSource): string {
  return source;
}

function stepId(category: ActionItemStep['category'], index: number, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 36);
  return `${category}-${index}-${slug || 'step'}`;
}

function makeStep(label: string, index: number, category: ActionItemStep['category'], reason?: string): ActionItemStep {
  const recommendedActions: ActionItemStep['recommendedActions'] =
    category === 'research'
      ? [{ actionKey: 'open_research', label: 'Research', href: '/research-center' }]
      : category === 'manual_review'
        ? [{ actionKey: 'ask_pb', label: 'Ask PB', href: '/private-banker' }]
        : category === 'risk_review'
          ? [{ actionKey: 'open_committee', label: 'Committee', href: '/committee-discussion' }]
          : [
              { actionKey: 'open_research', label: 'Research', href: '/research-center' },
              { actionKey: 'ask_pb', label: 'Ask PB', href: '/private-banker' },
              { actionKey: 'open_committee', label: 'Committee', href: '/committee-discussion' },
            ];
  return {
    stepId: stepId(category, index, label),
    label,
    reason,
    category,
    status: 'open',
    recommendedActions,
  };
}

function guardrailFromLabel(label: string, index: number, severity: ActionGuardrail['severity'] = 'warn'): ActionGuardrail {
  return {
    id: `guardrail-${index}-${label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'item'}`,
    label,
    severity,
  };
}

function outputContractMissingSections(input: PersonaActionBridgeInput): string[] {
  const fromSummary =
    input.outputContract && input.outputContract.status !== 'ok'
      ? input.outputContract.missingSections.map(missingSectionStep)
      : [];
  const fromWarnings =
    input.outputContractWarnings
      ?.filter((warning) => !SAFE_CAVEAT_RE.test(`${warning.code ?? ''} ${warning.kind ?? ''} ${warning.message ?? ''}`))
      .map((warning) => missingSectionStep(warning.code ?? warning.kind ?? warning.message ?? 'manual_review')) ?? [];
  return dedupeStrings([...fromSummary, ...fromWarnings], 8);
}

function hasUnsafeDirective(input: PersonaActionBridgeInput): boolean {
  if (input.outputContract?.recommendedAction === 'manual_review') return true;
  if ((input.outputContract?.unsafeDirectiveCount ?? 0) > 0) return true;
  return (input.outputContractWarnings ?? []).some((warning) => {
    const text = `${warning.code ?? ''} ${warning.kind ?? ''} ${warning.message ?? ''}`;
    return EXECUTION_DIRECTIVE_RE.test(text) && !SAFE_CAVEAT_RE.test(text);
  });
}

function computeCompleteness(input: {
  title?: string;
  sourceSummary?: string;
  actionSteps: ActionItemStep[];
  recommendedNextLinks: ActionItemRecommendedLink[];
  sourceRefs: ActionItemSourceRef[];
  guardrails: ActionGuardrail[];
  symbol?: string;
  name?: string;
}): PersonaActionBridgeResult['completeness'] {
  let score = 0;
  const missingFields: string[] = [];

  if (input.sourceSummary) score += 20;
  else missingFields.push('sourceSummary');

  if (input.actionSteps.length >= 3) score += 20;
  else if (input.actionSteps.length >= 1) score += 10;
  else missingFields.push('actionSteps');

  if (input.recommendedNextLinks.length) score += 20;
  else missingFields.push('recommendedNextLinks');

  if (input.sourceRefs.length) score += 15;
  else missingFields.push('sourceRefs');

  if (input.guardrails.length) score += 10;
  else missingFields.push('guardrails');

  if (input.title) score += 10;
  else missingFields.push('title');

  if (input.symbol || input.name) score += 5;

  return { score, level: bridgeLevel(score), missingFields };
}

export function mergeActionItemDetailWithBridge(
  existing: Partial<ActionItemDetailJson> | undefined,
  bridge: PersonaActionBridgeResult,
): ActionItemDetailJson {
  const base = existing ?? {};
  const seenStep = new Set<string>();
  const actionSteps = [...(base.actionSteps ?? []), ...bridge.actionSteps].filter((step) => {
    const key = `${step.category}|${step.label}`;
    if (seenStep.has(key)) return false;
    seenStep.add(key);
    return true;
  });

  const guardrails = [...(base.guardrails ?? []), ...bridge.guardrails].filter((guardrail, index, arr) => {
    return arr.findIndex((item) => item.label === guardrail.label) === index;
  });

  const doNotDo = dedupeStrings([...(base.doNotDo ?? []), ...guardrails.map((guardrail) => guardrail.label)], 10);
  const recommendedNextLinks = dedupeLinks([...(base.recommendedNextLinks ?? []), ...bridge.recommendedNextLinks]);

  return {
    ...bridge.detail,
    ...base,
    sourceSummary: base.sourceSummary ?? bridge.detail.sourceSummary,
    whyCreated: base.whyCreated ?? bridge.detail.whyCreated,
    checklist: base.checklist?.length ? base.checklist : bridge.detail.checklist,
    confirmNow: base.confirmNow?.length ? base.confirmNow : bridge.detail.confirmNow,
    evidenceNeeded: base.evidenceNeeded?.length ? base.evidenceNeeded : bridge.detail.evidenceNeeded,
    decisionContext: { ...(bridge.detail.decisionContext ?? {}), ...(base.decisionContext ?? {}) },
    recommendedNextLinks,
    actionSteps,
    guardrails,
    doNotDo,
    bridgeWarnings: bridge.warnings.length ? dedupeStrings([...(base.bridgeWarnings ?? []), ...bridge.warnings]) : base.bridgeWarnings,
    completenessScore: bridge.completeness.score,
    completenessLevel: bridge.completeness.level,
    notTradeInstruction: true,
  };
}

export function buildPersonaActionBridge(input: PersonaActionBridgeInput): PersonaActionBridgeResult {
  const warnings: string[] = [];
  const anchorOk = input.anchorOk === true || input.googleFinanceAnchorOk === true;

  const outputContractSteps = outputContractMissingSections(input);
  if (hasUnsafeDirective(input)) warnings.push('manual_review_required');

  const sourceSummary =
    input.source === 'us_diagnostics' && input.gatingReason === 'us_signal_mapping_empty' && anchorOk
      ? 'Google Finance anchor는 정상이나, 미국장 신호가 한국/관심 후보로 연결되지 않았습니다.'
      : normalizeText(input.sourceSummary ?? input.title ?? 'Structured output converted into follow-up actions.', 400);

  const nextChecks = dedupeStrings(
    [...usDiagnosticsChecks(input), ...(input.nextChecks ?? []), ...outputContractSteps],
    12,
  );
  const missingEvidence = dedupeStrings(input.missingEvidence ?? [], 8);
  const riskFlags = dedupeStrings(input.riskFlags ?? [], 8);

  const guardrailLabels = dedupeStrings(
    [
      ...(input.source === 'us_diagnostics' && anchorOk
        ? [
            'Google Finance repair를 반복하지 않기',
            'anchor 정상 상태에서 미국 후보를 강제로 생성하지 않기',
            '매수 후보로 오해하지 않기',
          ]
        : []),
      ...(input.doNotDo ?? []),
      ...DEFAULT_GUARDRAIL_LABELS,
    ],
    10,
  );
  const guardrails = guardrailLabels.map((label, index) =>
    guardrailFromLabel(label, index, EXECUTION_DIRECTIVE_RE.test(label) && !SAFE_CAVEAT_RE.test(label) ? 'block' : 'warn'),
  );
  if (hasUnsafeDirective(input)) {
    guardrails.push(guardrailFromLabel('Unsafe execution directive requires manual review.', guardrails.length, 'block'));
  }

  const actionSteps = [
    ...nextChecks.map((label, index) => makeStep(label, index, 'checklist')),
    ...missingEvidence.map((label, index) => makeStep(label, nextChecks.length + index, 'research', 'Missing evidence to verify')),
    ...riskFlags.map((label, index) => makeStep(label, nextChecks.length + missingEvidence.length + index, 'risk_review', 'Risk flag to review')),
    ...outputContractSteps.map((label, index) =>
      makeStep(label, nextChecks.length + missingEvidence.length + riskFlags.length + index, 'manual_review', 'PB output contract warning'),
    ),
  ].filter((item) => !EXECUTION_DIRECTIVE_RE.test(item.label) || SAFE_CAVEAT_RE.test(item.label));

  const links = recommendedLinks(input);
  const sourceRefs =
    input.sourceRefs?.length
      ? input.sourceRefs
      : [
          {
            sourceType: input.source,
            sourceHref: sourceHref(input.source, input.symbol),
            label: sourceLabel(input.source),
          },
        ];

  const completeness = computeCompleteness({
    title: input.title,
    sourceSummary,
    actionSteps,
    recommendedNextLinks: links,
    sourceRefs,
    guardrails,
    symbol: input.symbol,
    name: input.name,
  });

  const detail: ActionItemDetailJson = {
    notTradeInstruction: true,
    bridgeSource: input.source,
    bridgeWarnings: warnings.length ? warnings : undefined,
    guardrails,
    completenessScore: completeness.score,
    completenessLevel: completeness.level,
    actionCategory:
      riskFlags.length || input.source === 'today_candidate'
        ? 'risk_review'
        : input.source === 'research_report' || input.source === 'long_response_fallback'
          ? 'research_needed'
          : 'check_now',
    sourceLabel: sourceLabel(input.source),
    whyCreated: normalizeText(input.title ?? `${sourceLabel(input.source)} follow-up`, 400),
    sourceSummary,
    confirmNow: nextChecks.slice(0, 5),
    checklist: nextChecks.map((label) => ({ label, source: input.source })),
    doNotDo: guardrails.map((guardrail) => guardrail.label),
    evidenceNeeded: missingEvidence,
    actionSteps,
    recommendedNextLinks: links,
    sourceRefs,
    decisionContext: {
      sourceSummary,
      relatedSymbol: input.symbol,
      relatedName: input.name,
      riskFlags,
      missingEvidence,
      nextChecks,
    },
    symbol: input.symbol,
    name: input.name,
    market: input.market,
    usDiagnostics:
      input.source === 'us_diagnostics'
        ? {
            googleFinanceAnchorOk: anchorOk,
            gatingReason: input.gatingReason,
            suggestedNextChecks: nextChecks,
          }
        : undefined,
  };

  const contractCompleteness = analyzeActionItemDetailCompleteness(detail);
  const finalCompleteness = {
    score: Math.max(completeness.score, contractCompleteness.score),
    level: bridgeLevel(Math.max(completeness.score, contractCompleteness.score)),
    missingFields: [...new Set([...completeness.missingFields, ...contractCompleteness.missingFields])],
  };

  detail.completenessScore = finalCompleteness.score;
  detail.completenessLevel = finalCompleteness.level;

  return {
    detail,
    actionSteps,
    guardrails,
    recommendedNextLinks: links,
    completeness: finalCompleteness,
    warnings,
  };
}
