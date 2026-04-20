import { NextResponse } from 'next/server';
import type { CommitteeFollowupSaveResponse } from '@office-unify/shared-types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import {
  getWebCommitteeTurnForUserScope,
  insertCommitteeFollowupArtifact,
  insertCommitteeFollowupItem,
} from '@office-unify/supabase-access';
import { parseFollowupSaveRequest } from '@/lib/server/committeeFollowupValidation';

export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const { userKey } = auth;

  let bodyUnknown: unknown;
  try {
    bodyUnknown = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = parseFollowupSaveRequest(bodyUnknown);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'invalid_save_request', warnings: parsed.errors }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  const inScope = await getWebCommitteeTurnForUserScope(
    supabase,
    userKey,
    parsed.value.committeeTurnId,
  );
  if (!inScope) {
    return NextResponse.json({ error: 'invalid_committee_turn_scope' }, { status: 403 });
  }

  try {
    const inserted = await insertCommitteeFollowupItem(supabase, userKey, {
      committeeTurnId: parsed.value.committeeTurnId,
      sourceReportKind: parsed.value.sourceReportKind,
      item: parsed.value.item,
      verificationNote: 'server_validated',
    });

    await insertCommitteeFollowupArtifact(supabase, {
      followupItemId: inserted.id,
      artifactType: 'draft_json',
      contentJson: parsed.value.originalDraftJson ?? (parsed.value.item as unknown as Record<string, unknown>),
    });

    const response: CommitteeFollowupSaveResponse = {
      ok: true,
      id: inserted.id,
      status: inserted.status as CommitteeFollowupSaveResponse['status'],
      warnings: [],
    };
    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

