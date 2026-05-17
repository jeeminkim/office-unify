import { describe, expect, it } from 'vitest';
import type { SqlReadinessProbeDeps } from '@/lib/server/sqlReadinessCheck';
import {
  buildSqlReadinessSummary,
  evaluateSqlReadinessItem,
  runSqlReadinessCheck,
} from '@/lib/server/sqlReadinessCheck';
import { getSqlReadinessRegistry } from '@/lib/server/sqlReadinessRegistry';

function allTablesExist(tables: string[]): SqlReadinessProbeDeps {
  return {
    tableExists: async (t) => tables.includes(t),
    columnsExist: async () => ({ exists: [], missing: [] }),
    routineExists: async () => true,
  };
}

describe('sqlReadinessCheck', () => {
  it('marks item ready when all tables exist', async () => {
    const reg = getSqlReadinessRegistry().find((r) => r.order === 17)!;
    const item = await evaluateSqlReadinessItem(reg, allTablesExist(['today_candidate_impressions']));
    expect(item.status).toBe('ready');
  });

  it('marks item missing when table absent', async () => {
    const reg = getSqlReadinessRegistry().find((r) => r.order === 17)!;
    const item = await evaluateSqlReadinessItem(reg, allTablesExist([]));
    expect(item.status).toBe('missing');
  });

  it('marks item partial when some columns missing', async () => {
    const reg = getSqlReadinessRegistry().find((r) => r.order === 13)!;
    const deps: SqlReadinessProbeDeps = {
      tableExists: async () => true,
      columnsExist: async (_t, cols) => ({
        exists: cols.slice(0, 1),
        missing: cols.slice(1),
      }),
      routineExists: async () => true,
    };
    const item = await evaluateSqlReadinessItem(reg, deps);
    expect(item.status).toBe('partial');
  });

  it('marks optional item optional_missing when tables absent', async () => {
    const reg = getSqlReadinessRegistry().find((r) => r.order === 4)!;
    const item = await evaluateSqlReadinessItem(reg, allTablesExist([]));
    expect(item.status).toBe('optional_missing');
  });

  it('returns ok:false actionHint when probe fails', async () => {
    const deps: SqlReadinessProbeDeps = {
      tableExists: async () => null,
      columnsExist: async () => null,
      routineExists: async () => null,
    };
    const result = await runSqlReadinessCheck(deps, getSqlReadinessRegistry().slice(0, 2));
    expect(result.groups.length).toBeGreaterThan(0);
    expect(result.qualityMeta.readOnly).toBe(true);
    expect(result.groups[0]?.items.some((i) => i.status === 'unknown')).toBe(true);
  });

  it('buildSqlReadinessSummary counts statuses', () => {
    const summary = buildSqlReadinessSummary([
      {
        order: 1,
        sqlFile: 'a.sql',
        label: 'a',
        purpose: 'p',
        status: 'ready',
        requiredLevel: 'core',
        featureArea: 'x',
        checkedObjects: { tables: [], columns: [], indexes: [], routines: [] },
        degradedSymptoms: [],
        actionHint: 'h',
        docsPath: 'docs',
      },
      {
        order: 2,
        sqlFile: 'b.sql',
        label: 'b',
        purpose: 'p',
        status: 'missing',
        requiredLevel: 'recommended',
        featureArea: 'x',
        checkedObjects: { tables: [], columns: [], indexes: [], routines: [] },
        degradedSymptoms: [],
        actionHint: 'h',
        docsPath: 'docs',
      },
    ]);
    expect(summary.total).toBe(2);
    expect(summary.ready).toBe(1);
    expect(summary.missing).toBe(1);
  });
});
