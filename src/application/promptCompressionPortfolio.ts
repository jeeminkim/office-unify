import type { PersonaKey } from '../../analysisTypes';
import type { PortfolioSnapshot } from '../../portfolioService';

/** 기본 위원 경로는 standard, timeout 재시도·짧은 트렌드 등은 aggressive */
export type CompressedPromptMode = 'standard_compressed' | 'aggressive_compressed';

const TOP_HOLDINGS_STANDARD = 18;
const TOP_HOLDINGS_AGGRESSIVE = 10;

export function estimateTokensApprox(charCount: number): number {
  return Math.max(0, Math.ceil(charCount / 4));
}

export function truncateUtf8Chars(s: string, maxChars: number): string {
  const t = String(s || '').trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`;
}

/**
 * BASE_CONTEXT: 공통·압축 (전체 JSON 스냅샷 대신 요약 + 상위 보유만).
 */
/** fast 경로에서 BASE가 줄어도 상위 3종·지역 비중·리스크 힌트·이벤트 1줄은 항상 포함 */
export function buildFastModeContextFloor(snapshot: PortfolioSnapshot): string {
  const s = snapshot.summary;
  const top3 = [...snapshot.positions].sort((a, b) => b.weight_pct - a.weight_pct).slice(0, 3);
  const lines = top3.map(
    (p, i) =>
      `${i + 1}) ${p.symbol} ${p.market} 비중${p.weight_pct.toFixed(1)}% 평가~${Math.round(p.market_value_krw / 1e6)}백만원 수익률${typeof p.return_pct === 'number' ? p.return_pct.toFixed(1) : 'n/a'}%`
  );
  const riskHint = `집중도(top3합) ${s.top3_weight_pct.toFixed(1)}% | 포트폴리오 누적수익률 ${s.total_return_pct.toFixed(2)}%${
    s.quote_failure_count ? ` | 시세조회실패 ${s.quote_failure_count}건` : ''
  }`;
  const eventLine = truncateUtf8Chars(
    String(
      s.quote_quality_note ||
        s.partial_quote_warning ||
        s.price_basis_hint ||
        '(스냅샷 시점 기준 별도 이벤트 메모 없음)'
    ).replace(/\s+/g, ' '),
    240
  );
  return [
    '[FAST_MODE_CONTEXT_FLOOR — 데이터 최소 보장; 역할·사고 구조는 full과 동일하게 유지]',
    '[TOP_HOLDINGS_TOP3 — 반드시 인용 가능]',
    lines.length ? lines.join('\n') : '(보유 없음)',
    `[REGION_WEIGHT] KR ${s.domestic_weight_pct.toFixed(1)}% / US ${s.us_weight_pct.toFixed(1)}%`,
    `[RISK_OR_VOL_HINT] ${riskHint}`,
    `[RECENT_OR_DATA_ONE_LINE] ${eventLine}`
  ].join('\n');
}

export function buildPortfolioBaseContext(opts: {
  mode: string;
  userQuery: string;
  snapshot: PortfolioSnapshot;
  partialScopeBlock?: string;
  profileOneLiner?: string;
  quoteQualityBlock?: string;
  styleDirectiveBlock?: string;
  /** default: standard_compressed */
  compressionMode?: CompressedPromptMode;
  /** true면 상위 보유·비중·리스크·이벤트 최소 블록을 BASE 끝에 고정 삽입 */
  fastModeQualityFloor?: boolean;
}): string {
  const { snapshot, userQuery, mode } = opts;
  const aggressive = opts.compressionMode === 'aggressive_compressed';
  const topN = aggressive ? TOP_HOLDINGS_AGGRESSIVE : TOP_HOLDINGS_STANDARD;
  const profileMax = aggressive ? 280 : 420;
  const quoteMax = aggressive ? 200 : 320;
  const userQMax = aggressive ? 1200 : 2000;
  const s = snapshot.summary;
  const positions = [...snapshot.positions].sort((a, b) => b.weight_pct - a.weight_pct).slice(0, topN);
  const posLines = positions.map(
    p =>
      `${p.symbol}|${p.market}|w${p.weight_pct.toFixed(1)}%|mvKRW~${Math.round(p.market_value_krw)}|px${p.current_price}${p.currency === 'USD' ? 'USD' : ''}`
  );
  const parts = [
    aggressive ? '[BASE_CONTEXT — compressed:aggressive]' : '[BASE_CONTEXT — compressed:standard]',
    `[USER_MODE] ${mode}`,
    opts.profileOneLiner ? `[PROFILE] ${truncateUtf8Chars(opts.profileOneLiner, profileMax)}` : '',
    `[PORTFOLIO_SUM] n=${s.position_count} mvKRW=${Math.round(s.total_market_value_krw)} pnlKRW=${Math.round(s.total_pnl_krw)} ret%=${s.total_return_pct.toFixed(2)} top3w%=${s.top3_weight_pct.toFixed(1)} KR%=${s.domestic_weight_pct.toFixed(1)} US%=${s.us_weight_pct.toFixed(1)}`,
    s.degraded_quote_mode
      ? `[QUOTE] degraded=true failures=${s.quote_failure_count ?? 0}`
      : `[QUOTE] degraded=false`,
    opts.quoteQualityBlock ? truncateUtf8Chars(opts.quoteQualityBlock.replace(/^\s+|\s+$/g, ''), quoteMax) : '',
    `[TOP_HOLDINGS≤${topN}]`,
    posLines.length ? posLines.join('\n') : '(none)',
    opts.partialScopeBlock ? `\n${opts.partialScopeBlock}` : '',
    opts.styleDirectiveBlock ? `\n${opts.styleDirectiveBlock}` : '',
    opts.fastModeQualityFloor ? `\n${buildFastModeContextFloor(snapshot)}` : '',
    `[USER_QUESTION]\n${truncateUtf8Chars(userQuery, userQMax)}`,
    '[ANCHOR_RULE] 위 수치·스냅샷만 앵커. 없는 현금흐름/지출은 단정 금지.'
  ];
  return parts.filter(Boolean).join('\n');
}

/** PERSONA_CONTEXT: 역할 한 줄 + 바이어스 + 메모리(잘림). */
export function buildPersonaContext(opts: {
  personaKey: PersonaKey;
  personaBiasDirective: string;
  memoryDirective: string;
  compressionMode?: CompressedPromptMode;
}): string {
  const role =
    opts.personaKey === 'RAY'
      ? '[PERSONA] Ray — 거시·리스크 균형'
      : opts.personaKey === 'HINDENBURG'
        ? '[PERSONA] Hindenburg — 다운사이드·구조 리스크'
        : opts.personaKey === 'SIMONS'
          ? '[PERSONA] Simons — 확률·데이터 시그널'
          : opts.personaKey === 'DRUCKER'
            ? '[PERSONA] Drucker — 실행 레버·구조'
            : opts.personaKey === 'CIO'
              ? '[PERSONA] CIO — 최종 GO/HOLD/NO'
              : `[PERSONA] ${opts.personaKey}`;
  const bias = opts.personaBiasDirective || '';
  const memMax = opts.compressionMode === 'aggressive_compressed' ? 650 : 1100;
  const mem = opts.memoryDirective ? truncateUtf8Chars(opts.memoryDirective, memMax) : '';
  return [role, bias, mem ? `[MEMORY]\n${mem}` : ''].filter(Boolean).join('\n');
}

export type PortfolioTaskPromptMode =
  | 'persona'
  | 'persona_brevity'
  | 'cio'
  | 'retry_summary'
  | 'cio_fast_executive';

/** 페르소나별 필수 사고 흐름(full·fast 공통으로 삽입 가능). */
export function buildPersonaReasoningStructureBlock(personaKey: PersonaKey): string {
  switch (personaKey) {
    case 'RAY':
      return '[REASONING_STRUCTURE — Ray]\n1) 전체 포트폴리오 리스크 구조\n2) 균형·편중 평가\n3) 금리·경기 등 시스템 리스크\n4) 리스크 관리 방향 결론';
    case 'HINDENBURG':
      return '[REASONING_STRUCTURE — Hindenburg]\n1) 핵심 리스크를 한 문장으로 정의\n2) 구체적 근거 **2개 이상**(수치·구조·시나리오)\n3) downside 시나리오(범위·조건)\n4) 경고 또는 방어 전략 결론 — "리스크 있음" 수준의 추상만 금지';
    case 'SIMONS':
      return '[REASONING_STRUCTURE — Simons]\n1) 시장/포트 상태를 데이터로 정의\n2) 시그널 **2개 이상**(변동성·수급·추세·집중도 등)\n3) 패턴·확률 해석\n4) 유리/불리 판단 — 감정 표현·데이터 없는 단정 금지';
    case 'DRUCKER':
      return '[REASONING_STRUCTURE — Drucker]\n1) 포트폴리오 문제 정의\n2) 실행 전략 1~2개(**구체**: 예: 기술주 비중 30%→20%, 현금 버퍼 확보 등)\n3) 실행 방법(어떻게)\n4) 기대 효과 — "비중 줄인다"만 쓰지 말 것';
    case 'CIO':
      return '[REASONING_STRUCTURE — CIO]\n1) 최종 판단 **GO|HOLD|REDUCE|EXIT**(또는 동의 한국어) **본문에 명시**\n2) 핵심 이유 **2개 이상**\n3) 리스크 고려\n4) 실행 방향 요약 — "지켜본다" **단독 문장** 금지';
    default:
      return '';
  }
}

/** fast 경로: full과 동일한 `[TASK] persona` 지시 + 역할별 구조 강제(축소 금지). */
export function buildPortfolioFastPersonaPromptBundle(personaKey: PersonaKey): string {
  const struct = buildPersonaReasoningStructureBlock(personaKey);
  const base =
    '[TASK — full 동등 사고 구조]\n' +
    '**최소 4문장 이상**, **근거(수치·비중·스냅샷·시그널) 2개 이상** 포함, **판단·방향**을 명시.\n' +
    '장황한 서두는 피하되, 위 [REASONING_STRUCTURE] 단계를 생략하지 말 것.';
  return struct ? `${base}\n${struct}` : base;
}

/** TASK_PROMPT: 출력 길이·형식 제한. */
export function buildTaskPrompt(mode: PortfolioTaskPromptMode): string {
  switch (mode) {
    case 'persona':
      return '[TASK]\n핵심 판단만. **3~5문장 또는 bullet 5개 이내.** 장황한 서두 금지.';
    case 'persona_brevity':
      return '[TASK]\n**2~4문장.** 한 줄 결론 먼저.';
    case 'cio':
      return '[TASK]\n위 **요약 블록**만 근거로 결론. 본문에 **GO|HOLD|REDUCE|EXIT**(또는 동의 한국어) 중 하나를 명시하고, 이유·리스크·실행 요약을 포함. 3~5문장 이상 권장.';
    case 'retry_summary':
      return '[TASK]\n입력은 압축되었으나 **출력의 분석 구조·근거 밀도는 full 경로와 동일**하게 유지한다. 글자 수 제한 없음.';
    case 'cio_fast_executive':
      return (
        '[TASK — CIO 경량 실행]\n' +
        '속도만 경량이며 **사고 구조는 유지**한다.\n' +
        '(1) **GO|HOLD|REDUCE|EXIT** 중 하나를 본문에 명시 (2) 이유 2개 이상·수치·비중 인용 (3) 리스크 (4) 실행 요약.\n' +
        '**최소 4문장.** "상황을 지켜본다" 단독 문장 금지.'
      );
    default:
      return '[TASK]\n간결히.';
  }
}

export function compressPersonaLine(label: string, text: string, maxChars: number): string {
  const body = truncateUtf8Chars(text.replace(/\s+/g, ' ').trim(), maxChars);
  return `[${label}]\n${body}`;
}

/** CIO·Simons peer 등 후속 단계 입력 압축. */
export function compressPersonaOutputsForCio(entries: { label: string; text: string }[], maxEach: number): string {
  return entries.map(e => compressPersonaLine(e.label, e.text, maxEach)).join('\n\n');
}

/** 오픈 토픽 BASE (포트폴리오 JSON 없음). */
export function buildOpenTopicBaseContext(opts: {
  mode: string;
  userQuery: string;
  profileOneLiner: string;
  openTopicGuardBlock: string;
  compressionMode?: CompressedPromptMode;
}): string {
  const aggressive = opts.compressionMode === 'aggressive_compressed';
  return [
    aggressive ? '[BASE_CONTEXT — OPEN_TOPIC compressed:aggressive]' : '[BASE_CONTEXT — OPEN_TOPIC compressed:standard]',
    opts.openTopicGuardBlock.trim(),
    `[USER_MODE] ${opts.mode}`,
    `[PROFILE] ${truncateUtf8Chars(opts.profileOneLiner, aggressive ? 300 : 400)}`,
    `[USER_TOPIC]\n${truncateUtf8Chars(opts.userQuery, aggressive ? 1200 : 2000)}`
  ]
    .filter(Boolean)
    .join('\n');
}
