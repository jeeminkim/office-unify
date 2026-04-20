import type { SupabaseClient } from '@supabase/supabase-js';
import type { CommitteeFollowupDraft, CommitteeFollowupExtractResponse } from '@office-unify/shared-types';
import { COMMITTEE_DISCUSSION_USER_CONTENT_MAX_CHARS } from '@office-unify/shared-types';
import { generateGeminiPersonaReply, type GeminiChatTurn } from '../geminiWebPersonaAdapter';
import { generateOpenAiWebPersonaReply } from '../openAiWebPersonaAdapter';
import { executeOpenAiWithBudgetAndGeminiFallback } from '../openAiBudgetRunner';
import { resolveGeminiModelForWebPersonaSlug, resolveOpenAiModelForWebPersonaSlug } from '../webPersonaLlmModels';
import { isOpenAiWebPersonaSlug } from '../webPersonaOpenAiRouting';

function toGeminiContents(messages: { role: 'user' | 'assistant'; content: string }[]): GeminiChatTurn[] {
  return messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    text: m.content,
  }));
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 30)}\n\n... [truncated]`;
}

function parseJsonBlock(raw: string): unknown {
  let text = raw.trim();
  if (text.startsWith('```json')) text = text.slice(7);
  else if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? text.slice(start, end + 1) : text;
  return JSON.parse(candidate) as unknown;
}

function toExtractResponse(parsed: unknown): CommitteeFollowupExtractResponse {
  if (!parsed || typeof parsed !== 'object') return { items: [], warnings: ['extractor returned non-object'] };
  const obj = parsed as Record<string, unknown>;
  const items = Array.isArray(obj.items) ? obj.items : [];
  const warnings = Array.isArray(obj.warnings)
    ? obj.warnings.filter((w): w is string => typeof w === 'string')
    : [];
  const normalized: CommitteeFollowupDraft[] = items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      title: String(item.title ?? '').trim(),
      itemType: String(item.itemType ?? '').trim() as CommitteeFollowupDraft['itemType'],
      priority: String(item.priority ?? 'medium').trim() as CommitteeFollowupDraft['priority'],
      rationale: String(item.rationale ?? '').trim(),
      entities: Array.isArray(item.entities) ? item.entities.map((v) => String(v).trim()).filter(Boolean) : [],
      requiredEvidence: Array.isArray(item.requiredEvidence)
        ? item.requiredEvidence.map((v) => String(v).trim()).filter(Boolean)
        : [],
      acceptanceCriteria: Array.isArray(item.acceptanceCriteria)
        ? item.acceptanceCriteria.map((v) => String(v).trim()).filter(Boolean)
        : [],
      ownerPersona: typeof item.ownerPersona === 'string' ? item.ownerPersona.trim() : undefined,
      status: String(item.status ?? 'draft').trim() as CommitteeFollowupDraft['status'],
    }));
  return { items: normalized, warnings };
}

const FOLLOWUP_EXTRACT_APPEND = `
[추가 임무 — 위원회 후속작업 추출 JSON]
- 사람용 보고서 재작성 금지. 실행 가능한 후속작업 항목만 추출한다.
- 반드시 JSON 객체 하나만 출력한다. 코드펜스, 설명문, 마크다운 금지.
- 출력 형식:
{
  "items": [
    {
      "title": "string",
      "itemType": "equity_exposure_quant | risk_reduction_plan | portfolio_policy_update | entry_gate_definition | watchlist_review | thesis_validation",
      "priority": "low | medium | high | urgent",
      "rationale": "string",
      "entities": ["string"],
      "requiredEvidence": ["string"],
      "acceptanceCriteria": ["string"],
      "ownerPersona": "string (optional)",
      "status": "draft"
    }
  ],
  "warnings": ["string"]
}
- 항목은 3~8개.
- 중복 제목 금지.
- 모호한 항목 금지("추가 분석", "검토 필요", "확인 필요", "정리하기" 단독 표현 금지).
- 투자 실행 지시(즉시 매수/매도/주문) 금지.
- 근거 없는 확정 판단 금지.
`;

export async function runCommitteeFollowupExtract(params: {
  supabase: SupabaseClient;
  geminiApiKey: string;
  openAiApiKey?: string;
  topic: string;
  transcript: string;
  closing?: string;
  joMarkdown?: string;
}): Promise<CommitteeFollowupExtractResponse> {
  const slug = 'jo-il-hyeon';
  const userContent = truncate(
    `## topic
${params.topic.trim()}

## transcript
${params.transcript.trim()}

## closing
${(params.closing ?? '').trim() || '(none)'}

## jo_markdown
${(params.joMarkdown ?? '').trim() || '(none)'}
`,
    COMMITTEE_DISCUSSION_USER_CONTENT_MAX_CHARS,
  );

  const systemInstruction = `${FOLLOWUP_EXTRACT_APPEND}`;
  const contents = toGeminiContents([{ role: 'user', content: userContent }]);

  const text = isOpenAiWebPersonaSlug(slug)
    ? (
        await executeOpenAiWithBudgetAndGeminiFallback({
          supabase: params.supabase,
          geminiApiKey: params.geminiApiKey,
          invokeOpenAi: () =>
            generateOpenAiWebPersonaReply({
              apiKey: params.openAiApiKey?.trim() ?? '',
              model: resolveOpenAiModelForWebPersonaSlug(slug),
              systemInstruction,
              contents,
            }),
          invokeGeminiFallback: () =>
            generateGeminiPersonaReply({
              apiKey: params.geminiApiKey,
              model: resolveGeminiModelForWebPersonaSlug(slug),
              systemInstruction,
              contents,
            }),
        })
      ).text
    : await generateGeminiPersonaReply({
        apiKey: params.geminiApiKey,
        model: resolveGeminiModelForWebPersonaSlug(slug),
        systemInstruction,
        contents,
      });

  try {
    return toExtractResponse(parseJsonBlock(text));
  } catch {
    return {
      items: [],
      warnings: ['extractor_json_parse_failed'],
    };
  }
}

