import type { PersonaKey } from '../../analysisTypes';
import { runAnalysisPipeline } from '../../analysisPipelineService';

export { runPortfolioDebateAppService } from './runPortfolioDebateAppService';
export type { RunPortfolioDebateAppResult, PortfolioDebateSegment } from './runPortfolioDebateAppService';
export { runTrendAnalysisAppService } from './runTrendAnalysisAppService';
export type { RunTrendAnalysisAppResult } from './runTrendAnalysisAppService';
export { runOpenTopicDebateAppService } from './runOpenTopicDebateAppService';
export type { RunOpenTopicDebateAppResult, OpenTopicBroadcast } from './runOpenTopicDebateAppService';
export { runDecisionEngineAppService, formatDecisionSummaryForDiscord } from './runDecisionEngineAppService';

export async function runAnalysisAppService(params: {
  discordUserId: string;
  chatHistoryId: number | null;
  analysisType: string;
  personaOutputs: Array<{
    personaKey: PersonaKey;
    personaName: string;
    responseText: string;
    providerName?: string;
    modelName?: string;
    estimatedCostUsd?: number;
  }>;
  baseContext?: any;
}): Promise<void> {
  await runAnalysisPipeline(params);
}

