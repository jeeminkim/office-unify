import { GenerateResponse } from './types';

export class ApiError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export function logDevError(message: string, ...optionalParams: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(message, ...optionalParams);
  }
}

/** 파일명에 쓸 수 없는 문자 제거·길이 제한 */
export function sanitizeFilename(name: string, maxLen = 80): string {
  const trimmed = name.trim().replace(/[\/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
  if (trimmed.length <= maxLen) return trimmed || 'export';
  return trimmed.slice(0, maxLen);
}

export function formatResultAsMarkdown(result: GenerateResponse): string {
  let md = `# dev_support\n\n`;
  if (result.title) md += `## ${result.title}\n\n`;
  md += `- Task Type: ${result.taskType}\n`;
  if (result.provider) md += `- Provider: ${result.provider}\n`;
  md += `\n---\n\n`;

  if (result.warnings && result.warnings.length > 0) {
    md += `### ⚠️ 주의사항\n`;
    result.warnings.forEach((w) => (md += `- ${w}\n`));
    md += `\n`;
  }

  if (result.taskType === 'flow') {
    if (result.mermaidCode) {
      md += `### 프로세스 시각화 (Mermaid)\n\`\`\`mermaid\n${result.mermaidCode}\n\`\`\`\n\n`;
    }
    if (result.content) {
      md += `### 프로세스 요약\n${result.content}\n\n`;
    }
    if (result.explanation) {
      md += `### 상세 설명\n${result.explanation}\n\n`;
    }
  } else {
    if (result.explanation) {
      md += `### Explanation\n${result.explanation}\n\n`;
    }
    if (result.content) {
      md += `### ${result.taskType === 'sql' ? 'SQL' : 'TypeScript'}\n\`\`\`${result.taskType === 'sql' ? 'sql' : 'typescript'}\n${result.content}\n\`\`\`\n\n`;
    }
    if (result.example) {
      md += `### Usage Example\n\`\`\`${result.taskType === 'sql' ? 'sql' : 'typescript'}\n${result.example}\n\`\`\`\n\n`;
    }
  }

  return md;
}

/** Flow 전용 TXT 본문 (섹션 없으면 생략) */
export function buildFlowTextExport(result: GenerateResponse): string {
  const lines: string[] = [];
  lines.push(`제목: ${result.title ?? '(제목 없음)'}`);
  lines.push('작업유형: flow');
  lines.push('');

  if (result.content?.trim()) {
    lines.push('[프로세스 요약]');
    lines.push(result.content);
    lines.push('');
  }

  if (result.explanation?.trim()) {
    lines.push('[상세 설명]');
    lines.push(result.explanation);
    lines.push('');
  }

  if (result.mermaidCode?.trim()) {
    lines.push('[Mermaid Code]');
    lines.push(result.mermaidCode);
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function downloadTextFile(
  filename: string,
  text: string,
  mimeType: string = 'text/plain;charset=utf-8'
) {
  if (typeof window === 'undefined') return;
  const element = document.createElement('a');
  const file = new Blob([text], { type: mimeType });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  URL.revokeObjectURL(element.href);
}

/** 렌더된 Mermaid SVG → PNG 다운로드 (클라이언트 전용) */
export async function downloadSvgAsPng(
  svgElement: SVGSVGElement,
  filename: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const rect = svgElement.getBoundingClientRect();
  const w = Math.max(1, Math.ceil(rect.width || svgElement.clientWidth));
  const h = Math.max(1, Math.ceil(rect.height || svgElement.clientHeight));

  if (!clone.getAttribute('width')) clone.setAttribute('width', String(w));
  if (!clone.getAttribute('height')) clone.setAttribute('height', String(h));

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG를 이미지로 불러오지 못했습니다.'));
      img.src = url;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas를 사용할 수 없습니다.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);

    await new Promise<void>((resolve, reject) => {
      canvas.toBlob(
        (pngBlob) => {
          if (!pngBlob) {
            reject(new Error('PNG 변환에 실패했습니다.'));
            return;
          }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(pngBlob);
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(a.href);
          resolve();
        },
        'image/png',
        0.92
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadTextFileMarkdown(filename: string, text: string) {
  downloadTextFile(filename, text, 'text/markdown;charset=utf-8');
}

/**
 * TypeScript 결과에서 첫 번째 함수 선언 블록만 추출 (복사용).
 * 패턴이 없으면 전체 문자열을 반환한다.
 */
export function extractFirstTsFunction(source: string): string {
  const s = source.trim();
  if (!s) return s;

  const decl =
    /(?:^|\n)((?:export\s+)?(?:async\s+)?function\s+\w+\s*[<(])/.exec(s);
  if (!decl || decl[1] === undefined) return s;

  const from = decl.index + (decl[0].startsWith('\n') ? 1 : 0);
  const brace = s.indexOf('{', from);
  if (brace === -1) return s;

  let depth = 0;
  for (let i = brace; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(from, i + 1);
    }
  }
  return s;
}
