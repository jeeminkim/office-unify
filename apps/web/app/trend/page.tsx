import Link from "next/link";
import { SHOW_TREND_UI } from "@/lib/feature-flags";

/**
 * Trend 기능 플레이스홀더. `SHOW_TREND_UI`가 false일 때는 비노출·비활성화 상태를 안내한다.
 */
export default function TrendPage() {
  if (!SHOW_TREND_UI) {
    return (
      <div className="mx-auto max-w-lg p-8 text-slate-800">
        <h1 className="text-xl font-bold">Trend</h1>
        <p className="mt-2 text-sm text-slate-600">
          Trend 관련 기능은 현재 비활성화되어 있습니다. `lib/feature-flags.ts`의 SHOW_TREND_UI를 참고하세요.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
          ← 홈
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-8 text-slate-800">
      <h1 className="text-xl font-bold">Trend</h1>
      <p className="mt-2 text-sm text-slate-600">준비 중입니다.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
        ← 홈
      </Link>
    </div>
  );
}
