import { NextResponse } from 'next/server';
import { GeminiProvider } from '@/lib/providers/gemini';
import type { DbType, GenerateRequest } from '@/lib/types';
import { ApiError, logDevError } from '@/lib/utils';

const DB_TYPES: readonly DbType[] = ['postgresql', 'mysql', 'oracle'];

function isDbType(v: unknown): v is DbType {
  return typeof v === 'string' && (DB_TYPES as readonly string[]).includes(v);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      throw new ApiError('업무 내용(Prompt)이 누락되었거나 형식이 알맞지 않습니다.', 400);
    }
    if (typeof body.taskType !== 'string' || !['flow', 'sql', 'ts'].includes(body.taskType)) {
      throw new ApiError('잘못된 생성 타입(TaskType) 요청입니다.', 400);
    }
    if (body.provider !== 'gemini') {
      throw new ApiError('현재 MVP에서는 gemini 이외의 Provider를 지원하지 않습니다.', 400);
    }

    const serverKey = process.env.GEMINI_API_KEY?.trim();
    if (!serverKey) {
      throw new ApiError('서버에 GEMINI_API_KEY가 설정되어 있지 않습니다.', 503);
    }

    const taskType = body.taskType as GenerateRequest['taskType'];

    let dbType: DbType | undefined;
    let schemaContext: string | undefined;
    let sqlStyleHints: string | undefined;

    if (taskType === 'sql') {
      const rawDb = body.dbType;
      if (rawDb === undefined || rawDb === null) {
        dbType = 'postgresql';
      } else if (!isDbType(rawDb)) {
        throw new ApiError('dbType은 postgresql, mysql, oracle 중 하나여야 합니다.', 400);
      } else {
        dbType = rawDb;
      }

      const rawSchema = body.schemaContext;
      if (rawSchema === undefined || rawSchema === null) {
        schemaContext = '';
      } else if (typeof rawSchema !== 'string') {
        throw new ApiError('schemaContext는 문자열이어야 합니다.', 400);
      } else {
        schemaContext = rawSchema;
      }

      const rawHints = body.sqlStyleHints;
      if (rawHints === undefined || rawHints === null) {
        sqlStyleHints = '';
      } else if (typeof rawHints !== 'string') {
        throw new ApiError('sqlStyleHints는 문자열이어야 합니다.', 400);
      } else {
        sqlStyleHints = rawHints;
      }
    }

    const preferenceHint =
      typeof body.preferenceHint === 'string' && body.preferenceHint.trim().length > 0
        ? body.preferenceHint.trim()
        : undefined;

    const requestPayload: GenerateRequest = {
      prompt: body.prompt as string,
      taskType,
      provider: 'gemini',
      apiKey: serverKey,
      ...(taskType === 'sql' ? { dbType, schemaContext, sqlStyleHints } : {}),
      ...(preferenceHint ? { preferenceHint } : {}),
    };

    const provider = new GeminiProvider();
    const result = await provider.generate(requestPayload);

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      logDevError(`Route Handler ApiError [${error.statusCode}]: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    logDevError('Route Handler Internal Error', error);
    const message =
      error instanceof Error ? error.message : '서버 내부 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
