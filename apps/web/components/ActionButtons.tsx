"use client";
import { TaskType, DbType } from '@/lib/types';
import { Send, TerminalSquare, GitBranch, Table2 } from 'lucide-react';

interface ActionButtonsProps {
  onGenerate: (type: TaskType, dbType?: DbType) => void;
  isLoading: boolean;
  showSqlSchema: boolean;
  onToggleSqlSchema: () => void;
  sqlDbType: DbType;
  onSqlDbTypeChange: (db: DbType) => void;
}

const DB_LABEL: Record<DbType, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  oracle: 'Oracle',
};

/** 주요 액션 버튼 공통 높이 (SQL 그룹 내 행과 맞춤) */
const ACTION_H = 'h-14 min-h-[3.5rem]';

export default function ActionButtons({
  onGenerate,
  isLoading,
  showSqlSchema,
  onToggleSqlSchema,
  sqlDbType,
  onSqlDbTypeChange,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end sm:gap-4">
        <div className="flex flex-col justify-end sm:min-h-[5.5rem]">
          <button
            type="button"
            onClick={() => onGenerate('flow')}
            disabled={isLoading}
            className={`w-full ${ACTION_H} rounded-md bg-blue-600 px-4 text-white font-semibold shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2`}
          >
            <GitBranch className="h-5 w-5 shrink-0" />
            순서도 생성
          </button>
        </div>

        <div className="flex flex-col justify-end gap-1.5 sm:min-h-[5.5rem]">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              대상 DB
            </span>
            <button
              type="button"
              onClick={onToggleSqlSchema}
              disabled={isLoading}
              className="text-[11px] font-semibold text-emerald-700 underline-offset-2 hover:text-emerald-900 hover:underline disabled:opacity-50"
            >
              {showSqlSchema ? '스키마 닫기' : '스키마 입력'}
            </button>
          </div>
          <div className={`flex items-stretch gap-2 ${ACTION_H}`}>
            <select
              value={sqlDbType}
              onChange={(e) => onSqlDbTypeChange(e.target.value as DbType)}
              disabled={isLoading}
              className="h-full w-[7.5rem] shrink-0 rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              aria-label="대상 DB"
            >
              {(Object.keys(DB_LABEL) as DbType[]).map((key) => (
                <option key={key} value={key}>
                  {DB_LABEL[key]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onGenerate('sql', sqlDbType)}
              disabled={isLoading}
              className="flex h-full min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              <TerminalSquare className="h-5 w-5 shrink-0" />
              <span className="truncate">SQL 생성</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-end sm:min-h-[5.5rem]">
          <button
            type="button"
            onClick={() => onGenerate('ts')}
            disabled={isLoading}
            className={`w-full ${ACTION_H} rounded-md bg-indigo-600 px-4 text-white font-semibold shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2`}
          >
            <Send className="h-5 w-5 shrink-0" />
            TypeScript 생성
          </button>
        </div>
      </div>

      {showSqlSchema && (
        <p className="flex items-start gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <Table2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          스키마 입력이 켜져 있으면 테이블·조인 정보가 SQL 프롬프트에 포함됩니다.
        </p>
      )}
    </div>
  );
}
