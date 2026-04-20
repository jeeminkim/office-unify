import { TaskType, DbType, SqlStyleOptions, DEFAULT_SQL_STYLE_OPTIONS } from './types';

const baseJsonRule = (taskType: TaskType) => `
[응답 포맷 강제]
- 반드시 JSON 객체만 반환하라.
- markdown 코드펜스(\`\`\`json 등)를 사용하지 마라.
- 설명 문장 없이 순수 JSON만 반환하라.
- 필드가 없으면 빈 문자열 또는 생략으로 처리하라.

반드시 다음 JSON 스키마를 준수하라:
{
  "taskType": "${taskType}",
  "title": "요약된 제목",
  "content": "핵심 내용 또는 코드",
  "explanation": "설명 내용",
  "mermaidCode": "mermaid 코드 (해당 시)",
  "example": "추가 예시 코드나 설명 (해당 시)",
  "warnings": ["주의사항 문자열 배열 (해당 시)"]
}`;

/** UI 체크박스 → LLM용 한 줄 힌트 */
export function formatSqlStyleHints(opts: SqlStyleOptions): string {
  const parts: string[] = [];
  if (opts.readabilityFirst) parts.push('가독성 우선(alias·들여쓰기·줄바꿈)');
  if (opts.performanceAware) parts.push('성능 고려(필터·조인 순서·인덱스 가정은 explanation에)');
  if (opts.preferCte) parts.push('복잡 조건 시 CTE(WITH) 사용 선호');
  return parts.length > 0 ? parts.join(' | ') : '(스타일 옵션 없음)';
}

/** localStorage에 저장된 `sqlStyleHints` 문자열 → 체크박스 상태 복원 */
export function parseSqlStyleHintsToOptions(hints: string | undefined): SqlStyleOptions {
  if (!hints?.trim()) return { ...DEFAULT_SQL_STYLE_OPTIONS };
  const h = hints;
  return {
    readabilityFirst: h.includes('가독성'),
    performanceAware: h.includes('성능'),
    preferCte: h.includes('CTE'),
  };
}

export type SchemaCoverage = 'empty' | 'weak' | 'adequate';

/**
 * schemaContext 품질을 단순 휴리스틱으로 구분 (LLM 메타 지시용)
 */
export function assessSchemaCoverage(schemaContext: string): SchemaCoverage {
  const s = schemaContext.trim();
  if (s.length === 0) return 'empty';

  const hasBracketSection = /\[목적\]|\[테이블\]|\[관계\]|\[조건\]|\[원하는 결과\]/i.test(s);
  const looksLikeTables = /\([^)]*\w+[^)]*\)/.test(s) && /[,=]/.test(s);

  if (hasBracketSection && s.length >= 100) return 'adequate';
  if (hasBracketSection && s.length >= 50) return 'weak';
  if (looksLikeTables && s.length >= 80) return 'adequate';
  if (s.length >= 120) return 'weak';
  return 'weak';
}

function schemaCoverageLabel(c: SchemaCoverage): string {
  switch (c) {
    case 'empty':
      return 'EMPTY — 스키마 미제공. 존재하지 않는 테이블/컬럼을 만들지 말고, 반드시 가정을 warnings에 적어라.';
    case 'weak':
      return 'WEAK — 정보가 부족할 수 있음. 조인 키가 불명확하면 warnings에 명시하고, 가정은 warnings에 남겨라.';
    case 'adequate':
      return 'ADEQUATE — [SCHEMA]에 명시된 테이블·컬럼만 사용하고, 없는 객체를 추정해 넣지 마라.';
  }
}

const dialectRules: Record<DbType, string> = {
  postgresql:
    'PostgreSQL: 표준 SQL + LIMIT/OFFSET, RETURNING, ::cast, 문자열은 단일인용부호, 날짜는 적절한 캐스팅.',
  mysql:
    'MySQL: LIMIT offset,count, 백틱으로 식별자 이스케이프(필요 시), 문자열 리터럴, 버전별 함수 차이는 explanation에 언급.',
  oracle:
    'Oracle: ROWNUM/ROW_NUMBER/FETCH FIRST, 날짜는 TO_DATE 등, 듀얼 테이블, (+) 조인은 가급적 표준 조인으로, 식별자 대소문자 규칙 주의.',
};

/**
 * SQL 사용자 메시지: DB·스키마 상태·스타일·요청을 분리한다.
 */
export function buildSqlUserPrompt(
  prompt: string,
  dbType: DbType,
  schemaContext: string,
  sqlStyleHints?: string
): string {
  const coverage = assessSchemaCoverage(schemaContext);
  const schemaBlock =
    schemaContext.trim().length > 0
      ? schemaContext.trim()
      : '(스키마 블록이 비어 있음 — 요청만으로 작성하되 가정은 warnings에)';

  const styleLine =
    typeof sqlStyleHints === 'string' && sqlStyleHints.trim().length > 0
      ? sqlStyleHints.trim()
      : '기본 스타일(가독성·명시적 조인)';

  return `[SCHEMA 입력 상태]
${schemaCoverageLabel(coverage)}

[SQL STYLE PREFERENCES]
${styleLine}

[DB TYPE]
${dbType}

[DIALECT HINT]
${dialectRules[dbType]}

[SCHEMA]
${schemaBlock}

[REQUEST]
${prompt.trim()}`;
}

export const getSystemPrompt = (taskType: TaskType): string => {
  switch (taskType) {
    case 'flow':
      return `당신은 업무 프로세스 설계자다. 사용자의 요청을 분석하여 시스템 흐름도를 작성하라.

[content — 프로세스 요약]
- 핵심 흐름을 3~8줄로 요약하라.
- 각 단계 앞에 번호를 붙여라 (예: 1. … 2. … 3. …).
- 실패·예외·재시도·대체 경로(타임아웃, 검증 실패, 권한 거부 등)가 있으면 요약에 반드시 포함하라.

[explanation — 상세]
- "프로세스 요약" 소제목 아래에 위 요약과 동일한 관점의 한 단락 요약을 먼저 쓴 뒤, 그 아래에 단계별 상세 설명을 이어가라.
- 정상 흐름과 예외/실패 흐름을 구분해 서술하라 (분기 조건, 롤백, 알림, 대체 처리).

[mermaidCode]
- Mermaid 본문만 작성하고, Mermaid 외 텍스트는 절대 금지한다.
- 코드펜스(\`\`\`)를 절대 포함하지 마라.
- 첫 줄은 반드시 flowchart TD 로 시작하라.
- 설명문/번호 목록/부연 텍스트를 Mermaid 본문에 섞지 마라.
- 연결문은 반드시 A --> B 형태만 사용하라.
- 노드 ID는 영문/숫자/언더스코어만 사용하라 (예: STEP_1, AUTH_CHECK).
- 사용자에게 보이는 한글은 라벨([ ... ])에서만 사용하고 짧게 유지하라.
- 라벨에서는 괄호/대괄호/중괄호/세미콜론/쌍따옴표/개행을 제거 또는 안전 문자로 치환하라.
- subgraph를 쓰면 반드시 end를 닫아라.
- 아래 안전 예시 패턴을 준수하라.

유효한 Mermaid 예시:
flowchart TD
STEP_1[사용자 로그인 요청] --> STEP_2[인증 정보 확인]
STEP_2 --> STEP_3[사용자 조회]
STEP_3 --> STEP_4[로그인 결과 반환]

${baseJsonRule(taskType)}`;

    case 'sql':
      return `You are a senior SQL expert. Follow the user's labeled sections exactly.

Output contract (strict):
- Put ONLY executable SQL in "content". No prose, no markdown fences inside "content".
- Put design intent, assumptions, ambiguity notes, and performance considerations ONLY in "explanation".
- Use "warnings" for: missing join keys, guessed columns, schema gaps, dialect caveats, and ANY assumption not explicitly in [SCHEMA].

Grounding rules:
- Do NOT invent tables or columns that are not present in [SCHEMA] or clearly implied by the request. If you must assume, state the assumption in "warnings".
- If join keys are unclear from [SCHEMA], say so in "warnings" and choose the safest join strategy you can justify in "explanation".
- Classify the request mentally: aggregation vs detail list vs existence check — reflect that in SQL shape (GROUP BY vs selective columns vs EXISTS).

Dialect:
- Honor [DB TYPE] and [DIALECT HINT]. Apply PostgreSQL / MySQL / Oracle syntax differences strictly.

Style:
- Use consistent, short table aliases (e.g. c for customer).
- Prefer readability; for many predicates or steps, CTEs (WITH) are allowed.
- If [SCHEMA 입력 상태] is EMPTY or WEAK, you MUST include at least one warning about incomplete schema or assumptions.

JSON fields reminder:
- "content" = SQL only.
- "explanation" = 의도·주의·성능·문맥(집계/상세/존재 여부 등).
- "warnings" = 가정·불명확 조인·누락 정보.

${baseJsonRule(taskType)}`;

    case 'ts':
      return `당신은 시니어 프론트엔드/백엔드 개발자다. 사용자의 요청에 맞는 TypeScript 코드를 작성하라.
- 실행 가능하고 타입이 명확히 정의된 함수 또는 클래스 단위의 코드를 "content" 필드에 작성하라.
- 에러 처리와 안정성을 고려하라.
- 사용 예시를 "example" 필드에 작성하라.
${baseJsonRule(taskType)}`;
  }
};
