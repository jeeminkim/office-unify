import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import {
  listPortfolioTradeEventsForSymbol,
  listTradeJournalEntries,
  listTradeJournalReviewsByEntryId,
  listWebPortfolioHoldingsForUser,
  listWebPortfolioWatchlistForUser,
} from '@office-unify/supabase-access';
import { loadHoldingQuotes } from '@/lib/server/marketQuoteService';
import { matchRelatedSectorsForHolding } from '@/lib/server/sectorRadarDossierMatch';
import { buildSectorRadarSummaryForUser } from '@/lib/server/sectorRadarSummaryService';
import type { PortfolioDossierRelatedSector } from '@/lib/sectorRadarContract';
import { analyzeThesisHealth } from '@/lib/server/thesisHealthAnalyzer';

type Params = { params: Promise<{ symbol: string }> };

function parseKey(raw: string): { market?: 'KR' | 'US'; symbol: string } {
  const decoded = decodeURIComponent(raw).trim().toUpperCase();
  if (decoded.includes(':')) {
    const [m, s] = decoded.split(':');
    if ((m === 'KR' || m === 'US') && s) return { market: m, symbol: s };
  }
  if (decoded.includes('-')) {
    const [m, s] = decoded.split('-');
    if ((m === 'KR' || m === 'US') && s) return { market: m, symbol: s };
  }
  return { symbol: decoded };
}

function toNum(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseStopPrice(judgmentMemo: string | null | undefined): number | undefined {
  const raw = (judgmentMemo ?? '').toUpperCase();
  const m = raw.match(/(?:STOP|손절|무효화)\s*[:=]?\s*([0-9][0-9,._]*)/);
  if (!m?.[1]) return undefined;
  const n = Number(m[1].replace(/[,._\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function GET(_req: Request, context: Params) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  }
  const parsed = parseKey((await context.params).symbol);

  try {
    const holdings = await listWebPortfolioHoldingsForUser(supabase, auth.userKey);
    const holding = holdings.find((h) => {
      const s = h.symbol.toUpperCase();
      if (parsed.market) return h.market === parsed.market && s === parsed.symbol;
      return s === parsed.symbol;
    });
    if (!holding) {
      return NextResponse.json({ ok: false, error: 'holding_not_found', degraded: false }, { status: 404 });
    }

    const quote = await loadHoldingQuotes([{
      market: holding.market,
      symbol: holding.symbol,
      displayName: holding.name,
      quoteSymbol: holding.quote_symbol ?? undefined,
      googleTicker: holding.google_ticker ?? undefined,
    }]);
    const key = `${holding.market}:${holding.symbol.toUpperCase()}`;
    const q = quote.quoteByHolding.get(key);
    const avg = toNum(holding.avg_price);
    const current = q?.currentPrice;
    const pnlRate = current != null && avg > 0 ? ((current - avg) / avg) * 100 : undefined;

    const [journal, tradeEvents, trendRows, committeeRows, pbRows] = await Promise.all([
      listTradeJournalEntries(supabase, auth.userKey, 120),
      listPortfolioTradeEventsForSymbol(supabase, auth.userKey, holding.market as 'KR' | 'US', holding.symbol),
      supabase
        .from('trend_report_runs')
        .select('id,title,summary,created_at,focus')
        .eq('user_key', auth.userKey as string)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('web_committee_turns')
        .select('id,topic,transcript_excerpt,updated_at')
        .eq('user_key', auth.userKey as string)
        .order('updated_at', { ascending: false })
        .limit(20),
      supabase
        .from('web_persona_messages')
        .select('id,persona_name,role,content,created_at')
        .eq('user_key', auth.userKey as string)
        .order('created_at', { ascending: false })
        .limit(120),
    ]);

    const symbol = holding.symbol.toUpperCase();
    const journalRows = journal.filter((j) => j.symbol.toUpperCase() === symbol).slice(0, 12);
    const review = journalRows.length > 0
      ? await listTradeJournalReviewsByEntryId(supabase, journalRows[0]!.id).then((r) => r[0] ?? null).catch(() => null)
      : null;
    const trendSignals = (trendRows.data ?? [])
      .filter((r) => `${String(r.title ?? '')} ${String(r.summary ?? '')}`.toUpperCase().includes(symbol))
      .slice(0, 6)
      .map((r) => ({
        title: String(r.title ?? ''),
        summary: String(r.summary ?? ''),
        createdAt: String(r.created_at ?? ''),
        confidence: String(r.focus ?? '').includes('portfolio') ? 'medium' : 'low',
      }));
    const committeeLatest = (committeeRows.data ?? [])
      .find((r) => `${String(r.topic ?? '')} ${String(r.transcript_excerpt ?? '')}`.toUpperCase().includes(symbol));
    const pbLatest = (pbRows.data ?? [])
      .find((r) => String(r.role ?? '') === 'assistant' && String(r.content ?? '').toUpperCase().includes(symbol));

    let relatedSectorRadar: ReturnType<typeof matchRelatedSectorsForHolding> = [];
    let sectorRadarGeneratedAt: string | undefined;
    let sectorRadarWarnings: string[] = [];
    try {
      const [watchlistAll, radarSummary] = await Promise.all([
        listWebPortfolioWatchlistForUser(supabase, auth.userKey),
        buildSectorRadarSummaryForUser(supabase, auth.userKey),
      ]);
      sectorRadarGeneratedAt = radarSummary.generatedAt;
      sectorRadarWarnings = radarSummary.warnings ?? [];
      const wl = watchlistAll.find(
        (w) => w.market === holding.market && w.symbol.trim().toUpperCase() === holding.symbol.trim().toUpperCase(),
      ) ?? null;
      relatedSectorRadar = matchRelatedSectorsForHolding(
        {
          market: holding.market,
          symbol: holding.symbol,
          name: holding.name,
          sector: holding.sector ?? null,
          investment_memo: holding.investment_memo ?? null,
          judgment_memo: holding.judgment_memo ?? null,
        },
        wl,
        radarSummary.sectors,
      );
    } catch {
      sectorRadarWarnings = ['sector_radar_dossier_attach_failed'];
    }

    const relatedSector: PortfolioDossierRelatedSector | null =
      relatedSectorRadar[0] != null
        ? {
            key: relatedSectorRadar[0]!.key,
            name: relatedSectorRadar[0]!.name,
            score: relatedSectorRadar[0]!.score,
            zone: relatedSectorRadar[0]!.zone,
            confidence: relatedSectorRadar[0]!.confidence,
            narrativeHint: relatedSectorRadar[0]!.narrativeHint,
            anchors: relatedSectorRadar[0]!.linkedAnchors ?? [],
          }
        : null;

    const thesisHealth = analyzeThesisHealth({
      symbol,
      market: holding.market,
      currentPrice: current,
      pnlRate,
      targetPrice: toNum(holding.target_price) || undefined,
      stopPrice: parseStopPrice(holding.judgment_memo),
      holdingMemo: holding.investment_memo,
      judgmentMemo: holding.judgment_memo,
      trendSignals: trendSignals.map((t) => ({ summary: t.summary, confidence: t.confidence as 'low' | 'medium' | 'high' })),
      pbSummary: pbLatest ? String(pbLatest.content ?? '') : undefined,
      committeeSummary: committeeLatest ? `${committeeLatest.topic ?? ''} ${committeeLatest.transcript_excerpt ?? ''}` : undefined,
      recentJournal: journalRows.map((j) => ({
        thesisSummary: j.thesisSummary,
        note: j.note,
        side: j.side,
      })),
    });
    const alerts: Array<{ title: string; body: string; severity: 'info' | 'warn' | 'danger' }> = [];
    const target = toNum(holding.target_price);
    const stop = parseStopPrice(holding.judgment_memo);
    if (target > 0 && current != null && current >= target) {
      alerts.push({ title: '목표가 도달', body: '현재가가 목표가 이상입니다.', severity: 'info' });
    }
    if (stop && current != null && current <= stop) {
      alerts.push({ title: '손절/무효화 도달', body: '현재가가 무효화 조건 이하입니다.', severity: 'danger' });
    }
    if (pnlRate != null && pnlRate <= -10) {
      alerts.push({ title: '손실률 경고', body: `손실률 ${pnlRate.toFixed(2)}%`, severity: 'warn' });
    }
    if (thesisHealth.status === 'weakening' || thesisHealth.status === 'broken') {
      alerts.push({
        title: `thesis ${thesisHealth.status}`,
        body: thesisHealth.reasons[0] ?? 'thesis 점검이 필요합니다.',
        severity: thesisHealth.status === 'broken' ? 'danger' : 'warn',
      });
    }

    return NextResponse.json({
      ok: true,
      holding: {
        market: holding.market,
        symbol: holding.symbol,
        name: holding.name,
        sector: holding.sector ?? null,
        qty: toNum(holding.qty),
        avgPrice: toNum(holding.avg_price),
        currentPrice: current,
        pnlRate,
        googleTicker: holding.google_ticker,
        quoteSymbol: holding.quote_symbol,
      },
      relatedSectorRadar,
      relatedSector,
      sectorRadarGeneratedAt,
      sectorRadarWarnings,
      thesis: {
        reason: holding.investment_memo ?? undefined,
        targetPrice: toNum(holding.target_price) || undefined,
        stopPrice: parseStopPrice(holding.judgment_memo),
        memo: holding.judgment_memo ?? undefined,
        createdAt: holding.updated_at ?? undefined,
      },
      pbLatest: pbLatest
        ? {
            persona: pbLatest.persona_name,
            content: pbLatest.content,
            createdAt: pbLatest.created_at,
          }
        : undefined,
      committeeLatest: committeeLatest
        ? {
            topic: committeeLatest.topic,
            summary: committeeLatest.transcript_excerpt,
            createdAt: committeeLatest.updated_at,
          }
        : undefined,
      recentJournal: journalRows.slice(0, 8),
      tradeEvents: tradeEvents.map((row) => ({
        id: row.id,
        market: row.market,
        symbol: row.symbol,
        eventType: row.event_type,
        tradeDate: row.trade_date,
        quantity: row.quantity == null ? undefined : toNum(row.quantity),
        price: row.price == null ? undefined : toNum(row.price),
        beforeQuantity: row.before_quantity == null ? undefined : toNum(row.before_quantity),
        afterQuantity: row.after_quantity == null ? undefined : toNum(row.after_quantity),
        beforeAvgPrice: row.before_avg_price == null ? undefined : toNum(row.before_avg_price),
        afterAvgPrice: row.after_avg_price == null ? undefined : toNum(row.after_avg_price),
        realizedPnlKrw: row.realized_pnl_krw == null ? undefined : toNum(row.realized_pnl_krw),
        memo: row.memo ?? undefined,
        reason: row.reason ?? undefined,
      })),
      trendSignals,
      researchSignals: [],
      alerts,
      reviewLatest: review,
      thesisHealth,
      degraded: !q?.currentPrice,
      warnings: Array.from(new Set([...(quote.warnings ?? []), ...sectorRadarWarnings])),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'unknown error' }, { status: 500 });
  }
}

