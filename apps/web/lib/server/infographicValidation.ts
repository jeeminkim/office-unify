import type {
  InfographicArticlePattern,
  InfographicCharts,
  InfographicExtractRequestBody,
  InfographicFlow,
  InfographicInputSourceType,
  InfographicIndustryPattern,
  InfographicRisk,
  InfographicSpec,
  InfographicZone,
  InfographicZoneId,
} from '@office-unify/shared-types';

const MAX_RAW_TEXT = 22000;
const REQUIRED_ZONE_ORDER: InfographicZoneId[] = ['input', 'production', 'distribution', 'demand'];
const INPUT_SOURCE_TYPES: InfographicInputSourceType[] = ['text', 'url', 'pdf_upload', 'pdf_url'];
const ARTICLE_PATTERNS: InfographicArticlePattern[] = [
  'industry_report',
  'company_report',
  'opinion_editorial',
  'market_commentary',
  'thematic_analysis',
  'how_to_explainer',
  'mixed_or_unknown',
];
const INDUSTRY_PATTERNS: InfographicIndustryPattern[] = [
  'manufacturing',
  'semiconductor_electronics',
  'energy_resources',
  'healthcare_bio',
  'software_platform',
  'cybersecurity_service',
  'consumer_retail',
  'finance_insurance',
  'mobility_automotive',
  'media_content',
  'industrials_b2b',
  'mixed_or_unknown',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseInfographicExtractRequest(input: unknown):
  | { ok: true; value: InfographicExtractRequestBody }
  | { ok: false; errors: string[] } {
  if (!isRecord(input)) return { ok: false, errors: ['invalid_body'] };
  const industryName = typeof input.industryName === 'string' ? input.industryName.trim() : '';
  const sourceType = typeof input.sourceType === 'string' ? (input.sourceType.trim() as InfographicInputSourceType) : 'text';
  const rawText = typeof input.rawText === 'string' ? input.rawText.trim() : '';
  const sourceUrl = typeof input.sourceUrl === 'string' ? input.sourceUrl.trim() : undefined;
  const pdfUrl = typeof input.pdfUrl === 'string' ? input.pdfUrl.trim() : undefined;
  const articlePatternOverride =
    typeof input.articlePatternOverride === 'string' ? input.articlePatternOverride.trim() : undefined;
  const industryPatternOverride =
    typeof input.industryPatternOverride === 'string' ? input.industryPatternOverride.trim() : undefined;
  const errors: string[] = [];
  if (!industryName) errors.push('industryName_required');
  if (!INPUT_SOURCE_TYPES.includes(sourceType)) errors.push('sourceType_invalid');
  if (sourceType === 'text' && !rawText) errors.push('rawText_required');
  if (sourceType === 'url' && !sourceUrl) errors.push('sourceUrl_required');
  if (sourceType === 'pdf_url' && !pdfUrl) errors.push('pdfUrl_required');
  if (articlePatternOverride && !ARTICLE_PATTERNS.includes(articlePatternOverride as InfographicArticlePattern)) {
    errors.push('articlePatternOverride_invalid');
  }
  if (industryPatternOverride && !INDUSTRY_PATTERNS.includes(industryPatternOverride as InfographicIndustryPattern)) {
    errors.push('industryPatternOverride_invalid');
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      industryName: industryName.slice(0, 100),
      sourceType,
      rawText: rawText.slice(0, MAX_RAW_TEXT),
      sourceUrl,
      pdfUrl,
      articlePatternOverride: articlePatternOverride as InfographicArticlePattern | undefined,
      industryPatternOverride: industryPatternOverride as InfographicIndustryPattern | undefined,
    },
  };
}

function normalizeZoneArray(raw: unknown, warnings: string[]): InfographicZone[] {
  const fallback = REQUIRED_ZONE_ORDER.map((id) => ({
    id,
    name:
      id === 'input'
        ? '원재료·입력'
        : id === 'production'
          ? '생산·조립'
          : id === 'distribution'
            ? '유통·운용·네트워크'
            : '최종 수요·출력',
    items: [],
    visualKeywords: [],
  }));
  if (!Array.isArray(raw)) {
    warnings.push('zones_fallback_used');
    return fallback;
  }
  const mapped = raw
    .filter((z): z is Record<string, unknown> => isRecord(z))
    .map((z) => ({
      id: (String(z.id ?? '').trim() as InfographicZoneId) || 'input',
      name: String(z.name ?? '').trim(),
      items: Array.isArray(z.items) ? z.items.map(String).map((v) => v.trim()).filter(Boolean) : [],
      visualKeywords: Array.isArray(z.visualKeywords)
        ? z.visualKeywords.map(String).map((v) => v.trim()).filter(Boolean)
        : [],
    }));
  const byId = new Map(mapped.map((z) => [z.id, z]));
  return fallback.map((z) => ({
    ...z,
    ...(byId.get(z.id) ?? {}),
    id: z.id,
    name: (byId.get(z.id)?.name ?? z.name) || z.name,
  }));
}

function normalizeFlows(raw: unknown): InfographicFlow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => isRecord(f))
    .map((f) => ({
      from: String(f.from ?? 'input') as InfographicZoneId,
      to: String(f.to ?? 'production') as InfographicZoneId,
      type: (String(f.type ?? 'unknown') as InfographicFlow['type']) || 'unknown',
      label: String(f.label ?? '').trim(),
    }))
    .filter((f) => REQUIRED_ZONE_ORDER.includes(f.from) && REQUIRED_ZONE_ORDER.includes(f.to));
}

function normalizeChartRows(raw: unknown): { label: string; value: number | null }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => isRecord(r))
    .map((r) => {
      const n = Number(r.value);
      return {
        label: String(r.label ?? '').trim(),
        value: Number.isFinite(n) ? n : null,
      };
    })
    .filter((r) => r.label.length > 0);
}

function normalizeCharts(raw: unknown, warnings: string[]): InfographicCharts {
  if (!isRecord(raw)) {
    warnings.push('charts_fallback_used');
    return { bar: [], pie: [], line: [] };
  }
  return {
    bar: normalizeChartRows(raw.bar),
    pie: normalizeChartRows(raw.pie),
    line: normalizeChartRows(raw.line),
  };
}

export function normalizeInfographicSpec(spec: InfographicSpec, industryName: string): InfographicSpec {
  const warnings = Array.isArray(spec.warnings) ? [...spec.warnings.map(String)] : [];
  const zones = normalizeZoneArray(spec.zones, warnings);
  const flows = normalizeFlows(spec.flows);
  const charts = normalizeCharts(spec.charts, warnings);
  const risks: InfographicRisk[] = Array.isArray(spec.risks)
    ? spec.risks
        .map((r) => ({ title: String(r.title ?? '').trim(), description: String(r.description ?? '').trim() }))
        .filter((r) => r.title || r.description)
    : [];
  if (charts.bar.length === 0 && charts.pie.length === 0 && charts.line.length === 0) {
    warnings.push('chart_values_missing_or_unknown');
  }
  return {
    ...spec,
    title: spec.title?.trim() || `${industryName} 산업 인포그래픽`,
    subtitle: spec.subtitle?.trim() || '원문 정제 기반 산업 구조 요약',
    industry: spec.industry?.trim() || industryName,
    summary: spec.summary?.trim() || '원문에서 확인된 산업 구조 포인트를 정리했습니다.',
    zones,
    flows,
    lineup: Array.isArray(spec.lineup)
      ? spec.lineup.map((l) => ({
          name: String(l.name ?? '').trim(),
          category: String(l.category ?? '').trim(),
          note: String(l.note ?? '').trim(),
        })).filter((l) => l.name)
      : [],
    comparisons: Array.isArray(spec.comparisons)
      ? spec.comparisons.map((c) => ({
          label: String(c.label ?? '').trim(),
          value:
            typeof c.value === 'number' || typeof c.value === 'string' || c.value === null
              ? c.value
              : null,
          note: String(c.note ?? '').trim(),
        })).filter((c) => c.label)
      : [],
    risks,
    charts,
    notes: Array.isArray(spec.notes) ? spec.notes.map(String).map((v) => v.trim()).filter(Boolean) : [],
    warnings,
    sourceMeta: {
      sourceType: spec.sourceMeta?.sourceType ?? 'unknown',
      generatedAt: spec.sourceMeta?.generatedAt ?? new Date().toISOString(),
      confidence: spec.sourceMeta?.confidence ?? 'low',
      industryPattern: spec.sourceMeta?.industryPattern,
      extractionMode: spec.sourceMeta?.extractionMode,
      parseStage: spec.sourceMeta?.parseStage,
      resultMode: spec.sourceMeta?.resultMode,
      articlePattern: spec.sourceMeta?.articlePattern,
      sourceTone: spec.sourceMeta?.sourceTone,
      subjectivityLevel: spec.sourceMeta?.subjectivityLevel,
      structureDensity: spec.sourceMeta?.structureDensity,
      specCompletenessScore:
        typeof spec.sourceMeta?.specCompletenessScore === 'number'
          ? spec.sourceMeta.specCompletenessScore
          : undefined,
      filledZoneCount:
        typeof spec.sourceMeta?.filledZoneCount === 'number'
          ? spec.sourceMeta.filledZoneCount
          : undefined,
      numericEvidenceCount:
        typeof spec.sourceMeta?.numericEvidenceCount === 'number'
          ? spec.sourceMeta.numericEvidenceCount
          : undefined,
      riskCount:
        typeof spec.sourceMeta?.riskCount === 'number'
          ? spec.sourceMeta.riskCount
          : undefined,
      comparisonCount:
        typeof spec.sourceMeta?.comparisonCount === 'number'
          ? spec.sourceMeta.comparisonCount
          : undefined,
      chartCount:
        typeof spec.sourceMeta?.chartCount === 'number'
          ? spec.sourceMeta.chartCount
          : undefined,
      extractedFromText:
        typeof spec.sourceMeta?.extractedFromText === 'boolean'
          ? spec.sourceMeta.extractedFromText
          : undefined,
      extractedClaimsCount:
        typeof spec.sourceMeta?.extractedClaimsCount === 'number'
          ? spec.sourceMeta.extractedClaimsCount
          : undefined,
      extractedSignalsCount:
        typeof spec.sourceMeta?.extractedSignalsCount === 'number'
          ? spec.sourceMeta.extractedSignalsCount
          : undefined,
      extractedRisksCount:
        typeof spec.sourceMeta?.extractedRisksCount === 'number'
          ? spec.sourceMeta.extractedRisksCount
          : undefined,
      degradedReasons: Array.isArray(spec.sourceMeta?.degradedReasons)
        ? spec.sourceMeta?.degradedReasons.map(String) as InfographicSpec['sourceMeta']['degradedReasons']
        : [],
      zoneAliases: spec.sourceMeta?.zoneAliases,
      sourceUrl: spec.sourceMeta?.sourceUrl,
      sourceTitle: spec.sourceMeta?.sourceTitle,
      extractionWarnings: Array.isArray(spec.sourceMeta?.extractionWarnings)
        ? spec.sourceMeta?.extractionWarnings.map(String)
        : [],
      extractedTextLength:
        typeof spec.sourceMeta?.extractedTextLength === 'number'
          ? spec.sourceMeta.extractedTextLength
          : undefined,
    },
  };
}

export function validateInfographicSpec(spec: InfographicSpec): string[] {
  const errors: string[] = [];
  if (!spec.title?.trim()) errors.push('title_required');
  if (!spec.industry?.trim()) errors.push('industry_required');
  if (!Array.isArray(spec.zones) || spec.zones.length !== 4) errors.push('zones_must_be_4');
  const zoneIds = new Set(spec.zones.map((z) => z.id));
  for (const id of REQUIRED_ZONE_ORDER) {
    if (!zoneIds.has(id)) errors.push(`zone_missing:${id}`);
  }
  if (!spec.sourceMeta?.generatedAt) errors.push('sourceMeta_generatedAt_required');
  return errors;
}

