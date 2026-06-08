import { describe, expect, it } from 'vitest';
import { buildUsDiscoveryCandidates } from './usDiscoveryCandidates';

describe('buildUsDiscoveryCandidates', () => {
  it('returns read-only US discovery candidates from preferred themes', () => {
    const candidates = buildUsDiscoveryCandidates({
      preferredThemes: ['AI', 'power', 'data center'],
      limit: 1,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.symbol).toBe('VRT');
    expect(candidates[0]?.market).toBe('US');
    expect(candidates[0]?.isWatchlist).toBe(false);
    expect(candidates[0]?.isTradeCandidate).toBe(false);
    expect(JSON.stringify(candidates)).not.toMatch(/매수|매도|buy|sell|order|rebalance/i);
    expect(candidates[0]?.actionHintKo).toContain('시세 미확인');
  });

  it('excludes already selected symbols without writing to watchlist', () => {
    const candidates = buildUsDiscoveryCandidates({
      preferredThemes: ['AI', 'power', 'data center'],
      excludeSymbols: ['VRT'],
      limit: 1,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.symbol).not.toBe('VRT');
    expect(candidates[0]?.isWatchlist).toBe(false);
    expect(candidates[0]?.isTradeCandidate).toBe(false);
  });
});
