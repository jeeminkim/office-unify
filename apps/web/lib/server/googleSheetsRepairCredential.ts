import 'server-only';

import { getSheetsAccessToken } from '@/lib/server/google-sheets-api';

export type GoogleSheetsAuthMode = 'service_account' | 'none';

export type GoogleSheetsCredentialMeta = {
  authMode: GoogleSheetsAuthMode;
  writeAvailable: boolean;
  spreadsheetIdConfigured: boolean;
  targetSpreadsheetId?: string;
  /** JWT scope — spreadsheets (read+write), not spreadsheets.readonly */
  scopesNote: string;
  serviceAccountEmailMasked?: string;
  actionHint: string;
};

const SHEETS_WRITE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export function maskServiceAccountEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';
  const user = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const shown = user.length <= 2 ? `${user[0] ?? '*'}**` : `${user.slice(0, 3)}***`;
  return `${shown}@${domain}`;
}

function parseServiceAccountEmail(): string | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { client_email?: string };
    return typeof j.client_email === 'string' ? j.client_email : null;
  } catch {
    return null;
  }
}

/** Read-only: token fetch only, no spreadsheet mutation. */
export async function inspectGoogleSheetsCredentialMeta(): Promise<GoogleSheetsCredentialMeta> {
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ||
    process.env.GOOGLE_SPREADSHEET_ID?.trim() ||
    '';
  const email = parseServiceAccountEmail();
  const spreadsheetIdConfigured = Boolean(spreadsheetId);

  if (!email || !spreadsheetIdConfigured) {
    return {
      authMode: 'none',
      writeAvailable: false,
      spreadsheetIdConfigured,
      scopesNote: SHEETS_WRITE_SCOPE,
      actionHint:
        'GOOGLE_SERVICE_ACCOUNT_JSON·GOOGLE_SHEETS_SPREADSHEET_ID를 설정하세요. API key만으로는 비공개 스프레드시트 write가 어렵습니다.',
    };
  }

  let tokenOk = false;
  try {
    tokenOk = Boolean(await getSheetsAccessToken());
  } catch {
    tokenOk = false;
  }

  const writeAvailable = tokenOk;
  const masked = maskServiceAccountEmail(email);

  return {
    authMode: 'service_account',
    writeAvailable,
    spreadsheetIdConfigured,
    targetSpreadsheetId: spreadsheetId,
    scopesNote: SHEETS_WRITE_SCOPE,
    serviceAccountEmailMasked: masked,
    actionHint: writeAvailable
      ? `서비스 계정 ${masked}에 스프레드시트 Editor 공유가 필요합니다. Repair는 사용자 확인 후 1회만 write합니다.`
      : '현재 credential은 read-only 또는 write 권한이 없습니다. Google Sheets service account에 Editor 권한을 부여하거나 write scope를 설정하세요.',
  };
}
