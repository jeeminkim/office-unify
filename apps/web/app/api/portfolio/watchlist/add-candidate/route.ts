import { NextResponse } from 'next/server';
import { listWebPortfolioWatchlistForUser, upsertPortfolioWatchlist } from '@office-unify/supabase-access';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { upsertOpsEventByFingerprint } from '@/lib/server/upsertOpsEventByFingerprint';
import type { TodayStockCandidate } from '@/lib/todayCandidatesContract';
import { isDuplicateWatchlistCandidate } from '@/lib/server/watchlistCandidateUtils';
import { mapWatchlistRowToSectorMatchInput, matchWatchlistSector } from '@/lib/server/watchlistSectorMatcher';

type Body = { candidate?: TodayStockCandidate };
type PostProcessStatus = {
  sectorMatched?: boolean;
  tickerNormalized?: boolean;
  quoteReady?: boolean;
  warnings: string[];
};

function toMarket(input: TodayStockCandidate['market']): 'KR' | 'US' {
  return input === 'KOSPI' || input === 'KOSDAQ' || input === 'KONEX' ? 'KR' : 'US';
}

export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, status: 'failed', message: 'supabase_unconfigured' }, { status: 503 });
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, status: 'failed', message: 'invalid_json' }, { status: 400 });
  }
  const c = body.candidate;
  if (!c?.name || !c.stockCode) return NextResponse.json({ ok: false, status: 'failed', message: 'candidate fields required' }, { status: 400 });
  try {
    const existing = await listWebPortfolioWatchlistForUser(supabase, auth.userKey);
    const duplicate = isDuplicateWatchlistCandidate(existing, {
      market: 'KR',
      name: c.name,
      stockCode: c.stockCode,
      symbol: c.symbol,
      googleTicker: c.googleTicker,
      quoteSymbol: c.quoteSymbol,
    });
    const fpBase = `today_candidates:${auth.userKey}:${c.stockCode}`;
    if (duplicate) {
      void upsertOpsEventByFingerprint({
        userKey: String(auth.userKey),
        domain: 'today_candidates',
        eventType: 'info',
        severity: 'info',
        code: 'today_candidate_watchlist_already_exists',
        message: 'watchlist add skipped: already exists',
        detail: { candidateId: c.candidateId, stockCode: c.stockCode, name: c.name },
        fingerprint: `${fpBase}:already_exists`,
        route: '/api/portfolio/watchlist/add-candidate',
        component: 'watchlist-add-candidate',
        status: 'open',
      });
      return NextResponse.json({ ok: true, status: 'already_exists', message: '이미 관심종목에 등록된 종목입니다.' });
    }
    await upsertPortfolioWatchlist(supabase, auth.userKey, {
      market: toMarket(c.market),
      symbol: c.stockCode,
      name: c.name,
      sector: c.sector ?? null,
      interest_reason: `today_candidate:${c.source}`,
      observation_points: c.reasonSummary.slice(0, 300),
      google_ticker: c.googleTicker ?? `KRX:${c.stockCode}`,
      quote_symbol: c.quoteSymbol ?? `${c.stockCode}.KS`,
    });
    const postProcess: PostProcessStatus = { warnings: [] };
    try {
      const normalizedGoogle = (c.googleTicker ?? `KRX:${c.stockCode}`).trim().toUpperCase();
      const normalizedQuote = (c.quoteSymbol ?? `${c.stockCode}.KS`).trim().toUpperCase();
      const existingAfterInsert = await listWebPortfolioWatchlistForUser(supabase, auth.userKey);
      const row = existingAfterInsert.find((x) => x.market === 'KR' && x.symbol === c.stockCode);
      if (row) {
        const matched = matchWatchlistSector(mapWatchlistRowToSectorMatchInput(row));
        const patch: Record<string, unknown> = {
          google_ticker: normalizedGoogle,
          quote_symbol: normalizedQuote,
          updated_at: new Date().toISOString(),
          sector_is_manual: false,
          sector_match_status: matched.status,
          sector_match_confidence: Math.round(matched.confidence),
          sector_match_source: matched.source,
          sector_match_reason: matched.reason,
          sector_keywords: matched.sectorKeywords,
        };
        if (matched.matchedSector) {
          patch.sector = matched.matchedSector;
          postProcess.sectorMatched = true;
        } else {
          postProcess.warnings.push('sector_match_no_match');
        }
        const { error: patchErr } = await supabase
          .from('web_portfolio_watchlist')
          .update(patch)
          .eq('user_key', auth.userKey as string)
          .eq('market', 'KR')
          .eq('symbol', c.stockCode);
        if (patchErr && /column .* does not exist|schema cache/i.test(patchErr.message ?? '')) {
          postProcess.warnings.push('sector_meta_columns_missing');
        } else if (patchErr) {
          postProcess.warnings.push(`sector_patch_failed:${patchErr.message.slice(0, 80)}`);
        }
      } else {
        postProcess.warnings.push('watchlist_row_not_found_after_insert');
      }
      postProcess.tickerNormalized = true;
      postProcess.quoteReady = Boolean(normalizedGoogle && normalizedQuote);
      const code = postProcess.warnings.length === 0
        ? 'today_candidate_watchlist_add_postprocess_success'
        : 'today_candidate_watchlist_add_postprocess_partial';
      void upsertOpsEventByFingerprint({
        userKey: String(auth.userKey),
        domain: 'today_candidates',
        eventType: postProcess.warnings.length === 0 ? 'info' : 'warning',
        severity: postProcess.warnings.length === 0 ? 'info' : 'warning',
        code,
        message: postProcess.warnings.length === 0 ? 'watchlist postprocess success' : 'watchlist postprocess partial',
        detail: { candidateId: c.candidateId, stockCode: c.stockCode, warnings: postProcess.warnings },
        fingerprint: `${fpBase}:${postProcess.warnings.length === 0 ? 'postprocess_success' : 'postprocess_partial'}`,
        route: '/api/portfolio/watchlist/add-candidate',
        component: 'watchlist-add-candidate',
        status: 'open',
      });
    } catch (postErr: unknown) {
      postProcess.warnings.push(postErr instanceof Error ? postErr.message.slice(0, 120) : 'postprocess_failed');
      void upsertOpsEventByFingerprint({
        userKey: String(auth.userKey),
        domain: 'today_candidates',
        eventType: 'warning',
        severity: 'warning',
        code: 'today_candidate_watchlist_add_postprocess_failed',
        message: 'watchlist postprocess failed',
        detail: { candidateId: c.candidateId, stockCode: c.stockCode, warning: postProcess.warnings[0] },
        fingerprint: `${fpBase}:postprocess_failed`,
        route: '/api/portfolio/watchlist/add-candidate',
        component: 'watchlist-add-candidate',
        status: 'open',
      });
    }
    void upsertOpsEventByFingerprint({
      userKey: String(auth.userKey),
      domain: 'today_candidates',
      eventType: 'info',
      severity: 'info',
      code: 'today_candidate_watchlist_add_success',
      message: 'candidate added to watchlist',
      detail: { candidateId: c.candidateId, stockCode: c.stockCode, name: c.name },
      fingerprint: `${fpBase}:add_success`,
      route: '/api/portfolio/watchlist/add-candidate',
      component: 'watchlist-add-candidate',
      status: 'open',
    });
    return NextResponse.json({ ok: true, status: 'added', message: '관심종목에 추가했습니다.', postProcess });
  } catch (e: unknown) {
    void upsertOpsEventByFingerprint({
      userKey: String(auth.userKey),
      domain: 'today_candidates',
      eventType: 'error',
      severity: 'error',
      code: 'today_candidate_watchlist_add_failed',
      message: 'candidate watchlist add failed',
      detail: { error: e instanceof Error ? e.message : 'unknown' },
      fingerprint: `today_candidates:${auth.userKey}:${c.stockCode}:add_failed`,
      route: '/api/portfolio/watchlist/add-candidate',
      component: 'watchlist-add-candidate',
      status: 'open',
    });
    return NextResponse.json({ ok: false, status: 'failed', message: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
