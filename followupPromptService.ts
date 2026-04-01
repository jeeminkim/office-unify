import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { logger } from './logger';
import type { FollowupPromptType } from './src/repositories/followupRepository';

export type FollowupAnalysis = {
  shouldAttach: boolean;
  promptType: FollowupPromptType;
  options: string[];
};

const BULLET_LINE = /^[\s]*[•\-\*]\s+(.+)$/;

function uniqLabels(labels: string[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of labels) {
    const s = raw.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (s.length < 2) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function extractBulletOptions(text: string): string[] {
  const lines = String(text).split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const m = BULLET_LINE.exec(line);
    if (m) out.push(m[1]);
  }
  return uniqLabels(out, 12);
}

function extractChoiceOptions(text: string): string[] {
  const t = String(text);
  const candidates: string[] = [];
  for (const line of t.split('\n')) {
    const L = line.trim();
    if (/\bvs\.?\b/i.test(L) || /\svs\s/i.test(L)) {
      const parts = L.split(/\s+vs\.?\s+/i);
      for (const p of parts) {
        const s = p.replace(/^[•\-*0-9.)]+\s*/, '').trim();
        if (s.length >= 2) candidates.push(s.slice(0, 80));
      }
    }
  }
  if (candidates.length >= 2) return [...new Set(candidates)].slice(0, 12);
  for (const line of t.split('\n')) {
    const L = line.trim();
    if (L.includes('/') && !L.includes('//') && !L.includes('http')) {
      const parts = L.split('/').map(s => s.trim()).filter(s => s.length >= 2);
      if (parts.length >= 2) return parts.slice(0, 12);
    }
  }
  return [];
}

const DEFAULT_NEXT = ['포트폴리오·자산 점검', '종목·전략 심화 분석', '시장·트렌드 이슈 요약'];

/**
 * decision 버튼이 없는 질문형 후속에만 사용 (호출부에서 isDecisionPrompt 선행).
 */
export function analyzeFollowupPrompt(text: string): FollowupAnalysis {
  const t = String(text || '');
  const tail = t.slice(Math.max(0, t.length - 1200));
  const hasQm = /[?？]/.test(tail);
  const bullets = extractBulletOptions(t);

  if (/어떤 종목|심볼|티커|무엇을 분석|입력해 주세요|작성해 주세요|적어 주세요/i.test(tail)) {
    logger.info('FOLLOWUP', 'FOLLOWUP_PROMPT_DETECTED', { kind: 'FREE_INPUT' });
    return { shouldAttach: true, promptType: 'FREE_INPUT', options: [] };
  }

  if (bullets.length >= 2 && /(도와|다음|원하|선택|무엇을)/i.test(tail)) {
    logger.info('FOLLOWUP', 'FOLLOWUP_PROMPT_DETECTED', { kind: 'NEXT_ACTION', optionCount: bullets.length });
    return { shouldAttach: true, promptType: 'NEXT_ACTION', options: bullets };
  }

  const choice = extractChoiceOptions(t);
  if (choice.length >= 2 && hasQm) {
    logger.info('FOLLOWUP', 'FOLLOWUP_PROMPT_DETECTED', { kind: 'CHOICE', optionCount: choice.length });
    return { shouldAttach: true, promptType: 'CHOICE', options: choice };
  }

  if (hasQm && /(어떻게|무엇을|도와|권장|추천|진행|계속)/i.test(tail)) {
    logger.info('FOLLOWUP', 'FOLLOWUP_PROMPT_DETECTED', { kind: 'NEXT_ACTION', optionCount: DEFAULT_NEXT.length, fallback: true });
    return { shouldAttach: true, promptType: 'NEXT_ACTION', options: [...DEFAULT_NEXT] };
  }

  return { shouldAttach: false, promptType: 'NEXT_ACTION', options: [] };
}

export function buildFollowupComponentRows(
  snapshotId: string,
  promptType: FollowupPromptType,
  options: string[]
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

  if (promptType === 'FREE_INPUT') {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`followup:input|${snapshotId}`)
        .setLabel('답변 입력')
        .setStyle(ButtonStyle.Primary)
    );
    rows.push(row);
    return rows;
  }

  const opts = options.filter(Boolean);
  if (opts.length >= 4) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`followup:menu|${snapshotId}`)
      .setPlaceholder('다음 단계를 선택하세요')
      .setMinValues(1)
      .setMaxValues(1);
    opts.slice(0, 25).forEach((label, i) => {
      select.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(label.slice(0, 100))
          .setValue(String(i))
      );
    });
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
    return rows;
  }

  const n = Math.min(3, opts.length);
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (let i = 0; i < n; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`followup:select|${snapshotId}|${i}`)
        .setLabel(opts[i].slice(0, 80))
        .setStyle(ButtonStyle.Secondary)
    );
  }
  if (row.components.length) rows.push(row);
  return rows;
}
