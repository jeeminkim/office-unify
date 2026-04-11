/**
 * Discord/legacy llmProviderService 없이 Gemini REST 최소 호출만 수행.
 */

import { DEFAULT_GEMINI_WEB_PERSONA_MODEL } from './webPersonaLlmModels';
import { getGeminiPersonaChatMaxOutputTokens } from './llmEnvConfig';

export type GeminiChatTurn = { role: 'user' | 'model'; text: string };

export async function generateGeminiPersonaReply(params: {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  contents: GeminiChatTurn[];
}): Promise<string> {
  const model = params.model ?? DEFAULT_GEMINI_WEB_PERSONA_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${params.apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: params.systemInstruction }] },
    contents: params.contents.map((c) => ({
      role: c.role,
      parts: [{ text: c.text }],
    })),
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: getGeminiPersonaChatMaxOutputTokens(),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || !text.trim()) {
    throw new Error('Gemini returned empty text');
  }
  return text.trim();
}

function extractTextFromStreamChunk(data: unknown): string {
  const obj = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = obj.candidates?.[0]?.content?.parts;
  if (!parts?.length) return '';
  return parts.map((p) => p.text ?? '').join('');
}

/**
 * `streamGenerateContent?alt=sse` — 델타마다 `onDelta` 호출, 완료 후 전체 문자열 반환.
 */
export async function streamGeminiPersonaReply(params: {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  contents: GeminiChatTurn[];
  onDelta: (delta: string) => void | Promise<void>;
}): Promise<string> {
  const model = params.model ?? DEFAULT_GEMINI_WEB_PERSONA_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${params.apiKey}&alt=sse`;

  const body = {
    systemInstruction: { parts: [{ text: params.systemInstruction }] },
    contents: params.contents.map((c) => ({
      role: c.role,
      parts: [{ text: c.text }],
    })),
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: getGeminiPersonaChatMaxOutputTokens(),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini stream HTTP ${res.status}: ${t.slice(0, 500)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Gemini stream: no response body');

  const decoder = new TextDecoder();
  let lineBuf = '';
  let accEmitted = '';

  const handlePiece = async (piece: string) => {
    if (!piece) return;
    let delta: string;
    if (accEmitted && piece.startsWith(accEmitted)) {
      delta = piece.slice(accEmitted.length);
      accEmitted = piece;
    } else if (!accEmitted) {
      delta = piece;
      accEmitted = piece;
    } else {
      accEmitted += piece;
      delta = piece;
    }
    if (delta) await params.onDelta(delta);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    lineBuf += decoder.decode(value, { stream: true });
    const lines = lineBuf.split('\n');
    lineBuf = lines.pop() ?? '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as unknown;
        const piece = extractTextFromStreamChunk(json);
        await handlePiece(piece);
      } catch {
        // incomplete JSON line; skip
      }
    }
  }

  const tail = lineBuf.trim();
  if (tail.startsWith('data: ')) {
    const payload = tail.slice(6).trim();
    if (payload && payload !== '[DONE]') {
      try {
        const json = JSON.parse(payload) as unknown;
        const piece = extractTextFromStreamChunk(json);
        await handlePiece(piece);
      } catch {
        /* ignore */
      }
    }
  }

  const full = accEmitted.trim();
  if (!full) {
    throw new Error('Gemini stream returned empty text');
  }
  return full;
}
