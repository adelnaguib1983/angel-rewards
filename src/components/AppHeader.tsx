import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/app";

export function AppHeader({ name, avatar, isAdmin }: { name?: string; avatar?: string; isAdmin?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
      <Link to="/home" className="font-display text-2xl font-extrabold">أبطال <span className="text-primary">الإيمان</span></Link>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <>
            <Link to="/home" className="rounded-xl px-3 py-2 text-sm font-bold hover:bg-muted" activeProps={{ className: "bg-muted" }}>لوحتي</Link>
            <Link to="/admin" className="rounded-xl px-3 py-2 text-sm font-bold hover:bg-muted" activeProps={{ className: "bg-muted" }}>لوحة المشرف</Link>
          </>
        )}
        <span className="hidden text-sm text-muted-foreground sm:inline">{avatar} {name}</span>
        <button
          onClick={async () => { await signOut(qc); navigate({ to: "/auth", replace: true }); }}
          className="rounded-xl border-2 border-border px-3 py-2 text-sm font-bold hover:bg-muted"
        >خروج</button>
      </div>
    </header>
  );
}
