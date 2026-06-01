import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CommitteeLineRegenerateRequest,
  CommitteeLineRegenerateResponse,
  OfficeUserKey,
  PersonaStructuredOutput,
} from '@office-unify/shared-types';
import { COMMITTEE_DISCUSSION_USER_CONTENT_MAX_CHARS } from '@office-unify/shared-types';
import {
  buildWebPersonaSystemInstruction,
  generatePersonaAssistantReply,
  resolveWebPersona,
} from '@office-unify/ai-office-engine';
import { getCommitteeSystemPromptAppend } from '@office-unify/ai-office-engine';
import { formatCommitteeLongTermForPrompt, COMMITTEE_LT_MEMORY_KEY } from '@office-unify/ai-office-engine';
import { formatWebPortfolioLedgerForCommitteePrompt } from '@office-unify/ai-office-engine';
import { formatCommitteeInputSummaryForPrompt } from '@office-unify/ai-office-engine';
import {
  listWebPortfolioHoldingsForUser,
  listWebPortfolioWatchlistForUser,
  selectPersonaLongTermSummary,
} from '@office-unify/supabase-access';
import { getKstDateString } from '@office-unify/shared-utils';
import { guardCommitteeDiscussionLine } from '@/lib/server/committeeOutputGuard';
import {
  parsePersonaStructuredOutput,
  buildInsufficientPersonaStructuredOutput,
  buildCommitteeCompactCard,
} from '@/lib/server/personaStructuredOutput';
import { buildLongResponseFallback } from '@/lib/longResponseFallback';

const REGENERATE_TARGET_CHARS = 1200;
const REGENERATE_HARD_MAX = 1400;

const LINE_REGENERATE_APPEND_HUMAN_READABLE = `[위원회 발언 재생성 지침]
- 반드시 ${REGENERATE_TARGET_CHARS}자 이내의 짧은 한국어 카드로 답합니다.
- JSON, fenced code block, 원문 디버그 스니펫을 출력하지 않습니다.
- 섹션은 [결론], [핵심 근거], [기회 조건], [리스크], [누락 근거], [하지 말 것], [다음 확인]을 사용합니다.
- 각 섹션은 최대 3개 항목이며 [하지 말 것]은 최대 2개입니다.
- 리스크만 말하지 말고 기회 조건, 조건부 관찰 기준, 놓친 기회에서 배울 점을 함께 제시합니다.
- "그때 샀어야 했다", "지금 사라", "주문 실행", "자동 주문", "자동 리밸런싱"처럼 보이는 표현은 금지합니다.
- 이전 발언이 잘렸더라도 JSON 복원이 아니라 같은 persona 관점의 읽을 수 있는 발언으로 다시 씁니다.`;

const LINE_REGENERATE_APPEND = `[위원회 발언 재생성 지침]
- 반드시 ${REGENERATE_TARGET_CHARS}자 이내의 짧은 한국어 카드로 답합니다.
- JSON, fenced code block, 원문 디버그 덤프를 출력하지 않습니다.
- 섹션은 [결론], [핵심 근거], [리스크], [누락 근거], [하지 말 것], [다음 확인]만 사용합니다.
- 각 섹션의 항목은 최대 3개이며, [하지 말 것]은 최대 2개입니다.
- portfolioContext, scoreAdjustmentSuggestion 같은 내부 필드는 길게 노출하지 않고 필요한 의미만 요약합니다.
- 매수/매도 지시, 자동 주문, 자동 리밸런싱처럼 보이는 표현은 금지합니다.
- 이전 발언이 잘렸다면 JSON 복원이 아니라 같은 persona 관점의 짧고 읽을 수 있는 발언으로 다시 씁니다.`;

void LINE_REGENERATE_APPEND;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

async function loadLedgerSnapshotReadOnly(supabase: SupabaseClient, userKey: OfficeUserKey): Promise<string> {
  const [holdings, watchlist] = await Promise.all([
    listWebPortfolioHoldingsForUser(supabase, userKey).catch(() => []),
    listWebPortfolioWatchlistForUser(supabase, userKey).catch(() => []),
  ]);
  const base = formatWebPortfolioLedgerForCommitteePrompt({ holdings, watchlist });
  const dash = formatCommitteeInputSummaryForPrompt(holdings).trim();
  if (!dash) return base;
  return `${base}\n\n${dash}`;
}

function buildRepairUserContent(req: CommitteeLineRegenerateRequest): string {
  const mode = req.regenerateMode ?? 'repair_partial';
  const parts: string[] = [
    '## 토론 주제',
    req.originalQuestion.trim(),
    '',
    '## 재생성 모드',
    mode,
  ];
  if (req.previousLine?.trim()) {
    parts.push('', '## 이전 발언(참고용, 복원하지 말고 짧게 재작성)', req.previousLine.trim().slice(0, 1600));
  }
  if (req.previousOutputQuality && typeof req.previousOutputQuality === 'object') {
    parts.push('', '## 이전 outputQuality', JSON.stringify(req.previousOutputQuality).slice(0, 500));
  }
  if (req.actionRoadmapContext) {
    parts.push('', '## 액션 로드맵 맥락(참고)', JSON.stringify(req.actionRoadmapContext).slice(0, 1200));
  }
  parts.push(
    '',
    '## 지시',
    mode === 'structured_only'
      ? 'LLM 없이도 읽히는 핵심 요약에 가깝게, 짧은 한국어 카드만 작성하세요.'
      : mode === 'short_retry'
        ? '짧고 완결된 위원회 발언으로 다시 작성하세요.'
        : '끊긴 발언을 JSON 복원이 아니라 같은 persona 관점의 짧은 발언으로 복구하세요.',
  );
  return truncate(parts.join('\n'), COMMITTEE_DISCUSSION_USER_CONTENT_MAX_CHARS);
}

function buildDeterministicFallback(
  personaKey: string,
  req: CommitteeLineRegenerateRequest,
  structured?: PersonaStructuredOutput,
): string {
  if (structured) return buildCommitteeCompactCard(structured);
  const fallback = buildInsufficientPersonaStructuredOutput(
    personaKey,
    req.previousLine || req.originalQuestion || 'structured_output_parse_failed',
  );
  return buildCommitteeCompactCard({
    ...fallback,
    nextChecks:
      fallback.nextChecks.length > 0
        ? fallback.nextChecks
        : ['원 발언의 핵심 근거를 다시 확인합니다.', '리스크와 하지 말 것을 분리합니다.', '필요하면 Research 또는 Journal로 이어갑니다.'],
  });
}

function isTimeoutError(message: string): boolean {
  return /timeout|timed out|deadline|abort/i.test(message);
}

function stripFencedJson(text: string): string {
  return text.replace(/```(?:json)?\s*[\s\S]*?```/gi, '').trim();
}

function looksLikeJson(text: string): boolean {
  const t = stripFencedJson(text).trim();
  return /^\s*[\[{]/.test(t) || t.includes('"displaySummary"') || t.includes('"keyReasons"');
}

function normalizePlainCard(raw: string, fallback: string): string {
  const cleaned = stripFencedJson(raw).trim();
  if (!cleaned || looksLikeJson(cleaned)) return fallback;
  return truncate(cleaned, REGENERATE_TARGET_CHARS);
}

export function parseCommitteeLineRegenerateRequest(body: unknown): CommitteeLineRegenerateRequest | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const personaKey = typeof o.personaKey === 'string' ? o.personaKey.trim() : '';
  const originalQuestion = typeof o.originalQuestion === 'string' ? o.originalQuestion.trim() : '';
  if (!personaKey || !originalQuestion) return null;
  const mode = o.regenerateMode;
  const regenerateMode =
    mode === 'repair_partial' || mode === 'short_retry' || mode === 'structured_only' ? mode : undefined;
  return {
    committeeTurnId: typeof o.committeeTurnId === 'string' ? o.committeeTurnId.trim() : undefined,
    roundId: typeof o.roundId === 'string' ? o.roundId.trim() : undefined,
    personaKey,
    originalQuestion,
    previousLine: typeof o.previousLine === 'string' ? o.previousLine : undefined,
    previousOutputQuality: o.previousOutputQuality,
    actionRoadmapContext: o.actionRoadmapContext,
    regenerateMode,
    maxLength: typeof o.maxLength === 'number' ? o.maxLength : undefined,
  };
}

export async function executeCommitteeLineRegenerate(params: {
  supabase: SupabaseClient;
  userKey: OfficeUserKey;
  geminiApiKey: string;
  openAiApiKey: string;
  request: CommitteeLineRegenerateRequest;
}): Promise<CommitteeLineRegenerateResponse> {
  const slug = params.request.personaKey.trim().toLowerCase();
  const def = resolveWebPersona(slug);
  if (!def) {
    return {
      ok: false,
      status: 'invalid_request',
      personaKey: slug,
      displayText: '',
      outputQuality: { status: 'fallback', truncated: false, repaired: false, warnings: ['unknown_persona'] },
      actionHints: [],
      qualityMeta: { autoSaved: false, writeAction: false, generatedAt: new Date().toISOString() },
    };
  }

  const ledgerSnapshot = await loadLedgerSnapshotReadOnly(params.supabase, params.userKey);
  const committeeRaw = await selectPersonaLongTermSummary(params.supabase, params.userKey, COMMITTEE_LT_MEMORY_KEY);
  const committeeLt = formatCommitteeLongTermForPrompt(committeeRaw).trim();
  const userContent = buildRepairUserContent(params.request);
  const committeeAppend = getCommitteeSystemPromptAppend(def.key);
  let systemInstruction = buildWebPersonaSystemInstruction({
    personaSystem: def.systemPrompt,
    longTermForPrompt: '',
    previousDayAssistantHint: null,
    sessionDateKst: getKstDateString(),
    committeeAppend,
    ledgerSnapshot,
  });
  if (committeeLt) {
    systemInstruction += `\n\n[사용자 위원회 장기 기억]\n${committeeLt}`;
  }
  systemInstruction += `\n\n${LINE_REGENERATE_APPEND_HUMAN_READABLE}`;

  const maxLen = Math.min(params.request.maxLength ?? REGENERATE_TARGET_CHARS, REGENERATE_HARD_MAX);

  try {
    const { text: raw } = await generatePersonaAssistantReply({
      supabase: params.supabase,
      geminiApiKey: params.geminiApiKey,
      openAiApiKey: params.openAiApiKey,
      prepared: {
        def,
        personaKey: def.key,
        sessionId: 'line-regenerate-preview',
        sessionDateKst: getKstDateString(),
        messagesBefore: [],
        longTermRaw: null,
        previousDayAssistantHint: null,
        userContent,
        systemInstruction,
        contents: [{ role: 'user', text: userContent }],
      },
    });

    const parsed = parsePersonaStructuredOutput(raw, slug);
    let structured: PersonaStructuredOutput;
    let displayText: string;
    const warnings: string[] = [];

    if (parsed.ok) {
      structured = parsed.output;
      displayText = buildCommitteeCompactCard(structured);
      warnings.push(...parsed.warnings);
    } else {
      structured = buildInsufficientPersonaStructuredOutput(slug, parsed.fallbackSummary);
      displayText = normalizePlainCard(raw, buildDeterministicFallback(slug, params.request, structured));
      warnings.push(...parsed.warnings);
    }

    displayText = truncate(displayText, maxLen);
    const line = guardCommitteeDiscussionLine({
      slug,
      displayName: def.displayName,
      content: displayText,
      structuredOutput: structured,
    });

    const longResponseFallback =
      raw.length > 2000
        ? buildLongResponseFallback(raw, {
            actionHint: '재생성 원문이 길어 요약 카드만 표시합니다.',
          })
        : undefined;

    const repaired = Boolean(params.request.previousLine?.trim());
    const status =
      line.outputQuality.status === 'partial'
        ? 'partial_recovered'
        : parsed.ok
          ? 'regenerated'
          : 'partial_recovered';

    return {
      ok: true,
      status,
      personaKey: slug,
      displayText: line.content,
      structuredOutput: structured,
      outputQuality: {
        status: line.outputQuality.status === 'partial' ? 'partial' : parsed.ok ? 'ok' : 'fallback',
        truncated: line.outputQuality.truncated ?? false,
        repaired,
        warnings,
      },
      longResponseFallback: longResponseFallback?.exceededLimit ? longResponseFallback : undefined,
      actionHints: [
        { label: '이 발언으로 교체', actionKey: 'apply_to_line' },
        { label: '복사', actionKey: 'copy' },
        { label: 'Action Item으로 저장', actionKey: 'save_action_item' },
        { label: 'Research로 확인', actionKey: 'open_research' },
        { label: 'Journal로 메모', actionKey: 'open_journal' },
        { label: '복기로 남기기', actionKey: 'open_retrospective' },
      ],
      qualityMeta: { autoSaved: false, writeAction: false, generatedAt: new Date().toISOString() },
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    const timeout = isTimeoutError(message);
    const fallbackText = truncate(buildDeterministicFallback(slug, params.request), REGENERATE_TARGET_CHARS);
    return {
      ok: true,
      status: timeout ? 'timeout' : 'fallback_summary',
      personaKey: slug,
      displayText: fallbackText,
      outputQuality: {
        status: 'fallback',
        truncated: false,
        repaired: false,
        warnings: [timeout ? 'provider_timeout' : 'provider_error'],
      },
      actionHints: [
        { label: '핵심 요약 복사', actionKey: 'copy' },
        { label: 'Research로 확인', actionKey: 'open_research' },
      ],
      qualityMeta: { autoSaved: false, writeAction: false, generatedAt: new Date().toISOString() },
    };
  }
}
