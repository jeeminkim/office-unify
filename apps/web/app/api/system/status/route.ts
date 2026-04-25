import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { ALLOWED_PERSONA_CHAT_EMAIL } from '@/lib/server/allowed-user';
import { PORTFOLIO_READ_SECRET_ENV } from '@/lib/server/portfolio-read-guard';

type SectionStatus = 'ok' | 'warn' | 'error' | 'not_configured';

type StatusSection = {
  key: string;
  title: string;
  status: SectionStatus;
  message: string;
  details?: string[];
  actionHint?: string;
};

type SystemStatusResponse = {
  ok: boolean;
  generatedAt: string;
  sections: StatusSection[];
};

function envConfigured(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function envSection(key: string, title: string, envName: string, actionHint: string): StatusSection {
  const configured = envConfigured(envName);
  return {
    key,
    title,
    status: configured ? 'ok' : 'not_configured',
    message: configured ? `${envName} configured` : `${envName} is missing`,
    actionHint: configured ? undefined : actionHint,
  };
}

async function tableAccessSection(
  tableName: string,
  title: string,
  actionHint: string,
): Promise<StatusSection> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return {
      key: `db_${tableName}`,
      title,
      status: 'error',
      message: 'Supabase service client unavailable',
      actionHint: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 먼저 설정하세요.',
    };
  }
  const { error } = await supabase.from(tableName).select('*', { head: true, count: 'exact' }).limit(1);
  if (error) {
    return {
      key: `db_${tableName}`,
      title,
      status: 'warn',
      message: `${tableName} access failed`,
      details: [error.message],
      actionHint,
    };
  }
  return {
    key: `db_${tableName}`,
    title,
    status: 'ok',
    message: `${tableName} accessible`,
  };
}

export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  const sections: StatusSection[] = [
    envSection(
      'env_supabase_url',
      'Supabase URL',
      'SUPABASE_URL',
      'apps/web/.env.local 또는 배포 환경 변수에서 SUPABASE_URL을 설정하세요.',
    ),
    envSection(
      'env_supabase_anon',
      'Supabase anon key',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.',
    ),
    envSection(
      'env_supabase_service_role',
      'Supabase service role key',
      'SUPABASE_SERVICE_ROLE_KEY',
      '서버 전용 키 SUPABASE_SERVICE_ROLE_KEY를 설정하세요.',
    ),
    envSection('env_openai', 'OpenAI API key', 'OPENAI_API_KEY', 'OPENAI_API_KEY를 설정하세요.'),
    envSection('env_gemini', 'Gemini API key', 'GEMINI_API_KEY', 'GEMINI_API_KEY를 설정하세요.'),
    {
      key: 'env_google_sheets',
      title: 'Google Sheets env',
      status:
        envConfigured('GOOGLE_SERVICE_ACCOUNT_JSON') && envConfigured('GOOGLE_SHEETS_SPREADSHEET_ID')
          ? 'ok'
          : 'not_configured',
      message:
        envConfigured('GOOGLE_SERVICE_ACCOUNT_JSON') && envConfigured('GOOGLE_SHEETS_SPREADSHEET_ID')
          ? 'Google Sheets append configured'
          : 'Google Sheets append env is missing',
      actionHint: 'Sheets append-only를 쓰려면 GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SHEETS_SPREADSHEET_ID를 설정하세요.',
    },
    {
      key: 'single_user_gate',
      title: 'Single-user gate',
      status: ALLOWED_PERSONA_CHAT_EMAIL ? 'ok' : 'warn',
      message: ALLOWED_PERSONA_CHAT_EMAIL
        ? `Allowed email gate active (${ALLOWED_PERSONA_CHAT_EMAIL})`
        : 'Allowed email gate missing',
      actionHint: 'allowed-user.ts의 ALLOWED_PERSONA_CHAT_EMAIL을 확인하세요.',
    },
    {
      key: 'portfolio_read_guard',
      title: 'Portfolio read bearer gate',
      status: envConfigured(PORTFOLIO_READ_SECRET_ENV) ? 'ok' : 'warn',
      message: envConfigured(PORTFOLIO_READ_SECRET_ENV)
        ? `${PORTFOLIO_READ_SECRET_ENV} configured`
        : `${PORTFOLIO_READ_SECRET_ENV} missing (external read API disabled)`,
      actionHint: '외부에서 /api/portfolio/summary를 호출할 계획이면 시크릿을 설정하세요.',
    },
  ];

  const tableChecks = await Promise.all([
    tableAccessSection('web_portfolio_holdings', 'Portfolio table access', 'docs/sql/append_web_portfolio_ledger.sql 적용 여부를 확인하세요.'),
    tableAccessSection('web_persona_chat_requests', 'Persona idempotency table', 'docs/sql/append_web_persona_chat_requests.sql 적용 여부를 확인하세요.'),
    tableAccessSection('trend_memory_topics', 'Trend memory tables', 'docs/sql/append_web_trend_memory_phase1.sql 적용 여부를 확인하세요.'),
    tableAccessSection('trade_journal_entries', 'Trade journal tables', 'docs/sql/append_web_trade_journal.sql 적용 여부를 확인하세요.'),
  ]);
  sections.push(...tableChecks);

  sections.push({
    key: 'selfcheck_recent',
    title: 'Recent self-check',
    status: 'warn',
    message: 'Runtime self-check artifact is not persisted by server',
    details: ['로컬에서 npm run selfcheck를 수동 실행해 최신 상태를 확인하세요.'],
    actionHint: 'CI 또는 cron health endpoint를 추가하면 자동 진단 이력을 만들 수 있습니다.',
  });

  const hasError = sections.some((s) => s.status === 'error');
  const body: SystemStatusResponse = {
    ok: !hasError,
    generatedAt: new Date().toISOString(),
    sections,
  };
  return NextResponse.json(body);
}

