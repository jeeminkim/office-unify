import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey } from '@office-unify/shared-types';

export const DECISION_JOURNAL_TYPES = [
  'considered_buy',
  'skipped_buy',
  'considered_sell',
  'skipped_sell',
  'considered_add',
  'skipped_add',
  'hold',
  'wait',
  'other',
] as const;

export type DecisionJournalType = (typeof DECISION_JOURNAL_TYPES)[number];

export const DECISION_JOURNAL_OUTCOMES = ['pending', 'good_decision', 'bad_decision', 'mixed', 'unknown'] as const;
export type DecisionJournalOutcome = (typeof DECISION_JOURNAL_OUTCOMES)[number];

export type WebDecisionJournalRow = {
  id: string;
  user_key: string;
  market: string | null;
  symbol: string | null;
  name: string | null;
  decision_type: string;
  decision_date: string;
  context_price: number | string | null;
  sector_score: number | string | null;
  sector_zone: string | null;
  portfolio_weight: number | string | null;
  reason: string;
  expected_trigger: string | null;
  invalidation_condition: string | null;
  review_after_days: number | null;
  review_due_date: string | null;
  later_outcome: string | null;
  outcome_note: string | null;
  linked_trade_journal_id: string | null;
  linked_holding_key: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DecisionJournalInsertInput = {
  market?: string | null;
  symbol?: string | null;
  name?: string | null;
  decisionType: DecisionJournalType;
  decisionDate?: string;
  contextPrice?: number | null;
  sectorScore?: number | null;
  sectorZone?: string | null;
  portfolioWeight?: number | null;
  reason: string;
  expectedTrigger?: string | null;
  invalidationCondition?: string | null;
  reviewAfterDays?: number | null;
  reviewDueDate?: string | null;
  linkedTradeJournalId?: string | null;
  linkedHoldingKey?: string | null;
};

function addDaysIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function insertDecisionJournalEntry(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  input: DecisionJournalInsertInput,
): Promise<WebDecisionJournalRow> {
  const decisionDate = (input.decisionDate ?? new Date().toISOString().slice(0, 10)).trim();
  const reviewAfter = input.reviewAfterDays != null && Number.isFinite(input.reviewAfterDays) ? Math.floor(input.reviewAfterDays) : 30;
  const reviewDue = input.reviewDueDate?.trim() || addDaysIsoDate(decisionDate, reviewAfter);
  const row = {
    user_key: userKey as string,
    market: input.market?.trim() || null,
    symbol: input.symbol?.trim().toUpperCase() || null,
    name: input.name?.trim() || null,
    decision_type: input.decisionType,
    decision_date: decisionDate,
    context_price: input.contextPrice ?? null,
    sector_score: input.sectorScore ?? null,
    sector_zone: input.sectorZone?.trim() || null,
    portfolio_weight: input.portfolioWeight ?? null,
    reason: input.reason.trim(),
    expected_trigger: input.expectedTrigger?.trim() || null,
    invalidation_condition: input.invalidationCondition?.trim() || null,
    review_after_days: reviewAfter,
    review_due_date: reviewDue,
    later_outcome: 'pending' as const,
    outcome_note: null,
    linked_trade_journal_id: input.linkedTradeJournalId ?? null,
    linked_holding_key: input.linkedHoldingKey?.trim() || null,
  };
  const { data, error } = await client.from('web_decision_journal_entries').insert(row).select().single();
  if (error) throw error;
  return data as WebDecisionJournalRow;
}

export type DecisionJournalListFilters = {
  symbol?: string;
  market?: string;
  decisionType?: string;
  outcome?: string;
  dueOnly?: boolean;
  limit?: number;
};

export async function listDecisionJournalEntries(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  filters: DecisionJournalListFilters = {},
): Promise<WebDecisionJournalRow[]> {
  const limit = filters.limit != null && Number.isFinite(filters.limit) ? Math.min(200, Math.max(1, filters.limit)) : 80;
  let q = client
    .from('web_decision_journal_entries')
    .select('*')
    .eq('user_key', userKey as string)
    .order('decision_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (filters.market?.trim()) q = q.eq('market', filters.market.trim().toUpperCase());
  if (filters.symbol?.trim()) q = q.eq('symbol', filters.symbol.trim().toUpperCase());
  if (filters.decisionType?.trim()) q = q.eq('decision_type', filters.decisionType.trim());
  if (filters.outcome?.trim()) q = q.eq('later_outcome', filters.outcome.trim());
  if (filters.dueOnly) {
    const today = new Date().toISOString().slice(0, 10);
    q = q.lte('review_due_date', today).eq('later_outcome', 'pending');
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WebDecisionJournalRow[];
}

export async function listDecisionJournalReviewDue(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  limit = 100,
): Promise<WebDecisionJournalRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client
    .from('web_decision_journal_entries')
    .select('*')
    .eq('user_key', userKey as string)
    .eq('later_outcome', 'pending')
    .lte('review_due_date', today)
    .order('review_due_date', { ascending: true })
    .limit(Math.min(200, Math.max(1, limit)));
  if (error) throw error;
  return (data ?? []) as WebDecisionJournalRow[];
}

export async function getDecisionJournalEntryById(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  id: string,
): Promise<WebDecisionJournalRow | null> {
  const { data, error } = await client
    .from('web_decision_journal_entries')
    .select('*')
    .eq('user_key', userKey as string)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as WebDecisionJournalRow) ?? null;
}

export async function updateDecisionJournalEntry(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  id: string,
  patch: Partial<{
    reason: string;
    expected_trigger: string | null;
    invalidation_condition: string | null;
    review_after_days: number;
    review_due_date: string | null;
    later_outcome: DecisionJournalOutcome;
    outcome_note: string | null;
    context_price: number | null;
    sector_score: number | null;
    sector_zone: string | null;
    portfolio_weight: number | null;
    name: string | null;
    decision_type: DecisionJournalType;
  }>,
): Promise<void> {
  const { error } = await client
    .from('web_decision_journal_entries')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_key', userKey as string)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDecisionJournalEntry(client: SupabaseClient, userKey: OfficeUserKey, id: string): Promise<void> {
  const { error } = await client.from('web_decision_journal_entries').delete().eq('user_key', userKey as string).eq('id', id);
  if (error) throw error;
}
