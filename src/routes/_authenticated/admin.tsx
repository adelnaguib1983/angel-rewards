import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { MONTHS, REDEEM_STATUS, cairoDate, cairoWeek, useMe, useSettings } from "@/lib/app";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة المشرف | أبطال الإيمان" },
      { name: "description", content: "إدارة المشتركين والأنشطة والهدايا والنقاط." },
      { property: "og:title", content: "لوحة المشرف | أبطال الإيمان" },
      { property: "og:description", content: "إدارة المشتركين والأنشطة والهدايا والنقاط." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Member = { id: string; full_name: string; avatar: string; class_name: string | null; status: string; created_at: string; points: number; balance: number };

function useMembers() {
  return useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_members");
      if (error) throw error;
      return data as Member[];
    },
  });
}

const TABS = [
  ["summary", "📊 الملخص الأسبوعي"], ["requests", "📝 طلبات التسجيل"], ["members", "👥 المشتركون"],
  ["activities", "✅ الأنشطة"], ["redeem", "🎁 طلبات الهدايا"], ["log", "📒 سجل النقاط"],
  ["gifts", "🛍️ الهدايا"], ["badges", "🏅 الأوسمة والنقاط"], ["notif", "🔔 الإشعارات"],
] as const;
type Tab = (typeof TABS)[number][0];

function Admin() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<Tab>("summary");
  const qc = useQueryClient();
  const { data: unread } = useQuery({
    queryKey: ["unread"],
    enabled: !!me?.isAdmin,
    queryFn: async () => (await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false)).count ?? 0,
  });
  const { data: pending } = useMembers();
  useEffect(() => {
    if (!me?.isAdmin) return;
    const ch = supabase.channel("admin-notif")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        toast.info((payload.new as { message: string }).message);
        qc.invalidateQueries();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.isAdmin, qc]);

  if (isLoading) return <div className="p-10 text-center">...</div>;
  if (!me?.isAdmin) return (
    <div className="p-10 text-center"><p>هذه الصفحة للمشرفين فقط.</p><Link to="/home" className="text-primary">رجوع</Link></div>
  );
  const pendingCount = pending?.filter((m) => m.status === "pending").length ?? 0;

  return (
    <div className="pb-16">
      <AppHeader name={me.profile?.full_name} avatar={me.profile?.avatar} isAdmin />
      <main className="mx-auto max-w-6xl px-4">
        <h1 className="text-3xl font-extrabold">لوحة المشرف 🛠️</h1>
        <nav className="my-5 flex flex-wrap gap-2">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`relative rounded-2xl border-2 px-3 py-2 text-sm font-bold ${tab === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}>
              {l}
              {k === "requests" && pendingCount > 0 && <Dot n={pendingCount} />}
              {k === "notif" && !!unread && <Dot n={unread} />}
            </button>
          ))}
        </nav>
        {tab === "summary" && <Summary />}
        {tab === "requests" && <Requests />}
        {tab === "members" && <Members />}
        {tab === "activities" && <Activities />}
        {tab === "redeem" && <Redemptions />}
        {tab === "log" && <AdjLog />}
        {tab === "gifts" && <Gifts />}
        {tab === "badges" && <BadgesAndPoints />}
        {tab === "notif" && <Notifications />}
      </main>
    </div>
  );
}

function Dot({ n }: { n: number }) {
  return <span className="absolute -left-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-destructive px-1 text-xs text-destructive-foreground">{n}</span>;
}
const card = "rounded-3xl border-2 border-border bg-card p-4";
const nameMap = (m?: Member[]) => Object.fromEntries((m ?? []).map((x) => [x.id, x]));

/* ---------- Weekly summary ---------- */
function Summary() {
  const [offset, setOffset] = useState(0);
  const days = cairoWeek(offset);
  const { data: members } = useMembers();
  const { data: settings } = useSettings();
  const { data: logs } = useQuery({
    queryKey: ["admin-week-logs", offset],
    queryFn: async () => {
      const from = new Date(new Date(days[0]).getTime() - 86400000).toISOString();
      const to = new Date(new Date(days[6]).getTime() + 2 * 86400000).toISOString();
      const { data, error } = await supabase.from("activity_logs").select("*").gte("created_at", from).lt("created_at", to).eq("status", "approved");
      if (error) throw error;
      return data.filter((l) => days.includes(cairoDate(l.created_at)));
    },
  });
  const byMember = useMemo(() => {
    const m: Record<string, { points: number; count: number; acts: Record<string, number> }> = {};
    logs?.forEach((l) => {
      m[l.user_id] ??= { points: 0, count: 0, acts: {} };
      m[l.user_id].points += l.points; m[l.user_id].count++;
      m[l.user_id].acts[l.activity] = (m[l.user_id].acts[l.activity] ?? 0) + 1;
    });
    const rows = Object.entries(m).sort((a, b) => b[1].points - a[1].points || b[1].count - a[1].count);
    return rows.map(([id, v]) => ({ id, ...v, rank: rows.findIndex((r) => r[1].points === v.points) + 1 }));
  }, [logs]);
  const names = nameMap(members);
  const perActivity = settings?.map((s) => ({ ...s, n: logs?.filter((l) => l.activity === s.key).length ?? 0 })) ?? [];
  const total = logs?.reduce((a, l) => a + l.points, 0) ?? 0;

  function exportCsv() {
    const head = ["المركز", "الاسم", "الفصل", "النقاط", "عدد الأنشطة", ...(settings?.map((s) => s.label) ?? [])];
    const rows = byMember.map((r) => [r.rank, names[r.id]?.full_name ?? "", names[r.id]?.class_name ?? "", r.points, r.count, ...(settings?.map((s) => r.acts[s.key] ?? 0) ?? [])]);
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [[`الأسبوع ${days[0]} إلى ${days[6]} (توقيت القاهرة)`], head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `weekly-summary-${days[0]}.csv`; a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(offset + 1)} className="rounded-xl bg-card px-3 py-2 font-bold">→ السابق</button>
          <div className="font-bold">من الأحد {days[0]} إلى السبت {days[6]}</div>
          <button disabled={offset === 0} onClick={() => setOffset(offset - 1)} className="rounded-xl bg-card px-3 py-2 font-bold disabled:opacity-40">التالي ←</button>
        </div>
        <button onClick={exportCsv} className="pop rounded-2xl bg-accent px-4 py-2 font-extrabold text-accent-foreground">⬇️ تصدير CSV</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="أنشطة مكتملة" v={logs?.length ?? 0} cls="bg-primary text-primary-foreground" />
        <Stat label="نقاط مكتسبة" v={total} cls="bg-secondary text-secondary-foreground" />
        <Stat label="أعضاء مشاركون" v={byMember.length} cls="bg-accent text-accent-foreground" />
        <Stat label="إجمالي المفعّلين" v={members?.filter((m) => m.status === "approved").length ?? 0} cls="bg-sky text-primary-foreground" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={card}>
          <h3 className="mb-3 font-extrabold">الأنشطة المكتملة</h3>
          {perActivity.map((a) => (
            <div key={a.key} className="mb-2">
              <div className="flex justify-between text-sm"><span>{a.emoji} {a.label}</span><b>{a.n}</b></div>
              <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, (a.n / Math.max(1, ...perActivity.map((x) => x.n))) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <div className={card}>
          <h3 className="mb-3 font-extrabold">الأكثر مشاركة</h3>
          {!byMember.length && <p className="text-muted-foreground">لا توجد أنشطة هذا الأسبوع.</p>}
          {byMember.slice(0, 10).map((r) => (
            <div key={r.id} className="flex items-center gap-2 border-b border-border py-2 last:border-0">
              <b className="w-6">{r.rank}</b><span>{names[r.id]?.avatar}</span><span className="flex-1">{names[r.id]?.full_name}</span>
              <span className="text-xs text-muted-foreground">{r.count} نشاط</span><b className="text-primary">{r.points}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Stat({ label, v, cls }: { label: string; v: number; cls: string }) {
  return <div className={`pop rounded-3xl p-4 ${cls}`}><div className="text-sm font-bold">{label}</div><div className="font-display text-3xl font-extrabold">{v}</div></div>;
}

/* ---------- Requests ---------- */
function Requests() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-pending"],
    queryFn: async () => (await supabase.from("profiles").select("*").neq("status", "approved").order("created_at", { ascending: false })).data ?? [],
  });
  const set = async (id: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "تم تفعيل الحساب" : "تم الرفض");
    qc.invalidateQueries();
  };
  if (!data?.length) return <p className="text-muted-foreground">لا توجد طلبات جديدة 🎉</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.map((p) => (
        <div key={p.id} className={card}>
          <div className="flex items-center justify-between">
            <b className="text-lg">{p.avatar} {p.full_name}</b>
            <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "rejected" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>{p.status === "rejected" ? "مرفوض" : "جديد"}</span>
          </div>
          <Contact p={p} />
          <div className="mt-3 flex gap-2">
            <button onClick={() => set(p.id, "approved")} className="flex-1 rounded-xl bg-accent py-2 font-bold text-accent-foreground">✓ موافقة</button>
            {p.status !== "rejected" && <button onClick={() => set(p.id, "rejected")} className="flex-1 rounded-xl bg-destructive py-2 font-bold text-destructive-foreground">✗ رفض</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
type P = { academic_year?: string | null; class_name?: string | null; birth_date?: string | null; phone?: string | null; address?: string | null; created_at: string };
function Contact({ p }: { p: P }) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">العام الدراسي</dt><dd>{p.academic_year ?? "—"} {p.class_name ? `· ${p.class_name}` : ""}</dd>
      <dt className="text-muted-foreground">تاريخ الميلاد</dt><dd>{p.birth_date ?? "—"}</dd>
      <dt className="text-muted-foreground">الموبايل</dt><dd dir="ltr" className="text-right">{p.phone ? <a href={`tel:${p.phone}`} className="text-primary">{p.phone}</a> : "—"}</dd>
      <dt className="text-muted-foreground">العنوان</dt><dd>{p.address ?? "—"}</dd>
      <dt className="text-muted-foreground">تاريخ التسجيل</dt><dd>{cairoDate(p.created_at)}</dd>
    </dl>
  );
}

/* ---------- Members ---------- */
function Members() {
  const qc = useQueryClient();
  const { data: members } = useMembers();
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*")).data ?? [],
  });
  const [q, setQ] = useState("");
  const [adj, setAdj] = useState<Member | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState("");
  const pmap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const list = (members ?? []).filter((m) => m.status === "approved" && m.full_name.includes(q));

  async function saveAdj() {
    if (!adj || !reason.trim() || !amount) return toast.error("اكتب المقدار والسبب");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("point_adjustments").insert({ user_id: adj.id, amount, reason: reason.trim(), admin_id: user!.id });
    if (error) return toast.error(error.message);
    toast.success("تم تعديل النقاط وتسجيل السبب"); setAdj(null); setReason(""); qc.invalidateQueries();
  }

  return (
    <div>
      <Input placeholder="بحث بالاسم..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-xs" />
      <div className="space-y-2">
        {list.map((m) => (
          <div key={m.id} className={card}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-3xl">{m.avatar}</span>
              <div className="flex-1"><b>{m.full_name}</b><div className="text-xs text-muted-foreground">{pmap[m.id]?.academic_year ?? ""} {m.class_name ?? ""}</div></div>
              <div className="text-center"><div className="text-xs text-muted-foreground">النقاط</div><b className="text-primary">{m.points}</b></div>
              <div className="text-center"><div className="text-xs text-muted-foreground">الرصيد</div><b>{m.balance}</b></div>
              <button onClick={() => setOpen(open === m.id ? null : m.id)} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">بيانات التواصل</button>
              <button onClick={() => { setAdj(m); setAmount(10); }} className="rounded-xl bg-secondary px-3 py-1.5 text-sm font-bold text-secondary-foreground">± تعديل النقاط</button>
            </div>
            {open === m.id && pmap[m.id] && <Contact p={pmap[m.id]} />}
          </div>
        ))}
      </div>
      <Dialog open={!!adj} onOpenChange={(o) => !o && setAdj(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل نقاط {adj?.full_name}</DialogTitle></DialogHeader>
          <label className="text-sm">المقدار (سالب للخصم)</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} />
          <label className="text-sm">السبب (مطلوب)</label>
          <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="مثال: مساعدة في تنظيم الحفل" />
          <button onClick={saveAdj} className="rounded-2xl bg-primary py-3 font-extrabold text-primary-foreground">حفظ</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Activities review ---------- */
function Activities() {
  const qc = useQueryClient();
  const { data: members } = useMembers();
  const { data: settings } = useSettings();
  const names = nameMap(members);
  const [review, setReview] = useState<{ id: string; points: number; status: string } | null>(null);
  const [reason, setReason] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => (await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_review_log", { _log_id: review!.id, _points: review!.points, _status: review!.status, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ في السجل"); setReview(null); setReason(""); qc.invalidateQueries(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const s = Object.fromEntries((settings ?? []).map((x) => [x.key, x]));
  return (
    <div className="space-y-2">
      {data?.map((l) => (
        <div key={l.id} className={`${card} flex flex-wrap items-center gap-3`}>
          <span className="text-2xl">{s[l.activity]?.emoji}</span>
          <div className="flex-1 min-w-48">
            <b>{names[l.user_id]?.full_name}</b> · {s[l.activity]?.label}
            <div className="text-xs text-muted-foreground">الأسبوع {l.week} · {MONTHS[l.month - 1]} {l.year} · سُجّل {cairoDate(l.created_at)}</div>
            {l.verse && <div className="mt-1 text-sm">«{l.verse}»</div>}
            {l.admin_note && <div className="text-xs text-primary">ملاحظة: {l.admin_note}</div>}
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${l.status === "approved" ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"}`}>{l.status === "approved" ? `${l.points} نقطة` : "مرفوض"}</span>
          <button onClick={() => { setReview({ id: l.id, points: l.points, status: l.status }); setReason(""); }} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">مراجعة</button>
        </div>
      ))}
      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>مراجعة الإنجاز</DialogTitle></DialogHeader>
          {review && (
            <>
              <div className="flex gap-2">
                {(["approved", "rejected"] as const).map((st) => (
                  <button key={st} onClick={() => setReview({ ...review, status: st })} className={`flex-1 rounded-xl py-2 font-bold ${review.status === st ? (st === "approved" ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground") : "bg-muted"}`}>{st === "approved" ? "مقبول" : "مرفوض"}</button>
                ))}
              </div>
              <label className="text-sm">النقاط</label>
              <Input type="number" min={0} value={review.points} onChange={(e) => setReview({ ...review, points: Math.max(0, parseInt(e.target.value) || 0) })} />
              <label className="text-sm">سبب التغيير (مطلوب)</label>
              <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
              <button disabled={!reason.trim() || save.isPending} onClick={() => save.mutate()} className="rounded-2xl bg-primary py-3 font-extrabold text-primary-foreground disabled:opacity-50">حفظ</button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Redemptions ---------- */
function Redemptions() {
  const qc = useQueryClient();
  const { data: members } = useMembers();
  const names = nameMap(members);
  const [filter, setFilter] = useState("pending");
  const { data } = useQuery({
    queryKey: ["admin-red"],
    queryFn: async () => (await supabase.from("redemptions").select("*, gifts(name, emoji)").order("created_at", { ascending: false })).data ?? [],
  });
  const set = async (id: string, status: string) => {
    const note = status === "rejected" ? prompt("سبب الرفض؟") ?? "" : null;
    const { error } = await supabase.rpc("admin_set_redemption", { _id: id, _status: status, _note: note as string });
    if (error) return toast.error(error.message);
    toast.success(`تم التحديث: ${REDEEM_STATUS[status].label}`); qc.invalidateQueries();
  };
  const list = data?.filter((r) => filter === "all" || r.status === filter) ?? [];
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {[["pending", "قيد المراجعة"], ["approved", "مقبول"], ["delivered", "تم التسليم"], ["rejected", "مرفوض"], ["all", "الكل"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${filter === k ? "bg-secondary text-secondary-foreground" : "bg-card"}`}>
            {l} ({k === "all" ? data?.length ?? 0 : data?.filter((r) => r.status === k).length ?? 0})
          </button>
        ))}
      </div>
      {!list.length && <p className="text-muted-foreground">لا توجد طلبات.</p>}
      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.id} className={`${card} flex flex-wrap items-center gap-3`}>
            <span className="text-3xl">{r.gifts?.emoji}</span>
            <div className="flex-1"><b>{names[r.user_id]?.full_name}</b> طلب <b>{r.gifts?.name}</b>
              <div className="text-xs text-muted-foreground">{r.cost} نقطة · {cairoDate(r.created_at)}{r.admin_note ? ` · ${r.admin_note}` : ""}</div></div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${REDEEM_STATUS[r.status]?.cls}`}>{REDEEM_STATUS[r.status]?.label}</span>
            {r.status === "pending" && <button onClick={() => set(r.id, "approved")} className="rounded-xl bg-sky px-3 py-1.5 text-sm font-bold text-primary-foreground">قبول</button>}
            {(r.status === "pending" || r.status === "approved") && <button onClick={() => set(r.id, "delivered")} className="rounded-xl bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground">تم التسليم</button>}
            {r.status !== "rejected" && r.status !== "delivered" && <button onClick={() => set(r.id, "rejected")} className="rounded-xl bg-destructive px-3 py-1.5 text-sm font-bold text-destructive-foreground">رفض</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Adjustments log ---------- */
function AdjLog() {
  const { data: members } = useMembers();
  const names = nameMap(members);
  const [who, setWho] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-adj"],
    queryFn: async () => (await supabase.from("point_adjustments").select("*").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });
  const list = data?.filter((a) => !who || a.user_id === who) ?? [];
  return (
    <div>
      <select value={who} onChange={(e) => setWho(e.target.value)} className="mb-3 h-9 rounded-md border border-input bg-card px-2 text-sm">
        <option value="">كل الأعضاء</option>
        {members?.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
      </select>
      {!list.length && <p className="text-muted-foreground">لا توجد تعديلات بعد.</p>}
      <div className="overflow-x-auto rounded-3xl border-2 border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">العضو</th><th className="p-2">التغيير</th><th className="p-2 text-right">السبب</th><th className="p-2 text-right">المشرف</th><th className="p-2 text-right">النوع</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-2">{cairoDate(a.created_at)}</td>
                <td className="p-2">{names[a.user_id]?.full_name}</td>
                <td className={`p-2 text-center font-bold ${a.amount >= 0 ? "text-accent" : "text-destructive"}`}>{a.amount > 0 ? "+" : ""}{a.amount}</td>
                <td className="p-2">{a.reason}</td>
                <td className="p-2">{a.admin_id ? names[a.admin_id]?.full_name : ""}</td>
                <td className="p-2 text-xs text-muted-foreground">{a.log_id ? "مراجعة إنجاز" : "تعديل يدوي"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Gifts ---------- */
function Gifts() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-gifts"], queryFn: async () => (await supabase.from("gifts").select("*").order("cost")).data ?? [] });
  const [f, setF] = useState({ name: "", emoji: "🎁", description: "", cost: 100, stock: 10 });
  const add = async () => {
    if (!f.name.trim()) return toast.error("اكتب اسم الهدية");
    const { error } = await supabase.from("gifts").insert(f);
    if (error) return toast.error(error.message);
    setF({ name: "", emoji: "🎁", description: "", cost: 100, stock: 10 }); qc.invalidateQueries();
  };
  const upd = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("gifts").update(patch).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries();
  };
  return (
    <div className="space-y-4">
      <div className={`${card} grid gap-2 md:grid-cols-6`}>
        <Input value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} placeholder="🎁" />
        <Input className="md:col-span-2" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="اسم الهدية" />
        <Input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: +e.target.value })} placeholder="النقاط" />
        <Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: +e.target.value })} placeholder="الكمية" />
        <button onClick={add} className="rounded-xl bg-primary font-bold text-primary-foreground">+ إضافة</button>
        <Input className="md:col-span-6" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="وصف (اختياري)" />
      </div>
      {data?.map((g) => (
        <div key={g.id} className={`${card} flex flex-wrap items-center gap-3 ${g.active ? "" : "opacity-50"}`}>
          <span className="text-3xl">{g.emoji}</span>
          <b className="flex-1">{g.name}</b>
          <label className="text-xs">النقاط <Input type="number" className="w-24" defaultValue={g.cost} onBlur={(e) => +e.target.value !== g.cost && upd(g.id, { cost: +e.target.value })} /></label>
          <label className="text-xs">الكمية <Input type="number" className="w-20" defaultValue={g.stock} onBlur={(e) => +e.target.value !== g.stock && upd(g.id, { stock: +e.target.value })} /></label>
          <button onClick={() => upd(g.id, { active: !g.active })} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">{g.active ? "إخفاء" : "إظهار"}</button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Badges & activity points ---------- */
function BadgesAndPoints() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: badges } = useQuery({ queryKey: ["badges"], queryFn: async () => (await supabase.from("badges").select("*").order("threshold")).data ?? [] });
  const [f, setF] = useState({ name: "", emoji: "🏅", description: "", threshold: 100 });
  const addBadge = async () => {
    if (!f.name.trim()) return;
    const { error } = await supabase.from("badges").insert(f);
    if (error) return toast.error(error.message);
    setF({ name: "", emoji: "🏅", description: "", threshold: 100 }); qc.invalidateQueries();
  };
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className={card}>
        <h3 className="mb-3 font-extrabold">نقاط كل نشاط</h3>
        {settings?.map((s) => (
          <div key={s.key} className="mb-2 flex items-center gap-2">
            <span className="flex-1">{s.emoji} {s.label}</span>
            <Input type="number" className="w-24" defaultValue={s.points} onBlur={async (e) => {
              const v = +e.target.value; if (v === s.points) return;
              const { error } = await supabase.from("activity_settings").update({ points: v }).eq("key", s.key);
              if (error) toast.error(error.message); else { toast.success("تم"); qc.invalidateQueries({ queryKey: ["settings"] }); }
            }} />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">التغيير يطبق على التسجيلات الجديدة فقط.</p>
      </div>
      <div className={card}>
        <h3 className="mb-3 font-extrabold">الأوسمة</h3>
        <div className="mb-3 grid grid-cols-4 gap-2">
          <Input value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} />
          <Input className="col-span-2" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="اسم الوسام" />
          <Input type="number" value={f.threshold} onChange={(e) => setF({ ...f, threshold: +e.target.value })} />
          <Input className="col-span-3" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="وصف" />
          <button onClick={addBadge} className="rounded-xl bg-primary font-bold text-primary-foreground">+ إضافة</button>
        </div>
        {badges?.map((b) => (
          <div key={b.id} className="flex items-center gap-2 border-t border-border py-2">
            <span className="text-2xl">{b.emoji}</span><span className="flex-1">{b.name}</span><span className="text-sm">{b.threshold} نقطة</span>
            <button onClick={async () => { await supabase.from("badges").delete().eq("id", b.id); qc.invalidateQueries(); }} className="text-sm text-destructive">حذف</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Notifications ---------- */
function Notifications() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-notif"], queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const icons: Record<string, string> = { signup: "📝", activity: "✅", redeem: "🎁" };
  const markAll = async () => { await supabase.from("notifications").update({ read: true }).eq("read", false); qc.invalidateQueries(); };
  return (
    <div>
      <button onClick={markAll} className="mb-3 rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">تحديد الكل كمقروء</button>
      <div className="space-y-2">
        {data?.map((n) => (
          <div key={n.id} className={`flex items-center gap-3 rounded-2xl p-3 ${n.read ? "bg-card/50" : "bg-card ring-2 ring-primary"}`}>
            <span className="text-2xl">{icons[n.kind] ?? "🔔"}</span>
            <span className="flex-1">{n.message}</span>
            <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}</span>
          </div>
        ))}
        {!data?.length && <p className="text-muted-foreground">لا توجد إشعارات.</p>}
      </div>
    </div>
  );
}
