import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { runSqlReadinessCheckWithSupabase } from '@/lib/server/sqlReadinessCheck';
import { getSqlReadinessRegistry } from '@/lib/server/sqlReadinessRegistry';

export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: false,
      summary: {
        total: getSqlReadinessRegistry().length,
        ready: 0,
        missing: 0,
        partial: 0,
        optionalMissing: 0,
        coreMissing: 0,
        recommendedMissing: 0,
        checkedAt: new Date().toISOString(),
      },
      groups: [],
      qualityMeta: {
        readOnly: true,
        checkedAt: new Date().toISOString(),
        source: 'postgrest_read_probe',
        warnings: ['Supabase service client unavailable'],
      },
      actionHint:
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 설정한 뒤 다시 점검하세요. SQL을 자동 적용하지 않습니다.',
    });
  }

  try {
    const body = await runSqlReadinessCheckWithSupabase(supabase);
    return NextResponse.json(body);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'sql readiness check failed';
    return NextResponse.json({
      ok: false,
      summary: {
        total: getSqlReadinessRegistry().length,
        ready: 0,
        missing: 0,
        partial: 0,
        optionalMissing: 0,
        coreMissing: 0,
        recommendedMissing: 0,
        checkedAt: new Date().toISOString(),
      },
      groups: [],
      qualityMeta: {
        readOnly: true,
        checkedAt: new Date().toISOString(),
        source: 'postgrest_read_probe',
        warnings: [message],
      },
      actionHint: 'DB 점검 중 오류가 발생했습니다. 권한·네트워크를 확인한 뒤 다시 시도하세요.',
    });
  }
}
