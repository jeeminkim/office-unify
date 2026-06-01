import type { CommitteeDiscussionLineDto, PersonaStructuredOutput } from '@office-unify/shared-types';
import { humanizeCommitteeItems, humanizeCommitteeText } from '@/lib/committeeHumanReadable';

const JSON_FENCE = /```(?:json)?\s*[\s\S]*?```/gi;
const LOOKS_JSON = /^\s*[\[{]/;

function compactText(text: string, max = 160): string {
  const cleaned = humanizeCommitteeText(stripJsonFences(text).replace(/\s+/g, ' ').trim());
  if (!cleaned) return '';
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function compactItems(items: readonly string[], maxItems: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of humanizeCommitteeItems(items)) {
    const item = compactText(String(raw ?? ''));
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function stripJsonFences(text: string): string {
  return text.replace(JSON_FENCE, '').trim();
}

export function contentLooksLikeRawJson(text: string): boolean {
  const t = stripJsonFences(text).trim();
  return LOOKS_JSON.test(t) && (t.includes('"displaySummary"') || t.includes('"keyReasons"'));
}

export function buildReadableSummaryFromStructured(so: PersonaStructuredOutput): string {
  const sections: string[] = [];
  const summary = compactText(so.displaySummary, 240) || '이 발언은 일부 손상되어 핵심 요약만 표시합니다.';
  sections.push(`[결론]\n${summary}`);
  const rows: Array<[string, string[], number]> = [
    ['핵심 근거', so.keyReasons, 3],
    ['기회 조건', so.opportunityDrivers, 3],
    ['리스크', so.riskFlags, 3],
    ['누락 근거', so.missingEvidence, 2],
    ['하지 말 것', so.doNotDo, 2],
    ['다음 확인', so.nextChecks, 3],
  ];
  for (const [label, rawItems, max] of rows) {
    const items = compactItems(rawItems, max);
    if (items.length > 0) sections.push(`[${label}]\n${items.map((x) => `- ${x}`).join('\n')}`);
  }
  const card = sections.join('\n\n').trim();
  return card.length <= 1200 ? card : `${card.slice(0, 1199).trimEnd()}…`;
}

export function resolveLineDisplayContent(line: CommitteeDiscussionLineDto): {
  readable: string;
  rawForDebug: string | null;
  hasStructured: boolean;
} {
  const raw = line.content ?? '';
  if (line.structuredOutput) {
    return {
      readable: buildReadableSummaryFromStructured(line.structuredOutput),
      rawForDebug: contentLooksLikeRawJson(raw) ? raw : null,
      hasStructured: true,
    };
  }
  if (contentLooksLikeRawJson(raw)) {
    return {
      readable: '이 발언은 일부 손상되어 핵심 요약만 표시합니다. 원문은 디버그 보기에서만 확인할 수 있습니다.',
      rawForDebug: raw,
      hasStructured: false,
    };
  }
  return { readable: humanizeCommitteeText(stripJsonFences(raw)), rawForDebug: null, hasStructured: false };
}

export const STRUCTURED_SECTION_LABELS: Record<string, string> = {
  stance: '입장',
  keyReasons: '핵심 근거',
  opportunityDrivers: '기회 조건',
  riskFlags: '리스크',
  missingEvidence: '누락 근거',
  doNotDo: '하지 말 것',
  nextChecks: '다음 확인',
};
