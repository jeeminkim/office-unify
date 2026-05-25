import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AppNav mobile navigation', () => {
  it('keeps desktop nav hidden on mobile and prevents vertical label wrapping', () => {
    const source = readFileSync(join(process.cwd(), 'components/AppNav.tsx'), 'utf8');

    expect(source).toContain('md:block');
    expect(source).toContain('md:hidden');
    expect(source).toContain('whitespace-nowrap');
    expect(source).toContain('[word-break:keep-all]');
    expect(source).toContain('[overflow-wrap:normal]');
    expect(source).toContain('[writing-mode:horizontal-tb]');
  });
});
