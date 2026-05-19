import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { applyGoogleSheetsRepair } from '@/lib/server/googleSheetsRepair';

/** POST /api/system/google-finance-setup/repair/apply — confirm=true일 때만 Sheets write */
export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  let body: {
    confirm?: boolean;
    operationIds?: string[];
    overwrite?: boolean;
    idempotencyKey?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, status: 'error', error: 'invalid_json' },
      { status: 400 },
    );
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      {
        ok: false,
        status: 'confirmation_required',
        appliedOperations: [],
        skippedOperations: [],
        qualityMeta: { writeAction: true, confirmed: false, idempotent: false },
      },
      { status: 400 },
    );
  }

  const result = await applyGoogleSheetsRepair({
    confirm: true,
    operationIds: body.operationIds,
    overwrite: body.overwrite,
    idempotencyKey: body.idempotencyKey,
  });

  const httpStatus =
    result.status === 'confirmation_required'
      ? 400
      : result.status === 'write_not_available' || result.status === 'error'
        ? result.ok
          ? 200
          : 503
        : 200;

  return NextResponse.json(result, { status: httpStatus });
}
