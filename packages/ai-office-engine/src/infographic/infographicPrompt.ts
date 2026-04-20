import type { InfographicSourceType } from '@office-unify/shared-types';

export function buildInfographicSystemPrompt(): string {
  return `당신은 산업 분석 원문을 인포그래픽 스펙(JSON)으로 정제하는 엔진이다.

[출력 규칙]
- 반드시 JSON 객체만 출력한다.
- 코드펜스, 설명문, 마크다운, 주석 금지.
- 불확실하면 추정하지 말고 null/unknown/빈 배열을 사용한다.
- 숫자 데이터가 없으면 지어내지 말고 value=null 또는 빈 배열로 둔다.
- 투자 추천, 매수/매도 조언 문구 금지.
- 목적은 투자 판단이 아니라 산업 구조 정보 정제다.
- zones는 4개(id: input, production, distribution, demand) 고정이지만 산업 특성에 맞게 해석한다.
- 제조업형 해석:
  - input=원재료/부품/장비
  - production=생산/조립/개발
  - distribution=유통/운용/네트워크
  - demand=최종 수요/출력
- 소프트웨어/클라우드/보안형 해석:
  - input=입력/기반요소(데이터, 정책, 자산, 인력, 인프라)
  - production=구축/도입(솔루션, 통합, 설계, 권한체계)
  - distribution=운영/관제/대응(모니터링, 탐지, 자동화, 대응)
  - demand=최종 수요/효과(적용 산업, 보호 대상, 성과)

[필수 스키마]
{
  "title": "string",
  "subtitle": "string",
  "industry": "string",
  "summary": "string",
  "zones": [
    { "id":"input","name":"원재료·입력","items":["..."],"visualKeywords":["..."] },
    { "id":"production","name":"생산·조립","items":["..."],"visualKeywords":["..."] },
    { "id":"distribution","name":"유통·운용·네트워크","items":["..."],"visualKeywords":["..."] },
    { "id":"demand","name":"최종 수요·출력","items":["..."],"visualKeywords":["..."] }
  ],
  "flows": [
    { "from":"input","to":"production","type":"goods|data|capital|service|energy|unknown","label":"string" }
  ],
  "lineup": [{ "name":"string","category":"string","note":"string" }],
  "comparisons": [{ "label":"string","value": number | string | null, "note":"string" }],
  "risks": [{ "title":"string","description":"string" }],
  "charts": {
    "bar": [{ "label":"string","value": number | null }],
    "pie": [{ "label":"string","value": number | null }],
    "line": [{ "label":"string","value": number | null }]
  },
  "notes": ["string"],
  "warnings": ["string"],
  "sourceMeta": {
    "sourceType":"blog|securities_report|pasted_text|text|url|pdf_upload|pdf_url|unknown",
    "generatedAt":"ISO datetime string",
    "confidence":"low|medium|high"
  }
}`;
}

export function buildInfographicUserPrompt(params: {
  industryName: string;
  rawText: string;
  sourceType: InfographicSourceType;
  industryPattern?: string;
  articlePattern?: string;
  mode?: 'normal' | 'compact';
  sourceUrl?: string;
  sourceTitle?: string;
}): string {
  return `[입력]
industryName: ${params.industryName}
sourceType: ${params.sourceType}
industryPatternHint: ${params.industryPattern ?? 'unknown'}
articlePatternHint: ${params.articlePattern ?? 'mixed_or_unknown'}
extractMode: ${params.mode ?? 'normal'}
sourceUrl: ${params.sourceUrl ?? 'unknown'}
sourceTitle: ${params.sourceTitle ?? 'unknown'}

[원문]
${params.rawText}

[지시]
- 위 원문을 근거로 산업 인포그래픽용 JSON 스펙을 생성하라.
- zones는 반드시 4개 고정(id: input, production, distribution, demand).
- zone name은 기존 템플릿 이름을 유지하되, 필요하면 sourceMeta.zoneAliases에 도메인 맞춤 별칭을 넣어라.
- articlePattern이 opinion_editorial 또는 market_commentary이면 논점 구조(thesis/support/counter/checkpoint)를 우선 추출한 뒤 4-zone으로 매핑하라.
- 수치가 없으면 chart value를 null로 두고 warnings에 이유를 남겨라.
- 모호한 항목은 unknown 또는 빈 배열 허용.
- 한국어 기준으로 title/subtitle/summary/notes를 작성하라.`;
}

