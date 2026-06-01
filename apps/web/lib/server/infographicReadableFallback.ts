import type { InfographicSpec } from '@office-unify/shared-types';

function cleanLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  const t = cleanLine(text);
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function splitSentences(text: string): string[] {
  const normalized = text
    .replace(/\r/g, '\n')
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map(cleanLine)
    .filter((line) => line.length >= 12);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of normalized) {
    const item = truncate(line, 140);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= 18) break;
  }
  return out;
}

function pickByKeywords(lines: string[], keywords: string[], fallbackStart: number, max = 3): string[] {
  const matches = lines.filter((line) => keywords.some((kw) => line.includes(kw))).slice(0, max);
  if (matches.length > 0) return matches;
  return lines.slice(fallbackStart, fallbackStart + max);
}

export function buildReadableInfographicFallbackSpec(params: {
  industryName: string;
  rawText: string;
  sourceUrl?: string;
  sourceTitle?: string;
  extractionWarnings?: string[];
  reason?: string;
}): InfographicSpec {
  const lines = splitSentences(params.rawText);
  const summaryLines = lines.slice(0, 5);
  const claims = pickByKeywords(lines, ['주장', '전망', '가능성', '성장', '상승', '하락', '변화'], 1);
  const evidence = pickByKeywords(lines, ['근거', '수치', '%', '데이터', '실적', '사례', '발표'], 4);
  const implications = pickByKeywords(lines, ['산업', '투자', '시장', '공급', '수요', '경쟁', '리스크'], 7);
  const questions = [
    '블로그의 주장과 검증된 사실을 분리해 확인합니다.',
    '숫자 근거와 출처가 충분한지 다시 확인합니다.',
    '산업 구조나 기업 이벤트가 실제로 이어지는지 후속 자료로 점검합니다.',
  ];
  const title = params.sourceTitle?.trim() || `${params.industryName} 읽기 요약`;
  const summary =
    summaryLines.length > 0
      ? summaryLines.join(' ')
      : '원문 추출은 성공했지만 구조화 품질이 부족해 읽기 요약 중심으로 표시합니다.';

  return {
    title: truncate(title, 80),
    subtitle: 'Infographic 초안은 생성하지 못했지만, 원문 기반 요약은 사용할 수 있습니다.',
    industry: params.industryName || '분석 대상',
    summary: truncate(summary, 420),
    zones: [
      { id: 'input', name: '핵심 요약', items: summaryLines.slice(0, 5), visualKeywords: ['summary', 'claim'] },
      { id: 'production', name: '핵심 주장', items: claims, visualKeywords: ['claim', 'logic'] },
      { id: 'distribution', name: '근거와 사례', items: evidence, visualKeywords: ['evidence', 'data'] },
      { id: 'demand', name: '산업/투자 시사점', items: implications, visualKeywords: ['implication', 'risk'] },
    ],
    flows: [
      { from: 'input', to: 'production', type: 'data', label: '요약에서 주장 분리' },
      { from: 'production', to: 'distribution', type: 'data', label: '주장별 근거 확인' },
      { from: 'distribution', to: 'demand', type: 'unknown', label: '시사점과 확인 질문 연결' },
    ],
    lineup: questions.map((q, idx) => ({ name: `확인 질문 ${idx + 1}`, category: 'follow_up', note: q })),
    comparisons: [
      { label: '원문 추출', value: '성공', note: 'URL 또는 입력 본문에서 읽기 가능한 텍스트를 확보했습니다.' },
      { label: '구조화 분석', value: 'degraded', note: '요약은 유지하고 infographic draft만 보류합니다.' },
      { label: '수치 근거', value: evidence.some((x) => /%|\d/.test(x)) ? '일부 있음' : '부족', note: '숫자 근거가 약하면 별도 검증이 필요합니다.' },
    ],
    risks: [
      { title: '검증 필요', description: '블로그 주장과 확인된 사실을 분리해 후속 자료로 확인해야 합니다.' },
      { title: '수치 근거 부족 가능성', description: '수치나 출처가 부족하면 infographic 수치 카드로 쓰지 않습니다.' },
    ],
    charts: { bar: [], pie: [], line: [] },
    notes: [
      '이 결과는 투자 결론이나 주문 지시가 아니라 읽기 요약과 후속 확인 질문입니다.',
      'Research Center로 보낼 때는 compact seed만 사용하고 긴 원문을 URL query에 넣지 않습니다.',
      params.reason ? `degraded reason: ${params.reason}` : 'structured analysis degraded',
    ],
    warnings: ['Infographic draft degraded: readable summary preserved.'],
    sourceMeta: {
      sourceType: params.sourceUrl ? 'url' : 'text',
      generatedAt: new Date().toISOString(),
      confidence: 'low',
      extractionMode: 'degraded_fallback',
      parseStage: 'fallback',
      resultMode: 'mixed_summary_map',
      articlePattern: 'mixed_or_unknown',
      industryPattern: 'mixed_or_unknown',
      subjectivityLevel: 'medium',
      structureDensity: 'low',
      specCompletenessScore: 0.35,
      filledZoneCount: 4,
      numericEvidenceCount: evidence.filter((x) => /%|\d/.test(x)).length,
      riskCount: 2,
      comparisonCount: 3,
      chartCount: 0,
      degradedReasons: ['insufficient_structure'],
      extractedFromText: true,
      sourceUrl: params.sourceUrl,
      sourceTitle: params.sourceTitle,
      extractionWarnings: params.extractionWarnings ?? [],
      extractedTextLength: params.rawText.length,
    },
  };
}
