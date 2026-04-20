import type {
  InfographicArticlePattern,
  InfographicComparison,
  InfographicDegradedReason,
  InfographicExtractResponseBody,
  InfographicExtractionMode,
  InfographicIndustryPattern,
  InfographicParseStage,
  InfographicSourceTone,
  InfographicSourceType,
  InfographicSpec,
  InfographicStructureDensity,
  InfographicSubjectivityLevel,
  InfographicZoneId,
  InfographicResultMode,
} from '@office-unify/shared-types';
import { generateGeminiResearchReport } from '../research-center/researchGeminiCall';
import { buildInfographicSystemPrompt, buildInfographicUserPrompt } from './infographicPrompt';

type ParsedOutcome =
  | { ok: true; parsed: unknown; parseStage: InfographicParseStage; repaired: boolean; warnings: string[] }
  | { ok: false; warnings: string[] };

type NumericEvidence = {
  label: string;
  value: number;
};

type SpecQuality = {
  filledZoneCount: number;
  riskCount: number;
  comparisonCount: number;
  chartCount: number;
  numericEvidenceCount: number;
  notesCount: number;
  claimsCount: number;
  signalsCount: number;
  summaryReady: boolean;
  score: number;
  pass: boolean;
};

type OpinionFrame = {
  thesis: string;
  supportingPoints: string[];
  counterPoints: string[];
  risks: string[];
  checkpoints: string[];
  actors: string[];
  signals: string[];
  notes: string[];
};

const DEFAULT_ZONE_NAMES: Record<InfographicZoneId, string> = {
  input: '원재료·입력',
  production: '생산·조립',
  distribution: '유통·운용·네트워크',
  demand: '최종 수요·출력',
};

function stripCodeFence(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```json')) text = text.slice(7);
  else if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);
  return text.trim();
}

function extractFirstJsonCandidate(raw: string): string {
  const text = stripCodeFence(raw);
  const start = text.indexOf('{');
  if (start < 0) return text;
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end > start) return text.slice(start, end + 1);
  return text.slice(start);
}

function repairJsonCandidate(candidate: string): { repaired: string; warnings: string[] } {
  const warnings: string[] = [];
  let text = candidate.trim();
  const quoteRepaired = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  if (quoteRepaired !== text) warnings.push('extractor_repair_smart_quote');
  text = quoteRepaired;
  const trailingCommaRepaired = text.replace(/,\s*([}\]])/g, '$1');
  if (trailingCommaRepaired !== text) warnings.push('extractor_repair_trailing_comma');
  text = trailingCommaRepaired;
  const slashRepaired = text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
  if (slashRepaired !== text) warnings.push('extractor_repair_stray_backslash');
  text = slashRepaired;
  const cutCandidate = extractFirstJsonCandidate(text);
  if (cutCandidate !== text) warnings.push('extractor_repair_tail_cut');
  return { repaired: cutCandidate, warnings };
}

function parseJsonPipeline(raw: string): ParsedOutcome {
  const warnings: string[] = [];
  const first = extractFirstJsonCandidate(raw);
  try {
    return {
      ok: true,
      parsed: JSON.parse(first) as unknown,
      parseStage: 'strict_ok',
      repaired: false,
      warnings,
    };
  } catch {
    warnings.push('extractor_json_parse_failed_strict');
  }
  const repaired = repairJsonCandidate(first);
  warnings.push(...repaired.warnings);
  try {
    return {
      ok: true,
      parsed: JSON.parse(repaired.repaired) as unknown,
      parseStage: 'repair_ok',
      repaired: true,
      warnings: Array.from(new Set(warnings)),
    };
  } catch {
    warnings.push('extractor_json_parse_failed_repair');
    return { ok: false, warnings: Array.from(new Set(warnings)) };
  }
}

function detectSourceType(rawText: string): InfographicSourceType {
  const t = rawText.toLowerCase();
  if (/증권사|리포트|리서치|투자의견/.test(t)) return 'securities_report';
  if (/http|www\.|블로그|포스트/.test(t)) return 'blog';
  return 'pasted_text';
}

function detectIndustryPattern(industryName: string, rawText: string): InfographicIndustryPattern {
  const t = `${industryName}\n${rawText}`.toLowerCase();
  if (/반도체|메모리|파운드리|전자|디스플레이/.test(t)) return 'semiconductor_electronics';
  if (/원유|가스|정유|전력|재생에너지|석탄|우라늄/.test(t)) return 'energy_resources';
  if (/사이버|보안|security|랜섬|피싱|탐지|관제|threat|soc|mfa|edr|cnapp|cspm|ciem/.test(t)) {
    return 'cybersecurity_service';
  }
  if (/소프트웨어|클라우드|saas|paas|api|플랫폼|ai 서비스|devops/.test(t)) return 'software_platform';
  if (/바이오|헬스|의료|제약|임상|gene|drug/.test(t)) return 'healthcare_bio';
  if (/유통|소비재|리테일|전자상거래|브랜드/.test(t)) return 'consumer_retail';
  if (/은행|보험|자산운용|결제|핀테크|증권/.test(t)) return 'finance_insurance';
  if (/자동차|모빌리티|배터리|전기차|자율주행/.test(t)) return 'mobility_automotive';
  if (/콘텐츠|미디어|광고|스트리밍|게임|플랫폼 미디어/.test(t)) return 'media_content';
  if (/산업재|기계|플랜트|물류|b2b/.test(t)) return 'industrials_b2b';
  if (/제조|소재|장비|공장/.test(t)) return 'manufacturing';
  return 'mixed_or_unknown';
}

function zoneAliasesByPattern(pattern: InfographicIndustryPattern): Partial<Record<InfographicZoneId, string>> {
  if (pattern === 'cybersecurity_service' || pattern === 'software_platform') {
    return {
      input: '입력·기반요소',
      production: '구축·도입',
      distribution: '운영·관제·대응',
      demand: '최종 수요·효과',
    };
  }
  return {};
}

function zoneAliasesByArticlePattern(
  articlePattern: InfographicArticlePattern,
): Partial<Record<InfographicZoneId, string>> {
  if (articlePattern === 'opinion_editorial' || articlePattern === 'market_commentary') {
    return {
      input: '문제의식·배경',
      production: '핵심 주장·논리',
      distribution: '영향·쟁점·반론',
      demand: '시사점·체크포인트',
    };
  }
  if (articlePattern === 'thematic_analysis') {
    return {
      input: '기반 기술·자산',
      production: '핵심 플레이어·구성요소',
      distribution: '시장 확산·운영 구조',
      demand: '수혜처·리스크·시사점',
    };
  }
  if (articlePattern === 'how_to_explainer') {
    return {
      input: '문제 정의',
      production: '방법·절차',
      distribution: '운영·적용 포인트',
      demand: '결과·주의사항',
    };
  }
  return {};
}

function resultModeByArticlePattern(articlePattern: InfographicArticlePattern): InfographicResultMode {
  if (articlePattern === 'opinion_editorial') return 'opinion_argument_map';
  if (articlePattern === 'market_commentary') return 'market_checkpoint_map';
  if (articlePattern === 'how_to_explainer') return 'howto_process_map';
  if (articlePattern === 'mixed_or_unknown') return 'mixed_summary_map';
  return 'industry_structure';
}

function classifyArticlePattern(params: {
  rawText: string;
  sourceTitle?: string;
  sourceUrl?: string;
}): {
  articlePattern: InfographicArticlePattern;
  sourceTone: InfographicSourceTone;
  subjectivityLevel: InfographicSubjectivityLevel;
  structureDensity: InfographicStructureDensity;
} {
  const t = `${params.sourceTitle ?? ''}\n${params.rawText}\n${params.sourceUrl ?? ''}`.toLowerCase();
  const score = (arr: RegExp[]) => arr.reduce((acc, re) => acc + (re.test(t) ? 1 : 0), 0);
  const reportScore = score([/리포트|보고서|survey|기관|도표|figure|table|설문/, /%|순위|비중|응답률/, /분기|연간|전망/]);
  const companyScore = score([/기업|실적|가이던스|ceo|영업이익|매출|eps|ir/]);
  const opinionScore = score([/내 생각|나는|개인적으로|칼럼|의견|논평|opinion|editorial/, /너무|정말|결국|솔직히/]);
  const marketScore = score([/시황|수급|금리|환율|시장|테마|모멘텀|섹터/]);
  const thematicScore = score([/테마|구조|생태계|밸류체인|플랫폼|전환/]);
  const howtoScore = score([/방법|절차|가이드|체크포인트|실행 방법|운영 팁/]);
  let articlePattern: InfographicArticlePattern = 'mixed_or_unknown';
  const top = Math.max(reportScore, companyScore, opinionScore, marketScore, thematicScore, howtoScore);
  if (top > 0) {
    if (top === reportScore) articlePattern = 'industry_report';
    else if (top === companyScore) articlePattern = 'company_report';
    else if (top === opinionScore) articlePattern = 'opinion_editorial';
    else if (top === marketScore) articlePattern = 'market_commentary';
    else if (top === thematicScore) articlePattern = 'thematic_analysis';
    else if (top === howtoScore) articlePattern = 'how_to_explainer';
  }
  const subjectivityLevel: InfographicSubjectivityLevel =
    opinionScore >= 2 ? 'high' : opinionScore === 1 ? 'medium' : 'low';
  const structureDensity: InfographicStructureDensity =
    (params.rawText.match(/\n\s*(\d+\.|[-*]|##?|[가-힣A-Za-z ]{2,20}:)/g) ?? []).length >= 12
      ? 'high'
      : (params.rawText.match(/\n\s*(\d+\.|[-*]|##?|[가-힣A-Za-z ]{2,20}:)/g) ?? []).length >= 5
        ? 'medium'
        : 'low';
  const sourceTone: InfographicSourceTone =
    articlePattern === 'industry_report' ? 'institutional'
      : articlePattern === 'company_report' ? 'corporate'
      : articlePattern === 'opinion_editorial' ? 'personal_blog'
      : 'editorial';
  return { articlePattern, sourceTone, subjectivityLevel, structureDensity };
}

function buildFallbackSpec(
  industryName: string,
  sourceType: InfographicSourceType,
  pattern: InfographicIndustryPattern,
  mode: InfographicExtractionMode = 'semantic_fallback',
): InfographicSpec {
  const now = new Date().toISOString();
  return {
    title: `${industryName} 산업 구조 요약`,
    subtitle: '원문 기반 자동 정제 결과',
    industry: industryName,
    summary: '원문에서 안정적으로 추출 가능한 항목만 반영했습니다.',
    zones: [
      { id: 'input', name: DEFAULT_ZONE_NAMES.input, items: [], visualKeywords: [] },
      { id: 'production', name: DEFAULT_ZONE_NAMES.production, items: [], visualKeywords: [] },
      { id: 'distribution', name: DEFAULT_ZONE_NAMES.distribution, items: [], visualKeywords: [] },
      { id: 'demand', name: DEFAULT_ZONE_NAMES.demand, items: [], visualKeywords: [] },
    ],
    flows: [],
    lineup: [],
    comparisons: [],
    risks: [],
    charts: { bar: [], pie: [], line: [] },
    notes: [],
    warnings: ['extractor_fallback_used'],
    sourceMeta: {
      sourceType,
      generatedAt: now,
      confidence: 'low',
      industryPattern: pattern,
      extractionMode: mode,
      parseStage: 'fallback',
      resultMode: 'mixed_summary_map',
      degradedReasons: mode === 'degraded_fallback' ? ['insufficient_structure'] : [],
      zoneAliases: zoneAliasesByPattern(pattern),
    },
  };
}

function toSpecOrFallback(
  parsed: unknown,
  industryName: string,
  sourceType: InfographicSourceType,
  pattern: InfographicIndustryPattern,
): InfographicSpec {
  if (!parsed || typeof parsed !== 'object') return buildFallbackSpec(industryName, sourceType, pattern);
  const obj = parsed as Record<string, unknown>;
  const fallback = buildFallbackSpec(industryName, sourceType, pattern);
  return {
    ...fallback,
    ...obj,
    title: typeof obj.title === 'string' ? obj.title : fallback.title,
    subtitle: typeof obj.subtitle === 'string' ? obj.subtitle : fallback.subtitle,
    industry: typeof obj.industry === 'string' ? obj.industry : fallback.industry,
    summary: typeof obj.summary === 'string' ? obj.summary : fallback.summary,
    zones: Array.isArray(obj.zones) ? (obj.zones as InfographicSpec['zones']) : fallback.zones,
    flows: Array.isArray(obj.flows) ? (obj.flows as InfographicSpec['flows']) : fallback.flows,
    lineup: Array.isArray(obj.lineup) ? (obj.lineup as InfographicSpec['lineup']) : fallback.lineup,
    comparisons: Array.isArray(obj.comparisons)
      ? (obj.comparisons as InfographicSpec['comparisons'])
      : fallback.comparisons,
    risks: Array.isArray(obj.risks) ? (obj.risks as InfographicSpec['risks']) : fallback.risks,
    charts:
      obj.charts && typeof obj.charts === 'object'
        ? (obj.charts as InfographicSpec['charts'])
        : fallback.charts,
    notes: Array.isArray(obj.notes) ? (obj.notes as string[]) : fallback.notes,
    warnings: Array.isArray(obj.warnings)
      ? (obj.warnings as string[]).map((v) => String(v))
      : fallback.warnings,
    sourceMeta:
      obj.sourceMeta && typeof obj.sourceMeta === 'object'
        ? (obj.sourceMeta as InfographicSpec['sourceMeta'])
        : fallback.sourceMeta,
  };
}

function collectKeywordItems(rawText: string, keywords: string[], limit = 6): string[] {
  const lines = rawText
    .split(/\n|[.。!?]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 2);
  const picked: string[] = [];
  for (const line of lines) {
    if (keywords.some((k) => line.toLowerCase().includes(k.toLowerCase()))) {
      picked.push(line.replace(/^[\-•\d.)\s]+/, '').slice(0, 90));
    }
    if (picked.length >= limit * 3) break;
  }
  return Array.from(new Set(picked)).slice(0, limit);
}

function extractNumericEvidence(rawText: string): NumericEvidence[] {
  const evidence: NumericEvidence[] = [];
  const percentRegex = /([A-Za-z가-힣0-9\s/_-]{2,40})[:\-]\s*([0-9]{1,3}(?:\.[0-9]+)?)\s*%/g;
  let match: RegExpExecArray | null;
  while ((match = percentRegex.exec(rawText)) !== null) {
    const label = match[1].replace(/\s+/g, ' ').trim();
    const value = Number(match[2]);
    if (label && Number.isFinite(value)) evidence.push({ label, value });
  }
  const rankRegex = /([1-9])\s*순위?\s*[:\-]?\s*([A-Za-z가-힣0-9\s/_-]{2,30})/g;
  while ((match = rankRegex.exec(rawText)) !== null) {
    const rank = Number(match[1]);
    const label = match[2].trim();
    if (label && Number.isFinite(rank)) evidence.push({ label: `${rank}순위 ${label}`, value: rank });
  }
  return Array.from(new Map(evidence.map((e) => [`${e.label}:${e.value}`, e])).values()).slice(0, 16);
}

function neutralizeOpinionText(line: string): string {
  return line
    .replace(/개인적으로|솔직히|제 생각에는|나는 보기엔|말 그대로/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildOpinionFrame(rawText: string): OpinionFrame {
  const thesisCandidates = collectKeywordItems(rawText, ['핵심', '결론', '요약', '주장', '전망', '시사점'], 6)
    .map(neutralizeOpinionText)
    .filter(Boolean);
  const supporting = collectKeywordItems(rawText, ['근거', '이유', '상승', '확대', '성장', '개선', '강화'], 8)
    .map(neutralizeOpinionText)
    .filter(Boolean);
  const counter = collectKeywordItems(rawText, ['반론', '우려', '제약', '변수', '불확실', '하락', '둔화'], 6)
    .map(neutralizeOpinionText)
    .filter(Boolean);
  const signals = collectKeywordItems(rawText, ['신호', '지표', '수급', '금리', '환율', '체크', '모니터링'], 6)
    .map(neutralizeOpinionText)
    .filter(Boolean);
  const risks = collectKeywordItems(rawText, ['리스크', '위험', '변동성', '충격', '취약', '위협'], 6)
    .map(neutralizeOpinionText)
    .filter(Boolean);
  const checkpoints = collectKeywordItems(rawText, ['체크포인트', '행동', '점검', '확인', '대응', '전략'], 6)
    .map(neutralizeOpinionText)
    .filter(Boolean);
  const actors = collectKeywordItems(rawText, ['기업', '투자자', '정부', '기관', '고객', '공급사', '플레이어'], 6)
    .map(neutralizeOpinionText)
    .filter(Boolean);
  return {
    thesis: thesisCandidates[0] ?? supporting[0] ?? '핵심 논점 요약',
    supportingPoints: supporting.slice(0, 5),
    counterPoints: counter.slice(0, 4),
    risks: risks.slice(0, 5),
    checkpoints: checkpoints.slice(0, 5),
    actors: actors.slice(0, 5),
    signals: signals.slice(0, 5),
    notes: thesisCandidates.slice(0, 4),
  };
}

function opinionFrameToSpec(
  frame: OpinionFrame,
  industryName: string,
  sourceType: InfographicSourceType,
  pattern: InfographicIndustryPattern,
): InfographicSpec {
  const spec = buildFallbackSpec(industryName, sourceType, pattern, 'semantic_fallback');
  spec.summary = frame.thesis;
  spec.zones = [
    {
      id: 'input',
      name: DEFAULT_ZONE_NAMES.input,
      items: [frame.thesis, ...frame.notes].filter(Boolean).slice(0, 4),
      visualKeywords: ['배경', '문제의식', '논점'],
    },
    {
      id: 'production',
      name: DEFAULT_ZONE_NAMES.production,
      items: [...frame.supportingPoints, ...frame.actors].filter(Boolean).slice(0, 6),
      visualKeywords: ['주장', '근거', '핵심 포인트'],
    },
    {
      id: 'distribution',
      name: DEFAULT_ZONE_NAMES.distribution,
      items: [...frame.counterPoints, ...frame.signals].filter(Boolean).slice(0, 6),
      visualKeywords: ['쟁점', '반론', '신호'],
    },
    {
      id: 'demand',
      name: DEFAULT_ZONE_NAMES.demand,
      items: [...frame.checkpoints, ...frame.risks].filter(Boolean).slice(0, 6),
      visualKeywords: ['시사점', '행동', '주의'],
    },
  ];
  spec.risks = frame.risks.slice(0, 5).map((v) => ({ title: v.slice(0, 22), description: v }));
  spec.notes = frame.notes.length > 0 ? frame.notes : [frame.thesis];
  spec.warnings = Array.from(new Set([...spec.warnings, 'opinion_frame_mapped']));
  spec.sourceMeta.zoneAliases = zoneAliasesByArticlePattern('opinion_editorial');
  return spec;
}

function buildSemanticFallbackSpec(
  industryName: string,
  sourceType: InfographicSourceType,
  pattern: InfographicIndustryPattern,
  articlePattern: InfographicArticlePattern,
  rawText: string,
): InfographicSpec {
  if (articlePattern === 'opinion_editorial' || articlePattern === 'market_commentary') {
    return opinionFrameToSpec(buildOpinionFrame(rawText), industryName, sourceType, pattern);
  }
  const spec = buildFallbackSpec(industryName, sourceType, pattern, 'semantic_fallback');
  const zoneKeywordMapByPattern: Record<InfographicIndustryPattern, Record<InfographicZoneId, string[]>> = {
    manufacturing: {
      input: ['원재료', '부품', '소재', '장비', '공급'],
      production: ['생산', '조립', '개발', '공정', '제조'],
      distribution: ['유통', '운영', '네트워크', '물류', '채널'],
      demand: ['수요', '고객', '출력', '적용', '성과'],
    },
    semiconductor_electronics: {
      input: ['웨이퍼', '소재', '장비', '설계', 'fabless'],
      production: ['파운드리', '패키징', '테스트', '수율', '공정'],
      distribution: ['공급망', '채널', '재고', '출하', '유통'],
      demand: ['서버', '모바일', '자동차', 'ai', '데이터센터'],
    },
    energy_resources: {
      input: ['원유', '가스', '자원', '발전 연료', '인프라'],
      production: ['발전', '정제', '생산', '설비', '가동'],
      distribution: ['송배전', '운송', '네트워크', '공급', '저장'],
      demand: ['산업', '가정', '전력 수요', '가격', '정책'],
    },
    software_platform: {
      input: ['데이터', '인프라', '정책', '계정', '자산'],
      production: ['개발', '도입', '통합', '구축', '플랫폼'],
      distribution: ['운영', '관제', '모니터링', '서비스', '자동화'],
      demand: ['고객', '기업', '효과', '활용', '생산성'],
    },
    cybersecurity_service: {
      input: ['데이터', '자산', '권한', '계정', '클라우드', '인프라', '사용자', '정책'],
      production: ['도입', '구축', '솔루션', 'mfa', 'rbac', 'abac', 'edr', 'cnapp', 'cspm', 'ciem'],
      distribution: ['운영', '관제', '모니터링', '탐지', '대응', '자동화', '복구', '훈련'],
      demand: ['기업', '공공', '금융', '헬스케어', '제조', '고객', '보호', '효과'],
    },
    healthcare_bio: {
      input: ['임상 데이터', '연구 자산', '원료', '규제', '인력'],
      production: ['개발', '임상', '생산', '품질', '허가'],
      distribution: ['공급', '유통', '운영', '병원', '채널'],
      demand: ['환자', '의료기관', '보험', '치료 성과', '시장'],
    },
    consumer_retail: {
      input: ['소비 데이터', '브랜드', '상품', '물류', '채널'],
      production: ['기획', '조달', '운영', '마케팅', '재고'],
      distribution: ['온라인', '오프라인', '배송', '유통망', '광고'],
      demand: ['소비자', '재구매', '매출', '점유율', '트렌드'],
    },
    finance_insurance: {
      input: ['금리', '유동성', '규제', '고객 데이터', '리스크 요인'],
      production: ['상품 설계', '심사', '운용', '언더라이팅', '모델'],
      distribution: ['채널', '플랫폼', '영업', '서비스', '고객 운영'],
      demand: ['투자자', '가입자', '수익성', '안정성', '신뢰'],
    },
    mobility_automotive: {
      input: ['배터리', '부품', '소재', '소프트웨어', '인프라'],
      production: ['설계', '조립', '생산', '테스트', '공급'],
      distribution: ['딜러', '플릿', '충전망', '서비스', '운영'],
      demand: ['개인', '기업', '모빌리티 서비스', '규제 대응', '비용'],
    },
    media_content: {
      input: ['콘텐츠 자산', '크리에이터', 'IP', '플랫폼', '데이터'],
      production: ['제작', '편성', '배포 준비', '기획', '투자'],
      distribution: ['스트리밍', '광고', '유통', '플랫폼 운영', '커뮤니티'],
      demand: ['시청자', '광고주', '구독자', '참여도', '매출'],
    },
    industrials_b2b: {
      input: ['설비', '자재', '공급사', '수주', '프로젝트'],
      production: ['설계', '제조', '설치', '운영 준비', '품질'],
      distribution: ['납품', '서비스', '유지보수', '네트워크', '고객 지원'],
      demand: ['B2B 고객', '프로젝트 성과', '원가', '가동률', '계약'],
    },
    mixed_or_unknown: {
      input: ['기반 요소', '입력', '데이터', '자원', '공급'],
      production: ['핵심 구성', '개발', '구축', '운영 준비', '통합'],
      distribution: ['운영', '유통', '채널', '서비스', '네트워크'],
      demand: ['고객', '적용', '효과', '리스크', '시사점'],
    },
  };
  const zoneKeywordMap = zoneKeywordMapByPattern[pattern] ?? zoneKeywordMapByPattern.mixed_or_unknown;
  spec.zones = spec.zones.map((zone) => ({
    ...zone,
    items: collectKeywordItems(rawText, zoneKeywordMap[zone.id], 6),
    visualKeywords: zoneKeywordMap[zone.id].slice(0, 4),
  }));
  const riskItems = collectKeywordItems(
    rawText,
    ['위협', '리스크', '랜섬', '피싱', '오류', '침해', '노출', '보안', '취약', '위험'],
    6,
  );
  spec.risks = riskItems.slice(0, 5).map((line) => ({
    title: line.slice(0, 24),
    description: line,
  }));
  const notes = collectKeywordItems(
    rawText,
    ['조사', '설문', '대응', '도입', '운영', '전략', '방향', '현황', '핵심'],
    6,
  );
  spec.notes = notes.slice(0, 4);
  const numeric = extractNumericEvidence(rawText);
  if (numeric.length > 0) {
    spec.charts.bar = numeric.slice(0, 6).map((v) => ({ label: v.label, value: v.value }));
    spec.charts.pie = numeric
      .filter((v) => v.value >= 0 && v.value <= 100)
      .slice(0, 5)
      .map((v) => ({ label: v.label, value: v.value }));
    spec.comparisons = numeric.slice(0, 4).map<InfographicComparison>((v) => ({
      label: v.label,
      value: v.value,
      note: '원문 수치 근거',
    }));
  }
  spec.summary = notes[0] ?? `원문 기반 ${industryName} 구조 핵심을 요약했습니다.`;
  spec.warnings = Array.from(new Set([...spec.warnings, 'semantic_fallback_used']));
  spec.sourceMeta.extractedFromText = true;
  spec.sourceMeta.zoneAliases = {
    ...zoneAliasesByPattern(pattern),
    ...zoneAliasesByArticlePattern(articlePattern),
  };
  return spec;
}

function computeSpecQuality(spec: InfographicSpec, rawText: string): SpecQuality {
  const filledZoneCount = spec.zones.filter((z) => z.items.length >= 2).length;
  const riskCount = spec.risks.length;
  const comparisonCount = spec.comparisons.length;
  const chartCount = spec.charts.bar.length + spec.charts.pie.length + spec.charts.line.length;
  const numericEvidenceCount = extractNumericEvidence(rawText).length;
  const notesCount = spec.notes.length;
  const claimsCount = spec.zones[1]?.items?.length ?? 0;
  const signalsCount = spec.zones[2]?.items?.length ?? 0;
  const summaryReady = Boolean(spec.summary?.trim());
  const score =
    filledZoneCount * 20 +
    Math.min(riskCount, 5) * 6 +
    (comparisonCount > 0 ? 10 : 0) +
    (chartCount > 0 ? 12 : 0) +
    Math.min(notesCount, 4) * 4 +
    (summaryReady ? 8 : 0);
  const pass =
    filledZoneCount >= 3 &&
    riskCount >= 3 &&
    (comparisonCount > 0 || chartCount > 0) &&
    notesCount >= 2 &&
    summaryReady;
  return {
    filledZoneCount,
    riskCount,
    comparisonCount,
    chartCount,
    numericEvidenceCount,
    notesCount,
    claimsCount,
    signalsCount,
    summaryReady,
    score: Math.min(score, 100),
    pass,
  };
}

function classifyDegradedReasons(params: {
  quality: SpecQuality;
  rawText: string;
  articlePattern: InfographicArticlePattern;
}): InfographicDegradedReason[] {
  const reasons: InfographicDegradedReason[] = [];
  if (params.quality.filledZoneCount < 2) reasons.push('weak_zone_signal');
  if (params.quality.notesCount < 2) reasons.push('insufficient_structure');
  if (params.rawText.length > 12000) reasons.push('too_long_and_diffuse');
  if (params.quality.numericEvidenceCount < 2) reasons.push('weak_numeric_support');
  if (params.articlePattern === 'mixed_or_unknown') reasons.push('mixed_document');
  if (
    (params.articlePattern === 'opinion_editorial' || params.articlePattern === 'market_commentary') &&
    params.quality.claimsCount < 2
  ) {
    reasons.push('opinion_structure_unclear');
  }
  return Array.from(new Set(reasons.length > 0 ? reasons : ['insufficient_structure']));
}

function buildCompactSource(rawText: string): string {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const headingLike = lines.filter((line) => /^(\d+\.|[가-힣A-Za-z ]{2,30}:)/.test(line)).slice(0, 40);
  const top = lines.slice(0, 140);
  return Array.from(new Set([...headingLike, ...top])).join('\n').slice(0, 9000);
}

function applyQualityMeta(
  spec: InfographicSpec,
  quality: SpecQuality,
  mode: InfographicExtractionMode,
  stage: InfographicParseStage,
  pattern: InfographicIndustryPattern,
  articlePattern: InfographicArticlePattern,
  sourceTone: InfographicSourceTone,
  subjectivityLevel: InfographicSubjectivityLevel,
  structureDensity: InfographicStructureDensity,
  degradedReasons: InfographicDegradedReason[],
): InfographicSpec {
  return {
    ...spec,
    sourceMeta: {
      ...spec.sourceMeta,
      extractionMode: mode,
      parseStage: stage,
      industryPattern: pattern,
      articlePattern,
      resultMode: resultModeByArticlePattern(articlePattern),
      sourceTone,
      subjectivityLevel,
      structureDensity,
      specCompletenessScore: quality.score,
      filledZoneCount: quality.filledZoneCount,
      numericEvidenceCount: quality.numericEvidenceCount,
      riskCount: quality.riskCount,
      comparisonCount: quality.comparisonCount,
      chartCount: quality.chartCount,
      extractedClaimsCount: quality.claimsCount,
      extractedSignalsCount: quality.signalsCount,
      extractedRisksCount: quality.riskCount,
      degradedReasons,
      zoneAliases: spec.sourceMeta.zoneAliases ?? zoneAliasesByPattern(pattern),
    },
  };
}

export async function runInfographicExtraction(params: {
  geminiApiKey: string;
  industryName: string;
  rawText: string;
  sourceUrl?: string;
  sourceTitle?: string;
  extractionWarnings?: string[];
  articlePatternOverride?: string;
  industryPatternOverride?: string;
}): Promise<InfographicExtractResponseBody> {
  const sourceType = detectSourceType(params.rawText);
  const autoArticleMeta = classifyArticlePattern({
    rawText: params.rawText,
    sourceTitle: params.sourceTitle,
    sourceUrl: params.sourceUrl,
  });
  const resolvedArticlePattern = (params.articlePatternOverride as InfographicArticlePattern | undefined)
    ?? autoArticleMeta.articlePattern;
  const resolvedIndustryPattern = (params.industryPatternOverride as InfographicIndustryPattern | undefined)
    ?? detectIndustryPattern(params.industryName, params.rawText);
  const raw = await generateGeminiResearchReport({
    apiKey: params.geminiApiKey,
    systemInstruction: buildInfographicSystemPrompt(),
    userContent: buildInfographicUserPrompt({
      industryName: params.industryName,
      rawText: params.rawText,
      sourceType,
      industryPattern: resolvedIndustryPattern,
      articlePattern: resolvedArticlePattern,
      mode: 'normal',
      sourceUrl: params.sourceUrl,
      sourceTitle: params.sourceTitle,
    }),
  });
  const warnings: string[] = [...(params.extractionWarnings ?? [])];
  const firstParse = parseJsonPipeline(raw);
  let spec: InfographicSpec | null = null;
  let stage: InfographicParseStage = 'fallback';
  let mode: InfographicExtractionMode = 'degraded_fallback';
  if (firstParse.ok) {
    warnings.push(...firstParse.warnings);
    stage = firstParse.parseStage;
    mode = firstParse.repaired ? 'llm_repaired' : 'llm_direct';
    spec = toSpecOrFallback(firstParse.parsed, params.industryName, sourceType, resolvedIndustryPattern);
  } else {
    warnings.push(...firstParse.warnings, 'extractor_json_parse_failed');
  }
  if (spec) {
    const q1 = computeSpecQuality(spec, params.rawText);
    if (!q1.pass) {
      warnings.push('extractor_underfilled_spec_retry_compact');
      const compactRaw = await generateGeminiResearchReport({
        apiKey: params.geminiApiKey,
        systemInstruction: buildInfographicSystemPrompt(),
        userContent: buildInfographicUserPrompt({
          industryName: params.industryName,
          rawText: buildCompactSource(params.rawText),
          sourceType,
          industryPattern: resolvedIndustryPattern,
          articlePattern: resolvedArticlePattern,
          mode: 'compact',
          sourceUrl: params.sourceUrl,
          sourceTitle: params.sourceTitle,
        }),
      });
      const compactParse = parseJsonPipeline(compactRaw);
      if (compactParse.ok) {
        warnings.push(...compactParse.warnings, 'extractor_compact_retry_used');
        const compactSpec = toSpecOrFallback(compactParse.parsed, params.industryName, sourceType, resolvedIndustryPattern);
        const q2 = computeSpecQuality(compactSpec, params.rawText);
        if (q2.score >= q1.score) {
          spec = compactSpec;
          stage = compactParse.parseStage;
          mode = compactParse.repaired ? 'llm_repaired' : 'llm_direct';
        }
      } else {
        warnings.push(...compactParse.warnings, 'extractor_compact_retry_failed');
      }
    }
  }
  if (!spec) {
    spec = buildSemanticFallbackSpec(
      params.industryName,
      sourceType,
      resolvedIndustryPattern,
      resolvedArticlePattern,
      params.rawText,
    );
    mode = 'semantic_fallback';
    stage = 'fallback';
  }
  let quality = computeSpecQuality(spec, params.rawText);
  if (!quality.pass && mode !== 'semantic_fallback') {
    warnings.push('extractor_semantic_fallback_escalated');
    spec = buildSemanticFallbackSpec(
      params.industryName,
      sourceType,
      resolvedIndustryPattern,
      resolvedArticlePattern,
      params.rawText,
    );
    quality = computeSpecQuality(spec, params.rawText);
    mode = 'semantic_fallback';
    stage = 'fallback';
  }
  if (!quality.pass) {
    warnings.push('spec_degraded_fallback');
    const degraded = buildFallbackSpec(params.industryName, sourceType, resolvedIndustryPattern, 'degraded_fallback');
    degraded.warnings = Array.from(new Set([...degraded.warnings, ...warnings]));
    spec = degraded;
    quality = computeSpecQuality(spec, params.rawText);
    mode = 'degraded_fallback';
    stage = 'fallback';
  }
  const nextSpec = applyQualityMeta(
    {
      ...spec,
      warnings: Array.from(new Set([...(spec.warnings ?? []), ...warnings])),
      sourceMeta: {
        ...spec.sourceMeta,
        zoneAliases: {
          ...zoneAliasesByPattern(resolvedIndustryPattern),
          ...zoneAliasesByArticlePattern(resolvedArticlePattern),
          ...(spec.sourceMeta.zoneAliases ?? {}),
        },
        sourceUrl: params.sourceUrl,
        sourceTitle: params.sourceTitle,
        extractionWarnings: params.extractionWarnings ?? [],
        extractedTextLength: params.rawText.length,
      },
    },
    quality,
    mode,
    stage,
    resolvedIndustryPattern,
    resolvedArticlePattern,
    autoArticleMeta.sourceTone,
    autoArticleMeta.subjectivityLevel,
    autoArticleMeta.structureDensity,
    classifyDegradedReasons({
      quality,
      rawText: params.rawText,
      articlePattern: resolvedArticlePattern,
    }),
  );
  if (
    resolvedArticlePattern === 'opinion_editorial' ||
    resolvedArticlePattern === 'market_commentary'
  ) {
    nextSpec.warnings = Array.from(
      new Set([
        ...nextSpec.warnings,
        'opinion_style_neutralized',
      ]),
    );
  }
  return { ok: true, spec: nextSpec, warnings: nextSpec.warnings };
}

