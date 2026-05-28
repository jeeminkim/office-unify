/**
 * 페르소나·위원회 구조화 출력 계약 — 파싱·검증·금지 문구 sanitize (서버 전용).
 */

import 'server-only';

import type {
  PersonaChatMessageResponseBody,
  PersonaPortfolioContextStructured,
  PersonaRole,
  PersonaStructuredConfidence,
  PersonaStructuredOutput,
  PersonaStructuredStance,
  PersonaScoreAdjustmentSuggestion,
  PersonaStructuredOutputQualitySummary,
} from '@office-unify/shared-types';
import { PERSONA_FORBIDDEN_PHRASE_TEXTS } from '@/lib/personaPrinciples';

export const PERSONA_STRUCTURED_BANNED_PHRASES: readonly string[] = PERSONA_FORBIDDEN_PHRASE_TEXTS;

export function extractLeadingJsonObject(text: string): { jsonStr: string; rest: string } | null {
  const s = text.trimStart();
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = false;
        continue;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { jsonStr: s.slice(start, i + 1), rest: s.slice(i + 1) };
      }
    }
  }
  return null;
}

const PERSONA_ROLES: PersonaRole[] = [
  'risk',
  'opportunity',
  'skeptic',
  'suitability',
  'execution',
  'cio',
  'private_banker',
];

const PERSONA_STANCES: PersonaStructuredStance[] = [
  'observe',
  'review',
  'risk_review',
  'avoid_for_now',
  'hold_review',
  'insufficient_data',
];

const PERSONA_CONF: PersonaStructuredConfidence[] = ['high', 'medium', 'low', 'unknown'];

export function mapPersonaSlugToRole(slug: string): PersonaRole {
  const s = slug.trim().toLowerCase();
  if (s.includes('hindenburg')) return 'risk';
  if (s.includes('ray') || s.includes('dalio')) return 'opportunity';
  if (s.includes('simons')) return 'skeptic';
  if (s === 'cio') return 'cio';
  if (s.includes('drucker')) return 'execution';
  if (s.includes('jyp') || s.includes('pierpont') || s.includes('private') || s.includes('banker')) return 'private_banker';
  return 'opportunity';
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? '').trim()).filter(Boolean);
}

function pickRole(raw: unknown, slug: string): PersonaRole {
  const r = String(raw ?? '').trim().toLowerCase();
  if (PERSONA_ROLES.includes(r as PersonaRole)) return r as PersonaRole;
  return mapPersonaSlugToRole(slug);
}

function pickStance(raw: unknown): PersonaStructuredStance {
  const r = String(raw ?? '').trim().toLowerCase();
  if (PERSONA_STANCES.includes(r as PersonaStructuredStance)) return r as PersonaStructuredStance;
  return 'review';
}

function pickConfidence(raw: unknown): PersonaStructuredConfidence {
  const r = String(raw ?? '').trim().toLowerCase();
  if (PERSONA_CONF.includes(r as PersonaStructuredConfidence)) return r as PersonaStructuredConfidence;
  return 'unknown';
}

function bannedHitsInText(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const ph of PERSONA_STRUCTURED_BANNED_PHRASES) {
    if (lower.includes(ph.toLowerCase())) hits.push(ph);
  }
  return hits;
}

function scrubBanned(text: string): string {
  let out = text;
  for (const ph of PERSONA_STRUCTURED_BANNED_PHRASES) {
    const re = new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, '—');
  }
  return out.trim();
}

const COMMITTEE_COMPACT_MAX = 1200;
const COMMITTEE_COMPACT_ITEM_MAX = 160;

function stripJsonFencesForSummary(text: string): string {
  return text.replace(/```(?:json)?\s*[\s\S]*?```/gi, '').trim();
}

function compactText(text: string, max = COMMITTEE_COMPACT_ITEM_MAX): string {
  const cleaned = stripJsonFencesForSummary(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function compactItems(items: readonly string[], maxItems = 3, maxChars = COMMITTEE_COMPACT_ITEM_MAX): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = compactText(String(raw ?? ''), maxChars);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function decodeJsonStringFragment(fragment: string): string {
  try {
    return JSON.parse(`"${fragment}"`) as string;
  } catch {
    return fragment.replace(/\\"/g, '"').replace(/\\n/g, ' ');
  }
}

function extractPartialString(rawText: string, field: string): string | undefined {
  const re = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`);
  const match = re.exec(rawText);
  return match ? compactText(decodeJsonStringFragment(match[1]), 240) : undefined;
}

function extractPartialStringArray(rawText: string, field: string): string[] {
  const startRe = new RegExp(`"${field}"\\s*:\\s*\\[`);
  const start = startRe.exec(rawText);
  if (!start || start.index === undefined) return [];
  const rest = rawText.slice(start.index + start[0].length);
  const nextField = rest.search(/,\s*"[A-Za-z0-9_]+"\s*:/);
  const endBracket = rest.indexOf(']');
  const end =
    endBracket >= 0 && (nextField < 0 || endBracket < nextField)
      ? endBracket
      : nextField >= 0
        ? nextField
        : Math.min(rest.length, 2000);
  const segment = rest.slice(0, end);
  const values: string[] = [];
  const itemRe = /"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(segment)) && values.length < 3) {
    const decoded = compactText(decodeJsonStringFragment(match[1]));
    if (decoded) values.push(decoded);
  }
  return compactItems(values);
}

function plainFallbackSnippet(rawText: string): string {
  const text = stripJsonFencesForSummary(rawText);
  if (!text) return '';
  if (/^\s*[\[{]/.test(text) || text.includes('"displaySummary"') || text.includes('"keyReasons"')) {
    return '';
  }
  return compactText(text, 220);
}

export function buildCommitteeCompactCard(output: PersonaStructuredOutput): string {
  const sections: string[] = [];
  sections.push(`[결론]\n${compactText(output.displaySummary, 240) || '이 발언은 일부 손상되어 핵심 요약만 표시합니다.'}`);

  const rows: Array<[string, string[]]> = [
    ['핵심 근거', compactItems(output.keyReasons)],
    ['리스크', compactItems(output.riskFlags)],
    ['누락 근거', compactItems(output.missingEvidence, 2)],
    ['하지 말 것', compactItems(output.doNotDo, 2)],
    ['다음 확인', compactItems(output.nextChecks, 3)],
  ];

  for (const [label, items] of rows) {
    if (items.length === 0) continue;
    sections.push(`[${label}]\n${items.map((x) => `- ${x}`).join('\n')}`);
  }

  const card = sections.join('\n\n').trim();
  return card.length <= COMMITTEE_COMPACT_MAX
    ? card
    : `${card.slice(0, COMMITTEE_COMPACT_MAX - 1).trimEnd()}…`;
}

function buildCompactFallbackFromRaw(personaSlug: string, rawText: string): PersonaStructuredOutput {
  const displaySummary =
    extractPartialString(rawText, 'displaySummary') ||
    plainFallbackSnippet(rawText) ||
    '이 발언은 일부 손상되어 핵심 요약만 표시합니다.';

  return {
    role: mapPersonaSlugToRole(personaSlug),
    stance: 'insufficient_data',
    confidence: 'unknown',
    keyReasons: extractPartialStringArray(rawText, 'keyReasons'),
    riskFlags: extractPartialStringArray(rawText, 'riskFlags'),
    opportunityDrivers: extractPartialStringArray(rawText, 'opportunityDrivers'),
    missingEvidence: compactItems([
      ...extractPartialStringArray(rawText, 'missingEvidence'),
      'structured_output_parse_failed',
    ], 2),
    contradictions: extractPartialStringArray(rawText, 'contradictions'),
    doNotDo: extractPartialStringArray(rawText, 'doNotDo').slice(0, 2),
    nextChecks: extractPartialStringArray(rawText, 'nextChecks'),
    displaySummary,
  };
}

function sanitizeStringFields(output: PersonaStructuredOutput): { output: PersonaStructuredOutput; bannedCount: number } {
  let bannedCount = 0;
  const clone: PersonaStructuredOutput = {
    ...output,
    keyReasons: [...output.keyReasons],
    riskFlags: [...output.riskFlags],
    opportunityDrivers: [...output.opportunityDrivers],
    missingEvidence: [...output.missingEvidence],
    contradictions: [...output.contradictions],
    doNotDo: [...output.doNotDo],
    nextChecks: [...output.nextChecks],
  };

  const hitsDs = bannedHitsInText(clone.displaySummary);
  bannedCount += hitsDs.length;
  clone.displaySummary = scrubBanned(clone.displaySummary);

  const arrFields: (keyof Pick<
    PersonaStructuredOutput,
    'keyReasons' | 'riskFlags' | 'opportunityDrivers' | 'missingEvidence' | 'contradictions' | 'doNotDo' | 'nextChecks'
  >)[] = [
    'keyReasons',
    'riskFlags',
    'opportunityDrivers',
    'missingEvidence',
    'contradictions',
    'doNotDo',
    'nextChecks',
  ];

  for (const f of arrFields) {
    clone[f] = (clone[f] as string[]).map((line) => {
      const h = bannedHitsInText(line);
      bannedCount += h.length;
      return scrubBanned(line);
    });
  }

  if (clone.portfolioContext) {
    clone.portfolioContext = {
      suitabilityWarnings: clone.portfolioContext.suitabilityWarnings?.map((x) => {
        const h = bannedHitsInText(x);
        bannedCount += h.length;
        return scrubBanned(x);
      }),
      concentrationWarnings: clone.portfolioContext.concentrationWarnings?.map((x) => {
        const h = bannedHitsInText(x);
        bannedCount += h.length;
        return scrubBanned(x);
      }),
      positionSizingWarning:
        clone.portfolioContext.positionSizingWarning !== undefined
          ? scrubBanned(clone.portfolioContext.positionSizingWarning)
          : undefined,
    };
  }

  if (clone.scoreAdjustmentSuggestion?.reason) {
    const h = bannedHitsInText(clone.scoreAdjustmentSuggestion.reason);
    bannedCount += h.length;
    clone.scoreAdjustmentSuggestion = {
      ...clone.scoreAdjustmentSuggestion,
      reason: scrubBanned(clone.scoreAdjustmentSuggestion.reason),
    };
  }

  return { output: clone, bannedCount };
}

export function validatePersonaStructuredOutput(
  input: unknown,
  personaSlug: string,
): { ok: true; value: PersonaStructuredOutput } | { ok: false; reason: string } {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'not_object' };
  const o = input as Record<string, unknown>;
  const role = pickRole(o.role, personaSlug);
  const stance = pickStance(o.stance);
  const confidence = pickConfidence(o.confidence);
  const displaySummary = String(o.displaySummary ?? '').trim();
  if (!displaySummary) return { ok: false, reason: 'missing_display_summary' };

  const sasRaw = o.scoreAdjustmentSuggestion;
  let scoreAdjustmentSuggestion: PersonaScoreAdjustmentSuggestion | undefined;
  if (sasRaw && typeof sasRaw === 'object') {
    const s = sasRaw as Record<string, unknown>;
    const dir = String(s.direction ?? 'none').trim().toLowerCase();
    const direction = dir === 'up' || dir === 'down' || dir === 'none' ? dir : 'none';
    scoreAdjustmentSuggestion = {
      direction,
      suggestedDelta: typeof s.suggestedDelta === 'number' ? s.suggestedDelta : undefined,
      reason: String(s.reason ?? '').trim() || undefined,
      hardCap: typeof s.hardCap === 'number' ? s.hardCap : undefined,
    };
  }

  let portfolioContext: PersonaPortfolioContextStructured | undefined;
  const pcRaw = o.portfolioContext;
  if (pcRaw && typeof pcRaw === 'object') {
    const p = pcRaw as Record<string, unknown>;
    portfolioContext = {
      suitabilityWarnings: asStrArray(p.suitabilityWarnings),
      concentrationWarnings: asStrArray(p.concentrationWarnings),
      positionSizingWarning: String(p.positionSizingWarning ?? '').trim() || undefined,
    };
  }

  const value: PersonaStructuredOutput = {
    role,
    stance,
    confidence,
    keyReasons: asStrArray(o.keyReasons),
    riskFlags: asStrArray(o.riskFlags),
    opportunityDrivers: asStrArray(o.opportunityDrivers),
    missingEvidence: asStrArray(o.missingEvidence),
    contradictions: asStrArray(o.contradictions),
    doNotDo: asStrArray(o.doNotDo),
    nextChecks: asStrArray(o.nextChecks),
    portfolioContext,
    scoreAdjustmentSuggestion,
    displaySummary,
  };

  return { ok: true, value };
}

/** 필수 섹션 보정 + 금지 문구 처리 */
export function sanitizePersonaStructuredOutput(output: PersonaStructuredOutput): {
  output: PersonaStructuredOutput;
  bannedPhraseCount: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const needsKeyMissing =
    output.keyReasons.length === 0 && Boolean(output.displaySummary?.trim());
  if (needsKeyMissing) {
    warnings.push('key_reasons_missing');
  }
  const next: PersonaStructuredOutput = {
    ...output,
    missingEvidence: needsKeyMissing
      ? [...output.missingEvidence, '페르소나 응답 일부 누락(keyReasons)']
      : [...output.missingEvidence],
  };
  const sanitized = sanitizeStringFields(next);
  if (sanitized.bannedCount > 0) {
    warnings.push('banned_phrase_scrubbed');
  }
  return { output: sanitized.output, bannedPhraseCount: sanitized.bannedCount, warnings };
}

export type ParsePersonaStructuredOutputResult =
  | {
      ok: true;
      output: PersonaStructuredOutput;
      displayText: string;
      warnings: string[];
      bannedPhraseCount: number;
      lowConfidence: boolean;
    }
  | {
      ok: false;
      fallbackSummary: string;
      warnings: string[];
      bannedPhraseCount: number;
    };

/**
 * 원문에서 선행 JSON 객체를 파싱하고, 사용자 표시 텍스트는 JSON 이후 본문 또는 displaySummary를 사용한다.
 */
export function parsePersonaStructuredOutput(rawText: string, personaSlug: string): ParsePersonaStructuredOutputResult {
  const extracted = extractLeadingJsonObject(rawText);

  if (!extracted) {
    const fallback = buildCompactFallbackFromRaw(personaSlug, rawText);
    return {
      ok: false,
      fallbackSummary: buildCommitteeCompactCard(fallback),
      warnings: ['structured_output_parse_failed'],
      bannedPhraseCount: 0,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.jsonStr) as unknown;
  } catch {
    const fallback = buildCompactFallbackFromRaw(personaSlug, rawText);
    return {
      ok: false,
      fallbackSummary: buildCommitteeCompactCard(fallback),
      warnings: ['structured_output_parse_failed'],
      bannedPhraseCount: 0,
    };
  }

  const validated = validatePersonaStructuredOutput(parsed, personaSlug);
  if (!validated.ok) {
    const fallback = buildCompactFallbackFromRaw(personaSlug, rawText);
    return {
      ok: false,
      fallbackSummary: buildCommitteeCompactCard(fallback),
      warnings: ['structured_output_parse_failed', validated.reason],
      bannedPhraseCount: 0,
    };
  }

  let warnings: string[] = [];
  let out = validated.value;

  const sanitized = sanitizePersonaStructuredOutput(out);
  out = sanitized.output;
  warnings = [...warnings, ...sanitized.warnings];

  if (warnings.includes('key_reasons_missing')) {
    out = {
      ...out,
      stance: 'insufficient_data',
      confidence: out.confidence === 'unknown' ? 'unknown' : 'low',
      missingEvidence: [...out.missingEvidence, '페르소나 응답 일부 누락'],
    };
  }

  if (sanitized.bannedPhraseCount > 0) {
    out = {
      ...out,
      stance: out.stance === 'insufficient_data' ? 'insufficient_data' : 'review',
      confidence: 'low',
      missingEvidence: [...out.missingEvidence, '금지 표현 완화 처리됨'],
    };
  }

  const displayText = buildCommitteeCompactCard(out);
  const lowConfidence = out.confidence === 'low' || out.confidence === 'unknown';

  return {
    ok: true,
    output: out,
    displayText,
    warnings,
    bannedPhraseCount: sanitized.bannedPhraseCount,
    lowConfidence,
  };
}

export type PersonaStructuredLayer = {
  displayReplyText: string;
  personaStructuredOutput: PersonaStructuredOutput | null;
  personaStructuredFallbackSummary?: string;
  personaStructuredOutputSummary: PersonaStructuredOutputQualitySummary;
  personaWarnings: string[];
};

/** 단일 응답 본문에 구조화 레이어 필드를 additive로 병합 (스트림/비스트림 공통) */
export function mergePersonaStructuredLayerIntoChatResponse(
  out: PersonaChatMessageResponseBody,
  structuredLayer: PersonaStructuredLayer,
): PersonaChatMessageResponseBody {
  const mergedWarnings = [...(out.outputQuality?.warnings ?? []), ...structuredLayer.personaWarnings];
  const parseFailed = structuredLayer.personaStructuredOutputSummary.parseFailedCount > 0;
  const fallbackApplied = Boolean(structuredLayer.personaStructuredFallbackSummary);
  const bannedPhraseCount = structuredLayer.personaStructuredOutputSummary.bannedPhraseCount;

  const base: PersonaChatMessageResponseBody = {
    ...out,
    personaStructuredOutput: structuredLayer.personaStructuredOutput,
    personaStructuredFallbackSummary: structuredLayer.personaStructuredFallbackSummary,
    personaStructuredOutputSummary: structuredLayer.personaStructuredOutputSummary,
    personaWarnings: structuredLayer.personaWarnings,
    personaStructuredParseFailed: parseFailed,
    personaStructuredFallbackApplied: fallbackApplied,
    personaStructuredBannedPhraseCount: bannedPhraseCount,
  };

  if (out.outputQuality) {
    return {
      ...base,
      outputQuality: {
        ...out.outputQuality,
        warnings: mergedWarnings,
      },
    };
  }
  if (mergedWarnings.length > 0) {
    return {
      ...base,
      outputQuality: {
        formatValid: false,
        missingSections: [],
        normalized: false,
        warnings: mergedWarnings,
      },
    };
  }
  return base;
}

/**
 * NDJSON `done` 줄에 동일 메타를 중복 노출(구 클라이언트는 `body`만 보면 됨).
 */
export function buildPersonaChatStreamDoneEnvelope(params: {
  deduplicated: boolean;
  body: PersonaChatMessageResponseBody;
}): Record<string, unknown> {
  const { deduplicated, body } = params;
  return {
    type: 'done',
    deduplicated,
    body,
    structuredOutput: body.personaStructuredOutput ?? null,
    structuredOutputSummary: body.personaStructuredOutputSummary,
    personaWarnings: body.personaWarnings,
    bannedPhraseCount:
      body.personaStructuredBannedPhraseCount ?? body.personaStructuredOutputSummary?.bannedPhraseCount ?? 0,
    parseFailed: body.personaStructuredParseFailed ?? false,
    fallbackApplied: body.personaStructuredFallbackApplied ?? false,
  };
}

export function summarizePersonaStructuredOutputQuality(
  layer: PersonaStructuredLayer,
): PersonaStructuredOutputQualitySummary {
  return { ...layer.personaStructuredOutputSummary };
}

export function buildPersonaStructuredLayer(personaSlug: string, rawAssistantText: string): PersonaStructuredLayer {
  const parsed = parsePersonaStructuredOutput(rawAssistantText, personaSlug);
  if (parsed.ok) {
    return {
      displayReplyText: parsed.displayText,
      personaStructuredOutput: parsed.output,
      personaStructuredFallbackSummary: undefined,
      personaStructuredOutputSummary: {
        parseSuccessCount: 1,
        parseFailedCount: 0,
        sanitizedCount: parsed.warnings.length > 0 ? 1 : 0,
        bannedPhraseCount: parsed.bannedPhraseCount,
        lowConfidenceCount: parsed.lowConfidence ? 1 : 0,
      },
      personaWarnings: parsed.warnings,
    };
  }
  const insufficient = buildInsufficientPersonaStructuredOutput(personaSlug, parsed.fallbackSummary);
  return {
    displayReplyText: buildCommitteeCompactCard(insufficient),
    personaStructuredOutput: insufficient,
    personaStructuredFallbackSummary: parsed.fallbackSummary,
    personaStructuredOutputSummary: {
      parseSuccessCount: 0,
      parseFailedCount: 1,
      sanitizedCount: 0,
      bannedPhraseCount: 0,
      lowConfidenceCount: 1,
    },
    personaWarnings: parsed.warnings,
  };
}

/** 파싱 실패 시 최소 계약 객체 */
export function buildInsufficientPersonaStructuredOutput(personaSlug: string, fallbackSummary: string): PersonaStructuredOutput {
  const compact = buildCompactFallbackFromRaw(personaSlug, scrubBanned(fallbackSummary));
  const safe = compact.displaySummary;
  return {
    role: mapPersonaSlugToRole(personaSlug),
    stance: 'insufficient_data',
    confidence: 'unknown',
    keyReasons: compact.keyReasons,
    riskFlags: compact.riskFlags,
    opportunityDrivers: compact.opportunityDrivers,
    missingEvidence: compactItems([...compact.missingEvidence, 'structured_output_parse_failed'], 2),
    contradictions: compact.contradictions,
    doNotDo: compact.doNotDo,
    nextChecks: compact.nextChecks,
    displaySummary: safe || '구조화 응답을 해석하지 못했습니다. 원문을 참고해 주세요.',
  };
}
