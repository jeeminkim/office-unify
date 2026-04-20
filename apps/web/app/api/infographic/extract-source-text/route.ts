import { NextResponse } from 'next/server';
import type { InfographicExtractSourceTextResponseBody } from '@office-unify/shared-types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { parseInfographicExtractRequest } from '@/lib/server/infographicValidation';
import { resolveInfographicSourceText } from '@/lib/server/infographicSourceExtract';

async function parseMultipartBody(req: Request): Promise<unknown> {
  const form = await req.formData();
  const sourceType = String(form.get('sourceType') ?? 'pdf_upload');
  const industryName = String(form.get('industryName') ?? '').trim();
  const sourceUrl = String(form.get('sourceUrl') ?? '').trim();
  const pdfUrl = String(form.get('pdfUrl') ?? '').trim();
  const rawText = String(form.get('rawText') ?? '').trim();
  const articlePatternOverride = String(form.get('articlePatternOverride') ?? '').trim();
  const industryPatternOverride = String(form.get('industryPatternOverride') ?? '').trim();
  const pdfFileRaw = form.get('pdfFile');
  const pdfFile = pdfFileRaw instanceof File ? pdfFileRaw : undefined;
  return {
    sourceType,
    industryName,
    sourceUrl: sourceUrl || undefined,
    pdfUrl: pdfUrl || undefined,
    rawText: rawText || undefined,
    articlePatternOverride: articlePatternOverride || undefined,
    industryPatternOverride: industryPatternOverride || undefined,
    pdfFile,
  };
}

export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    const contentType = req.headers.get('content-type') ?? '';
    body = contentType.includes('multipart/form-data') ? await parseMultipartBody(req) : await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = parseInfographicExtractRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'invalid_request', warnings: parsed.errors }, { status: 400 });
  }

  try {
    const bodyRecord = body as Record<string, unknown>;
    const sourceResolved = await resolveInfographicSourceText({
      sourceType: parsed.value.sourceType,
      rawText: parsed.value.rawText,
      sourceUrl: parsed.value.sourceUrl,
      pdfUrl: parsed.value.pdfUrl,
      pdfFile: bodyRecord.pdfFile instanceof File ? bodyRecord.pdfFile : undefined,
    });
    const response: InfographicExtractSourceTextResponseBody = {
      ok: true,
      rawText: sourceResolved.rawText,
      cleanedText: sourceResolved.cleanedText,
      warnings: sourceResolved.extractionWarnings,
      sourceMeta: {
        sourceType: parsed.value.sourceType,
        articlePattern: parsed.value.articlePatternOverride ?? sourceResolved.articlePattern,
        industryPattern: parsed.value.industryPatternOverride ?? sourceResolved.industryPattern,
        sourceTone: sourceResolved.sourceTone,
        subjectivityLevel: sourceResolved.subjectivityLevel,
        structureDensity: sourceResolved.structureDensity,
        sourceUrl: sourceResolved.sourceUrl,
        sourceTitle: sourceResolved.sourceTitle,
        extractionWarnings: sourceResolved.extractionWarnings,
        extractedTextLength: sourceResolved.cleanedTextLength,
        rawExtractedTextLength: sourceResolved.rawExtractedTextLength,
        cleanedTextLength: sourceResolved.cleanedTextLength,
        cleanupApplied: sourceResolved.cleanupApplied,
        cleanupNotes: sourceResolved.cleanupNotes,
      },
    };
    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

