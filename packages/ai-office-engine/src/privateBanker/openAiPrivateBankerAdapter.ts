import type { OpenAiCallUsage } from '../openAiBudgetRunner';
import { getOpenAiPrivateBankerMaxTokens, getOfficeUnifyOpenAiPrivateBankerModel } from '../llmEnvConfig';
import { PRIVATE_BANKER_OPENAI_MODEL } from './privateBankerPrompt';

/**
 * Private Banker 전용 — Gemini 경로와 분리. 서버에서만 OPENAI_API_KEY 사용.
 */
export async function generateOpenAiPrivateBankerReply(params: {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  /** OpenAI chat: user/assistant 대화 (현재 턴 user는 제외하고 히스토리만) */
  history: { role: 'user' | 'assistant'; content: string }[];
  userMessage: string;
}): Promise<{ text: string; usage: OpenAiCallUsage }> {
  const model = params.model ?? getOfficeUnifyOpenAiPrivateBankerModel() ?? PRIVATE_BANKER_OPENAI_MODEL;
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: params.systemInstruction },
    ...params.history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: params.userMessage },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.55,
      max_tokens: getOpenAiPrivateBankerMaxTokens(),
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${t.slice(0, 600)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text?.trim()) {
    throw new Error('OpenAI returned empty text');
  }
  const pt = data.usage?.prompt_tokens ?? 0;
  const ct = data.usage?.completion_tokens ?? 0;
  return {
    text: text.trim(),
    usage: { model, promptTokens: pt, completionTokens: ct },
  };
}
