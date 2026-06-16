export const DASHBOARD_HOME_SECTION_ORDER = [
  'daily_conversation',
  'compact_memory_junior_summary',
  'today_core',
  'operations_summary',
  'data_readiness_runbook',
] as const;

export type DashboardHomeSectionKey = (typeof DASHBOARD_HOME_SECTION_ORDER)[number];

export function buildDashboardHomeSectionOrder(): DashboardHomeSectionKey[] {
  return [...DASHBOARD_HOME_SECTION_ORDER];
}
