type Props = {
  className?: string;
  label?: string;
};

export function SignOutButton({
  className = "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50",
  label = "로그아웃",
}: Props) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
