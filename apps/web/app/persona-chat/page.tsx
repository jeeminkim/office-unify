import Link from "next/link";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";
import { isAllowedPersonaChatEmail } from "@/lib/server/allowed-user";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { PersonaChatClient } from "./PersonaChatClient";

export default async function PersonaChatPage() {
  const supabase = await createServerSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 p-8 text-slate-800">
        <h1 className="text-xl font-bold">Persona chat</h1>
        <p className="text-sm text-slate-600">
          이 페이지는 Google 로그인 후에만 사용할 수 있습니다. 세션 쿠키로 API가 보호됩니다.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <GoogleSignInButton redirectTo="/persona-chat" />
        </div>
        <Link href="/" className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
          ← dev_support 홈
        </Link>
      </div>
    );
  }

  if (!isAllowedPersonaChatEmail(user.email)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 p-8 text-slate-800">
        <h1 className="text-xl font-bold">접근 불가</h1>
        <p className="text-sm text-slate-600">
          이 서비스는 허용된 Google 계정만 사용할 수 있습니다. 다른 계정으로 로그인한 경우 로그아웃한 뒤 허용된 계정으로 다시 시도하세요.
        </p>
        {user.email ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-xs text-amber-950">
            현재 로그인: {user.email}
          </p>
        ) : null}
        <SignOutButton />
        <Link href="/" className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
          ← dev_support 홈
        </Link>
      </div>
    );
  }

  return <PersonaChatClient />;
}
