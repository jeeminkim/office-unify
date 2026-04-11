import Link from "next/link";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";
import { isAllowedPersonaChatEmail } from "@/lib/server/allowed-user";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { PortfolioLedgerClient } from "./PortfolioLedgerClient";

export default async function PortfolioLedgerPage() {
  const supabase = await createServerSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 p-8 text-slate-800">
        <h1 className="text-xl font-bold">포트폴리오 원장</h1>
        <p className="text-sm text-slate-600">Google 로그인 후에만 사용할 수 있습니다.</p>
        <GoogleSignInButton redirectTo="/portfolio-ledger" />
        <Link href="/" className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
          ← 홈
        </Link>
      </div>
    );
  }

  if (!isAllowedPersonaChatEmail(user.email)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 p-8 text-slate-800">
        <h1 className="text-xl font-bold">접근 불가</h1>
        <p className="text-sm text-slate-600">허용된 Google 계정만 사용할 수 있습니다.</p>
        <SignOutButton />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-slate-200 bg-white px-4 py-2 text-right text-xs text-slate-600">
        <span className="mr-3">{user.email}</span>
        <SignOutButton />
      </div>
      <PortfolioLedgerClient />
    </div>
  );
}
