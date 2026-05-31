import { describe, expect, it } from 'vitest';
import { normalizeInfographicSourceUrl } from '@/lib/server/infographicSourceExtract';

describe('infographicSourceExtract URL normalization', () => {
  it('normalizes Naver mobile blog URLs to desktop blog host', () => {
    expect(normalizeInfographicSourceUrl('https://m.blog.naver.com/example/223456789012')).toBe(
      'https://blog.naver.com/example/223456789012',
    );
  });

  it('rejects invalid URLs before fetch', () => {
    expect(() => normalizeInfographicSourceUrl('not-a-url')).toThrow();
  });
});
