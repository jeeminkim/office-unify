import type { SupabaseClient } from '@supabase/supabase-js';
import type { CommitteeDiscussionLineDto, OfficeUserKey } from '@office-unify/shared-types';
import { COMMITTEE_DISCUSSION_USER_CONTENT_MAX_CHARS } from '@office-unify/shared-types';
import { getKstDateString } from '@office-unify/shared-utils';
import {
  getOrCreateWebPersonaSession,
  listWebPortfolioHoldingsForUser,
  listWebPortfolioWatchlistForUser,
} from '@office-unify/supabase-access';
import { remediateCommitteePersonaReply } from './committeeResponseFormat';
import { COMMITTEE_DISCUSSION_SPEAKER_ORDER, getCommitteeSystemPromptAppend } from './committeePrompt';
import { generateGeminiPersonaReply, type GeminiChatTurn } from '../geminiWebPersonaAdapter';
import { generateOpenAiWebPersonaReply } from '../openAiWebPersonaAdapter';
import { executeOpenAiWithBudgetAndGeminiFallback } from '../openAiBudgetRunner';
import { formatWebPortfolioLedgerForPrivateBankerPrompt } from '../privateBanker/privateBankerPortfolioLedgerPrompt';
import {
  generatePersonaAssistantReply,
  buildWebPersonaSystemInstruction,
  type PersonaChatTurnPrepared,
} from '../webPersonaChatOrchestrator';
import { resolveGeminiModelForWebPersonaSlug, resolveOpenAiModelForWebPersonaSlug } from '../webPersonaLlmModels';
import { isOpenAiWebPersonaSlug } from '../webPersonaOpenAiRouting';
import { resolveWebPersona } from '../webPersonas/registry';

function toGeminiContents(messages: { role: 'user' | 'assistant'; content: string }[]): GeminiChatTurn[] {
  return messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    text: m.content,
  }));
}

function truncateForCommittee(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 60)}\n\n… [길이 제한으로 이하 생략]`;
}

function formatTranscript(lines: CommitteeDiscussionLineDto[]): string {
  if (lines.length === 0) return '(없음)';
  return lines
    .map((l) => `### ${l.displayName} (${l.slug})\n\n${l.content.trim()}`)
    .join('\n\n---\n\n');
}

const DISCUSSION_TURN_PREAMBLE = `[투자위원회 · 턴제 토론]
- 당신은 이번 라운드에서 **지정된 순서로 한 번만** 발언합니다.
- 앞선 발언자의 논지를 **참고**하되, 다른 페르소나의 말투를 흉내 내지 마세요.
- 투자위원회 응답 계약(대괄호 섹션)을 유지합니다.`;

const CLOSING_CIO_APPEND = `
[정리 발언 모드 — CIO]
- 토론을 **마무리**하는 정리 발언만 합니다.
- 새 아이디어 과다 추가 없이, 합의·이견·남은 리스크·모니터링을 압축합니다.`;

const CLOSING_DRUCKER_APPEND = `
[정리 발언 모드 — Peter Drucker]
- 앞선 CIO 정리를 바탕으로 **실행·우선순위·하지 말아야 할 일** 관점에서 마무리합니다.
- 투자위원회 응답 계약을 유지합니다.`;

const JO_REPORT_APPEND = `
[추가 임무 — GPT Builder용 마크다운 보고서]
아래에 토론 기록이 포함되어 있다. 토론에서 **도출된 종목(티커)·섹터**가 있으면, 복사해 넣기 좋은 **마크다운(.md) 보고서 한 편**만 출력한다.
- 제목, 요약, 표(가능하면), 리스크, 다음 행동을 간결히.
- 종목·섹터가 없거나 불명확하면 한두 문장으로 "명확히 도출된 종목/섹터 없음"만 쓰고 억지로 채우지 않는다.
- SQL·원장 반영 초안은 쓰지 않는다(이 응답은 보고서 전용).`;

async function loadLedgerSnapshot(supabase: SupabaseClient, userKey: OfficeUserKey): Promise<string> {
  const [holdings, watchlist] = await Promise.all([
    listWebPortfolioHoldingsForUser(supabase, userKey).catch(() => [] as Awaited<
      ReturnType<typeof listWebPortfolioHoldingsForUser>
    >),
    listWebPortfolioWatchlistForUser(supabase, userKey).catch(() => [] as Awaited<
      ReturnType<typeof listWebPortfolioWatchlistForUser>
    >),
  ]);
  return formatWebPortfolioLedgerForPrivateBankerPrompt({ holdings, watchlist });
}

async function buildCommitteeSpeakerPrepared(params: {
  supabase: SupabaseClient;
  userKey: OfficeUserKey;
  personaSlug: string;
  userContent: string;
  ledgerSnapshot: string;
}): Promise<PersonaChatTurnPrepared> {
  const def = resolveWebPersona(params.personaSlug);
  if (!def) throw new Error(`Unknown persona: ${params.personaSlug}`);

  const text = truncateForCommittee(params.userContent.trim(), COMMITTEE_DISCUSSION_USER_CONTENT_MAX_CHARS);
  if (!text) throw new Error('Empty committee discussion user content');

  const personaKey = def.key;
  const kst = getKstDateString();
  const { sessionId, sessionDateKst } = await getOrCreateWebPersonaSession(
    params.supabase,
    params.userKey,
    personaKey,
    kst,
  );

  const committeeAppend = getCommitteeSystemPromptAppend(personaKey);

  const systemInstruction = buildWebPersonaSystemInstruction({
    personaSystem: def.systemPrompt,
    longTermForPrompt: '',
    previousDayAssistantHint: null,
    sessionDateKst: sessionDateKst as string,
    committeeAppend,
    ledgerSnapshot: params.ledgerSnapshot,
  });

  return {
    def,
    personaKey,
    sessionId,
    sessionDateKst: sessionDateKst as string,
    messagesBefore: [],
    longTermRaw: null,
    previousDayAssistantHint: null,
    userContent: text,
    systemInstruction,
    contents: toGeminiContents([{ role: 'user', content: text }]),
  };
}

function buildRoundUserContent(params: {
  topic: string;
  roundNote?: string;
  priorTranscript: CommitteeDiscussionLineDto[];
  currentRoundPrefix: CommitteeDiscussionLineDto[];
}): string {
  const topic = truncateForCommittee(params.topic.trim(), 6000);
  const parts: string[] = [
    DISCUSSION_TURN_PREAMBLE,
    '',
    `## 주제`,
    topic,
  ];
  if (params.roundNote?.trim()) {
    parts.push('', `## 이번 라운드 추가 메모`, params.roundNote.trim());
  }
  if (params.priorTranscript.length > 0) {
    parts.push(
      '',
      `## 이전 라운드까지의 기록`,
      truncateForCommittee(formatTranscript(params.priorTranscript), 14_000),
    );
  }
  if (params.currentRoundPrefix.length > 0) {
    parts.push(
      '',
      `## 이번 라운드에서 이미 나온 발언`,
      truncateForCommittee(formatTranscript(params.currentRoundPrefix), 12_000),
    );
  }
  parts.push('', `## 지시`, `위 맥락에 맞춰 **당신 차례 발언**만 작성하세요.`);
  return truncateForCommittee(parts.join('\n'), COMMITTEE_DISCUSSION_USER_CONTENT_MAX_CHARS);
}

export async function runCommitteeDiscussionRound(params: {
  supabase: SupabaseClient;
  userKey: OfficeUserKey;
  geminiApiKey: string;
  openAiApiKey?: string;
  topic: string;
  roundNote?: string;
  priorTranscript: CommitteeDiscussionLineDto[];
}): Promise<{ lines: CommitteeDiscussionLineDto[] }> {
  const ledgerSnapshot = await loadLedgerSnapshot(params.supabase, params.userKey);

  const lines: CommitteeDiscussionLineDto[] = [];
  for (const slug of COMMITTEE_DISCUSSION_SPEAKER_ORDER) {
    const def = resolveWebPersona(slug);
    if (!def) throw new Error(`Unknown persona: ${slug}`);

    const userContent = buildRoundUserContent({
      topic: params.topic,
      roundNote: params.roundNote,
      priorTranscript: params.priorTranscript,
      currentRoundPrefix: lines,
    });

    const prepared = await buildCommitteeSpeakerPrepared({
      supabase: params.supabase,
      userKey: params.userKey,
      personaSlug: slug,
      userContent,
      ledgerSnapshot,
    });

    const { text: raw } = await generatePersonaAssistantReply({
      supabase: params.supabase,
      geminiApiKey: params.geminiApiKey,
      openAiApiKey: params.openAiApiKey,
      prepared,
    });

    const rem = remediateCommitteePersonaReply(slug, raw);
    lines.push({
      slug,
      displayName: def.displayName,
      content: rem.text,
    });
  }

  return { lines };
}

export async function runCommitteeDiscussionClosing(params: {
  supabase: SupabaseClient;
  userKey: OfficeUserKey;
  geminiApiKey: string;
  openAiApiKey?: string;
  topic: string;
  transcript: CommitteeDiscussionLineDto[];
}): Promise<{ cio: CommitteeDiscussionLineDto; drucker: CommitteeDiscussionLineDto }> {
  const ledgerSnapshot = await loadLedgerSnapshot(params.supabase, params.userKey);
  const transcriptText = truncateForCommittee(formatTranscript(params.transcript), 20_000);

  const baseUser = truncateForCommittee(
    `## 주제\n${params.topic.trim()}\n\n## 전체 토론 기록\n${transcriptText}\n\n## 지시\n위 토론을 바탕으로 **정리 발언**만 하세요.`,
    COMMITTEE_DISCUSSION_USER_CONTENT_MAX_CHARS,
  );

  const cioDef = resolveWebPersona('cio');
  if (!cioDef) throw new Error('CIO persona missing');

  const cioPrepared = await buildCommitteeSpeakerPrepared({
    supabase: params.supabase,
    userKey: params.userKey,
    personaSlug: 'cio',
    userContent: baseUser,
    ledgerSnapshot,
  });
  const cioSystem = `${cioPrepared.systemInstruction}\n${CLOSING_CIO_APPEND}`;
  const cioGen = await generatePersonaAssistantReply({
    supabase: params.supabase,
    geminiApiKey: params.geminiApiKey,
    openAiApiKey: params.openAiApiKey,
    prepared: { ...cioPrepared, systemInstruction: cioSystem },
  });
  const cioRem = remediateCommitteePersonaReply('cio', cioGen.text);
  const cioLine: CommitteeDiscussionLineDto = {
    slug: 'cio',
    displayName: cioDef.displayName,
    content: cioRem.text,
  };

  const druckerDef = resolveWebPersona('drucker');
  if (!druckerDef) throw new Error('Drucker persona missing');

  const druckerUser = truncateForCommittee(
    `${baseUser}\n\n## CIO 정리 발언\n${cioLine.content}`,
    COMMITTEE_DISCUSSION_USER_CONTENT_MAX_CHARS,
  );

  const druckerPrepared = await buildCommitteeSpeakerPrepared({
    supabase: params.supabase,
    userKey: params.userKey,
    personaSlug: 'drucker',
    userContent: druckerUser,
    ledgerSnapshot,
  });
  const druckerSystem = `${druckerPrepared.systemInstruction}\n${CLOSING_DRUCKER_APPEND}`;
  const druckerGen = await generatePersonaAssistantReply({
    supabase: params.supabase,
    geminiApiKey: params.geminiApiKey,
    openAiApiKey: params.openAiApiKey,
    prepared: { ...druckerPrepared, systemInstruction: druckerSystem },
  });
  const druckerRem = remediateCommitteePersonaReply('drucker', druckerGen.text);
  const druckerLine: CommitteeDiscussionLineDto = {
    slug: 'drucker',
    displayName: druckerDef.displayName,
    content: druckerRem.text,
  };

  return { cio: cioLine, drucker: druckerLine };
}

/** UI·API에서 사용자가 명시적으로 요청한 경우에만 호출할 것(토론 플로우와 자동 연동 금지). */
export async function runCommitteeDiscussionJoReport(params: {
  supabase: SupabaseClient;
  geminiApiKey: string;
  openAiApiKey?: string;
  topic: string;
  transcript: CommitteeDiscussionLineDto[];
}): Promise<{ markdown: string }> {
  const def = resolveWebPersona('jo-il-hyeon');
  if (!def) throw new Error('jo-il-hyeon persona missing');

  const transcriptText = truncateForCommittee(formatTranscript(params.transcript), 22_000);
  const userContent = truncateForCommittee(
    `## 주제\n${params.topic.trim()}\n\n## 토론 기록\n${transcriptText}`,
    COMMITTEE_DISCUSSION_USER_CONTENT_MAX_CHARS,
  );

  const systemInstruction = `${def.systemPrompt}\n\n${JO_REPORT_APPEND}`;

  const slug = 'jo-il-hyeon';
  const contents = toGeminiContents([{ role: 'user', content: userContent }]);

  if (isOpenAiWebPersonaSlug(slug)) {
    const key = params.openAiApiKey?.trim();
    if (!key) throw new Error('OPENAI_API_KEY is not set (required for jo-il-hyeon).');
    const model = resolveOpenAiModelForWebPersonaSlug(slug);
    const out = await executeOpenAiWithBudgetAndGeminiFallback({
      supabase: params.supabase,
      geminiApiKey: params.geminiApiKey,
      invokeOpenAi: () =>
        generateOpenAiWebPersonaReply({
          apiKey: key,
          model,
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
    });
    return { markdown: out.text.trim() };
  }

  const text = await generateGeminiPersonaReply({
    apiKey: params.geminiApiKey,
    model: resolveGeminiModelForWebPersonaSlug(slug),
    systemInstruction,
    contents,
  });
  return { markdown: text.trim() };
}
