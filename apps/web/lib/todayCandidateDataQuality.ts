import type { TodayCandidateDataQuality, TodayStockCandidate } from './todayCandidatesContract';

function hasOverheatCaution(notes: string[]): boolean {
  const text = notes.join(' ').toLowerCase();
  return text.includes('과열') || text.includes('추격') || text.includes('급등');
}

export function buildCandidateDataQuality(input: {
  confidence: TodayStockCandidate['confidence'];
  quoteReady: boolean;
  sectorConfidence?: 'high' | 'medium' | 'low' | 'very_low' | 'unknown';
  usMarketDataAvailable?: boolean;
  hasWatchlistLink: boolean;
  cautionNotes: string[];
  source?: TodayStockCandidate['source'];
}): TodayCandidateDataQuality {
  const badgesByPriority: string[] = [];
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (input.confidence === 'high') badgesByPriority.push('신뢰도 높음');
  if (input.confidence === 'medium') badgesByPriority.push('신뢰도 보통');
  if (input.confidence === 'low' || input.confidence === 'very_low') {
    badgesByPriority.push(input.confidence === 'very_low' ? '신뢰도 매우 낮음' : '신뢰도 낮음');
    warnings.push('low_confidence');
  }
  if (input.quoteReady) badgesByPriority.push('시세 확인됨');
  else badgesByPriority.push('시세 확인 필요');
  if (input.sectorConfidence === 'high' || input.sectorConfidence === 'medium') badgesByPriority.push('섹터 확인됨');
  else badgesByPriority.push('섹터 확인 필요');
  if (input.usMarketDataAvailable) badgesByPriority.push('미국장 신호 확인');
  else if (input.source === 'us_market_morning') badgesByPriority.push('미국장 데이터 제한');
  if (hasOverheatCaution(input.cautionNotes)) badgesByPriority.push('과열 주의');
  if (input.hasWatchlistLink) badgesByPriority.push('관심종목 연결');

  if (!input.quoteReady) reasons.push('quoteSymbol/googleTicker는 있으나 시세 확인이 완료되지 않았습니다.');
  if (!input.sectorConfidence || input.sectorConfidence === 'low' || input.sectorConfidence === 'very_low' || input.sectorConfidence === 'unknown') {
    reasons.push('섹터 신뢰도가 낮거나 확인 정보가 제한적입니다.');
  }
  if (input.usMarketDataAvailable === false && input.source === 'us_market_morning') reasons.push('미국장 데이터가 no_data 또는 제한 상태입니다.');
  if (hasOverheatCaution(input.cautionNotes)) reasons.push('과열 또는 추격매수 리스크가 있습니다.');
  if (!input.hasWatchlistLink) reasons.push('내 관심종목 연결성은 낮습니다.');

  const summaryParts: string[] = [];
  if (!input.quoteReady) summaryParts.push('시세 확인이 필요하고');
  if ((!input.sectorConfidence || ['low', 'very_low', 'unknown'].includes(input.sectorConfidence)) && summaryParts.length < 2) summaryParts.push('섹터 신뢰도가 낮고');
  if (input.usMarketDataAvailable === false && input.source === 'us_market_morning' && summaryParts.length < 2) summaryParts.push('미국장 데이터가 제한적이며');
  if (hasOverheatCaution(input.cautionNotes) && summaryParts.length < 2) summaryParts.push('과열 또는 추격매수 리스크가 있어');
  if (!input.hasWatchlistLink && summaryParts.length < 2) summaryParts.push('관심종목 연결성이 낮아');
  let summary: string | undefined;
  if (input.confidence === 'low' || input.confidence === 'very_low') {
    if (summaryParts.length === 0) {
      summary = input.confidence === 'very_low'
        ? '신뢰도 매우 낮음: 주요 데이터가 부족해 관찰만 권장합니다.'
        : '신뢰도 낮음: 데이터 확인이 필요해 관찰 중심으로 보세요.';
    } else {
      const joined = summaryParts.join(' ').replace(/\s+/g, ' ').trim().replace(/고$/,'고');
      summary = `신뢰도 ${input.confidence === 'very_low' ? '매우 낮음' : '낮음'}: ${joined} 관찰만 권장합니다.`;
    }
  }
  return {
    overall: input.confidence,
    badges: badgesByPriority.slice(0, 4),
    reasons,
    summary,
    quoteReady: input.quoteReady,
    sectorConfidence: input.sectorConfidence ?? 'unknown',
    usMarketDataAvailable: input.usMarketDataAvailable,
    warnings,
  };
}

export function filterCandidatesByConfidence(
  rows: TodayStockCandidate[],
  showLowConfidence: boolean,
): TodayStockCandidate[] {
  if (showLowConfidence) return rows;
  return rows.filter((c) => c.confidence === 'high' || c.confidence === 'medium');
}
