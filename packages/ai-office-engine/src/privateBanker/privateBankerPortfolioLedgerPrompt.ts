import type { WebPortfolioHoldingRow, WebPortfolioWatchlistRow } from '@office-unify/supabase-access';

const MAX_SNAPSHOT_CHARS = 14_000;

function n(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return String(v);
}

function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return '—';
  const t = String(s).trim();
  return t.length ? t : '—';
}

/**
 * Private Banker 시스템 프롬프트에 넣을 Supabase 웹 원장 텍스트.
 */
export function formatWebPortfolioLedgerForPrivateBankerPrompt(params: {
  holdings: WebPortfolioHoldingRow[];
  watchlist: WebPortfolioWatchlistRow[];
}): string {
  const lines: string[] = [];

  lines.push('## 보유 (web_portfolio_holdings)');
  if (params.holdings.length === 0) {
    lines.push('(등록 없음)');
  } else {
    for (const h of params.holdings) {
      lines.push(
        `- [${esc(h.market)}] ${esc(h.symbol)} · ${esc(h.name)} | 수량 ${n(h.qty)} · 평단 ${n(h.avg_price)} · 목표가 ${n(h.target_price)} · 섹터 ${esc(h.sector)}`,
      );
      lines.push(
        `  투자메모: ${esc(h.investment_memo)} | 판단: ${esc(h.judgment_memo)}`,
      );
    }
  }

  lines.push('');
  lines.push('## 관심 (web_portfolio_watchlist)');
  if (params.watchlist.length === 0) {
    lines.push('(등록 없음)');
  } else {
    for (const w of params.watchlist) {
      lines.push(
        `- [${esc(w.market)}] ${esc(w.symbol)} · ${esc(w.name)} · 섹터 ${esc(w.sector)}`,
      );
      lines.push(
        `  관심이유: ${esc(w.interest_reason)} | 희망매수: ${esc(w.desired_buy_range)} | 관찰: ${esc(w.observation_points)} | 우선: ${esc(w.priority)}`,
      );
      lines.push(`  메모: ${esc(w.investment_memo)}`);
    }
  }

  let out = lines.join('\n');
  if (out.length > MAX_SNAPSHOT_CHARS) {
    out = `${out.slice(0, MAX_SNAPSHOT_CHARS - 80)}\n… [원장 스냅샷이 길어 이후 생략]`;
  }
  return out;
}
