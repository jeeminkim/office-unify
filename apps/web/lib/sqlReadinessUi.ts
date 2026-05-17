import type {
  SqlReadinessItem,
  SqlReadinessItemStatus,
  SqlReadinessRequiredLevel,
  SqlReadinessSummary,
} from '@office-unify/shared-types';

export function sqlReadinessStatusBadgeLabel(status: SqlReadinessItemStatus): string {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'missing':
      return 'missing';
    case 'partial':
      return 'partial';
    case 'optional_missing':
      return 'optional';
    case 'unknown':
      return 'unknown';
    default:
      return status;
  }
}

export function sqlReadinessRequiredLevelLabel(level: SqlReadinessRequiredLevel): string {
  if (level === 'core') return 'core';
  if (level === 'recommended') return 'recommended';
  return 'optional';
}

export function sqlReadinessStatusTone(
  status: SqlReadinessItemStatus,
  requiredLevel: SqlReadinessRequiredLevel,
): string {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  if (status === 'partial') return 'border-orange-200 bg-orange-50 text-orange-950';
  if (status === 'unknown') return 'border-slate-300 bg-slate-100 text-slate-800';
  if (status === 'optional_missing' || requiredLevel === 'optional') {
    return 'border-slate-200 bg-slate-50 text-slate-700';
  }
  if (requiredLevel === 'core' && (status === 'missing' || status === 'partial')) {
    return 'border-red-200 bg-red-50 text-red-950';
  }
  if (requiredLevel === 'recommended' && (status === 'missing' || status === 'partial')) {
    return 'border-amber-200 bg-amber-50 text-amber-950';
  }
  return 'border-amber-200 bg-amber-50 text-amber-950';
}

export function filterSqlReadinessItems(
  items: SqlReadinessItem[],
  missingOnly: boolean,
): SqlReadinessItem[] {
  if (!missingOnly) return items;
  return items.filter((i) => i.status !== 'ready');
}

export function flattenSqlReadinessGroups(
  groups: { groupName: string; items: SqlReadinessItem[] }[],
): SqlReadinessItem[] {
  return groups.flatMap((g) => g.items);
}

export function formatSqlReadinessSummaryLine(summary: SqlReadinessSummary): string {
  return `${summary.ready}/${summary.total} ready · ${summary.missing} missing · ${summary.partial} partial`;
}
