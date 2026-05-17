import { describe, expect, it } from 'vitest';
import {
  filterSqlReadinessItems,
  formatSqlReadinessSummaryLine,
  sqlReadinessRequiredLevelLabel,
  sqlReadinessStatusBadgeLabel,
} from '@/lib/sqlReadinessUi';
import type { SqlReadinessItem } from '@office-unify/shared-types';

const sampleItem = (status: SqlReadinessItem['status']): SqlReadinessItem => ({
  order: 1,
  sqlFile: 'x.sql',
  label: 'x',
  purpose: 'p',
  status,
  requiredLevel: 'core',
  featureArea: 'x',
  checkedObjects: { tables: [], columns: [], indexes: [], routines: [] },
  degradedSymptoms: [],
  actionHint: 'h',
  docsPath: 'docs',
});

describe('sqlReadinessUi', () => {
  it('filters missing only', () => {
    const items = [sampleItem('ready'), sampleItem('missing')];
    expect(filterSqlReadinessItems(items, true)).toHaveLength(1);
    expect(filterSqlReadinessItems(items, false)).toHaveLength(2);
  });

  it('formats summary line', () => {
    expect(
      formatSqlReadinessSummaryLine({
        total: 10,
        ready: 8,
        missing: 1,
        partial: 1,
        optionalMissing: 0,
        coreMissing: 0,
        recommendedMissing: 1,
        checkedAt: 't',
      }),
    ).toContain('8/10');
  });

  it('badge labels', () => {
    expect(sqlReadinessStatusBadgeLabel('optional_missing')).toBe('optional');
    expect(sqlReadinessRequiredLevelLabel('core')).toBe('core');
  });
});
