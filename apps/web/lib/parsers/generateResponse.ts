import { GenerateResponse, TaskType } from '../types';
import { ApiError, logDevError } from '../utils';
import {
  detectDiagramType,
  extractMermaid,
  logMermaidEvent,
  sanitizeForLog,
} from '../mermaid/pipeline';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractJsonObject(text: string): unknown {
  let cleanText = text.trim();

  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.substring(3);
  }

  if (cleanText.endsWith('```')) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }

  const jsonStart = cleanText.indexOf('{');
  const jsonEnd = cleanText.lastIndexOf('}');

  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleanText = cleanText.slice(jsonStart, jsonEnd + 1);
  }

  try {
    return JSON.parse(cleanText) as unknown;
  } catch (err) {
    logDevError('JSON 영역 파싱 실패', err);
    throw new ApiError('응답을 처리하는 중 오류가 발생했습니다. (JSON 파싱 실패)', 500);
  }
}

export function normalizeGenerateResponse(
  parsed: unknown,
  requestedTaskType: TaskType,
  rawResponseText?: string
): GenerateResponse {
  const obj = isRecord(parsed) ? parsed : {};

  const rawTaskType = obj.taskType;
  const normalized =
    typeof rawTaskType === 'string' ? rawTaskType.trim().toLowerCase() : '';
  const parsedTaskType: TaskType =
    normalized === 'flow' || normalized === 'sql' || normalized === 'ts'
      ? (normalized as TaskType)
      : requestedTaskType;

  const rawContent = obj.content;
  const parsedContent =
    typeof rawContent === 'string' && rawContent.trim().length > 0
      ? rawContent
      : '결과 내용이 생성되지 않았습니다.';

  const parsedExplanation =
    typeof obj.explanation === 'string' ? obj.explanation : undefined;
  const rawMermaidField =
    typeof obj.mermaidCode === 'string' ? obj.mermaidCode : undefined;
  const parsedMermaidCode =
    parsedTaskType === 'flow'
      ? (() => {
          const sourceText = typeof rawResponseText === 'string' ? rawResponseText : '';
          logMermaidEvent('MERMAID_EXTRACT_START', {
            requestedTaskType,
            rawLength: sourceText.length,
            mermaidFieldLength: rawMermaidField?.length ?? 0,
          });
          const extracted = extractMermaid(sourceText, rawMermaidField);
          logMermaidEvent('MERMAID_EXTRACT_RESULT', {
            requestedTaskType,
            extractedLength: extracted.length,
            diagramType: detectDiagramType(extracted),
            sample: sanitizeForLog(extracted),
          });
          return extracted || rawMermaidField;
        })()
      : rawMermaidField;
  const parsedExample =
    typeof obj.example === 'string' ? obj.example : undefined;

  const rawWarnings = obj.warnings;
  const parsedWarnings = Array.isArray(rawWarnings)
    ? rawWarnings.filter((w): w is string => typeof w === 'string')
    : [];

  return {
    taskType: parsedTaskType,
    title: typeof obj.title === 'string' ? obj.title : undefined,
    content: parsedContent,
    explanation: parsedExplanation,
    mermaidCode: parsedMermaidCode,
    example: parsedExample,
    warnings: parsedWarnings,
    provider: 'gemini',
  };
}
