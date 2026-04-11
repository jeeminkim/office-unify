import type { PersonaKey } from '@office-unify/shared-types';
import { normalizeSymbol } from '@office-unify/shared-utils';
import {
  DECISION_ENGINE_VERSION,
  FINANCIAL_COMMITTEE_KEYS,
  analysisTypeToRouteFamily,
} from '@office-unify/ai-office-engine';

/**
 * 워크스페이스 패키지가 번들에 정상 포함되는지 확인하는 얇은 헬퍼.
 * supabase-access는 클라이언트 번들 혼입을 피하기 위해 여기서 참조하지 않는다.
 */
export function getOfficeUnifyWorkspaceSmoke(): {
  personaSample: PersonaKey;
  symbol: string;
  routeFamily: ReturnType<typeof analysisTypeToRouteFamily>;
  decisionEngineVersion: string;
  committeeCount: number;
} {
  return {
    personaSample: 'RAY',
    symbol: normalizeSymbol('  aapl  '),
    routeFamily: analysisTypeToRouteFamily('portfolio_review'),
    decisionEngineVersion: DECISION_ENGINE_VERSION,
    committeeCount: FINANCIAL_COMMITTEE_KEYS.length,
  };
}
