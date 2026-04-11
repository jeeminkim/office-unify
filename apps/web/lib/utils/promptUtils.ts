import { GenerateResponse } from '@/lib/types';

export const FOLLOW_UP_MAX_COUNT = 5;

/** 짧은 SQL 요청 시 서버로 보낼 문자열을 보완 구조로 확장 (기존 긴 입력은 그대로 둠) */
const SHORT_SQL_PROMPT_LEN = 80;

export function enrichSqlPromptIfShort(prompt: string): string {
  const t = prompt.trim();
  if (t.length >= SHORT_SQL_PROMPT_LEN) return prompt;
  return `${t}\n\n[자동 보완 가이드]\n[목적] 위 요청을 실행 가능한 SQL로 변환\n[테이블·조건] 아래 [SCHEMA] 블록을 우선 사용\n[원하는 결과] 컬럼·집계·정렬을 명시`;
}

/**
 * 후속 수정(follow-up) 요청 시 누적 횟수에 따라 새로운 프롬프트를 조합합니다.
 */
export function buildFollowUpPrompt(
  currentPrompt: string,
  followUpText: string,
  result: GenerateResponse,
  newCount: number
): string {
  if (newCount >= FOLLOW_UP_MAX_COUNT) {
    // 5회 이상 시 프롬프트 요약 재구성 (컨텍스트 오버플로우 방지)
    const baseContent = result.content || result.explanation || '';
    return `[현재 결과 기준]\n${baseContent}\n\n[추가 수정 요청]\n${followUpText}`;
  } else {
    // 5회 미만 시 누적 방식 유지
    return `[기존 업무 내용]\n${currentPrompt}\n\n[추가 수정 요청 사항]\n${followUpText}`;
  }
}
