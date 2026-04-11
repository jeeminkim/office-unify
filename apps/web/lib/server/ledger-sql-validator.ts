import type {
  ParsedLedgerOperation,
  PortfolioLedgerHoldingInput,
  PortfolioLedgerValidateResponseBody,
  PortfolioLedgerWatchlistInput,
} from '@office-unify/shared-types';

const FORBIDDEN = /\b(DROP|ALTER|CREATE|TRUNCATE|EXEC|GRANT|REVOKE|COPY|\\\copy)\b/i;
const HOLDINGS_TABLE = 'web_portfolio_holdings';
const WATCHLIST_TABLE = 'web_portfolio_watchlist';

const HOLDINGS_COLS = new Set([
  'user_key',
  'market',
  'symbol',
  'name',
  'sector',
  'investment_memo',
  'qty',
  'avg_price',
  'target_price',
  'judgment_memo',
]);

const WATCHLIST_COLS = new Set([
  'user_key',
  'market',
  'symbol',
  'name',
  'sector',
  'investment_memo',
  'interest_reason',
  'desired_buy_range',
  'observation_points',
  'priority',
]);

function stripBlockComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function stripLineComments(s: string): string {
  return s
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

export function splitSqlStatements(sql: string): string[] {
  const cleaned = stripLineComments(stripBlockComments(sql));
  const parts: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inQuote) {
      buf += c;
      if (c === "'" && cleaned[i + 1] === "'") {
        buf += cleaned[++i];
      } else if (c === "'") {
        inQuote = false;
      }
    } else {
      if (c === "'") {
        inQuote = true;
        buf += c;
      } else if (c === ';') {
        if (buf.trim()) parts.push(buf.trim());
        buf = '';
      } else {
        buf += c;
      }
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function splitCommaOutsideQuotes(inner: string): string[] {
  const tokens: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (inQuote) {
      buf += c;
      if (c === "'" && inner[i + 1] === "'") {
        buf += inner[++i];
      } else if (c === "'") {
        inQuote = false;
      }
    } else {
      if (c === "'") {
        inQuote = true;
        buf += c;
      } else if (c === ',') {
        tokens.push(buf.trim());
        buf = '';
      } else {
        buf += c;
      }
    }
  }
  if (buf.trim()) tokens.push(buf.trim());
  return tokens;
}

function parseSqlStringOrNumber(token: string): string | number | null {
  const t = token.trim();
  if (t === 'NULL' || t === '') return null;
  if (t.startsWith("'")) {
    if (!t.endsWith("'") || t.length < 2) return null;
    return t.slice(1, -1).replace(/''/g, "'");
  }
  const n = parseNumericToken(t);
  if (n === null) return null;
  return n;
}

function coerceNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return parseNumericToken(v);
  return null;
}

function parseNumericToken(t: string): number | null {
  const normalized = t.replace(/,/g, '').replace(/\s/g, '');
  if (normalized === '' || normalized === 'NULL') return null;
  const n = Number(normalized);
  if (Number.isFinite(n)) return n;
  return null;
}

function normalizeMarket(v: string): 'KR' | 'US' | null {
  const u = v.trim().toUpperCase();
  if (u === 'KR' || u === 'US') return u;
  return null;
}

function parseInsert(
  stmt: string,
  errors: string[],
  lineHint: string,
): ParsedLedgerOperation | null {
  const m = stmt.match(
    /^\s*INSERT\s+INTO\s+(\S+)\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)\s*$/i,
  );
  if (!m) {
    errors.push(`${lineHint}: INSERT 형식이 올바르지 않습니다. (INSERT INTO … (cols) VALUES (…))`);
    return null;
  }
  const table = m[1].toLowerCase();
  const colsRaw = m[2];
  const valsRaw = m[3];

  const cols = splitCommaOutsideQuotes(colsRaw).map((c) => c.replace(/"/g, '').trim().toLowerCase());
  const vals = splitCommaOutsideQuotes(valsRaw).map((v) => v.trim());

  if (cols.length !== vals.length) {
    errors.push(`${lineHint}: 컬럼 수(${cols.length})와 값 수(${vals.length})가 일치하지 않습니다.`);
    return null;
  }

  const rec: Record<string, string | number | null> = {};
  for (let i = 0; i < cols.length; i++) {
    const parsed = parseSqlStringOrNumber(vals[i]);
    rec[cols[i]] = parsed;
  }

  if (table === HOLDINGS_TABLE) {
    for (const c of cols) {
      if (!HOLDINGS_COLS.has(c)) {
        errors.push(`${lineHint}: 허용되지 않은 컬럼 "${c}" (${HOLDINGS_TABLE})`);
        return null;
      }
    }
    const market = normalizeMarket(String(rec.market ?? ''));
    const symbol = rec.symbol != null ? String(rec.symbol).trim() : '';
    const name = rec.name != null ? String(rec.name).trim() : '';
    if (!market) {
      errors.push(`${lineHint}: market은 KR 또는 US여야 합니다.`);
      return null;
    }
    if (!symbol || !name) {
      errors.push(`${lineHint}: symbol, name은 필수입니다.`);
      return null;
    }
    const row: PortfolioLedgerHoldingInput = {
      market,
      symbol,
      name,
      sector: rec.sector != null ? String(rec.sector) : null,
      investment_memo: rec.investment_memo != null ? String(rec.investment_memo) : null,
      qty: coerceNum(rec.qty),
      avg_price: coerceNum(rec.avg_price),
      target_price: coerceNum(rec.target_price),
      judgment_memo: rec.judgment_memo != null ? String(rec.judgment_memo) : null,
    };
    return { kind: 'insert_holding', row };
  }

  if (table === WATCHLIST_TABLE) {
    for (const c of cols) {
      if (!WATCHLIST_COLS.has(c)) {
        errors.push(`${lineHint}: 허용되지 않은 컬럼 "${c}" (${WATCHLIST_TABLE})`);
        return null;
      }
    }
    const market = normalizeMarket(String(rec.market ?? ''));
    const symbol = rec.symbol != null ? String(rec.symbol).trim() : '';
    const name = rec.name != null ? String(rec.name).trim() : '';
    if (!market) {
      errors.push(`${lineHint}: market은 KR 또는 US여야 합니다.`);
      return null;
    }
    if (!symbol || !name) {
      errors.push(`${lineHint}: symbol, name은 필수입니다.`);
      return null;
    }
    const row: PortfolioLedgerWatchlistInput = {
      market,
      symbol,
      name,
      sector: rec.sector != null ? String(rec.sector) : null,
      investment_memo: rec.investment_memo != null ? String(rec.investment_memo) : null,
      interest_reason: rec.interest_reason != null ? String(rec.interest_reason) : null,
      desired_buy_range: rec.desired_buy_range != null ? String(rec.desired_buy_range) : null,
      observation_points: rec.observation_points != null ? String(rec.observation_points) : null,
      priority: rec.priority != null ? String(rec.priority) : null,
    };
    return { kind: 'insert_watchlist', row };
  }

  errors.push(`${lineHint}: 허용된 테이블만 사용할 수 있습니다: ${HOLDINGS_TABLE}, ${WATCHLIST_TABLE}`);
  return null;
}

/** WHERE symbol = 'x' AND market = 'KR' 형태(순서 가변) */
function parseDeleteWhere(whereRaw: string): { symbol: string; market: 'KR' | 'US' } | null {
  const w = whereRaw.replace(/\s+/g, ' ').trim();
  const sym = w.match(/symbol\s*=\s*'([^']*)'/i);
  const mar = w.match(/market\s*=\s*'([^']*)'/i);
  if (!sym || !mar) return null;
  const market = normalizeMarket(mar[1]);
  if (!market) return null;
  return { symbol: sym[1].trim(), market };
}

function parseDelete(stmt: string, errors: string[], lineHint: string): ParsedLedgerOperation | null {
  const m = stmt.match(/^\s*DELETE\s+FROM\s+(\S+)\s+WHERE\s+([\s\S]+)$/i);
  if (!m) {
    errors.push(`${lineHint}: DELETE 형식: DELETE FROM … WHERE symbol = '…' AND market = 'KR|US'`);
    return null;
  }
  const table = m[1].toLowerCase();
  const whereParsed = parseDeleteWhere(m[2]);
  if (!whereParsed) {
    errors.push(`${lineHint}: WHERE에 symbol, market 조건이 필요합니다.`);
    return null;
  }
  if (table === HOLDINGS_TABLE) {
    return { kind: 'delete_holding', ...whereParsed };
  }
  if (table === WATCHLIST_TABLE) {
    return { kind: 'delete_watchlist', ...whereParsed };
  }
  errors.push(`${lineHint}: DELETE 대상 테이블이 올바르지 않습니다.`);
  return null;
}

export function validateLedgerSql(sql: string): PortfolioLedgerValidateResponseBody {
  const errors: string[] = [];
  const operations: ParsedLedgerOperation[] = [];

  if (!sql?.trim()) {
    return {
      ok: false,
      errors: ['SQL이 비어 있습니다.'],
      operations: [],
      summary: { insertHoldings: 0, insertWatchlist: 0, deleteHoldings: 0, deleteWatchlist: 0 },
    };
  }

  if (FORBIDDEN.test(sql)) {
    return {
      ok: false,
      errors: ['DROP/ALTER/CREATE 등 위험한 구문은 허용되지 않습니다.'],
      operations: [],
      summary: { insertHoldings: 0, insertWatchlist: 0, deleteHoldings: 0, deleteWatchlist: 0 },
    };
  }

  const stmts = splitSqlStatements(sql);
  let idx = 0;
  for (const stmt of stmts) {
    idx += 1;
    const hint = `문장 ${idx}`;
    const upper = stmt.toUpperCase().trim();
    if (!upper) continue;

    if (upper.startsWith('INSERT')) {
      const op = parseInsert(stmt, errors, hint);
      if (op) operations.push(op);
      continue;
    }
    if (upper.startsWith('DELETE')) {
      const op = parseDelete(stmt, errors, hint);
      if (op) operations.push(op);
      continue;
    }
    if (upper.startsWith('UPDATE') || upper.startsWith('SELECT')) {
      errors.push(`${hint}: UPDATE/SELECT는 지원하지 않습니다. INSERT 또는 DELETE만 사용하세요.`);
      continue;
    }
    errors.push(`${hint}: 지원하지 않는 문장입니다.`);
  }

  const summary = {
    insertHoldings: operations.filter((o) => o.kind === 'insert_holding').length,
    insertWatchlist: operations.filter((o) => o.kind === 'insert_watchlist').length,
    deleteHoldings: operations.filter((o) => o.kind === 'delete_holding').length,
    deleteWatchlist: operations.filter((o) => o.kind === 'delete_watchlist').length,
  };

  if (stmts.length > 0 && operations.length === 0 && errors.length === 0) {
    errors.push('실행 가능한 INSERT 또는 DELETE가 없습니다.');
  }

  return {
    ok: errors.length === 0 && operations.length > 0,
    errors,
    operations,
    summary,
  };
}
