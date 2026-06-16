import { describe, expect, it } from 'vitest';
import { buildDashboardHomeSectionOrder } from './dashboardHomeSections';

describe('dashboard home section order', () => {
  it('puts daily conversation and compact summary before operations and runbooks', () => {
    const order = buildDashboardHomeSectionOrder();
    expect(order.slice(0, 3)).toEqual([
      'daily_conversation',
      'compact_memory_junior_summary',
      'today_core',
    ]);
    expect(order.indexOf('daily_conversation')).toBeLessThan(order.indexOf('operations_summary'));
    expect(order.indexOf('operations_summary')).toBeLessThan(order.indexOf('data_readiness_runbook'));
  });
});
