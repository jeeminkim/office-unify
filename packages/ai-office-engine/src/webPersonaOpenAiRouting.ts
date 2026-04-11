/**
 * `/persona-chat` 웹 페르소나 중 OpenAI(Chat Completions)로 호출하는 슬러그.
 * 나머지는 Gemini(`GEMINI_API_KEY`)를 사용한다.
 */
export const OPENAI_WEB_PERSONA_SLUGS = ['jo-il-hyeon', 'hindenburg', 'jim-simons'] as const;

const SLUG_SET = new Set<string>(OPENAI_WEB_PERSONA_SLUGS);

export function isOpenAiWebPersonaSlug(slug: string): boolean {
  return SLUG_SET.has(slug.trim().toLowerCase());
}
