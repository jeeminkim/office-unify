"use client";

import { useState } from "react";
import Link from "next/link";
import PromptInput from "@/components/PromptInput";
import ActionButtons from "@/components/ActionButtons";
import ResultPanel from "@/components/ResultPanel";
import { useGenerate } from "@/hooks/useGenerate";
import type { DbType } from "@/lib/types";
import { DEFAULT_SQL_STYLE_OPTIONS, type SqlStyleOptions, type TaskType } from "@/lib/types";
import { enrichSqlPromptIfShort } from "@/lib/utils/promptUtils";
import { formatSqlStyleHints } from "@/lib/prompts";

export default function DevAssistantPage() {
  const [prompt, setPrompt] = useState("");
  const [schemaContext, setSchemaContext] = useState("");
  const [showSqlSchema, setShowSqlSchema] = useState(false);
  const [sqlDbType, setSqlDbType] = useState<DbType>("postgresql");
  const [sqlStyle, setSqlStyle] = useState<SqlStyleOptions>(DEFAULT_SQL_STYLE_OPTIONS);
  const { generate, isLoading, error, result } = useGenerate();

  const handleGenerate = (type: TaskType, dbType?: DbType) => {
    if (type === "sql") {
      const resolvedDb = dbType ?? "postgresql";
      generate(enrichSqlPromptIfShort(prompt), "sql", {
        dbType: resolvedDb,
        schemaContext,
        sqlStyleHints: formatSqlStyleHints(sqlStyle),
        persistPrompt: prompt,
      });
      return;
    }
    generate(prompt, type, { persistPrompt: prompt });
  };

  return (
    <div className="mx-auto max-w-5xl p-6 text-slate-900">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dev Assistant</h1>
          <p className="text-sm text-slate-600">투자 대시보드와 분리된 개발 보조 작업 공간입니다.</p>
        </div>
        <Link href="/" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs">← 투자 홈</Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          schemaContext={schemaContext}
          onSchemaChange={setSchemaContext}
          showSchema={showSqlSchema}
          sqlStyle={sqlStyle}
          onSqlStyleChange={setSqlStyle}
        />
        <div className="mt-4">
          <ActionButtons
            onGenerate={handleGenerate}
            isLoading={isLoading}
            showSqlSchema={showSqlSchema}
            onToggleSqlSchema={() => setShowSqlSchema((v) => !v)}
            sqlDbType={sqlDbType}
            onSqlDbTypeChange={setSqlDbType}
          />
        </div>
      </section>

      {error ? <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      {!isLoading && result ? (
        <div className="mt-4">
          <ResultPanel
            result={result}
            isGenerating={isLoading}
            feedbackPrompt={prompt}
            onFollowUp={() => {}}
          />
        </div>
      ) : null}
    </div>
  );
}

