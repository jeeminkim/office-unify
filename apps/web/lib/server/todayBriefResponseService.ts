import type { TodayBriefWithCandidatesResponse } from "@/lib/todayCandidatesContract";
import type { TodayBriefRequestOptions } from "@/lib/server/todayBriefRouteRequest";

export type BuildTodayBriefResponseParams = {
  options: TodayBriefRequestOptions;
  userKey: string;
};

/**
 * Prep only: the current `/api/dashboard/today-brief` route still owns the broad response assembly.
 *
 * Next extraction target:
 * - auth and `NextResponse` stay in the route
 * - data loading, candidate generation, qualityMeta assembly, and bounded impression/snapshot writes move here
 * - the returned shape must preserve `TodayBriefWithCandidatesResponse`
 */
export async function buildTodayBriefResponse(
  params: BuildTodayBriefResponseParams,
): Promise<TodayBriefWithCandidatesResponse> {
  void params;
  throw new Error("buildTodayBriefResponse is a planned extraction point and is not wired yet.");
}
