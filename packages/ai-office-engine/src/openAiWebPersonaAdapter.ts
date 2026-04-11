/**
 * 웹 persona-chat 전용 — `geminiWebPersonaAdapter`와 동일한 turns 형식을 OpenAI Chat로 전달.
 */

import type { OpenAiCallUsage } from './openAiBudgetRunner';
import type { GeminiChatTurn } from './geminiWebPersonaAdapter';
import { getOpenAiPersonaChatMaxTokens } from './llmEnvConfig';
import { DEFAULT_OPENAI_WEB_PERSONA_MODEL } from './webPersonaLlmModels';

function geminiTurnsToChatParams(contents: GeminiChatTurn[]): {
  history: { role: 'user' | 'assistant'; content: string }[];
  userMessage: string;
} {
  if (contents.length === 0) throw new Error('empty conversation turns');
  const last = contents[contents.length - 1];
  if (last.role !== 'user') throw new Error('last turn must be user');
  const history = contents.slice(0, -1).map((c) => ({
    role: (c.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: c.text,
  }));
  return { history, userMessage: last.text };
}

export async function generateOpenAiWebPersonaReply(params: {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  contents: GeminiChatTurn[];
}): Promise<{ text: string; usage: OpenAiCallUsage }> {
  const { history, userMessage } = geminiTurnsToChatParams(params.contents);
  const model = params.model ?? DEFAULT_OPENAI_WEB_PERSONA_MODEL;
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: params.systemInstruction },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
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
      max_tokens: getOpenAiPersonaChatMaxTokens(),
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
    usage: {
      model,
      promptTokens: pt,
      completionTokens: ct,
    },
  };
}

/**
 * Chat Completions 스트리밍 — 델타마다 `onDelta` 호출.
 * `usage`는 스트림 끝에 포함되면 사용하고, 없으면 출력 길이로 대략 추정한다.
 */
export async function streamOpenAiWebPersonaReply(params: {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  contents: GeminiChatTurn[];
  onDelta: (delta: string) => void | Promise<void>;
}): Promise<{ text: string; usage: OpenAiCallUsage }> {
  const { history, userMessage } = geminiTurnsToChatParams(params.contents);
  const model = params.model ?? DEFAULT_OPENAI_WEB_PERSONA_MODEL;
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: params.systemInstruction },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
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
      max_tokens: getOpenAiPersonaChatMaxTokens(),
      stream: true,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI stream HTTP ${res.status}: ${t.slice(0, 600)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('OpenAI stream: no response body');

  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const chunk = json.choices?.[0]?.delta?.content;
        if (chunk) {
          full += chunk;
          await params.onDelta(chunk);
        }
        if (json.usage) {
          promptTokens = json.usage.prompt_tokens ?? promptTokens;
          completionTokens = json.usage.completion_tokens ?? completionTokens;
        }
      } catch {
        /* ignore partial */
      }
    }
  }

  const tail = buf.trim();
  if (tail.startsWith('data: ')) {
    const data = tail.slice(6).trim();
    if (data && data !== '[DONE]') {
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const chunk = json.choices?.[0]?.delta?.content;
        if (chunk) {
          full += chunk;
          await params.onDelta(chunk);
        }
        if (json.usage) {
          promptTokens = json.usage.prompt_tokens ?? promptTokens;
          completionTokens = json.usage.completion_tokens ?? completionTokens;
        }
      } catch {
        /* ignore */
      }
    }
  }

  const text = full.trim();
  if (!text) {
    throw new Error('OpenAI stream returned empty text');
  }
  if (!completionTokens) {
    completionTokens = Math.max(1, Math.ceil(text.length / 3));
  }
  if (!promptTokens) {
    promptTokens = Math.ceil(params.systemInstruction.length / 4);
  }

  return {
    text,
    usage: {
      model,
      promptTokens,
      completionTokens,
    },
  };
}
