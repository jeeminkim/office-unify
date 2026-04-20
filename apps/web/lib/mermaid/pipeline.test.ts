import { describe, expect, it } from 'vitest';
import { extractMermaid, sanitizeMermaid } from './pipeline';
import { MERMAID_SANITIZE_FIXTURES } from './fixtures';

describe('mermaid pipeline', () => {
  it('keeps fixture-driven sanitize expectations', () => {
    for (const fixture of MERMAID_SANITIZE_FIXTURES) {
      const target =
        fixture.name.includes('혼합 장문') || fixture.name.includes('SQL TS Flow')
          ? sanitizeMermaid(extractMermaid(fixture.input))
          : sanitizeMermaid(fixture.input);
      for (const token of fixture.expectedContains) {
        expect(target).toContain(token);
      }
    }
  });

  it('keeps normal flowchart after sanitize', () => {
    const input = `flowchart TD
A[시작] --> B[검증]
B --> C[완료]`;
    const sanitized = sanitizeMermaid(input);
    expect(sanitized).toContain('flowchart TD');
    expect(sanitized).toContain('A[시작] --> B[검증]');
    expect(sanitized).toContain('B --> C[완료]');
  });

  it('removes markdown mermaid code fence', () => {
    const input = `\`\`\`mermaid
flowchart TD
A --> B
\`\`\``;
    const sanitized = sanitizeMermaid(input);
    expect(sanitized).toContain('flowchart TD');
    expect(sanitized).not.toContain('```');
  });

  it('prepends flowchart TD when declaration is missing', () => {
    const input = `A[요청] --> B[처리]
B --> C[응답]`;
    const sanitized = sanitizeMermaid(input);
    expect(sanitized.startsWith('flowchart TD')).toBe(true);
  });

  it('removes natural language explanation lines', () => {
    const input = `설명: 로그인 단계입니다.
flowchart TD
USER[요청] --> AUTH[검증]
예시: 실패시 재시도`;
    const sanitized = sanitizeMermaid(input);
    expect(sanitized).toContain('USER[요청] --> AUTH[검증]');
    expect(sanitized).not.toContain('설명:');
    expect(sanitized).not.toContain('예시:');
  });

  it('removes broken arrow lines', () => {
    const input = `flowchart TD
A[시작] -->
B[종료]`;
    const sanitized = sanitizeMermaid(input);
    expect(sanitized).not.toContain('A[시작] -->');
    expect(sanitized).toContain('B[종료]');
  });

  it('maps empty input to safe fallback', () => {
    const sanitized = sanitizeMermaid('');
    expect(sanitized).toContain('flowchart TD');
    expect(sanitized).toContain('다이어그램 생성 실패');
  });

  it('extracts fenced mermaid block correctly', () => {
    const raw = `설명 텍스트
\`\`\`mermaid
flowchart TD
A --> B
\`\`\`
끝`;
    const extracted = extractMermaid(raw);
    expect(extracted).toBe(`flowchart TD
A --> B`);
  });

  it('extracts mermaid from mixed sql/ts/plain text response', () => {
    const raw = `SELECT * FROM users;
\`\`\`typescript
const a = 1;
\`\`\`
flowchart TD
S1[요청] --> S2[응답]
끝`;
    const extracted = extractMermaid(raw);
    expect(extracted).toContain('flowchart TD');
    expect(extracted).toContain('S1[요청] --> S2[응답]');
    expect(extracted).not.toContain('SELECT * FROM users;');
    expect(extracted).not.toContain('끝');
  });

  it('does not break valid subgraph/end syntax', () => {
    const input = `flowchart TD
subgraph AUTH
A[로그인 요청] --> B[검증]
end
B --> C[응답]`;
    const sanitized = sanitizeMermaid(input);
    expect(sanitized).toContain('subgraph AUTH');
    expect(sanitized).toContain('end');
    expect(sanitized).toContain('B --> C[응답]');
  });

  it('does not force non-flowchart declarations to flowchart TD', () => {
    const sequenceInput = `sequenceDiagram
autonumber
participant U as User
U->>S: Login`;
    const erInput = `erDiagram
USER ||--o{ ORDER : places`;
    const classInput = `classDiagram
class User`;

    expect(sanitizeMermaid(sequenceInput).startsWith('sequenceDiagram')).toBe(true);
    expect(sanitizeMermaid(erInput).startsWith('erDiagram')).toBe(true);
    expect(sanitizeMermaid(classInput).startsWith('classDiagram')).toBe(true);
  });
});

