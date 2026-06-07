import type { QuoteRootCauseCode } from '@office-unify/shared-types';
import type { ActionIntent } from '@/lib/actionIntentContract';

export type ActionReasonDomain =
  | 'quote'
  | 'today_candidate'
  | 'us_diagnostics'
  | 'infographic'
  | 'committee'
  | 'research'
  | 'smart_resolve'
  | 'action_item'
  | 'system';

export type ActionReasonCode =
  | QuoteRootCauseCode
  | 'insufficient_source'
  | 'source_title_only'
  | 'source_metadata_only'
  | 'source_blocked_or_empty'
  | 'structured_output_partial'
  | 'structured_output_parse_failed'
  | 'partial_recovery'
  | 'manual_review_required'
  | 'ambiguous_name';

export type ActionReasonIntent =
  | 'navigate'
  | 'read_only_check'
  | 'confirmed_post'
  | 'action_inbox_save'
  | 'local_only'
  | 'external_manual_check'
  | 'copy'
  | 'disabled';

export type ActionReasonSeverity = 'info' | 'warning' | 'critical';

export type ActionReasonContract = {
  code: ActionReasonCode;
  domain: ActionReasonDomain;
  severity: ActionReasonSeverity;
  userTitleKo: string;
  userMessageKo: string;
  actionHintKo: string;
  primaryIntent: ActionReasonIntent;
  primaryActionKey: string;
  primaryActionLabelKo: string;
  secondaryActionKeys: string[];
  disabledReasonKo?: string;
  isTradeCandidate: false;
  isWriteAction: boolean;
  requiresConfirm: boolean;
  isGoogleFinanceProblem?: boolean;
  isQuoteUsabilityProblem?: boolean;
  isMappingProblem?: boolean;
  isSourceExtractionProblem?: boolean;
  isCommitteeRecoveryProblem?: boolean;
  noTradeGuardrailKo?: string;
};

const NO_TRADE_GUARDRAIL = '이 항목은 관찰/진단용입니다. 자동 매매, 자동 주문, 자동 리밸런싱을 실행하지 않습니다.';

export const BUTTON_INTENT_LABELS: Record<ActionReasonIntent, string> = {
  navigate: '화면 이동만 합니다. 저장은 없습니다.',
  read_only_check: '상태만 확인합니다. 데이터는 변경하지 않습니다.',
  confirmed_post: '확인 후 명시적 POST로만 실행합니다.',
  action_inbox_save: 'Action Inbox에 작업으로 저장합니다.',
  local_only: '현재 화면에서만 반영합니다.',
  external_manual_check: '외부 화면에서 직접 확인합니다.',
  copy: '내용을 복사합니다.',
  disabled: '현재 조건에서는 사용할 수 없습니다.',
};

const CONTRACTS: Record<ActionReasonCode, ActionReasonContract> = {
  provider_not_configured: {
    code: 'provider_not_configured',
    domain: 'quote',
    severity: 'warning',
    userTitleKo: '시세 provider 상태 확인 필요',
    userMessageKo: '실시간 또는 준실시간 시세 provider가 설정되지 않았습니다. Google Sheets는 지연 read-back 보조 경로입니다.',
    actionHintKo: '시세 provider 상태를 확인하고, Google Finance 설정 문제로 단정하지 마세요.',
    primaryIntent: 'read_only_check',
    primaryActionKey: 'quote_provider_status',
    primaryActionLabelKo: '시세 provider 상태 확인',
    secondaryActionKeys: ['quote_recovery'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isQuoteUsabilityProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  google_finance_anchor_missing: {
    code: 'google_finance_anchor_missing',
    domain: 'quote',
    severity: 'critical',
    userTitleKo: 'Google Finance anchor 누락',
    userMessageKo: 'Google Finance anchor 행이 없거나 설정되지 않았습니다. 이 경우에만 Google Finance 설정이 primary action입니다.',
    actionHintKo: 'Google Finance 설정 화면에서 anchor/formula 상태를 확인하세요.',
    primaryIntent: 'navigate',
    primaryActionKey: 'google_finance_setup',
    primaryActionLabelKo: 'Google Finance 설정',
    secondaryActionKeys: ['quote_recovery'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isGoogleFinanceProblem: true,
    isQuoteUsabilityProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  google_finance_formula_pending: {
    code: 'google_finance_formula_pending',
    domain: 'quote',
    severity: 'warning',
    userTitleKo: 'Google Finance formula 계산 대기',
    userMessageKo: 'Google Sheets 수식이 아직 계산 중입니다. 잠시 후 read-back 상태를 다시 확인하세요.',
    actionHintKo: '새 후보를 만들지 말고 formula read-back을 재확인하세요.',
    primaryIntent: 'read_only_check',
    primaryActionKey: 'google_finance_readback_check',
    primaryActionLabelKo: '수식 read-back 확인',
    secondaryActionKeys: ['quote_recovery'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isGoogleFinanceProblem: true,
    isQuoteUsabilityProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  google_finance_readback_partial: {
    code: 'google_finance_readback_partial',
    domain: 'quote',
    severity: 'warning',
    userTitleKo: 'Google Finance read-back 일부 누락',
    userMessageKo: '일부 행은 read-back 되었지만 사용 가능한 시세 커버리지가 부족합니다.',
    actionHintKo: 'Google Finance read-back과 ticker mapping을 함께 확인하세요.',
    primaryIntent: 'read_only_check',
    primaryActionKey: 'google_finance_readback_check',
    primaryActionLabelKo: 'read-back 상태 확인',
    secondaryActionKeys: ['quote_recovery', 'ticker_resolver'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isGoogleFinanceProblem: true,
    isQuoteUsabilityProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  quote_rows_missing: {
    code: 'quote_rows_missing',
    domain: 'quote',
    severity: 'warning',
    userTitleKo: '시세 행 누락',
    userMessageKo: 'portfolio quote 행이 부족합니다. 이미 사용 가능한 값은 유지하고 누락/부분 행만 복구 대상으로 봅니다.',
    actionHintKo: 'Quote Recovery에서 시세 상태를 확인하고 필요한 경우에만 명시적으로 refresh하세요.',
    primaryIntent: 'read_only_check',
    primaryActionKey: 'quote_recovery',
    primaryActionLabelKo: '시세 상태 확인',
    secondaryActionKeys: ['quote_status_check'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isQuoteUsabilityProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  ticker_mapping_required: {
    code: 'ticker_mapping_required',
    domain: 'smart_resolve',
    severity: 'warning',
    userTitleKo: 'ticker mapping 확인 필요',
    userMessageKo: '종목 코드, US ticker, Google Finance ticker 중 일부가 없거나 모호합니다.',
    actionHintKo: 'Ticker resolver에서 코드와 googleTicker를 확인하세요.',
    primaryIntent: 'navigate',
    primaryActionKey: 'ticker_resolver',
    primaryActionLabelKo: 'ticker resolver 확인',
    secondaryActionKeys: ['quote_status_check'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isQuoteUsabilityProblem: true,
    isMappingProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  invalid_symbol: {
    code: 'invalid_symbol',
    domain: 'smart_resolve',
    severity: 'warning',
    userTitleKo: '잘못된 symbol',
    userMessageKo: 'symbol 형식이 유효하지 않습니다. refresh 전에 종목 코드나 US ticker를 확인하세요.',
    actionHintKo: '6자리 국내 코드 또는 올바른 US ticker를 입력하세요.',
    primaryIntent: 'local_only',
    primaryActionKey: 'fix_symbol',
    primaryActionLabelKo: 'symbol 수정',
    secondaryActionKeys: ['ticker_resolver'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isQuoteUsabilityProblem: true,
    isMappingProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  missing_google_ticker: {
    code: 'missing_google_ticker',
    domain: 'smart_resolve',
    severity: 'warning',
    userTitleKo: 'Google ticker 누락',
    userMessageKo: 'Google Finance ticker가 없어 quote read-back이 불완전할 수 있습니다.',
    actionHintKo: 'Smart resolve 또는 ticker resolver로 googleTicker를 채우세요.',
    primaryIntent: 'navigate',
    primaryActionKey: 'ticker_resolver',
    primaryActionLabelKo: 'ticker 채우기',
    secondaryActionKeys: ['quote_status_check'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isQuoteUsabilityProblem: true,
    isMappingProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  us_market_feed_missing: {
    code: 'us_market_feed_missing',
    domain: 'us_diagnostics',
    severity: 'warning',
    userTitleKo: 'US market feed 없음',
    userMessageKo: '미국 시장 feed가 비어 있어 US 후보를 만들 수 없습니다. Google Finance 설정 문제가 아닐 수 있습니다.',
    actionHintKo: 'US market feed 상태를 먼저 확인하세요.',
    primaryIntent: 'read_only_check',
    primaryActionKey: 'us_market_feed_check',
    primaryActionLabelKo: 'US market feed 확인',
    secondaryActionKeys: ['quote_status_check'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isSourceExtractionProblem: false,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  us_signal_mapping_empty: {
    code: 'us_signal_mapping_empty',
    domain: 'us_diagnostics',
    severity: 'warning',
    userTitleKo: 'US signal mapping 비어 있음',
    userMessageKo: 'US 신호는 있지만 국내 후보나 관심종목 후보로 연결되지 않았습니다.',
    actionHintKo: 'Watchlist sector/theme, Sector Radar mapping, US-KR theme registry를 확인하세요.',
    primaryIntent: 'navigate',
    primaryActionKey: 'us_mapping_diagnosis',
    primaryActionLabelKo: 'US mapping 진단',
    secondaryActionKeys: ['theme_mapping_check'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isMappingProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  theme_mapping_required: {
    code: 'theme_mapping_required',
    domain: 'today_candidate',
    severity: 'warning',
    userTitleKo: '관심종목 theme mapping 필요',
    userMessageKo: '관심종목 sector/theme mapping이 없거나 약해 후보 연결이 제한됩니다.',
    actionHintKo: '관심종목의 sector/theme 태그를 확인하세요.',
    primaryIntent: 'navigate',
    primaryActionKey: 'theme_mapping_check',
    primaryActionLabelKo: 'theme mapping 확인',
    secondaryActionKeys: ['us_mapping_diagnosis'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isMappingProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  queue_policy_suppressed: {
    code: 'queue_policy_suppressed',
    domain: 'today_candidate',
    severity: 'info',
    userTitleKo: '후보 운영 정책으로 보류',
    userMessageKo: '후보가 있었지만 반복 노출, 리스크 리뷰, 데이터 품질 이유로 primary deck에서 보류되었습니다.',
    actionHintKo: '후보 운영 상태와 diagnostic slot을 확인하세요.',
    primaryIntent: 'read_only_check',
    primaryActionKey: 'candidate_queue_review',
    primaryActionLabelKo: '후보 운영 상태 보기',
    secondaryActionKeys: ['quote_recovery'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  discovery_universe_empty: {
    code: 'discovery_universe_empty',
    domain: 'today_candidate',
    severity: 'info',
    userTitleKo: 'Discovery universe 부족',
    userMessageKo: 'read-only discovery에서 충분히 resolve된 후보를 찾지 못했습니다.',
    actionHintKo: '관심 theme와 resolver coverage를 확인하세요.',
    primaryIntent: 'read_only_check',
    primaryActionKey: 'discovery_universe_check',
    primaryActionLabelKo: 'discovery 상태 확인',
    secondaryActionKeys: ['ticker_resolver'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isMappingProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  insufficient_candidates: {
    code: 'insufficient_candidates',
    domain: 'today_candidate',
    severity: 'info',
    userTitleKo: '후보 부족',
    userMessageKo: '현재 관찰 기준을 통과한 후보가 부족합니다. 후보를 강제로 만들지 않습니다.',
    actionHintKo: '부족 사유와 data-check slot을 확인하세요.',
    primaryIntent: 'read_only_check',
    primaryActionKey: 'candidate_shortage_review',
    primaryActionLabelKo: '후보 부족 사유 보기',
    secondaryActionKeys: ['discovery_universe_check'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  insufficient_source: {
    code: 'insufficient_source',
    domain: 'infographic',
    severity: 'warning',
    userTitleKo: '본문 부족',
    userMessageKo: 'URL에서 infographic draft를 만들 만큼 충분한 본문을 읽지 못했습니다.',
    actionHintKo: '본문을 붙여넣거나 추출된 텍스트를 편집한 뒤 다시 생성하세요.',
    primaryIntent: 'local_only',
    primaryActionKey: 'edit_or_paste_source_text',
    primaryActionLabelKo: '본문 붙여넣기',
    secondaryActionKeys: ['retry_extract', 'copy_readable_summary', 'send_research_seed'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isSourceExtractionProblem: true,
  },
  source_title_only: {
    code: 'source_title_only',
    domain: 'infographic',
    severity: 'warning',
    userTitleKo: '제목만 추출됨',
    userMessageKo: 'URL에서 제목 수준의 정보만 확인되었습니다. 성공한 본문 추출로 보지 않습니다.',
    actionHintKo: '본문을 직접 붙여넣거나 다른 URL을 시도하세요.',
    primaryIntent: 'local_only',
    primaryActionKey: 'paste_body_text',
    primaryActionLabelKo: '본문 붙여넣기',
    secondaryActionKeys: ['retry_extract'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isSourceExtractionProblem: true,
  },
  source_metadata_only: {
    code: 'source_metadata_only',
    domain: 'infographic',
    severity: 'warning',
    userTitleKo: '메타데이터만 추출됨',
    userMessageKo: 'URL에서 source/title/metadata만 확인되었습니다.',
    actionHintKo: '본문 텍스트를 붙여넣어 summary-first fallback을 사용하세요.',
    primaryIntent: 'local_only',
    primaryActionKey: 'paste_body_text',
    primaryActionLabelKo: '본문 붙여넣기',
    secondaryActionKeys: ['retry_extract'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isSourceExtractionProblem: true,
  },
  source_blocked_or_empty: {
    code: 'source_blocked_or_empty',
    domain: 'infographic',
    severity: 'warning',
    userTitleKo: '소스 차단 또는 빈 본문',
    userMessageKo: 'URL 접근이 차단되었거나 본문이 비어 있습니다.',
    actionHintKo: '외부 페이지에서 본문을 직접 확인한 뒤 붙여넣으세요.',
    primaryIntent: 'external_manual_check',
    primaryActionKey: 'external_source_check',
    primaryActionLabelKo: '외부에서 본문 확인',
    secondaryActionKeys: ['paste_body_text'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isSourceExtractionProblem: true,
  },
  structured_output_partial: {
    code: 'structured_output_partial',
    domain: 'committee',
    severity: 'info',
    userTitleKo: '일부 발언 복구 필요',
    userMessageKo: '위원회 발언 일부가 손상되어 핵심만 복구해 표시합니다.',
    actionHintKo: '부분 복구 또는 짧은 재생성을 사용하세요. 저장은 명시 버튼에서만 실행됩니다.',
    primaryIntent: 'local_only',
    primaryActionKey: 'committee_partial_recovery',
    primaryActionLabelKo: '부분 복구',
    secondaryActionKeys: ['save_action_inbox'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isCommitteeRecoveryProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  structured_output_parse_failed: {
    code: 'structured_output_parse_failed',
    domain: 'committee',
    severity: 'warning',
    userTitleKo: '구조화 출력 해석 실패',
    userMessageKo: '모델 출력 형식이 손상되어 raw artifact 대신 읽을 수 있는 요약을 표시합니다.',
    actionHintKo: '핵심 요약을 확인하고 필요하면 발언을 다시 생성하세요.',
    primaryIntent: 'local_only',
    primaryActionKey: 'committee_repair_summary',
    primaryActionLabelKo: '핵심 요약 확인',
    secondaryActionKeys: ['committee_regenerate'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isCommitteeRecoveryProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  partial_recovery: {
    code: 'partial_recovery',
    domain: 'committee',
    severity: 'info',
    userTitleKo: '부분 복구',
    userMessageKo: '일부 출력만 복구되었습니다. 기본 UI에는 snake_case/raw JSON을 직접 노출하지 않습니다.',
    actionHintKo: '복구 preview를 확인하고 필요할 때만 Action Inbox에 저장하세요.',
    primaryIntent: 'local_only',
    primaryActionKey: 'committee_partial_recovery',
    primaryActionLabelKo: '복구 preview 보기',
    secondaryActionKeys: ['save_action_inbox'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isCommitteeRecoveryProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  manual_review_required: {
    code: 'manual_review_required',
    domain: 'smart_resolve',
    severity: 'warning',
    userTitleKo: '수동 확인 필요',
    userMessageKo: '자동으로 확정하기에는 근거가 부족합니다. 코드를 직접 확인해야 합니다.',
    actionHintKo: 'UNKNOWN/manual_review 후보는 폼 자동 채우기를 비활성화합니다.',
    primaryIntent: 'disabled',
    primaryActionKey: 'manual_review_required',
    primaryActionLabelKo: '수동 확인 필요',
    secondaryActionKeys: ['ticker_resolver'],
    disabledReasonKo: '수동 확인 전에는 local fill을 사용할 수 없습니다.',
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isMappingProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  ambiguous_name: {
    code: 'ambiguous_name',
    domain: 'smart_resolve',
    severity: 'warning',
    userTitleKo: '여러 후보가 있습니다',
    userMessageKo: '입력한 이름이 여러 종목과 매칭됩니다.',
    actionHintKo: '시장, 6자리 코드, US ticker 중 하나를 확인해 후보를 좁히세요.',
    primaryIntent: 'local_only',
    primaryActionKey: 'choose_resolve_candidate',
    primaryActionLabelKo: '후보 직접 선택',
    secondaryActionKeys: ['ticker_resolver'],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    isMappingProblem: true,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
  unknown: {
    code: 'unknown',
    domain: 'system',
    severity: 'warning',
    userTitleKo: '원인 분류 필요',
    userMessageKo: '아직 이 문제의 원인을 분류하지 못했습니다.',
    actionHintKo: '관련 진단 화면에서 상태를 다시 확인하세요.',
    primaryIntent: 'read_only_check',
    primaryActionKey: 'diagnostic_review',
    primaryActionLabelKo: '진단 확인',
    secondaryActionKeys: [],
    isTradeCandidate: false,
    isWriteAction: false,
    requiresConfirm: false,
    noTradeGuardrailKo: NO_TRADE_GUARDRAIL,
  },
};

export function getActionReasonContract(
  code: ActionReasonCode | string | undefined,
  overrides: Partial<ActionReasonContract> = {},
): ActionReasonContract {
  const key = isActionReasonCode(code) ? code : 'unknown';
  return { ...CONTRACTS[key], ...overrides, code: overrides.code ?? CONTRACTS[key].code };
}

export function isActionReasonCode(code: unknown): code is ActionReasonCode {
  return typeof code === 'string' && code in CONTRACTS;
}

export function resolveActionReasonFromQuoteRootCause(input: {
  code?: QuoteRootCauseCode | ActionReasonCode | string;
}): ActionReasonContract {
  return getActionReasonContract(input.code);
}

export function resolveActionReasonFromUsDiagnostics(input: {
  reasonCode?: ActionReasonCode | string;
  gatingReason?: string;
  quoteRootCauseCode?: QuoteRootCauseCode | string;
  usMarketFeedMissing?: boolean;
  usSignalMappingEmpty?: boolean;
}): ActionReasonContract {
  if (isActionReasonCode(input.reasonCode)) return getActionReasonContract(input.reasonCode);
  if (isActionReasonCode(input.quoteRootCauseCode)) return getActionReasonContract(input.quoteRootCauseCode);
  if (input.usMarketFeedMissing) return getActionReasonContract('us_market_feed_missing');
  if (input.usSignalMappingEmpty || input.gatingReason === 'us_signal_mapping_empty') {
    return getActionReasonContract('us_signal_mapping_empty');
  }
  return getActionReasonContract('unknown');
}

export function resolveActionReasonFromSourceExtraction(input: {
  sourceQualityReason?: string;
  sourceExtractionQuality?: string;
  sourceExtractionStatus?: string;
}): ActionReasonContract {
  const reason = input.sourceQualityReason ?? input.sourceExtractionQuality;
  if (reason === 'title_only') return getActionReasonContract('source_title_only');
  if (reason === 'metadata_only') return getActionReasonContract('source_metadata_only');
  if (reason === 'blocked_or_empty') return getActionReasonContract('source_blocked_or_empty');
  if (reason === 'too_short' || reason === 'needs_manual_paste' || input.sourceExtractionStatus === 'insufficient_source') {
    return getActionReasonContract('insufficient_source');
  }
  return getActionReasonContract('unknown');
}

export function resolveActionReasonFromCommitteeWarning(input: {
  code?: string;
  status?: string;
  parseFailed?: boolean;
}): ActionReasonContract {
  if (input.code === 'structured_output_parse_failed' || input.parseFailed) {
    return getActionReasonContract('structured_output_parse_failed');
  }
  if (input.code === 'partial_recovery') return getActionReasonContract('partial_recovery');
  if (input.status === 'partial') return getActionReasonContract('structured_output_partial');
  if (input.code === 'manual_review_required') return getActionReasonContract('manual_review_required');
  return getActionReasonContract('unknown');
}

export function resolveActionReasonFromSmartResolve(input: {
  failureCode?: string;
  symbol?: string;
  matchType?: string;
  confidence?: string;
}): ActionReasonContract {
  if (input.failureCode === 'ambiguous_name') return getActionReasonContract('ambiguous_name');
  if (input.failureCode === 'invalid_symbol') return getActionReasonContract('invalid_symbol');
  if (input.symbol === 'UNKNOWN' || input.matchType === 'manual_review' || input.confidence === 'low') {
    return getActionReasonContract('manual_review_required');
  }
  return getActionReasonContract('unknown');
}

export function formatActionReasonForUser(code: ActionReasonCode | string | undefined): {
  title: string;
  message: string;
  actionHint: string;
} {
  const reason = getActionReasonContract(code);
  return {
    title: reason.userTitleKo,
    message: reason.userMessageKo,
    actionHint: reason.actionHintKo,
  };
}

export function getPrimaryActionForReason(code: ActionReasonCode | string | undefined): {
  intent: ActionReasonIntent;
  actionKey: string;
  labelKo: string;
  disabledReasonKo?: string;
} {
  const reason = getActionReasonContract(code);
  return {
    intent: reason.primaryIntent,
    actionKey: reason.primaryActionKey,
    labelKo: reason.primaryActionLabelKo,
    disabledReasonKo: reason.disabledReasonKo,
  };
}

export function getButtonIntentLabel(intent: ActionReasonIntent): string {
  return BUTTON_INTENT_LABELS[intent];
}

export function assertReasonHasUsableAction(reason: ActionReasonContract): boolean {
  if (!reason.primaryActionKey || !reason.primaryActionLabelKo) return false;
  if (reason.primaryIntent === 'disabled') return Boolean(reason.disabledReasonKo);
  if (reason.isWriteAction || reason.requiresConfirm) return reason.primaryIntent === 'confirmed_post';
  return true;
}

export type ActionReasonViewModel = {
  code: ActionReasonCode;
  domain: ActionReasonDomain;
  severity: ActionReasonSeverity;
  titleKo: string;
  messageKo: string;
  actionHintKo: string;
  shortLabelKo: string;
  noTradeGuardrailKo?: string;
};

export type PrimaryActionViewModel = {
  reasonCode: ActionReasonCode;
  actionKey: string;
  labelKo: string;
  href?: string;
  actionIntent: ActionIntent;
  disabledReasonKo?: string;
  afterClickExpectationKo: string;
  isWriteAction: boolean;
  requiresConfirm: boolean;
};

export type DiagnosticDisplaySlotViewModel = {
  reasonCode: ActionReasonCode;
  title: string;
  subtitle: string;
  reasonLabelKo: string;
  actionHintKo: string;
  primaryAction: string;
  primaryActionLabelKo: string;
  primaryActionHref?: string;
  actionIntent: ActionIntent;
  isTradeCandidate: false;
};

export type ActionStepReasonViewModel = {
  reasonCode: ActionReasonCode;
  title: string;
  description: string;
  href?: string;
  buttonLabel: string;
  actionIntent: ActionIntent;
  afterClickExpectationKo: string;
  disabledReasonKo?: string;
};

const ACTION_HREF_BY_KEY: Record<string, string | undefined> = {
  google_finance_setup: '/ops/google-finance-setup',
  google_finance_readback_check: '/ops/google-finance-setup',
  quote_provider_status: '/system-status',
  quote_recovery: '/portfolio',
  quote_status_check: '/portfolio',
  ticker_resolver: '/portfolio-ledger',
  fix_symbol: '/portfolio-ledger',
  us_market_feed_check: '/system-status',
  us_mapping_diagnosis: '/sector-radar',
  theme_mapping_check: '/sector-radar',
  candidate_queue_review: '/',
  candidate_shortage_review: '/',
  discovery_universe_check: '/',
  diagnostic_review: '/system-status',
  save_action_inbox: '/action-items',
};

const ACTION_INTENT_BY_REASON_INTENT: Record<ActionReasonIntent, ActionIntent> = {
  navigate: 'navigate_only',
  read_only_check: 'read_only_check',
  confirmed_post: 'confirmed_write',
  action_inbox_save: 'save_to_inbox',
  local_only: 'local_only',
  external_manual_check: 'external_manual_check',
  copy: 'copy_only',
  disabled: 'disabled',
};

const AFTER_CLICK_EXPECTATION_BY_INTENT: Record<ActionIntent, string> = {
  navigate_only: '화면 이동만 합니다. 저장, 주문, 관심종목 등록은 자동으로 실행하지 않습니다.',
  read_only_check: '상태를 읽어서 확인합니다. 데이터 변경, 주문, 관심종목 등록은 실행하지 않습니다.',
  confirmed_write: '명시 확인 버튼을 누른 경우에만 쓰기 요청을 보냅니다.',
  feedback_update: '사용자가 선택한 피드백 상태만 저장합니다. 주문이나 후보 생성은 실행하지 않습니다.',
  save_to_inbox: 'Action Inbox에 검토 작업으로만 저장합니다. 자동 주문이나 자동 매매는 실행하지 않습니다.',
  save_note: '노트 저장 동작입니다. 투자 실행 지시는 만들지 않습니다.',
  local_only: '현재 화면의 입력 또는 미리보기 상태만 바꿉니다.',
  external_manual_check: '외부 화면에서 사용자가 직접 확인해야 합니다. 앱이 자동으로 처리하지 않습니다.',
  copy_only: '내용을 클립보드에 복사합니다. 저장이나 전송은 실행하지 않습니다.',
  disabled: '현재 조건에서는 사용할 수 없습니다.',
};

export function normalizeUnknownSnakeCaseReason(raw: string | undefined): string {
  const clean = (raw ?? '').trim();
  if (!clean) return '추가 확인 필요';
  return `추가 확인 필요: ${clean.replace(/[_-]+/g, ' ')}`;
}

export function resolveReasonCodeFromLegacyString(
  raw: string | undefined,
  _domain?: ActionReasonDomain,
): ActionReasonCode {
  const v = (raw ?? '').trim().toLowerCase();
  if (isActionReasonCode(v)) return v;
  if (!v) return 'unknown';
  if (v.includes('sheets_anchor_zero') || v.includes('anchor 0') || v.includes('google finance anchor')) {
    return 'google_finance_anchor_missing';
  }
  if (v.includes('formula_pending')) return 'google_finance_formula_pending';
  if (v.includes('readback_partial')) return 'google_finance_readback_partial';
  if (
    v.includes('quote_not_returned') ||
    v.includes('missing_row') ||
    v.includes('googlefinance_no_data') ||
    v.includes('price_not_numeric') ||
    v.includes('row_empty') ||
    v.includes('parse_failed')
  ) {
    return 'quote_rows_missing';
  }
  if (v.includes('provider_not_configured') || v.includes('quote provider')) return 'provider_not_configured';
  if (v.includes('usmarketdatamissing') || v.includes('market feed') || v.includes('yahoo') || v.includes('feed')) {
    return 'us_market_feed_missing';
  }
  if (v.includes('us_signal_mapping_empty')) return 'us_signal_mapping_empty';
  if (v.includes('theme_mapping_required') || v.includes('theme')) return 'theme_mapping_required';
  if (v.includes('missing_google_ticker')) return 'missing_google_ticker';
  if (v.includes('invalid_symbol')) return 'invalid_symbol';
  if (v.includes('mapping_required') || v.includes('mapping_missing') || v.includes('ticker') || v.includes('resolve')) {
    return 'ticker_mapping_required';
  }
  if (v.includes('queue_policy') || v.includes('repeat_suppression') || v.includes('risk_queue')) {
    return 'queue_policy_suppressed';
  }
  if (v.includes('discovery_universe')) return 'discovery_universe_empty';
  if (v.includes('insufficient_candidate')) return 'insufficient_candidates';
  if (v.includes('title_only')) return 'source_title_only';
  if (v.includes('metadata_only')) return 'source_metadata_only';
  if (v.includes('blocked_or_empty') || v.includes('empty_source')) return 'source_blocked_or_empty';
  if (v.includes('too_short') || v.includes('needs_manual_paste') || v.includes('insufficient_source')) {
    return 'insufficient_source';
  }
  if (v.includes('structured_output_parse_failed')) return 'structured_output_parse_failed';
  if (v.includes('structured_output_partial')) return 'structured_output_partial';
  if (v.includes('partial_recovery')) return 'partial_recovery';
  if (v.includes('manual_review')) return 'manual_review_required';
  if (v.includes('ambiguous')) return 'ambiguous_name';
  return 'unknown';
}

export function buildReasonViewModel(
  codeOrLegacy: ActionReasonCode | string | undefined,
  context: { fallbackLabelKo?: string } = {},
): ActionReasonViewModel {
  const code = isActionReasonCode(codeOrLegacy) ? codeOrLegacy : resolveReasonCodeFromLegacyString(codeOrLegacy);
  const reason = getActionReasonContract(code);
  const fallbackLabel = code === 'unknown' ? normalizeUnknownSnakeCaseReason(context.fallbackLabelKo ?? codeOrLegacy) : undefined;
  return {
    code: reason.code,
    domain: reason.domain,
    severity: reason.severity,
    titleKo: fallbackLabel ?? reason.userTitleKo,
    messageKo: code === 'unknown' && fallbackLabel ? fallbackLabel : reason.userMessageKo,
    actionHintKo: reason.actionHintKo,
    shortLabelKo: fallbackLabel ?? reason.userTitleKo,
    noTradeGuardrailKo: reason.noTradeGuardrailKo,
  };
}

export function buildPrimaryActionViewModel(
  codeOrLegacy: ActionReasonCode | string | undefined,
): PrimaryActionViewModel {
  const reason = getActionReasonContract(resolveReasonCodeFromLegacyString(codeOrLegacy));
  const actionIntent = ACTION_INTENT_BY_REASON_INTENT[reason.primaryIntent];
  return {
    reasonCode: reason.code,
    actionKey: reason.primaryActionKey,
    labelKo: reason.primaryActionLabelKo,
    href: ACTION_HREF_BY_KEY[reason.primaryActionKey],
    actionIntent,
    disabledReasonKo: reason.disabledReasonKo,
    afterClickExpectationKo: AFTER_CLICK_EXPECTATION_BY_INTENT[actionIntent],
    isWriteAction: reason.isWriteAction,
    requiresConfirm: reason.requiresConfirm,
  };
}

export function buildDiagnosticDisplaySlotFromReason(
  codeOrLegacy: ActionReasonCode | string | undefined,
  context: { title?: string; subtitle?: string } = {},
): DiagnosticDisplaySlotViewModel {
  const reason = buildReasonViewModel(codeOrLegacy);
  const action = buildPrimaryActionViewModel(reason.code);
  return {
    reasonCode: reason.code,
    title: context.title ?? reason.titleKo,
    subtitle: context.subtitle ?? reason.messageKo,
    reasonLabelKo: reason.shortLabelKo,
    actionHintKo: reason.actionHintKo,
    primaryAction: action.actionKey,
    primaryActionLabelKo: action.labelKo,
    primaryActionHref: action.href,
    actionIntent: action.actionIntent,
    isTradeCandidate: false,
  };
}

export function buildActionStepFromReason(
  codeOrLegacy: ActionReasonCode | string | undefined,
  context: { title?: string; description?: string } = {},
): ActionStepReasonViewModel {
  const reason = buildReasonViewModel(codeOrLegacy);
  const action = buildPrimaryActionViewModel(reason.code);
  return {
    reasonCode: reason.code,
    title: context.title ?? reason.titleKo,
    description: context.description ?? reason.messageKo,
    href: action.href,
    buttonLabel: action.labelKo,
    actionIntent: action.actionIntent,
    afterClickExpectationKo: action.afterClickExpectationKo,
    disabledReasonKo: action.disabledReasonKo,
  };
}
