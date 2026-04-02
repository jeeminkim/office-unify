/**
 * 운영 로그 읽기 전용 분석 — advisory / 진단용. DB·프로세스 kill 등 자동 조치 없음.
 */
import fs from 'fs';
import path from 'path';
import { LOG_DIR, DAILY_DIR, getKstDateKey, controlPanelLogPath, HEALTH_FILE } from './loggingPaths';

export type SystemHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DiagnosedIssue = {
  problem: string;
  explanation: string;
  impact: string;
  action: string;
  severity: IssueSeverity;
  patternId: string;
};

export type LogAnalysisResult = {
  systemStatus: SystemHealthStatus;
  issues: DiagnosedIssue[];
  warnings: DiagnosedIssue[];
  insights: string[];
  analyzedAt: string;
  meta: {
    filesRead: string[];
    linesScannedApprox: number;
    windowMinutes: number;
    healthSnapshot?: Record<string, unknown> | null;
  };
  /** 내부 디버그용 원문 스니펫 (상세 보기 버튼) */
  _snippets?: string[];
};

const CACHE_TTL_MS = 30_000;
let analysisCache: { at: number; result: LogAnalysisResult } | null = null;

const TAIL_LINES_PER_FILE = 450;
const WINDOW_MINUTES = 30;

const LINE_TS = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/;

function parseLineTimeMs(line: string): number | null {
  const m = LINE_TS.exec(line);
  if (!m) return null;
  const t = Date.parse(m[1]);
  return Number.isFinite(t) ? t : null;
}

function readTailLines(filePath: string, maxLines: number): string[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(l => l.length > 0);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function collectLogFilePaths(): string[] {
  const keys = [getKstDateKey(), prevDateKey()];
  const out: string[] = [];
  for (const dk of keys) {
    out.push(path.join(DAILY_DIR, `office-error_${dk}.log`));
    out.push(path.join(DAILY_DIR, `office-ops_${dk}.log`));
    out.push(path.join(DAILY_DIR, `office-runtime_${dk}.log`));
    out.push(path.join(LOG_DIR, 'quote', `quote.log_${dk}`));
    out.push(path.join(LOG_DIR, 'interaction', `interaction.log_${dk}`));
  }
  out.push(controlPanelLogPath(getKstDateKey()));
  out.push(controlPanelLogPath(prevDateKey()));
  return [...new Set(out)];
}

function prevDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value || '0000';
  const m = parts.find(p => p.type === 'month')?.value || '00';
  const day = parts.find(p => p.type === 'day')?.value || '00';
  return `${y}${m}${day}`;
}

function filterWindow(lines: string[], windowMs: number): string[] {
  const cutoff = Date.now() - windowMs;
  return lines.filter(line => {
    const t = parseLineTimeMs(line);
    if (t == null) return true;
    return t >= cutoff;
  });
}

function readHealthJson(): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(HEALTH_FILE)) return null;
    const j = JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8'));
    return typeof j === 'object' && j ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

type Counts = Record<string, number>;

function countPatterns(lines: string[]): Counts {
  const c: Counts = {};
  const bump = (k: string, n = 1) => {
    c[k] = (c[k] || 0) + n;
  };

  for (const line of lines) {
    const L = line;
    if (/unauthorized_401|unauthorized401|yahoo_v7_http_error|yahoo_chart_http_error/i.test(L)) {
      bump('quote_auth_fail');
    }
    if (/eod_fallback_used|finalSource.*eod|live_failed_then_yahoo_chart_eod/i.test(L)) {
      bump('quote_eod_fallback');
    }
    if (/degraded_quote_mode|quote_quality_degraded/i.test(L)) {
      bump('quote_degraded');
    }
    if (/main panel restore failed|PANEL restore failed|ensureMainPanelOnBoot.*failed/i.test(L)) {
      bump('panel_restore_fail');
    }
    if (/NO_STATE_AND_NO_CALLER_CHANNEL|No channelId in state|skip_no_channel/i.test(L)) {
      bump('panel_no_channel');
    }
    if (/SCHEDULER.*weekly report skipped/i.test(L) && !/\[DEBUG\].*SCHEDULER/i.test(L)) {
      bump('scheduler_weekly_skip');
    }
    if (/FOLLOWUP_COMPONENT_SKIPPED/i.test(L)) {
      bump('followup_skipped');
    }
    if (/DECISION_COMPONENT_SKIPPED/i.test(L)) {
      bump('decision_skipped');
    }
    if (/interaction.*missing|defer skipped|already handled/i.test(L)) {
      bump('interaction_risk');
    }
    if (/\[ERROR\]|uncaughtException|unhandledRejection/i.test(L)) {
      bump('system_error');
    }
  }
  return c;
}

function dedupeByPattern(list: DiagnosedIssue[]): DiagnosedIssue[] {
  const seen = new Set<string>();
  const out: DiagnosedIssue[] = [];
  for (const x of list) {
    if (seen.has(x.patternId)) continue;
    seen.add(x.patternId);
    out.push(x);
  }
  return out;
}

function healthIssues(health: Record<string, unknown> | null): DiagnosedIssue[] {
  const out: DiagnosedIssue[] = [];
  if (!health) return out;

  const panels = health.panels as Record<string, unknown> | undefined;
  if (panels?.restoreSucceeded === false && String(panels?.lastPanelAction || '').match(/failed|skip/)) {
    out.push({
      patternId: 'health_panel',
      problem: '메인 패널 복구 실패(헬스)',
      explanation: '재기동 시 메인 메뉴 패널이 정상 복구되지 않았을 수 있습니다.',
      impact: '사용자가 채널 상단에서 빠른 메뉴를 찾기 어려울 수 있습니다.',
      action: '`DISCORD_MAIN_PANEL_CHANNEL_ID` 환경변수를 설정하거나 `panel:settings:reinstall`로 패널을 다시 띄우세요.',
      severity: 'HIGH'
    });
  }
  if (health.discord && (health.discord as { lastError?: string }).lastError) {
    out.push({
      patternId: 'health_discord_err',
      problem: 'Discord 클라이언트 오류 기록',
      explanation: String((health.discord as { lastError?: string }).lastError).slice(0, 200),
      impact: '봇 연결·메시지 전송에 일시 장애가 있었을 수 있습니다.',
      action: 'PM2/로그에서 최근 ERROR를 확인하고 토큰·네트워크를 점검하세요.',
      severity: 'MEDIUM'
    });
  }
  return out;
}

function countsToIssues(counts: Counts): { issues: DiagnosedIssue[]; warnings: DiagnosedIssue[] } {
  const issues: DiagnosedIssue[] = [];
  const warnings: DiagnosedIssue[] = [];

  const push = (d: DiagnosedIssue, bucket: 'issue' | 'warn') => {
    if (bucket === 'issue') issues.push(d);
    else warnings.push(d);
  };

  if ((counts.quote_auth_fail || 0) >= 3) {
    push(
      {
        patternId: 'quote_401',
        problem: 'Yahoo 시세 호출 실패(401·차단)',
        explanation: '실시간 호가 API가 반복적으로 거절되고 있을 가능성이 큽니다.',
        impact: '종가·캐시·DB 기반 지연 가격으로 평가되어 숫자가 실시간과 어긋날 수 있습니다.',
        action: '네트워크·헤더 정책을 점검하고, `QUOTE_RESOLUTION` 로그에서 v7/v8 실패 비율을 확인하세요.',
        severity: 'HIGH'
      },
      'issue'
    );
  } else if ((counts.quote_auth_fail || 0) > 0) {
    push(
      {
        patternId: 'quote_401_light',
        problem: 'Yahoo 시세 일부 실패',
        explanation: '일부 종목에서 인증/차단류 응답이 관측되었습니다.',
        impact: '해당 종목만 평가 품질이 낮아질 수 있습니다.',
        action: '동일 현상이 지속되면 횟수 임계치를 넘어 HIGH로 분류됩니다.',
        severity: 'MEDIUM'
      },
      'warn'
    );
  }

  if ((counts.quote_eod_fallback || 0) >= 8) {
    push(
      {
        patternId: 'quote_eod',
        problem: 'EOD·차트 폴백 의존 증가',
        explanation: '실시간 호가 대신 일봉 종가 등으로 채운 흔적이 많습니다.',
        impact: '장중 판단과 평가 시점이 어긋날 수 있습니다.',
        action: '시세 소스 안정화 또는 운영 시간대에 맞는 기대치를 문서화하세요.',
        severity: 'MEDIUM'
      },
      'warn'
    );
  }

  if ((counts.quote_degraded || 0) >= 1) {
    push(
      {
        patternId: 'quote_degraded',
        problem: '시세 품질 저하 모드',
        explanation: '스냅샷에 degraded·지연 가격 신호가 포함되었습니다.',
        impact: '위원회·리스크 판단 입력값의 신선도가 떨어집니다.',
        action: '포트폴리오 메시지의 시세 출처·기준시각 안내를 사용자에게 공유하세요.',
        severity: 'MEDIUM'
      },
      'warn'
    );
  }

  if ((counts.panel_restore_fail || 0) >= 1 || (counts.panel_no_channel || 0) >= 1) {
    push(
      {
        patternId: 'panel',
        problem: '메인 패널 복구 경로 이상',
        explanation: 'state.json 채널 누락 또는 복구 실패 로그가 있습니다.',
        impact: '재기동 후 메뉴 패널이 보이지 않을 수 있습니다.',
        action: '`DISCORD_MAIN_PANEL_CHANNEL_ID` 설정 또는 데이터 센터에서 패널 재설치를 안내하세요.',
        severity: 'HIGH'
      },
      'issue'
    );
  }

  if ((counts.scheduler_weekly_skip || 0) >= 5) {
    push(
      {
        patternId: 'scheduler',
        problem: '주간 리포트 스케줄러 스킵 다발(비DEBUG)',
        explanation: '조건 미충족으로 리포트가 생략된 흔적이 반복됩니다.',
        impact: '예정된 주간 요약이 누락될 수 있습니다.',
        action: '의도된 동작인지 확인하고, 필요 시 스케줄 조건·DB `chat_history`를 점검하세요.',
        severity: 'LOW'
      },
      'warn'
    );
  }

  if ((counts.followup_skipped || 0) + (counts.decision_skipped || 0) >= 2) {
    push(
      {
        patternId: 'ux_skip',
        problem: 'Discord 인터랙션 컴포넌트 스킵',
        explanation: 'Follow-up/Decision 버튼이 스냅샷·행 제한 등으로 붙지 않은 경우가 있습니다.',
        impact: '질문만 보이고 버튼이 없는 UX 이슈로 이어질 수 있습니다.',
        action: '`UI_COMPONENT_POLICY`·`message_chunk_not_first` 로그를 확인하세요.',
        severity: 'MEDIUM'
      },
      'warn'
    );
  }

  if ((counts.interaction_risk || 0) >= 3) {
    push(
      {
        patternId: 'interaction',
        problem: '인터랙션 라우팅·defer 경고',
        explanation: '이미 처리됨/지연 생략 등 상호작용 안정성 관련 로그가 있습니다.',
        impact: '버튼 응답 실패·중복 처리 가능성.',
        action: '동일 사용자 연타·웹훅 경로를 점검하세요.',
        severity: 'MEDIUM'
      },
      'warn'
    );
  }

  if ((counts.system_error || 0) >= 5) {
    push(
      {
        patternId: 'sys_err',
        problem: 'ERROR·예외 로그 다발',
        explanation: '최근 구간에 오류 레벨 로그가 여러 건 있습니다.',
        impact: '기능 일부 실패 또는 데이터 경로 장애 가능.',
        action: '`office-error` 전체 스택을 확인하고 재현 조건을 좁히세요.',
        severity: 'CRITICAL'
      },
      'issue'
    );
  } else if ((counts.system_error || 0) >= 1) {
    push(
      {
        patternId: 'sys_err_light',
        problem: 'ERROR·예외 로그 관측',
        explanation: '최근 로그에 오류/예외 흔적이 있습니다.',
        impact: '범위는 제한적일 수 있으나 모니터링이 필요합니다.',
        action: '해당 시각 전후의 `office-error`·`office-runtime`을 추적하세요.',
        severity: 'HIGH'
      },
      'issue'
    );
  }

  return { issues, warnings };
}

function deriveStatus(issues: DiagnosedIssue[], warnings: DiagnosedIssue[]): SystemHealthStatus {
  if (issues.some(i => i.severity === 'CRITICAL')) return 'CRITICAL';
  if (issues.some(i => i.severity === 'HIGH') || warnings.length >= 4) return 'DEGRADED';
  if (issues.length > 0 || warnings.length > 0) return 'DEGRADED';
  return 'HEALTHY';
}

function buildInsights(counts: Counts, status: SystemHealthStatus): string[] {
  const insights: string[] = [];
  if (status === 'HEALTHY') {
    insights.push('최근 윈도우에서 치명적 패턴이 두드러지지 않았습니다. 정기 점검만 유지하면 됩니다.');
  }
  if ((counts.quote_eod_fallback || 0) > 0 && (counts.quote_auth_fail || 0) === 0) {
    insights.push('EOD 폴백은 장 마감 후·실시간 불필요 구간에서는 정상에 가깝게 동작할 수 있습니다.');
  }
  return insights;
}

function analyzeLogsInternal(): LogAnalysisResult {
  const filesRead = collectLogFilePaths();
  let allLines: string[] = [];
  const snippets: string[] = [];

  for (const fp of filesRead) {
    const tail = readTailLines(fp, TAIL_LINES_PER_FILE);
    const win = filterWindow(tail, WINDOW_MINUTES * 60 * 1000);
    allLines = allLines.concat(win.map(l => `${path.basename(fp)}: ${l}`));
  }

  const rawLinesForCount = allLines.map(l => l.replace(/^[^:]+:\s*/, ''));
  const counts = countPatterns(rawLinesForCount);
  const health = readHealthJson();

  const fromCounts = countsToIssues(counts);
  const fromHealth = healthIssues(health);

  const mergedIssues = dedupeByPattern([
    ...fromHealth.filter(h => h.severity === 'HIGH' || h.severity === 'CRITICAL'),
    ...fromCounts.issues
  ]);
  const mergedWarnings = dedupeByPattern([
    ...fromHealth.filter(h => h.severity !== 'HIGH' && h.severity !== 'CRITICAL'),
    ...fromCounts.warnings
  ]);

  const insights = buildInsights(counts, deriveStatus(mergedIssues, mergedWarnings));

  const status = deriveStatus(mergedIssues, mergedWarnings);

  for (const line of rawLinesForCount) {
    if (/\[ERROR\]|COMPONENT_SKIPPED|restore failed|401|uncaught/i.test(line)) {
      snippets.push(line.slice(0, 300));
      if (snippets.length >= 25) break;
    }
  }

  return {
    systemStatus: status,
    issues: mergedIssues.slice(0, 20),
    warnings: mergedWarnings.slice(0, 25),
    insights,
    analyzedAt: new Date().toISOString(),
    meta: {
      filesRead,
      linesScannedApprox: allLines.length,
      windowMinutes: WINDOW_MINUTES,
      healthSnapshot: health
    },
    _snippets: snippets
  };
}

export function analyzeLogs(forceRefresh = false): LogAnalysisResult {
  if (!forceRefresh && analysisCache && Date.now() - analysisCache.at < CACHE_TTL_MS) {
    return analysisCache.result;
  }
  const result = analyzeLogsInternal();
  analysisCache = { at: Date.now(), result };
  return result;
}

export function generateSystemReport(result?: LogAnalysisResult): string {
  const r = result ?? analyzeLogs();
  const statusKo =
    r.systemStatus === 'HEALTHY' ? '정상' : r.systemStatus === 'DEGRADED' ? '부분 장애(관찰 필요)' : '위험(즉시 점검 권고)';

  const lines: string[] = [];
  lines.push('🧠 **Peter Thiel (System Operator)**');
  lines.push('');
  lines.push('### 1. 현재 시스템 상태');
  lines.push(`- **${statusKo}** (${r.systemStatus})`);
  lines.push(`- 분석 시각: ${r.analyzedAt} · 최근 **${r.meta.windowMinutes}분**·일별 로그 꼬리 구간 기준`);
  lines.push('');

  lines.push('### 2. 주요 문제');
  if (r.issues.length === 0 && r.warnings.length === 0) {
    lines.push('- 특이사항 없음 (또는 임계 미만)');
  } else {
    const show = [...r.issues, ...r.warnings].slice(0, 8);
    for (const x of show) {
      lines.push(`- **${x.problem}** [${x.severity}]`);
      lines.push(`  - 영향: ${x.impact}`);
      lines.push(`  - 원인 추정: ${x.explanation}`);
    }
  }
  lines.push('');

  lines.push('### 3. 즉시 조치 필요 (HIGH 이상)');
  const hi = [...r.issues, ...r.warnings].filter(x => x.severity === 'HIGH' || x.severity === 'CRITICAL');
  if (hi.length === 0) {
    lines.push('- 없음');
  } else {
    for (const x of hi) {
      lines.push(`- **${x.problem}**: ${x.action}`);
    }
  }
  lines.push('');

  lines.push('### 4. 개선 권고');
  lines.push('- 시세: 실시간 실패율이 높으면 소스 다변화·캐시 TTL·운영 시간대 기대치를 문서화하세요.');
  lines.push('- 패널: `state/discord-panel.json`과 폴백 채널 ID를 항상 함께 운영하세요.');
  lines.push('- UX: 긴 응답은 첫 청크에만 컴포넌트가 붙습니다 — 질문형 응답은 길이를 줄이는 것이 유리합니다.');
  lines.push('');

  lines.push('### 5. 한 줄 결론');
  const one =
    r.systemStatus === 'HEALTHY'
      ? '현재 시스템은 안정적으로 보이며, 반복되는 경고만 주기적으로 모니터링하면 됩니다.'
      : r.systemStatus === 'DEGRADED'
        ? '현재 시스템은 동작 중이나 시세·패널·UX 중 하나 이상에서 품질 저하가 관찰됩니다.'
        : '현재 시스템에 심각한 오류 신호가 있습니다. 운영자 확인이 필요합니다.';
  lines.push(`_${one}_`);

  return lines.join('\n');
}

export function generateDetailView(result?: LogAnalysisResult): string {
  const r = result ?? analyzeLogs();
  const sn = r._snippets || [];
  const head = [
    '📋 **상세 로그 스니펫** (최근 윈도우, 민감 정보는 그대로 노출될 수 있음)',
    '',
    `파일 수: ${r.meta.filesRead.length}, 스캔 줄(대략): ${r.meta.linesScannedApprox}`,
    ''
  ];
  if (sn.length === 0) {
    return head.join('\n') + '\n(매칭 스니펫 없음)';
  }
  return head.join('\n') + sn.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

export function generateActionsView(result?: LogAnalysisResult): string {
  const r = result ?? analyzeLogs();
  const lines: string[] = [];
  lines.push('🛠 **조치 방법 (요약)**');
  lines.push('');
  const all = [...r.issues, ...r.warnings].filter(x => x.severity === 'HIGH' || x.severity === 'CRITICAL');
  if (all.length === 0) {
    lines.push('즉시 필수 조치 항목이 없습니다. 아래는 참고용 일반 조치입니다.');
    lines.push('');
  }
  for (const x of all.length ? all : r.warnings.slice(0, 5)) {
    lines.push(`**${x.problem}** (${x.severity})`);
    lines.push(`→ ${x.action}`);
    lines.push('');
  }
  lines.push('**안전 수동 조치**');
  lines.push('- 메인 패널: 설정의 패널 재설치 또는 봇이 쓰는 채널에 `DISCORD_MAIN_PANEL_CHANNEL_ID` 지정');
  lines.push('- 시세: `logs/quote/quote.log_*`에서 `QUOTE_RESOLUTION` 확인');
  lines.push('- 자동 매매·DB 강제 수정·프로세스 kill은 이 도구에서 수행하지 않습니다.');
  return lines.join('\n');
}
