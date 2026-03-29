/**
 * 운영 DB 계약 타입 고정 + 문서(DATABASE_SCHEMA.md) 키워드 정합성 경고.
 * 실행: npm run check:schema-contract
 */
import * as fs from 'fs';
import * as path from 'path';
import type { ChatHistoryRowContract, DbIdInteger, AnalysisGenerationTraceInsertContract } from '../src/types/dbSchemaContract';

const _idIsInteger: DbIdInteger = 1;
const _chatHistoryRow: ChatHistoryRowContract = {
  id: _idIsInteger,
  user_id: '0'
};
void _chatHistoryRow;

const _trace: AnalysisGenerationTraceInsertContract = {
  discord_user_id: '0',
  chat_history_id: null,
  analysis_type: 'x',
  persona_name: 'x'
};
void _trace;

const root = path.join(__dirname, '..');
const dbDoc = path.join(root, 'docs', 'DATABASE_SCHEMA.md');
if (fs.existsSync(dbDoc)) {
  const md = fs.readFileSync(dbDoc, 'utf8');
  if (!/chat_history[\s\S]{0,400}integer/i.test(md)) {
    console.warn(
      '[check-schema-contract] WARNING: docs/DATABASE_SCHEMA.md may be missing chat_history.id integer note — verify manually.'
    );
  }
} else {
  console.warn('[check-schema-contract] WARNING: docs/DATABASE_SCHEMA.md not found.');
}

console.log('[check-schema-contract] Core types OK (chat_history.id number, trace.chat_history_id number | null).');
