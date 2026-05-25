import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PersonaCoachHint } from './PersonaCoachHint';

describe('PersonaCoachHint', () => {
  it('renders compact dismissible role guidance', () => {
    const html = renderToStaticMarkup(<PersonaCoachHint role="risk_manager" variant="compact" />);

    expect(html).toContain('역할 안내');
    expect(html).toContain('오늘은 숨기기');
    expect(html).not.toContain('alert(');
  });
});
