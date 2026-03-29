import type { ClaimType, EvidenceScope } from '../../analysisTypes';
import { extractClaimsWithFallbackMeta } from '../../claimLedgerService';

export type ExtractedClaim = {
  claim_order: number;
  claim_type: ClaimType;
  claim_text: string;
  claim_summary: string;
  evidence_scope: EvidenceScope;
  confidence_score: number;
  novelty_score: number;
  usefulness_score: number;
  has_numeric_anchor: boolean;
  is_actionable: boolean;
  is_downside_focused: boolean;
};

export type ClaimExtractionResult = {
  claims: ExtractedClaim[];
  fallbackUsed: boolean;
};

export type ClaimMappingPolicy = 'direct_claim_id' | 'scored_candidate' | 'legacy_only';

export function extractClaimsByContract(params: {
  responseText: string;
  analysisType: string;
  personaName: string;
}): ClaimExtractionResult {
  const { claims, usedSingleClaimFallback } = extractClaimsWithFallbackMeta({
    responseText: params.responseText,
    analysisType: params.analysisType,
    personaName: params.personaName
  });
  return {
    claims,
    /** true when heuristic line extraction failed and full-text single claim path ran */
    fallbackUsed: usedSingleClaimFallback
  };
}


