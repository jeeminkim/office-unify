import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-4 p-8 text-slate-800">
      <h1 className="text-xl font-bold">로그인 오류</h1>
      <p className="text-sm text-slate-600">
        Google 로그인 처리 중 문제가 발생했습니다. Supabase 대시보드의 Redirect URL과 Google OAuth 설정을 확인한 뒤 다시 시도하세요.
      </p>
      <Link href="/" className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
        ← 홈으로
      </Link>
    </div>
  );
}
