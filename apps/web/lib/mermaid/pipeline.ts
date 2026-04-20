const DIAGRAM_DECLARATION =
  /^(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram-v2|journey|gantt)\b/i;
const NATURAL_LANGUAGE_LINE =
  /^(설명|예시|아래는|다음과 같습니다|요약|참고|note|explanation)\s*[:：]/i;
const CODE_FENCE_LINE = /^```(?:mermaid)?\s*$/i;
const EDGE_WITHOUT_TARGET = /-->\s*$/;
const DANGEROUS_QUOTE = /["'`]/g;
const WHITESPACE = /\s+/g;
const MAX_LABEL_LEN = 60;
const FLOWCHART_DIRECTIVE =
  /^(flowchart|graph|subgraph|end|classDef|class|style|linkStyle|click|%%)\b/i;
const GENERIC_KEEP_LINE =
  /^(sequenceDiagram|classDiagram|erDiagram|stateDiagram-v2|journey|gantt|autonumber|participant|actor|class|note|state|section|task|title|dateFormat|axisFormat|%%)\b/i;

const SAFE_FALLBACK = `flowchart TD
A[다이어그램 생성 실패] --> B[입력 확인 필요]`;

export type MermaidLogEvent =
  | 'MERMAID_EXTRACT_START'
  | 'MERMAID_EXTRACT_RESULT'
  | 'MERMAID_SANITIZE_APPLIED'
  | 'MERMAID_PARSE_OK'
  | 'MERMAID_PARSE_FAIL'
  | 'MERMAID_RENDER_OK'
  | 'MERMAID_RENDER_FAIL'
  | 'MERMAID_RENDER_FALLBACK';

export function sanitizeForLog(text: string, max = 180): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

export function logMermaidEvent(
  event: MermaidLogEvent,
  payload: Record<string, unknown>
): void {
  const logger =
    event === 'MERMAID_PARSE_FAIL' ||
    event === 'MERMAID_RENDER_FAIL' ||
    event === 'MERMAID_RENDER_FALLBACK'
    ? console.warn
    : console.info;
  logger(`[${event}]`, payload);
}

export function detectDiagramType(input: string): string {
  const first = input
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!first) return 'unknown';
  const m = first.match(
    /^(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram-v2|journey|gantt)\b/i
  );
  return m ? m[1] : 'unknown';
}

function cleanLabel(label: string): string {
  const normalized = label
    .replace(/\r?\n/g, ' ')
    .replace(DANGEROUS_QUOTE, '')
    .replace(/[;:{}[\]()]/g, ' ')
    .replace(/[:]{2,}/g, ':')
    .replace(WHITESPACE, ' ')
    .trim();
  if (!normalized) return '단계';
  return normalized.length > MAX_LABEL_LEN ? `${normalized.slice(0, MAX_LABEL_LEN)}...` : normalized;
}

function sanitizeFlowchartLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return '';
  if (CODE_FENCE_LINE.test(trimmed)) return '';
  if (NATURAL_LANGUAGE_LINE.test(trimmed)) return '';
  if (EDGE_WITHOUT_TARGET.test(trimmed)) return '';
  if (FLOWCHART_DIRECTIVE.test(trimmed)) return trimmed;

  return trimmed.replace(/\[([^\]]+)\]/g, (_full, label: string) => `[${cleanLabel(label)}]`);
}

function sanitizeGenericLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return '';
  if (CODE_FENCE_LINE.test(trimmed)) return '';
  if (NATURAL_LANGUAGE_LINE.test(trimmed)) return '';
  if (GENERIC_KEEP_LINE.test(trimmed)) return trimmed;
  return trimmed;
}

function stripCommonArtifacts(input: string): string {
  return (input ?? '')
    .replace(/```mermaid/gi, '')
    .replace(/```/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function isLikelyMermaidContinuation(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (CODE_FENCE_LINE.test(t)) return false;
  if (DIAGRAM_DECLARATION.test(t)) return true;
  if (FLOWCHART_DIRECTIVE.test(t)) return true;
  if (GENERIC_KEEP_LINE.test(t)) return true;
  if (t.includes('-->') || t.includes('---') || t.includes(':::') || t.includes('->>')) return true;
  if (/[A-Za-z_][A-Za-z0-9_]*\s*[\[\(\{]/.test(t)) return true;
  if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*$/.test(t)) return true;
  if (/^(설명|예시|아래는|다음과 같습니다|요약|참고|끝)\b/i.test(t)) return false;
  if (/^[가-힣\s.,!?]+$/.test(t)) return false;
  return true;
}

export function extractMermaid(raw: string, jsonMermaidCandidate?: string): string {
  const fromJson = (jsonMermaidCandidate ?? '').trim();
  if (fromJson) return fromJson;

  const source = (raw ?? '').trim();
  if (!source) return '';

  const mermaidFence = source.match(/```mermaid\s*([\s\S]*?)```/i);
  if (mermaidFence?.[1]) return mermaidFence[1].trim();

  const anyFence = source.match(/```[\w-]*\s*([\s\S]*?)```/);
  if (anyFence?.[1] && DIAGRAM_DECLARATION.test(anyFence[1].trim())) {
    return anyFence[1].trim();
  }

  const lines = source.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => DIAGRAM_DECLARATION.test(line.trim()));
  if (startIndex >= 0) {
    const collected: string[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      const current = lines[i];
      if (!isLikelyMermaidContinuation(current)) break;
      collected.push(current);
    }
    return collected.join('\n').trim();
  }

  return source;
}

export function sanitizeMermaid(input: string): string {
  const normalized = stripCommonArtifacts(input);
  const diagramType = detectDiagramType(normalized);
  const isFlowchart = diagramType === 'flowchart' || diagramType === 'graph' || diagramType === 'unknown';

  const lines = normalized
    .split('\n')
    .map((line) => (isFlowchart ? sanitizeFlowchartLine(line) : sanitizeGenericLine(line)))
    .filter((line) => line.length > 0);

  if (lines.length === 0) return SAFE_FALLBACK;

  const hasDeclaration = lines.some((line) => DIAGRAM_DECLARATION.test(line.trim()));
  const sanitized = hasDeclaration || !isFlowchart ? lines.join('\n') : `flowchart TD\n${lines.join('\n')}`;
  const compacted = sanitized.replace(/\n{3,}/g, '\n\n').trim();
  return compacted.length > 0 ? compacted : SAFE_FALLBACK;
}

