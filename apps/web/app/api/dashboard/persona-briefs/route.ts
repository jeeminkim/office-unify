import { NextResponse } from 'next/server';
import { countOpsEventsOpenError, listActionItemsForUser } from '@office-unify/supabase-access';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { buildDailyInvestmentConversationState, getKstDateKey } from '@/lib/dailyInvestmentConversationModel';
import { buildDailyInvestmentActivitySummary } from '@/lib/server/dailyInvestmentActivitySummary';
import {
  buildJuniorAnalystMorningBrief,
  buildJuniorAnalystPostPbFollowup,
  type UserInvestmentMemory,
} from '@/lib/server/juniorAnalystDailyBrief';
import {
  buildSystemAnalystDataCoverage,
  buildSystemAnalystInsights,
  buildSystemAnalystRecommendations,
} from '@/lib/server/systemAnalystInsights';
import {
  listExistingInvestmentMemories,
  listRecentPbConversationRecords,
} from '@/lib/server/privateBankerMemoryStore';

export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const todayDate = getKstDateKey();
  const [conversationRecords, memories, openItems, inProgressItems, openErrorCount] = await Promise.all([
    listRecentPbConversationRecords(supabase, auth.userKey, 20).catch(() => []),
    listExistingInvestmentMemories(supabase, auth.userKey).catch(() => []),
    listActionItemsForUser(supabase, auth.userKey as string, { status: 'open', limit: 100 }).catch(() => []),
    listActionItemsForUser(supabase, auth.userKey as string, { status: 'in_progress', limit: 100 }).catch(() => []),
    countOpsEventsOpenError(supabase, auth.userKey).catch(() => 0),
  ]);
  const todayConversations = conversationRecords.filter((record) => !record.createdAt || getKstDateKey(record.createdAt) === todayDate);
  const latestTodayConversation = todayConversations[0];
  const userInvestmentMemories: UserInvestmentMemory[] = memories.map((memory) => ({
    title: memory.title,
    content: memory.content,
    memoryType: memory.memoryType,
    relatedSymbols: memory.relatedSymbols,
    relatedThemes: memory.relatedThemes,
  }));

  const morningBrief = buildJuniorAnalystMorningBrief({
    recentPbDailyConversations: todayConversations.map((record) => record.summary),
    userInvestmentMemories,
    openActionItems: [...openItems, ...inProgressItems],
  });
  const postPbFollowup = latestTodayConversation
    ? buildJuniorAnalystPostPbFollowup({
        morningBrief,
        pbConversationSummary: latestTodayConversation.summary,
        promotedMemories: userInvestmentMemories,
        openActionItems: [...openItems, ...inProgressItems],
      })
    : undefined;
  const dailyActivitySummary = buildDailyInvestmentActivitySummary({
    pbDailyConversation: latestTodayConversation?.summary,
    juniorMorningBrief: morningBrief,
    juniorFollowup: postPbFollowup,
    openActionItems: [...openItems, ...inProgressItems],
    promotedMemories: userInvestmentMemories,
  });
  const dailyConversation = buildDailyInvestmentConversationState({
    todayDate,
    morningBrief,
    pbConversation: latestTodayConversation
      ? { ...latestTodayConversation.summary, id: latestTodayConversation.id }
      : null,
    postPbFollowup,
    dailyActivitySummary,
  });
  const systemInput = {
    opsEventsSummary: { openErrorCount },
    userFeedbackSignals: [...openItems, ...inProgressItems],
    mobileUxSignals: [{ area: 'dashboard_home_order', compactOperations: true }],
    pbMemorySignals: userInvestmentMemories,
  };
  const systemAnalyst = buildSystemAnalystInsights(systemInput);
  const dataCoverage = buildSystemAnalystDataCoverage(systemInput);
  const recommendations = buildSystemAnalystRecommendations(systemAnalyst);

  return NextResponse.json({
    ok: true,
    juniorAnalyst: {
      morningBrief,
      postPbFollowup,
    },
    systemAnalyst: {
      insights: systemAnalyst,
      dataCoverage,
      recommendations,
    },
    dailyConversation,
    dailyActivitySummary,
    qualityMeta: {
      readOnly: true,
      pbDailyAvailable: todayConversations.length > 0,
      memoryAvailable: memories.length > 0,
      opsAvailable: typeof openErrorCount === 'number',
      warnings: [
        ...(memories.length === 0 ? ['오늘 대화는 가능하지만 최근 투자 기억 연결은 아직 준비되지 않았습니다.'] : []),
        ...(openErrorCount === 0 ? ['최근 시스템 오류 기록이 없어 시스템 담당자는 화면 구조와 현재 readiness만 기준으로 의견을 냈습니다.'] : []),
      ],
    },
    legacyJuniorAnalyst: morningBrief,
    legacySystemAnalyst: systemAnalyst,
    sourceSummary: {
      recentPbConversationCount: conversationRecords.length,
      todayPbConversationCount: todayConversations.length,
      investmentMemoryCount: memories.length,
      openActionItemCount: openItems.length + inProgressItems.length,
      openOpsErrorCount: openErrorCount,
    },
  });
}
