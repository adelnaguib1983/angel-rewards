import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/app";

type Stage = "member" | "servant" | "admin";
const STAGE: Record<Stage, { label: string; cls: string; badge: string }> = {
  member: { label: "🦁 مرحلة المخدومين", cls: "stage-member", badge: "bg-primary text-primary-foreground" },
  servant: { label: "📘 مرحلة الخدام", cls: "stage-servant", badge: "bg-sky text-primary-foreground" },
  admin: { label: "🛡️ مرحلة المشرفين", cls: "stage-admin", badge: "bg-secondary text-secondary-foreground" },
};

export function AppHeader({ name, avatar, photo, isAdmin, stage = "member", children }: { name?: string; avatar?: string; photo?: string | null; isAdmin?: boolean; stage?: Stage; children?: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const s = STAGE[stage];
  return (
    <div className={s.cls}>
      <div className="stage-bar h-1.5 w-full" />
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl font-extrabold">أبطال <span className="text-primary">الإيمان</span></span>
          <span className={`float-in rounded-full px-2.5 py-0.5 text-xs font-bold ${s.badge}`}>{s.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {children}
        {(isAdmin || stage === "servant") && (
  <nav className="flex gap-1 text-xs font-bold">
    {stage !== "member" && <Link to="/home" className="rounded-xl bg-primary px-2 py-1.5 text-primary-foreground">المخدومين 👁️</Link>}
    {stage !== "servant" && <Link to="/servant" className="rounded-xl bg-sky px-2 py-1.5 text-primary-foreground">الخدام</Link>}
    {isAdmin && stage !== "admin" && <Link to="/admin" className="rounded-xl bg-secondary px-2 py-1.5 text-secondary-foreground">المشرف</Link>}
  </nav>
)}

          <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:inline-flex">
            {photo ? <img src={photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : avatar} {name}
          </span>
          <button
            onClick={async () => { await signOut(qc); navigate({ to: "/auth", replace: true }); }}
            className="rounded-xl border-2 border-border px-3 py-2 text-sm font-bold hover:bg-muted"
          >خروج</button>
        </div>
      </header>
    </div>
  );
}
