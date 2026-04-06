import type { PersonaKey } from '../../analysisTypes';
import { logger } from '../../logger';

const COMMITTEE_KEYS = new Set<PersonaKey>(['RAY', 'HINDENBURG', 'SIMONS', 'DRUCKER', 'CIO']);

/** full / fast 공통: 최대 호출 횟수(초기 1 + 재생성 2) */
export const PORTFOLIO_QUALITY_MAX_ATTEMPTS = 3;

export type PortfolioQualityRunMode = 'full' | 'light' | 'retry_summary' | 'short_summary';

export type PortfolioQualityMeta = {
  compressionMode: string;
  maxOutputTokens?: number;
  modelRequested?: string;
};

/** 한국어·bullet 혼합: 문장 단위 과소추정 완화 */
export function countSentenceLikeUnits(text: string): number {
  const t = String(text || '').trim();
  if (!t) return 0;
  const punct = t.split(/[.!?。！？…]+/).filter(s => s.replace(/[#*_`\s\d]/g, '').length >= 5).length;
  const lines = t.split(/\n/).filter(s => s.replace(/^[-*•\d.\s]+/, '').trim().length >= 10).length;
  const bullets = (t.match(/(?:^|\n)\s*[-*•]\s+\S/g) || []).length;
  return Math.max(punct, lines, bullets > 0 ? Math.max(1, Math.ceil(bullets * 0.75)) : 0);
}

export function countEvidenceMarkers(text: string): number {
  const t = String(text || '');
  let n = 0;
  if (/\d+\.?\d*\s*%/.test(t)) n += 1;
  if (/\d{1,3}(,\d{3})+|\d+\s*원|\d+\s*억|w\d|비중|top\d|KR%|US%/i.test(t)) n += 1;
  if (/(^|\n)\s*[-*•]\s/.test(t)) n += 1;
  if (/(근거|이유|첫째|둘째|또한|예를 들어|데이터|수치|시그널|변동성|수급)/i.test(t)) n += 1;
  if (/\d+\)/.test(t) || /\(1\)|\(2\)/.test(t)) n += 1;
  return n;
}

export function countBulletLines(text: string): number {
  return (String(text || '').match(/(?:^|\n)\s*[-*•]\s+/g) || []).length;
}

export function hasJudgmentOrDirection(text: string): boolean {
  return /(판단|결론|권장|방향|전략|리스크|경고|방어|유지|축소|확대|대응|GO|HOLD|REDUCE|EXIT|NO\b)/i.test(
    String(text || '')
  );
}

export function cioHasVerdictToken(text: string): boolean {
  return /(GO|HOLD|REDUCE|EXIT|NO\b|보류|유지|축소|확대|청산|이탈|진입|추가\s*매수)/i.test(String(text || ''));
}

function hindenburgPersonaOk(t: string): { ok: boolean; reason?: string } {
  const riskKw = ['리스크', '하방', 'downside', '악화', '손실', '하락', '경고', '구조', '취약', '버블', '과대', '집중', '부실', '레버리지'];
  const hit = riskKw.filter(k => t.includes(k)).length;
  if (hit < 2) return { ok: false, reason: 'hindenburg_risk_keywords_lt2' };
  if (!/(하락|손실|downside|악화|스트레스|시나리오|최악|슬럼프|하방|조정)/i.test(t))
    return { ok: false, reason: 'hindenburg_downside_scenario_missing' };
  if (!/(경고|방어|대응|축소|헷지|현금|회피|완충)/i.test(t))
    return { ok: false, reason: 'hindenburg_warning_or_defense_missing' };
  return { ok: true };
}

function simonsPersonaOk(t: string): { ok: boolean; reason?: string } {
  const sig = ['수치', '데이터', '변동성', '수급', '추세', '비중', '상관', '패턴', '확률', '시그널', 'vol', 'beta'];
  const hit = sig.filter(k => t.toLowerCase().includes(k.toLowerCase())).length;
  if (hit < 2) return { ok: false, reason: 'simons_data_signal_evidence_lt2' };
  if (!/(확률|패턴|시그널|구간|범위|해석|유리|불리)/i.test(t))
    return { ok: false, reason: 'simons_pattern_or_conclusion_missing' };
  return { ok: true };
}

function druckerPersonaOk(t: string): { ok: boolean; reason?: string } {
  const bullets = countBulletLines(t);
  const numbered = (t.match(/\n\s*\d+[\).]/g) || []).length;
  if (bullets + numbered < 2 && !/(첫째|둘째|첫\s|둘\s|실행|조치|단계).{8,}/i.test(t))
    return { ok: false, reason: 'drucker_execution_items_lt2' };
  if (!/(어떻게|방법|절차|우선|구체|매수|매도|리밸|조정|비중\s*\d)/i.test(t))
    return { ok: false, reason: 'drucker_how_missing' };
  if (!/(기대|효과|목적|목표|완화|개선)/i.test(t)) return { ok: false, reason: 'drucker_effect_or_purpose_missing' };
  return { ok: true };
}

function rayPersonaOk(t: string): { ok: boolean; reason?: string } {
  if (!/(분산|균형|편중|집중|비중|포트폴리오|자산배분|집중도)/i.test(t))
    return { ok: false, reason: 'ray_portfolio_structure_missing' };
  if (!/(금리|인플레|경기|유동성|환율|매크로|시스템|거시)/i.test(t))
    return { ok: false, reason: 'ray_system_risk_missing' };
  if (!/(관리|리스크|완충|현금|방향|유지|축소|확대)/i.test(t))
    return { ok: false, reason: 'ray_risk_management_direction_missing' };
  return { ok: true };
}

function cioPersonaOk(t: string): { ok: boolean; reason?: string } {
  if (!cioHasVerdictToken(t)) return { ok: false, reason: 'cio_verdict_missing' };
  let r = 0;
  if (/(첫째|첫\s|1\)|먼저|첫번째)/i.test(t)) r += 1;
  if (/(둘째|둘\s|2\)|또한|두번째)/i.test(t)) r += 1;
  if (/(이유|근거)\s*[가-힣:：]/.test(t) || /(?:이유|근거)\s*[一二三四五六七八九十]/.test(t)) r += 1;
  if (r < 2) return { ok: false, reason: 'cio_reasons_insufficient' };
  if (!/(리스크|변동성|손실|하방|불확실)/i.test(t)) return { ok: false, reason: 'cio_risk_consideration_missing' };
  if (!/(실행|조치|방향|요약|단계|우선)/i.test(t)) return { ok: false, reason: 'cio_execution_summary_missing' };
  return { ok: true };
}

export type PortfolioQualityEvaluation = {
  pass: boolean;
  failureReasons: string[];
  responseLength: number;
  sentenceLikeUnitCount: number;
  evidenceMarkerCount: number;
  bulletCount: number;
  hasDecisionToken: boolean;
};

export function evaluatePortfolioPersonaQuality(personaKey: PersonaKey, rawText: string): PortfolioQualityEvaluation {
  const failureReasons: string[] = [];
  if (!COMMITTEE_KEYS.has(personaKey)) {
    return {
      pass: true,
      failureReasons: [],
      responseLength: String(rawText || '').trim().length,
      sentenceLikeUnitCount: 0,
      evidenceMarkerCount: 0,
      bulletCount: 0,
      hasDecisionToken: true
    };
  }

  const t = String(rawText || '').trim();
  const sl = countSentenceLikeUnits(t);
  const ev = countEvidenceMarkers(t);
  const bullets = countBulletLines(t);

  if (t.length < 180) failureReasons.push('min_length_180');
  if (sl < 5) failureReasons.push('sentence_like_units_lt5');
  if (ev < 2) failureReasons.push('evidence_markers_lt2');
  if (!hasJudgmentOrDirection(t)) failureReasons.push('judgment_or_direction_missing');
  if (personaKey === 'CIO' && !cioHasVerdictToken(t)) failureReasons.push('cio_verdict_token');

  let personaExtra: { ok: boolean; reason?: string } = { ok: true };
  switch (personaKey) {
    case 'HINDENBURG':
      personaExtra = hindenburgPersonaOk(t);
      break;
    case 'SIMONS':
      personaExtra = simonsPersonaOk(t);
      break;
    case 'DRUCKER':
      personaExtra = druckerPersonaOk(t);
      break;
    case 'RAY':
      personaExtra = rayPersonaOk(t);
      break;
    case 'CIO':
      personaExtra = cioPersonaOk(t);
      break;
    default:
      break;
  }
  if (!personaExtra.ok && personaExtra.reason) failureReasons.push(personaExtra.reason);

  const pass = failureReasons.length === 0;
  return {
    pass,
    failureReasons,
    responseLength: t.length,
    sentenceLikeUnitCount: sl,
    evidenceMarkerCount: ev,
    bulletCount: bullets,
    hasDecisionToken: personaKey === 'CIO' ? cioHasVerdictToken(t) : hasJudgmentOrDirection(t)
  };
}

export function portfolioPersonaMeetsQualityFloor(personaKey: PersonaKey, rawText: string): boolean {
  return evaluatePortfolioPersonaQuality(personaKey, rawText).pass;
}

/** @deprecated use evaluatePortfolioPersonaQuality */
export function evaluatePortfolioPersonaQualityMetrics(personaKey: PersonaKey, rawText: string) {
  const e = evaluatePortfolioPersonaQuality(personaKey, rawText);
  return {
    pass: e.pass,
    responseLength: e.responseLength,
    sentenceCount: e.sentenceLikeUnitCount,
    evidenceMarkerCount: e.evidenceMarkerCount,
    hasDecisionToken: e.hasDecisionToken
  };
}

export function buildPortfolioQualityRetryAppend(personaKey: PersonaKey, attemptIndex: number): string {
  const n = attemptIndex + 1;
  const strict =
    attemptIndex >= 1
      ? '\n**[재시도 강화]** 추상 요약 금지. 부족한 항목을 번호 매겨 채우라.\n'
      : '';
  const common =
    `\n\n[QUALITY_RETRY_${n}]${strict}\n` +
    '이전 출력이 품질 기준에 미달했습니다. **반드시** 아래를 만족하라.\n' +
    '- **문장·bullet 합산 5단위 이상**(한국어 종결·줄바꿈·bullet 모두 인정).\n' +
    '- **근거 2개 이상**(수치·비중·스냅샷·시그널 등).\n' +
    '- **판단·방향** 명시.\n';

  const byKey: Partial<Record<PersonaKey, string>> = {
    RAY: `${common}Ray: (1) 포트 구조·균형·분산 (2) 시스템 리스크 1개 이상 명시 (3) 리스크 관리 방향 (4) 결론. 균형·편중·거시를 **구체**히.`,
    HINDENBURG: `${common}Hindenburg: **리스크 키워드 2개 이상**, **하방·악화·손실 시나리오** 한 덩어리, **경고 또는 방어** 결론. "리스크 있다" 한 줄 금지.`,
    SIMONS: `${common}Simons: **데이터/변동성/수급/패턴** 근거 2개 이상, **확률·패턴 해석**, **유리/불리** 결론. 감정 표현 금지.`,
    DRUCKER: `${common}Drucker: **실행 항목 2개 이상**(bullet 또는 번호), **어떻게(절차·우선순위)** 문장, **기대 효과·목적** 포함.`,
    CIO: `${common}CIO: 본문에 **GO|HOLD|REDUCE|EXIT**(또는 동의 한국어), **이유 2개 이상**, **리스크**, **실행 요약**. "지켜본다" 단독 금지.`
  };

  return byKey[personaKey] || common;
}

export async function runPortfolioPersonaWithQualityRetry<T>(params: {
  personaKey: PersonaKey;
  basePrompt: string;
  maxAttempts?: number;
  invoke: (fullPrompt: string) => Promise<T>;
  getText: (result: T) => string;
  analysisType: string;
  runMode: PortfolioQualityRunMode;
  executionId?: string | null;
  qualityMeta?: PortfolioQualityMeta;
  getModelActuallyUsed?: (result: T) => string | undefined;
}): Promise<T> {
  const max = params.maxAttempts ?? PORTFOLIO_QUALITY_MAX_ATTEMPTS;
  const baseLog = {
    personaKey: params.personaKey,
    analysisType: params.analysisType,
    runMode: params.runMode,
    executionId: params.executionId ?? null
  };
  const qm = params.qualityMeta;

  const logPerf = (
    payload: Partial<{
      qualityFloorPassed: boolean;
      qualityRegenerateAttempts: number;
      qualityFailureReason: string | null;
      attemptNo: number;
    }> & { last?: T }
  ) => {
    const raw = payload.last != null ? params.getText(payload.last) : '';
    const ev = COMMITTEE_KEYS.has(params.personaKey) ? evaluatePortfolioPersonaQuality(params.personaKey, raw) : null;
    logger.info('AI_PERF', 'portfolio_persona_quality', {
      ...baseLog,
      qualityFloorPassed: payload.qualityFloorPassed ?? false,
      qualityRegenerateAttempts: payload.qualityRegenerateAttempts ?? 0,
      qualityFailureReason: payload.qualityFailureReason ?? (ev && !ev.pass ? ev.failureReasons.join(',') : null),
      compressionMode: qm?.compressionMode ?? null,
      outputCap: qm?.maxOutputTokens ?? null,
      modelRequested: qm?.modelRequested ?? null,
      modelActuallyUsed: payload.last != null ? params.getModelActuallyUsed?.(payload.last) ?? null : null,
      responseLength: ev?.responseLength ?? String(raw).length,
      evidenceMarkerCount: ev?.evidenceMarkerCount ?? null,
      sentenceLikeUnitCount: ev?.sentenceLikeUnitCount ?? null,
      bulletCount: ev?.bulletCount ?? null,
      attemptNo: payload.attemptNo ?? null
    });
  };

  let last = await params.invoke(params.basePrompt);
  let raw = params.getText(last);
  let ev = evaluatePortfolioPersonaQuality(params.personaKey, raw);
  if (ev.pass) {
    logger.info('QUALITY', 'QUALITY_FLOOR_PASSED', { ...baseLog, attemptNo: 1, ...ev });
    logPerf({
      qualityFloorPassed: true,
      qualityRegenerateAttempts: 0,
      qualityFailureReason: null,
      attemptNo: 1,
      last
    });
    return last;
  }
  logger.warn('QUALITY', 'QUALITY_FLOOR_FAILED', { ...baseLog, attemptNo: 1, ...ev });
  logger.warn('QUALITY', 'QUALITY_FAILURE_REASON', {
    ...baseLog,
    attemptNo: 1,
    reasons: ev.failureReasons,
    joined: ev.failureReasons.join(',')
  });

  for (let a = 1; a < max; a++) {
    const attemptNo = a + 1;
    logger.info('QUALITY', 'QUALITY_REGENERATE_ATTEMPT', { ...baseLog, attemptNo });
    const prompt = `${params.basePrompt}${buildPortfolioQualityRetryAppend(params.personaKey, a - 1)}`;
    last = await params.invoke(prompt);
    raw = params.getText(last);
    ev = evaluatePortfolioPersonaQuality(params.personaKey, raw);
    if (ev.pass) {
      logger.info('QUALITY', 'QUALITY_REGENERATE_RECOVERED', { ...baseLog, attemptNo, ...ev });
      logPerf({
        qualityFloorPassed: true,
        qualityRegenerateAttempts: a,
        qualityFailureReason: null,
        attemptNo,
        last
      });
      return last;
    }
    logger.warn('QUALITY', 'QUALITY_FLOOR_FAILED', { ...baseLog, attemptNo, ...ev });
    logger.warn('QUALITY', 'QUALITY_FAILURE_REASON', {
      ...baseLog,
      attemptNo,
      reasons: ev.failureReasons,
      joined: ev.failureReasons.join(',')
    });
  }

  logger.warn('QUALITY', 'QUALITY_REGENERATE_EXHAUSTED', {
    ...baseLog,
    attemptNo: max,
    ...ev
  });
  logger.warn('QUALITY', 'QUALITY_FAILURE_REASON', {
    ...baseLog,
    attemptNo: max,
    reasons: ev.failureReasons,
    joined: ev.failureReasons.join(',')
  });
  logPerf({
    qualityFloorPassed: false,
    qualityRegenerateAttempts: max - 1,
    qualityFailureReason: ev.failureReasons.join(','),
    attemptNo: max,
    last
  });
  return last;
}
