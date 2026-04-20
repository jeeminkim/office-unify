export type MermaidFixture = {
  name: string;
  input: string;
  expectedContains: string[];
};

export const MERMAID_SANITIZE_FIXTURES: MermaidFixture[] = [
  {
    name: '정상 flowchart',
    input: `flowchart TD
A[시작] --> B[검증]
B --> C[완료]`,
    expectedContains: ['flowchart TD', 'A[시작] --> B[검증]'],
  },
  {
    name: '지원되지 않습니다 메시지',
    input: '다이어그램은 지원되지 않습니다.',
    expectedContains: ['flowchart TD'],
  },
  {
    name: '자연어 설명 혼합',
    input: `설명: 아래는 로그인 처리 흐름입니다.
flowchart TD
USER[사용자 요청] --> AUTH[인증 확인]
다음과 같습니다: 실패시 재시도`,
    expectedContains: ['flowchart TD', 'USER[사용자 요청] --> AUTH[인증 확인]'],
  },
  {
    name: '위험 문자가 많은 라벨',
    input: `flowchart TD
A["사용자(신규):가입;요청"] --> B["검증{필수}"]`,
    expectedContains: ['flowchart TD', 'A[사용자 신규 가입 요청] --> B[검증 필수]'],
  },
  {
    name: '끊긴 화살표',
    input: `flowchart TD
A[시작] -->
B[종료]`,
    expectedContains: ['flowchart TD', 'B[종료]'],
  },
  {
    name: '선언 누락',
    input: `A[요청] --> B[처리]
B --> C[응답]`,
    expectedContains: ['flowchart TD', 'A[요청] --> B[처리]'],
  },
  {
    name: '완전 빈 입력',
    input: '',
    expectedContains: ['flowchart TD', 'A[다이어그램 생성 실패] --> B[입력 확인 필요]'],
  },
  {
    name: 'SQL TS Flow 혼합 장문',
    input: `SELECT * FROM users;
\`\`\`typescript
const a = 1;
\`\`\`
\`\`\`mermaid
flowchart TD
S1[요청] --> S2[응답]
\`\`\`
끝`,
    expectedContains: ['flowchart TD', 'S1[요청] --> S2[응답]'],
  },
];

