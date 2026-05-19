import 'server-only';

import type { GoogleFinanceAnchorIssue } from '@office-unify/shared-types';
import type { GoogleFinanceQuoteRow } from '@/lib/server/googleFinanceSheetQuoteService';
import { isPortfolioQuoteRowReadbackOk } from '@/lib/server/portfolioQuotesAnchorMatch';

export type AnchorIssueDetail = {
  issue: GoogleFinanceAnchorIssue;
  formulaPresent?: boolean;
  formulaLooksValid?: boolean;
  formulaNote?: string;
};

/** Calculated values only — formula text may be unavailable from Sheets values API. */
export function classifyAnchorIssue(row: GoogleFinanceQuoteRow | null): AnchorIssueDetail {
  if (!row) {
    return { issue: 'no_row', formulaPresent: false, formulaNote: '행 없음' };
  }

  const raw = (row.rawPrice ?? '').trim();
  const hasNumericPrice = row.price != null && row.price > 0;
  const statusCol = (row.sheetStatus ?? '').trim().toLowerCase();
  const formulaHint =
    raw.startsWith('=') || raw.startsWith("'=") || Boolean(row.priceFormulaText?.includes('GOOGLEFINANCE'));
  const formulaPresent = formulaHint ? true : raw.length === 0 ? undefined : false;
  const formulaLooksValid =
    formulaHint && (raw.includes('GOOGLEFINANCE') || row.priceFormulaText?.includes('GOOGLEFINANCE'))
      ? true
      : formulaPresent === false
        ? false
        : undefined;

  const formulaNote =
    formulaPresent === undefined
      ? '수식 확인 불가, 계산 결과 기준으로 판단'
      : formulaPresent
        ? '수식 문자열 또는 GOOGLEFINANCE 힌트 감지'
        : 'price 셀에 수식 힌트 없음';

  if (row.rowStatus === 'parse_failed') {
    return { issue: 'parse_failed', formulaPresent, formulaLooksValid, formulaNote };
  }

  if (isPortfolioQuoteRowReadbackOk(row)) {
    if (statusCol === 'ok' && !hasNumericPrice && raw.length > 0 && !raw.startsWith('=')) {
      return { issue: 'suspicious_status', formulaPresent, formulaLooksValid, formulaNote };
    }
    return { issue: 'ok', formulaPresent, formulaLooksValid, formulaNote };
  }

  if (!raw && !hasNumericPrice) {
    if (row.rowStatus === 'formula_pending') {
      return { issue: 'formula_pending', formulaPresent, formulaLooksValid, formulaNote };
    }
    return { issue: formulaPresent === false ? 'no_formula' : 'price_empty', formulaPresent, formulaLooksValid, formulaNote };
  }

  if (row.rowStatus === 'formula_pending' || /loading/i.test(raw)) {
    return { issue: 'formula_pending', formulaPresent, formulaLooksValid, formulaNote };
  }

  if (!hasNumericPrice) {
    if (statusCol === 'ok' || statusCol === 'missing') {
      return { issue: statusCol === 'ok' ? 'suspicious_status' : 'status_missing', formulaPresent, formulaLooksValid, formulaNote };
    }
    return { issue: 'price_empty', formulaPresent, formulaLooksValid, formulaNote };
  }

  return { issue: 'unknown', formulaPresent, formulaLooksValid, formulaNote };
}
