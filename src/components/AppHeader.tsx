import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/app";

export function AppHeader({ name, avatar, photo, children }: { name?: string; avatar?: string; photo?: string | null; isAdmin?: boolean; children?: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
      <Link to="/home" className="font-display text-2xl font-extrabold">أبطال <span className="text-primary">الإيمان</span></Link>
      <div className="flex items-center gap-2">
        {children}
        <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:inline-flex">
          {photo ? <img src={photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : avatar} {name}
        </span>
        <button
          onClick={async () => { await signOut(qc); navigate({ to: "/auth", replace: true }); }}
          className="rounded-xl border-2 border-border px-3 py-2 text-sm font-bold hover:bg-muted"
        >خروج</button>
      </div>
    </header>
  );
}
