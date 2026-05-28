import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionStepRunner } from '@/components/ActionStepRunner';
import type { ActionItemDetailJson } from '@office-unify/shared-types';

describe('ActionStepRunner', () => {
  it('renders the first three runnable steps and collapses the rest behind More', () => {
    const detail: ActionItemDetailJson = {
      notTradeInstruction: true,
      actionSteps: [1, 2, 3, 4, 5].map((n) => ({
        stepId: `s-${n}`,
        label: `Step ${n}`,
        category: 'checklist',
        status: 'open',
      })),
    };

    const html = renderToStaticMarkup(<ActionStepRunner detail={detail} />);
    expect(html).toContain('Step 1');
    expect(html).toContain('Step 2');
    expect(html).toContain('Step 3');
    expect(html).not.toContain('Step 4');
    expect(html).toContain('+2개 더 보기');
  });

  it('does not render doNotDo category as runnable action rows', () => {
    const detail: ActionItemDetailJson = {
      notTradeInstruction: true,
      actionSteps: [
        { stepId: 'run', label: 'Check evidence', category: 'checklist', status: 'open' },
        { stepId: 'guard', label: 'Do not execute orders', category: 'do_not_do', status: 'open' },
      ],
    };

    const html = renderToStaticMarkup(<ActionStepRunner detail={detail} />);
    expect(html).toContain('Check evidence');
    expect(html).toContain('Do not execute orders');
    expect(html).toContain('<li>Do not execute orders</li>');
  });
});
