import type { OpsRunbookPlan, QuoteRecoveryRunbookResponse } from '@office-unify/shared-types';
import type { TodayBriefWithCandidatesResponse } from '@/lib/todayCandidatesContract';

export type CopilotStatusLevel =
  | 'ready'
  | 'needs_attention'
  | 'degraded_but_usable'
  | 'blocked_needs_input'
  | 'running'
  | 'completed';

export type CopilotPrimaryAction =
  | 'run_quote_recovery'
  | 'run_data_readiness'
  | 'rerun_today_brief'
  | 'show_us_discovery'
  | 'open_ticker_resolver'
  | 'open_quote_status'
  | 'edit_source_text'
  | 'copy_readable_summary'
  | 'send_to_research'
  | 'start_committee'
  | 'save_action_item'
  | 'none';

export type CopilotStatusCard = {
  titleKo: string;
  messageKo: string;
  statusLevel: CopilotStatusLevel;
  primaryAction: CopilotPrimaryAction;
  primaryActionLabelKo: string;
  secondaryActions?: CopilotPrimaryAction[];
  noTradeGuardrailKo: string;
  isWriteAction: boolean;
  requiresConfirm: boolean;
};

export type DashboardCopilotStatusInput = {
  todayBrief: TodayBriefWithCandidatesResponse | null;
  quoteRecovery: QuoteRecoveryRunbookResponse | null;
  opsRunbookPlan: OpsRunbookPlan | null;
  busy?: boolean;
  errorMessage?: string | null;
  openActionItemCount?: number | null;
};

export type PortfolioQuoteCopilotStatusInput = {
  missingTickerCount: number;
  autoApplicableTickerCount: number;
  quoteUsabilityStatus?: string | null;
  tickerSavedButMissingRow?: boolean;
  busy?: boolean;
  errorMessage?: string | null;
};

const GUARDRAIL =
  '매수·매도 지시가 아니며 자동매매, 자동주문, 자동 리밸런싱, 관심종목 자동 등록을 실행하지 않습니다.';

function card(input: Omit<CopilotStatusCard, 'noTradeGuardrailKo'>): CopilotStatusCard {
  return {
    ...input,
    noTradeGuardrailKo: GUARDRAIL,
  };
}

export function buildDashboardCopilotStatus(input: DashboardCopilotStatusInput): CopilotStatusCard {
  if (input.busy) {
    return card({
      titleKo: '오늘의 진행 도우미',
      messageKo: '시세, 후보, 데이터 준비 상태를 확인하는 중입니다. 결과가 부족해도 읽을 수 있는 진단 카드로 이어집니다.',
      statusLevel: 'running',
      primaryAction: 'none',
      primaryActionLabelKo: '확인 중',
      secondaryActions: ['open_quote_status', 'show_us_discovery'],
      isWriteAction: false,
      requiresConfirm: false,
    });
  }

  if (input.errorMessage) {
    return card({
      titleKo: '점검 흐름에 확인이 필요합니다',
      messageKo: '일부 상태 확인이 실패했습니다. 먼저 시세·후보 점검을 다시 실행하고, 계속 막히면 원인별 진단 카드에서 다음 행동을 선택하세요.',
      statusLevel: 'blocked_needs_input',
      primaryAction: 'run_quote_recovery',
      primaryActionLabelKo: '시세·후보 한 번에 점검',
      secondaryActions: ['open_quote_status', 'open_ticker_resolver'],
      isWriteAction: false,
      requiresConfirm: true,
    });
  }

  const deckContract = input.todayBrief?.qualityMeta?.todayCandidates?.deckContract;
  if (deckContract?.usDiscoverySlotPresent || deckContract?.deckContractStatus === 'degraded_with_discovery') {
    return card({
      titleKo: '오늘의 진행 도우미',
      messageKo:
        '미국 시세는 아직 완전하지 않지만 관찰 후보는 표시할 수 있습니다. 먼저 시세·후보를 한 번에 점검하고, 부족하면 미국 관찰 후보를 이어서 보세요.',
      statusLevel: 'degraded_but_usable',
      primaryAction: 'run_quote_recovery',
      primaryActionLabelKo: '시세·후보 한 번에 점검',
      secondaryActions: ['show_us_discovery', 'send_to_research'],
      isWriteAction: false,
      requiresConfirm: true,
    });
  }

  if ((deckContract?.filledUsSlots ?? 1) < (deckContract?.targetUsSlots ?? 1)) {
    return card({
      titleKo: '미국 후보 점검이 필요합니다',
      messageKo: '미국 가격 후보가 부족합니다. 시세 상태, ticker mapping, US feed/provider 상태를 한 번에 점검하세요.',
      statusLevel: 'needs_attention',
      primaryAction: 'run_quote_recovery',
      primaryActionLabelKo: '시세·후보 한 번에 점검',
      secondaryActions: ['open_ticker_resolver', 'show_us_discovery'],
      isWriteAction: false,
      requiresConfirm: true,
    });
  }

  const blockedSteps = input.opsRunbookPlan?.blockedSteps.length ?? 0;
  const confirmSteps = input.opsRunbookPlan?.confirmRequiredSteps.length ?? 0;
  if (blockedSteps > 0 || confirmSteps > 0) {
    return card({
      titleKo: '데이터 준비 상태를 이어서 확인하세요',
      messageKo: '일부 데이터 준비 단계가 남아 있습니다. 실행은 사용자가 누를 때만 진행되고, Sheets repair/write는 기본으로 실행하지 않습니다.',
      statusLevel: 'needs_attention',
      primaryAction: 'run_data_readiness',
      primaryActionLabelKo: '미국 데이터 준비 실행',
      secondaryActions: ['open_quote_status', 'open_ticker_resolver'],
      isWriteAction: false,
      requiresConfirm: true,
    });
  }

  if ((input.openActionItemCount ?? 0) > 0) {
    return card({
      titleKo: '오늘의 진행 도우미',
      messageKo: '오늘 확인할 데이터와 후보 흐름은 사용할 수 있습니다. 남은 Action Inbox 항목을 이어서 정리하면 됩니다.',
      statusLevel: 'ready',
      primaryAction: 'save_action_item',
      primaryActionLabelKo: 'Action Inbox 보기',
      secondaryActions: ['rerun_today_brief'],
      isWriteAction: false,
      requiresConfirm: false,
    });
  }

  return card({
    titleKo: '오늘의 진행 도우미',
    messageKo: '시세, 후보, 데이터 준비 상태가 사용할 수 있는 상태입니다. 필요하면 Today Brief를 다시 확인하세요.',
    statusLevel: 'ready',
    primaryAction: 'rerun_today_brief',
    primaryActionLabelKo: '요약 새로고침',
    secondaryActions: ['open_quote_status'],
    isWriteAction: false,
    requiresConfirm: false,
  });
}

export function buildPortfolioQuoteCopilotStatus(input: PortfolioQuoteCopilotStatusInput): CopilotStatusCard {
  if (input.busy) {
    return card({
      titleKo: '시세 점검 도우미',
      messageKo: '포트폴리오 시세, ticker mapping, Google Finance read-back 상태를 확인하는 중입니다.',
      statusLevel: 'running',
      primaryAction: 'none',
      primaryActionLabelKo: '확인 중',
      secondaryActions: ['open_quote_status'],
      isWriteAction: false,
      requiresConfirm: false,
    });
  }

  if (input.errorMessage) {
    return card({
      titleKo: '시세 점검을 다시 이어가야 합니다',
      messageKo: '방금 확인 흐름이 실패했습니다. 원본 오류 대신 ticker mapping과 시세 상태를 한 번에 다시 확인하세요.',
      statusLevel: 'blocked_needs_input',
      primaryAction: 'run_quote_recovery',
      primaryActionLabelKo: '시세 한 번에 점검',
      secondaryActions: ['open_quote_status', 'open_ticker_resolver'],
      isWriteAction: false,
      requiresConfirm: true,
    });
  }

  if (input.missingTickerCount > 0) {
    return card({
      titleKo: 'ticker mapping이 먼저 필요합니다',
      messageKo: `${input.missingTickerCount}개 종목은 google_ticker가 없어 시세 행을 만들 수 없습니다. 먼저 추천 ticker를 찾고, 검증 전 기본값 또는 직접 입력으로 이어가세요.`,
      statusLevel: 'needs_attention',
      primaryAction: 'run_quote_recovery',
      primaryActionLabelKo: '추천 ticker 찾기',
      secondaryActions: ['open_ticker_resolver', 'open_quote_status'],
      isWriteAction: false,
      requiresConfirm: true,
    });
  }

  if (input.autoApplicableTickerCount > 0) {
    return card({
      titleKo: '적용 가능한 ticker 후보가 있습니다',
      messageKo: '추천 ticker 후보가 준비됐습니다. 적용은 사용자가 명시적으로 누를 때만 저장되며, 이후 30~90초 뒤 시세 상태를 다시 확인하세요.',
      statusLevel: 'needs_attention',
      primaryAction: 'open_ticker_resolver',
      primaryActionLabelKo: '추천 결과 확인',
      secondaryActions: ['open_quote_status'],
      isWriteAction: false,
      requiresConfirm: true,
    });
  }

  if (input.tickerSavedButMissingRow || input.quoteUsabilityStatus === 'partial' || input.quoteUsabilityStatus === 'failed') {
    return card({
      titleKo: '시세 행 확인이 필요합니다',
      messageKo: 'ticker는 준비됐지만 일부 시세 행이 없거나 아직 충분히 읽히지 않았습니다. 이미 사용 가능한 시세는 그대로 두고 빈 행만 점검하세요.',
      statusLevel: 'degraded_but_usable',
      primaryAction: 'run_quote_recovery',
      primaryActionLabelKo: '시세 한 번에 점검',
      secondaryActions: ['open_quote_status'],
      isWriteAction: false,
      requiresConfirm: true,
    });
  }

  return card({
    titleKo: '시세 상태를 사용할 수 있습니다',
    messageKo: '포트폴리오 시세는 현재 화면 표시와 요약 계산에 사용할 수 있습니다. 필요하면 read-only 상태 확인만 다시 실행하세요.',
    statusLevel: 'ready',
    primaryAction: 'open_quote_status',
    primaryActionLabelKo: '시세 상태 확인',
    secondaryActions: ['open_ticker_resolver'],
    isWriteAction: false,
    requiresConfirm: false,
  });
}

export function copilotActionHref(action: CopilotPrimaryAction): string | null {
  switch (action) {
    case 'open_ticker_resolver':
      return '/portfolio-ledger#ticker';
    case 'open_quote_status':
      return '/ops/google-finance-setup';
    case 'show_us_discovery':
      return '#today-candidates';
    case 'send_to_research':
      return '/research-center';
    case 'start_committee':
      return '/committee-discussion';
    case 'save_action_item':
      return '/action-items';
    default:
      return null;
  }
}

export function copilotActionLabelKo(action: CopilotPrimaryAction): string {
  switch (action) {
    case 'run_quote_recovery':
      return '시세·후보 한 번에 점검';
    case 'run_data_readiness':
      return '미국 데이터 준비 실행';
    case 'rerun_today_brief':
      return '요약 새로고침';
    case 'show_us_discovery':
      return '미국 관찰 후보 보기';
    case 'open_ticker_resolver':
      return 'Ticker resolver 확인';
    case 'open_quote_status':
      return '시세 상태 확인';
    case 'edit_source_text':
      return '본문 붙여넣기';
    case 'copy_readable_summary':
      return '읽기 요약 복사';
    case 'send_to_research':
      return 'Research로 이어가기';
    case 'start_committee':
      return '위원회 토론 시작';
    case 'save_action_item':
      return 'Action Inbox 보기';
    case 'none':
    default:
      return '다음 행동 없음';
  }
}
