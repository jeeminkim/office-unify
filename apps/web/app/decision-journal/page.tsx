import { Suspense } from "react";
import { DecisionJournalClient } from "./DecisionJournalClient";

export default function DecisionJournalPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl p-6 text-sm text-slate-600">비거래 의사결정 일지를 불러오는 중…</div>
      }
    >
      <DecisionJournalClient />
    </Suspense>
  );
}
