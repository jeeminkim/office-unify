"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = {
  redirectTo?: string;
  className?: string;
  label?: string;
};

export function GoogleSignInButton({
  redirectTo = "/persona-chat",
  className = "rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800",
  label = "Google로 로그인",
}: Props) {
  async function signIn() {
    const supabase = createBrowserSupabaseClient();
    const next = encodeURIComponent(redirectTo.startsWith("/") ? redirectTo : "/persona-chat");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
  }

  return (
    <button type="button" className={className} onClick={() => void signIn()}>
      {label}
    </button>
  );
}
