import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { upsertOpsEventByFingerprint } from '@/lib/server/upsertOpsEventByFingerprint';

type Body = {
  candidateId?: string;
  stockCode?: string;
  event?: 'detail_opened';
};

export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: 'invalid_json' }, { status: 400 });
  }
  if (body.event !== 'detail_opened' || !body.candidateId) {
    return NextResponse.json({ ok: false, message: 'invalid_event' }, { status: 400 });
  }
  const ymd = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  await upsertOpsEventByFingerprint({
    userKey: String(auth.userKey),
    domain: 'today_candidates',
    eventType: 'info',
    severity: 'info',
    code: 'today_candidate_detail_opened',
    message: 'today candidate detail opened',
    detail: { candidateId: body.candidateId, stockCode: body.stockCode ?? null },
    fingerprint: `today_candidates:${auth.userKey}:${ymd}:${body.candidateId}:detail_opened`,
    route: '/api/dashboard/today-candidates/event',
    component: 'today-candidates',
    status: 'open',
  });
  return NextResponse.json({ ok: true });
}
