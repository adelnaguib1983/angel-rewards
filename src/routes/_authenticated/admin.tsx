// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { PROFILE_COLS, ACADEMIC_YEARS, MONTHS, REDEEM_STATUS, cairoDate, cairoWeek, useMe, useSettings, fileToDataUrl } from "@/lib/app";
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

type Member = { id: string; full_name: string; avatar: string; class_name: string | null; academic_year: string | null; status: string; created_at: string; points: number; balance: number };

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
  ["summary", "📊 الملخص الأسبوعي"], ["announcements", "📣 الإعلانات"], ["requests", "📝 طلبات التسجيل"], ["members", "👥 المشتركون"], ["servants", "📘 الخدام والافتقاد"], ["absence", "🚫 الغياب الأسبوعي"],
  ["activities", "✅ الأنشطة"], ["redeem", "🎁 طلبات الهدايا"], ["log", "📒 سجل النقاط"],
  ["archive", "🗂️ الأرشيف والمقارنة"], ["gifts", "🛍️ الهدايا"], ["badges", "🏅 الأوسمة والنقاط"], ["notif", "🔔 مركز التنبيهات"], ["quiz", "🧠 المسابقات"],
  ["audit", "🕵️ سجل التدقيق"], ["staff", "🔑 الصلاحيات"],
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
  const { data: perms } = usePerms();
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
  const ownerOnly = (k: string) => k === "audit" || k === "staff";
  const pendingCount = pending?.filter((m) => m.status === "pending").length ?? 0;

  return (
    <div className="stage-admin pb-16">
      <AppHeader stage="admin" name={me.profile?.full_name} avatar={me.profile?.avatar} isAdmin />
      <main className="mx-auto max-w-6xl px-4">
        <h1 className="text-3xl font-extrabold">لوحة المشرف 🛠️</h1>
        <nav className="my-5 flex flex-wrap gap-2">
          {TABS.filter(([k]) => !ownerOnly(k) || perms?.owner).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`relative rounded-2xl border-2 px-3 py-2 text-sm font-bold ${tab === k ? "border-secondary bg-secondary text-secondary-foreground pop" : "border-border bg-card hover:bg-muted"}`}>
              {l}
              {k === "requests" && pendingCount > 0 && <Dot n={pendingCount} />}
              {k === "notif" && !!unread && <Dot n={unread} />}
            </button>
          ))}
        </nav>
        {tab === "summary" && <Summary />}
        {tab === "announcements" && <Announcements />}
        {tab === "requests" && <Requests />}
        {tab === "members" && <Members />}
        {tab === "servants" && <ServantsTab />}
        {tab === "absence" && <AbsenceTab />}
        {tab === "activities" && <Activities />}
        {tab === "redeem" && <Redemptions />}
        {tab === "log" && <AdjLog />}
        {tab === "gifts" && <Gifts />}
        {tab === "badges" && <BadgesAndPoints />}
        {tab === "notif" && <Notifications />}
        {tab === "quiz" && <AdminQuizzes />}
        {tab === "archive" && <Archive />}
        {tab === "audit" && perms?.owner && <Audit />}
        {tab === "staff" && perms?.owner && <Staff />}
      </main>
    </div>
  );
}

function Dot({ n }: { n: number }) {
  return <span className="absolute -left-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-destructive px-1 text-xs text-destructive-foreground">{n}</span>;
}
const card = "rounded-3xl border-2 border-border bg-card p-4";
const nameMap = (m?: Member[]) => Object.fromEntries((m ?? []).map((x) => [x.id, x]));

/* ---------- Announcements ---------- */
function Announcements() {
  const qc = useQueryClient();
  const empty = { title: "", body: "", event_date: "", published: true, image_url: "" };
  const [signupsFor, setSignupsFor] = useState<{ id: string; title: string } | null>(null);
  const { data: signups } = useQuery({ queryKey: ["admin-signups", signupsFor?.id], enabled: !!signupsFor, queryFn: async () => (await supabase.rpc("admin_signups", { _ann: signupsFor.id })).data ?? [] });
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) return toast.error("اكتب عنوان الإعلان وتفاصيله");
    const payload = { title: form.title.trim(), body: form.body.trim(), event_date: form.event_date || null, published: form.published, image_url: form.image_url || null };
    if (editing) {
      const { error } = await supabase.from("announcements").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editing);
      if (error) return toast.error(error.message);
      toast.success("تم تحديث الإعلان");
    } else {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return toast.error("سجّل الدخول مرة أخرى");
      const { error } = await supabase.from("announcements").insert({ ...payload, created_by: userId });
      if (error) return toast.error(error.message);
      toast.success("تم نشر الإعلان");
    }
    setForm(empty); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); qc.invalidateQueries({ queryKey: ["announcements"] });
  };
  const edit = (item: { id: string; title: string; body: string; event_date: string | null; published: boolean }) => {
    setEditing(item.id); setForm({ title: item.title, body: item.body, event_date: item.event_date ?? "", published: item.published, image_url: item.image_url ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggle = async (id: string, published: boolean) => {
    const { error } = await supabase.from("announcements").update({ published, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-announcements"] }); qc.invalidateQueries({ queryKey: ["announcements"] });
  };
  const remove = async (id: string) => {
    if (!confirm("حذف هذا الإعلان نهائيًا؟")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم حذف الإعلان"); qc.invalidateQueries({ queryKey: ["admin-announcements"] }); qc.invalidateQueries({ queryKey: ["announcements"] });
  };
  return (
    <div className="space-y-5">
      <section className={card}>
        <h2 className="mb-3 text-xl font-extrabold">{editing ? "تعديل الإعلان" : "إعلان جديد"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-bold">العنوان<Input className="mt-1" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: رحلة الدير" /></label>
          <label className="text-sm font-bold">تاريخ النشاط أو الرحلة (اختياري)<Input className="mt-1" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></label>
          <label className="text-sm font-bold md:col-span-2">التفاصيل<textarea className="mt-1 min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm" maxLength={1500} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="اكتب المكان والموعد وأي تفاصيل مهمة" /></label>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-xl border-2 border-dashed border-border px-4 py-2 text-sm font-bold hover:bg-muted">📷 {form.image_url ? "تغيير الصورة" : "إضافة صورة"}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setForm({ ...form, image_url: await fileToDataUrl(f, 1000, 0.75) }); } catch (err) { toast.error((err as Error).message); } }} /></label>
            {form.image_url && <><img src={form.image_url} alt="" className="h-16 rounded-xl object-cover" /><button onClick={() => setForm({ ...form, image_url: "" })} className="text-sm text-destructive">إزالة</button></>}
          </div>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> ظاهر للمشتركين</label>
          <div className="flex gap-2 md:justify-end"><button onClick={save} className="rounded-xl bg-primary px-5 py-2 font-extrabold text-primary-foreground">{editing ? "حفظ التعديل" : "نشر الإعلان"}</button>{editing && <button onClick={() => { setEditing(null); setForm(empty); }} className="rounded-xl bg-muted px-4 py-2 font-bold">إلغاء</button>}</div>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-extrabold">الإعلانات السابقة</h2>
        {isLoading && <p className="text-muted-foreground">جاري التحميل...</p>}
        {!isLoading && !data?.length && <p className="text-muted-foreground">لا توجد إعلانات بعد.</p>}
        <div className="space-y-3">{data?.map((item) => (
          <article key={item.id} className={`${card} grid grid-cols-[minmax(0,1fr)_auto] gap-3`}>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">📌 {item.title}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.published ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{item.published ? "ظاهر" : "مخفي"}</span>{item.event_date && <span className="text-xs text-muted-foreground">📅 {item.event_date}</span>}</div>{item.image_url && <img src={item.image_url} alt="" className="mt-2 max-h-40 rounded-xl object-cover" />}<p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p></div>
            <div className="flex shrink-0 flex-col gap-2"><button onClick={() => setSignupsFor({ id: item.id, title: item.title })} className="rounded-xl bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">🙋 المسجلون</button><button onClick={() => edit(item)} className="rounded-xl bg-secondary px-3 py-1.5 text-sm font-bold text-secondary-foreground">تعديل</button><button onClick={() => toggle(item.id, !item.published)} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">{item.published ? "إخفاء" : "إظهار"}</button><button onClick={() => remove(item.id)} className="rounded-xl bg-destructive px-3 py-1.5 text-sm font-bold text-destructive-foreground">حذف</button></div>
          </article>
        ))}</div>
      </section>
      <Dialog open={!!signupsFor} onOpenChange={(o) => !o && setSignupsFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>المسجلون في: {signupsFor?.title} ({signups?.length ?? 0})</DialogTitle></DialogHeader>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {!signups?.length && <p className="text-muted-foreground">لا يوجد مسجلون بعد.</p>}
            {signups?.map((r, i) => <div key={r.user_id} className="flex justify-between gap-2 rounded-xl bg-muted p-2 text-sm"><span className="font-bold">{i + 1}. {r.full_name}</span><span className="text-muted-foreground">{r.academic_year ?? ""} · {new Date(r.created_at).toLocaleString("ar-EG")}</span></div>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Weekly summary ---------- */
function Summary({ initialOffset = 0 }: { initialOffset?: number }) {
  const [offset, setOffset] = useState(initialOffset);
  const [year, setYear] = useState("");
  const days = cairoWeek(offset);
  const { data: members } = useMembers();
  const { data: settings } = useSettings();
  const { data: allLogs } = useQuery({
    queryKey: ["admin-week-logs", offset],
    queryFn: async () => {
      const from = new Date(new Date(days[0]).getTime() - 86400000).toISOString();
      const to = new Date(new Date(days[6]).getTime() + 2 * 86400000).toISOString();
      const { data, error } = await supabase.from("activity_logs").select("*").gte("created_at", from).lt("created_at", to).eq("status", "approved");
      if (error) throw error;
      return data.filter((l) => days.includes(cairoDate(l.created_at)));
    },
  });
  const yearOf = nameMap(members);
  const logs = (allLogs ?? []).filter((l) => !year || yearOf[l.user_id]?.academic_year === year);
  const byMember = useMemo(() => {
    const m: Record<string, { points: number; count: number; acts: Record<string, number> }> = {};
    logs.forEach((l) => {
      m[l.user_id] ??= { points: 0, count: 0, acts: {} };
      m[l.user_id].points += l.points; m[l.user_id].count++;
      m[l.user_id].acts[l.activity] = (m[l.user_id].acts[l.activity] ?? 0) + 1;
    });
    const rows = Object.entries(m).sort((a, b) => b[1].points - a[1].points || b[1].count - a[1].count);
    return rows.map(([id, v]) => ({ id, ...v, rank: rows.findIndex((r) => r[1].points === v.points) + 1, tied: rows.filter((r) => r[1].points === v.points).length > 1 }));
  }, [logs]);
  const names = nameMap(members);
  const perActivity = settings?.map((s) => ({ ...s, n: logs.filter((l) => l.activity === s.key).length ?? 0 })) ?? [];
  const total = logs.reduce((a, l) => a + l.points, 0);
  const [detail, setDetail] = useState<null | "acts" | "points" | "approved">(null);
  const approvedList = (members ?? []).filter((m) => m.status === "approved" && (!year || m.academic_year === year));

  function exportCsv() {
    const head = ["من تاريخ", "إلى تاريخ", "المركز", "تعادل", "الاسم", "العام الدراسي", "الفصل", "النقاط", "عدد الأنشطة", ...(settings?.map((s) => s.label) ?? [])];
    const rows = byMember.map((r) => [days[0], days[6], r.tied ? `=${r.rank}` : r.rank, r.tied ? "نعم (مركز مشترك)" : "لا", names[r.id]?.full_name ?? "", names[r.id]?.academic_year ?? "", names[r.id]?.class_name ?? "", r.points, r.count, ...(settings?.map((s) => r.acts[s.key] ?? 0) ?? [])]);
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [[`الأسبوع من الأحد ${days[0]} إلى السبت ${days[6]} (توقيت القاهرة)${year ? ` — ${year}` : ""}`], ["قواعد الترتيب: المتساوون في النقاط يأخذون نفس المركز (=)، ويليهم المركز التالي بعد عددهم"], head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `weekly-summary-${days[0]}${year ? "-" + year : ""}.csv`; a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(offset + 1)} className="rounded-xl bg-card px-3 py-2 font-bold">→ السابق</button>
          <div className="font-bold">من الأحد {days[0]} إلى السبت {days[6]}</div>
          <button disabled={offset === 0} onClick={() => setOffset(offset - 1)} className="rounded-xl bg-card px-3 py-2 font-bold disabled:opacity-40">التالي ←</button>
        </div>
        <select value={year} onChange={(e) => setYear(e.target.value)} className="h-10 rounded-xl border border-input bg-card px-2 text-sm">
          <option value="">كل الأعوام الدراسية</option>
          {ACADEMIC_YEARS.map((y) => <option key={y}>{y}</option>)}
        </select>
        <button onClick={exportCsv} className="pop rounded-2xl bg-accent px-4 py-2 font-extrabold text-accent-foreground">⬇️ تصدير CSV</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="أنشطة مكتملة" v={logs.length} cls="bg-primary text-primary-foreground" onClick={() => setDetail("acts")} />
        <Stat label="نقاط مكتسبة" v={total} cls="bg-secondary text-secondary-foreground" onClick={() => setDetail("points")} />
        <Stat label="أعضاء مشاركون" v={byMember.length} cls="bg-accent text-accent-foreground" onClick={() => setDetail("points")} />
        <Stat label="إجمالي المفعّلين" v={approvedList.length} cls="bg-sky text-primary-foreground" onClick={() => setDetail("approved")} />
      </div>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail === "acts" ? "الأنشطة المكتملة" : detail === "points" ? "النقاط لكل مشترك" : "المشتركون المفعّلون"}</DialogTitle></DialogHeader>
          {detail === "acts" && (logs.length ? [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((l) => {
            const s = settings?.find((x) => x.key === l.activity);
            return <div key={l.id} className="flex items-center gap-2 border-b border-border py-2 text-sm last:border-0"><span>{s?.emoji}</span><span className="flex-1">{s?.label ?? l.activity}</span><b>{names[l.user_id]?.full_name ?? "—"}</b><span className="text-xs text-muted-foreground">{cairoDate(l.created_at)}</span></div>;
          }) : <p className="text-muted-foreground">لا توجد أنشطة.</p>)}
          {detail === "points" && (byMember.length ? byMember.map((r) => (
            <div key={r.id} className="flex items-center gap-2 border-b border-border py-2 text-sm last:border-0"><b className="w-8">{r.tied ? `=${r.rank}` : r.rank}</b><span>{names[r.id]?.avatar}</span><span className="flex-1">{names[r.id]?.full_name}</span><span className="text-xs text-muted-foreground">{r.count} نشاط</span><b className="text-primary">{r.points}</b></div>
          )) : <p className="text-muted-foreground">لا توجد نقاط.</p>)}
          {detail === "approved" && approvedList.map((m) => (
            <div key={m.id} className="flex items-center gap-2 border-b border-border py-2 text-sm last:border-0"><span>{m.avatar}</span><span className="flex-1">{m.full_name}</span><span className="text-xs text-muted-foreground">{m.academic_year ?? ""}</span></div>
          ))}
        </DialogContent>
      </Dialog>
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
              <b className="w-8">{r.tied ? `=${r.rank}` : r.rank}</b><span>{names[r.id]?.avatar}</span><span className="flex-1">{names[r.id]?.full_name}</span>
              <span className="text-xs text-muted-foreground">{r.count} نشاط</span><b className="text-primary">{r.points}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Stat({ label, v, cls, onClick }: { label: string; v: number; cls: string; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={`pop rounded-3xl p-4 text-right transition hover:scale-[1.02] ${cls}`}><div className="text-sm font-bold">{label} ›</div><div className="font-display text-3xl font-extrabold">{v}</div></button>;
}

/* ---------- Requests ---------- */
function Requests() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-pending"],
    queryFn: async () => (await supabase.from("profiles").select(PROFILE_COLS + ", account_type").neq("status", "approved").order("created_at", { ascending: false })).data ?? [],
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
            <b className="text-lg">{p.avatar} {p.full_name} <span className={`rounded-full px-2 py-0.5 text-xs ${p.account_type === "servant" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>{p.account_type === "servant" ? "خادم" : "مشترك"}</span></b>
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
type P = { id: string; academic_year?: string | null; class_name?: string | null; created_at: string };
function usePerms() {
  return useQuery({ queryKey: ["perms"], queryFn: async () => (await supabase.rpc("my_permissions")).data as { owner: boolean; contacts: boolean } });
}
function Contact({ p }: { p: P }) {
  const { data: perms } = usePerms();
  const [c, setC] = useState<{ birth_date: string | null; phone: string | null; address: string | null } | null>(null);
  const reveal = async () => {
    const { data, error } = await supabase.rpc("view_contact", { _member: p.id });
    if (error) return toast.error(error.message);
    setC(data?.[0] ?? { birth_date: null, phone: null, address: null });
  };
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">العام الدراسي</dt><dd>{p.academic_year ?? "—"} {p.class_name ? `· ${p.class_name}` : ""}</dd>
      <dt className="text-muted-foreground">تاريخ التسجيل</dt><dd>{cairoDate(p.created_at)}</dd>
      {c ? (
        <>
          <dt className="text-muted-foreground">تاريخ الميلاد</dt><dd>{c.birth_date ?? "—"}</dd>
          <dt className="text-muted-foreground">الموبايل</dt><dd dir="ltr" className="text-right">{c.phone ? <a href={`tel:${c.phone}`} className="text-primary">{c.phone}</a> : "—"}</dd>
          <dt className="text-muted-foreground">العنوان</dt><dd>{c.address ?? "—"}</dd>
        </>
      ) : perms?.contacts ? (
        <dd className="col-span-2"><button onClick={reveal} className="mt-1 rounded-xl bg-muted px-3 py-1 text-xs font-bold">🔒 عرض بيانات التواصل (يُسجَّل في سجل التدقيق)</button></dd>
      ) : (
        <dd className="col-span-2 text-xs text-muted-foreground">🔒 بيانات التواصل متاحة للمشرفين المخولين فقط</dd>
      )}
    </dl>
  );
}

/* ---------- Members ---------- */
function Members() {
  const qc = useQueryClient();
  const { data: members } = useMembers();
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select(PROFILE_COLS)).data ?? [],
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
              <button onClick={() => setOpen(open === m.id ? null : m.id)} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">التفاصيل</button>
              <button onClick={() => { setAdj(m); setAmount(10); }} className="rounded-xl bg-secondary px-3 py-1.5 text-sm font-bold text-secondary-foreground">± تعديل النقاط</button>
              <button onClick={async () => {
                if (!confirm(`إزالة ${m.full_name} نهائيًا من البرنامج؟ سيتم حذف كل بياناته.`)) return;
                const { error } = await supabase.rpc("admin_remove_member", { _member: m.id });
                if (error) return toast.error(error.message);
                toast.success("تمت إزالة المشترك"); qc.invalidateQueries();
              }} className="rounded-xl bg-destructive px-3 py-1.5 text-sm font-bold text-destructive-foreground">🗑️ إزالة</button>
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
  const [na, setNa] = useState({ label: "", emoji: "⭐", points: 10 });
  const addActivity = async () => {
    if (!na.label.trim()) return toast.error("اكتب اسم النشاط");
    const key = "a_" + Date.now().toString(36);
    const { error } = await supabase.from("activity_settings").insert({ key, label: na.label.trim(), emoji: na.emoji || "⭐", points: na.points, sort: (settings?.length ?? 0) + 1 });
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة النشاط"); setNa({ label: "", emoji: "⭐", points: 10 }); qc.invalidateQueries({ queryKey: ["settings"] });
  };
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
        <h4 className="mt-4 mb-2 font-extrabold">➕ نشاط جديد</h4>
        <div className="grid grid-cols-6 gap-2">
          <Input value={na.emoji} onChange={(e) => setNa({ ...na, emoji: e.target.value })} />
          <Input className="col-span-3" value={na.label} onChange={(e) => setNa({ ...na, label: e.target.value })} placeholder="اسم النشاط" />
          <Input type="number" value={na.points} onChange={(e) => setNa({ ...na, points: +e.target.value })} title="النقاط" />
          <button onClick={addActivity} className="rounded-xl bg-primary font-bold text-primary-foreground">إضافة</button>
        </div>
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
  const [selected, setSelected] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["admin-notif"], queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const { data: preps } = useQuery({ queryKey: ["notif-prep-status"], queryFn: async () => (await supabase.rpc("admin_prep_status", { _offset: 0 })).data ?? [] });
  const { data: memberAbsence } = useQuery({ queryKey: ["notif-member-absence"], queryFn: async () => (await supabase.rpc("admin_absence_by_type", { _offset: 0, _type: "member" })).data ?? [] });
  const { data: servantAbsence } = useQuery({ queryKey: ["notif-servant-absence"], queryFn: async () => (await supabase.rpc("admin_absence_by_type", { _offset: 0, _type: "servant" })).data ?? [] });
  const missingPrep = (preps ?? []).filter((p) => !p.submitted);
  const categories = [
    { key: "prep", icon: "📘", label: "تحضير الخدام", rows: (data ?? []).filter((n) => n.kind === "prep") },
    { key: "visitation", icon: "📞", label: "افتقاد الخدام للمشتركين", rows: (data ?? []).filter((n) => n.kind === "visitation") },
    { key: "activity", icon: "✅", label: "أنشطة المشتركين", rows: (data ?? []).filter((n) => n.kind === "activity") },
    { key: "signup", icon: "📝", label: "طلبات التسجيل الجديدة", rows: (data ?? []).filter((n) => n.kind === "signup") },
    { key: "servant_absence", icon: "🚷", label: "غياب الخدام", rows: (servantAbsence ?? []).map((r) => ({ id: `sa-${r.id}`, message: `${r.full_name} غائب هذا الأسبوع`, read: false, created_at: new Date().toISOString(), synthetic: true })) },
    { key: "member_absence", icon: "🚫", label: "غياب المشتركين", rows: (memberAbsence ?? []).map((r) => ({ id: `ma-${r.id}`, message: `${r.full_name} · ${r.academic_year ?? "بدون مرحلة"}`, read: false, created_at: new Date().toISOString(), synthetic: true })) },
    { key: "missing_prep", icon: "⏰", label: "لم يرسلوا التحضير", rows: missingPrep.map((r) => ({ id: `mp-${r.user_id}`, message: `${r.full_name} لم يرسل تحضير هذا الأسبوع`, read: false, created_at: new Date().toISOString(), synthetic: true })) },
  ];
  const active = categories.find((c) => c.key === selected);
  const openCategory = async (key: string) => {
    setSelected(key);
    if (["prep", "visitation", "activity", "signup"].includes(key)) {
      await supabase.from("notifications").update({ read: true }).eq("kind", key).eq("read", false);
      qc.invalidateQueries({ queryKey: ["admin-notif"] });
      qc.invalidateQueries({ queryKey: ["unread"] });
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold">التنبيهات حسب النوع</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => {
          const unread = c.rows.filter((r) => !r.read).length;
          return <button key={c.key} onClick={() => openCategory(c.key)} className="pop relative min-h-32 rounded-2xl border-2 border-border bg-card p-4 text-center transition hover:border-primary hover:bg-muted">
            <span className="block text-4xl" aria-hidden="true">{c.icon}</span>
            <span className="mt-2 block text-sm font-extrabold">{c.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{c.rows.length} تنبيه</span>
            {!!unread && <Dot n={unread} />}
          </button>;
        })}
      </div>
      <Dialog open={!!active} onOpenChange={(o) => !o && setSelected(null)}><DialogContent>
        <DialogHeader><DialogTitle>{active?.icon} {active?.label}</DialogTitle></DialogHeader>
        <div className="max-h-[65vh] space-y-2 overflow-y-auto">
          {!active?.rows.length && <p className="text-muted-foreground">لا توجد تنبيهات في هذا القسم.</p>}
          {active?.rows.map((n) => <div key={n.id} className="rounded-xl bg-muted p-3 text-sm"><div className="font-bold">{n.message}</div>{!n.synthetic && <div className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}</div>}</div>)}
        </div>
      </DialogContent></Dialog>
    </div>
  );
}

/* ---------- Archive + comparison chart ---------- */
function Archive() {
  const WEEKS = 8;
  const [open, setOpen] = useState<number | null>(null);
  const { data: members } = useMembers();
  const names = nameMap(members);
  const weeks = Array.from({ length: WEEKS }, (_, i) => cairoWeek(i + 1));
  const { data: logs } = useQuery({
    queryKey: ["admin-archive"],
    queryFn: async () => {
      const from = new Date(new Date(weeks[WEEKS - 1][0]).getTime() - 86400000).toISOString();
      const { data, error } = await supabase.from("activity_logs").select("user_id, points, created_at").eq("status", "approved").gte("created_at", from);
      if (error) throw error;
      return data;
    },
  });
  const perWeek = weeks.map((days, i) => {
    const wl = (logs ?? []).filter((l) => days.includes(cairoDate(l.created_at)));
    const byUser: Record<string, number> = {};
    wl.forEach((l) => { byUser[l.user_id] = (byUser[l.user_id] ?? 0) + l.points; });
    const groups: Record<string, number> = {};
    Object.entries(byUser).forEach(([u, pts]) => { const g = names[u]?.academic_year ?? "غير محدد"; groups[g] = (groups[g] ?? 0) + pts; });
    const sorted = Object.entries(byUser).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 3).map(([u, pts]) => ({ u, pts, rank: sorted.findIndex((r) => r[1] === pts) + 1 }));
    return { offset: i + 1, days, total: wl.length, points: wl.reduce((a, l) => a + l.points, 0), groups, top };
  });
  const groupNames = Array.from(new Set(perWeek.flatMap((w) => Object.keys(w.groups))));
  const chronological = [...perWeek].reverse();
  const colors = ["var(--primary)", "var(--secondary)", "var(--accent)", "var(--sky)", "var(--chart-5)", "var(--muted-foreground)"];
  const max = Math.max(1, ...chronological.flatMap((w) => groupNames.map((g) => w.groups[g] ?? 0)));
  // group rank per week
  const groupRank = (w: (typeof perWeek)[number], g: string) => {
    const vals = groupNames.map((x) => w.groups[x] ?? 0).sort((a, b) => b - a);
    return vals.indexOf(w.groups[g] ?? 0) + 1;
  };

  if (open) return (
    <div>
      <button onClick={() => setOpen(null)} className="mb-3 rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">→ رجوع للأرشيف</button>
      <Summary initialOffset={open} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className={card}>
        <h3 className="mb-1 font-extrabold">مقارنة نقاط المجموعات (العام الدراسي) عبر آخر {WEEKS} أسابيع</h3>
        <p className="mb-3 text-xs text-muted-foreground">الرقم داخل العمود = ترتيب المجموعة في ذلك الأسبوع</p>
        {!groupNames.length ? <p className="text-muted-foreground">لا توجد بيانات بعد.</p> : (
          <>
            <div className="flex h-56 items-end gap-3 overflow-x-auto border-b border-border pb-1">
              {chronological.map((w) => (
                <div key={w.offset} className="flex min-w-20 flex-1 flex-col items-center">
                  <div className="flex h-48 items-end gap-0.5">
                    {groupNames.map((g, gi) => {
                      const v = w.groups[g] ?? 0;
                      return (
                        <div key={g} title={`${g}: ${v} نقطة`} className="relative w-3 rounded-t" style={{ height: `${(v / max) * 100}%`, background: colors[gi % colors.length], minHeight: v ? 4 : 0 }}>
                          {v > 0 && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold">{groupRank(w, g)}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{w.days[0].slice(5)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {groupNames.map((g, gi) => <span key={g} className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: colors[gi % colors.length] }} />{g}</span>)}
            </div>
          </>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {perWeek.map((w) => (
          <button key={w.offset} onClick={() => setOpen(w.offset)} className={`${card} text-right hover:border-primary`}>
            <div className="flex justify-between"><b>الأحد {w.days[0]} → السبت {w.days[6]}</b><span className="text-xs text-muted-foreground">{w.total} نشاط · {w.points} نقطة</span></div>
            <div className="mt-2 space-y-1 text-sm">
              {!w.top.length && <span className="text-muted-foreground">لا توجد أنشطة</span>}
              {w.top.map((t) => <div key={t.u}>{["🥇", "🥈", "🥉"][t.rank - 1] ?? t.rank} {names[t.u]?.full_name} — {t.pts}</div>)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Audit log (owner) ---------- */
function Audit() {
  const { data: members } = useMembers();
  const names = nameMap(members);
  const [admin, setAdmin] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("contact_access_log").select("*").order("created_at", { ascending: false }).limit(1000)).data ?? [],
  });
  const admins = Array.from(new Set((data ?? []).map((a) => a.admin_id)));
  const list = (data ?? []).filter((a) => (!admin || a.admin_id === admin) && (!from || cairoDate(a.created_at) >= from) && (!to || cairoDate(a.created_at) <= to));
  const fmt = (d: string) => new Date(d).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });
  function exportCsv() {
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["التاريخ والوقت (القاهرة)", "المشرف", "العضو"], ...list.map((a) => [fmt(a.created_at), names[a.admin_id]?.full_name ?? a.admin_id, names[a.member_id]?.full_name ?? a.member_id])];
    const blob = new Blob(["\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const el = document.createElement("a"); el.href = URL.createObjectURL(blob); el.download = `contact-audit-${cairoDate(new Date())}.csv`; el.click();
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="text-xs">المشرف
          <select value={admin} onChange={(e) => setAdmin(e.target.value)} className="block h-9 rounded-md border border-input bg-card px-2 text-sm">
            <option value="">الكل</option>
            {admins.map((id) => <option key={id} value={id}>{names[id]?.full_name ?? id}</option>)}
          </select></label>
        <label className="text-xs">من <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs">إلى <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button onClick={exportCsv} className="h-9 rounded-xl bg-accent px-4 font-bold text-accent-foreground">⬇️ تصدير CSV</button>
      </div>
      {!list.length && <p className="text-muted-foreground">لا توجد سجلات.</p>}
      <div className="overflow-x-auto rounded-3xl border-2 border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr><th className="p-2 text-right">التاريخ والوقت</th><th className="p-2 text-right">المشرف</th><th className="p-2 text-right">اطّلع على بيانات</th></tr></thead>
          <tbody>{list.map((a) => (
            <tr key={a.id} className="border-t border-border"><td className="p-2">{fmt(a.created_at)}</td><td className="p-2">{names[a.admin_id]?.full_name}</td><td className="p-2">{names[a.member_id]?.full_name}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Staff permissions (owner) ---------- */
function Staff() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useQuery({ queryKey: ["staff"], queryFn: async () => { const { data, error } = await supabase.rpc("owner_list_staff"); if (error) throw error; return data; } });
  const set = async (u: string, isAdmin: boolean, view: boolean) => {
    const { error } = await supabase.rpc("owner_set_staff", { _user: u, _is_admin: isAdmin, _can_view: view });
    if (error) return toast.error(error.message);
    toast.success("تم تحديث الصلاحيات"); qc.invalidateQueries();
  };
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">أنت المشرف المسؤول. حدّد من يكون مشرفًا، ومن يُسمح له بالاطلاع على بيانات التواصل (كل اطلاع يُسجَّل).</p>
      <Input placeholder="بحث بالاسم..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-xs" />
      <div className="space-y-2">
        {data?.filter((s) => s.full_name.includes(q)).map((s) => (
          <div key={s.user_id} className={`${card} flex flex-wrap items-center gap-3`}>
            <span className="text-2xl">{s.avatar}</span>
            <b className="flex-1">{s.full_name} {s.is_owner && <span className="text-xs text-primary">(المسؤول)</span>}</b>
            {!s.is_owner && (
              <>
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={s.is_admin} onChange={(e) => set(s.user_id, e.target.checked, e.target.checked && s.can_view_contacts)} /> مشرف</label>
                <label className={`flex items-center gap-1 text-sm ${s.is_admin ? "" : "opacity-40"}`}><input type="checkbox" disabled={!s.is_admin} checked={s.can_view_contacts} onChange={(e) => set(s.user_id, true, e.target.checked)} /> الاطلاع على بيانات التواصل</label>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Quizzes ---------- */
function AdminQuizzes() {
  const qc = useQueryClient();
  const blank = () => ({ question: "", options: ["", "", "", ""], correct: 0, points: 5, image_url: null });
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [qimg, setQimg] = useState<string | null>(null);
  const pickImg = async (e, cb) => { const f = e.target.files?.[0]; if (!f) return; try { cb(await fileToDataUrl(f, 900, 0.75)); } catch (err) { toast.error(err.message); } e.target.value = ""; };
  const [title, setTitle] = useState("");
  const [qs, setQs] = useState([blank()]);
  const [results, setResults] = useState<{ id: string; title: string } | null>(null);
  const { data: quizzes } = useQuery({ queryKey: ["admin-quizzes"], queryFn: async () => (await supabase.from("quizzes").select("*").order("created_at", { ascending: false })).data ?? [] });
  const { data: res } = useQuery({ queryKey: ["quiz-res", results?.id], enabled: !!results, queryFn: async () => (await supabase.rpc("admin_quiz_results", { _quiz: results.id })).data ?? [] });
  const upd = (i, patch) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const create = async () => {
    if (!title.trim()) return toast.error("اكتب عنوان المسابقة");
    const clean = qs.map((q) => ({ ...q, options: q.options.map((o) => o.trim()).filter(Boolean) }));
    if (opens && closes && new Date(closes) <= new Date(opens)) return toast.error("وقت القفل لازم يكون بعد وقت الفتح");
    if (clean.some((q) => !q.question.trim() || q.options.length < 2 || q.correct >= q.options.length)) return toast.error("كل سؤال يحتاج نصًا واختيارين على الأقل وإجابة صحيحة");
    const { data: auth } = await supabase.auth.getUser();
    const { data: z, error } = await supabase.from("quizzes").insert({ title: title.trim(), created_by: auth.user.id, image_url: qimg, opens_at: opens ? new Date(opens).toISOString() : null, closes_at: closes ? new Date(closes).toISOString() : null }).select("id").single();
    if (error) return toast.error(error.message);
    const { error: e2 } = await supabase.from("quiz_questions").insert(clean.map((q, i) => ({ quiz_id: z.id, question: q.question.trim(), options: q.options, correct: q.correct, points: q.points, sort: i, image_url: q.image_url })));
    if (e2) return toast.error(e2.message);
    toast.success("تم نشر المسابقة"); setTitle(""); setQs([blank()]); setOpens(""); setCloses(""); setQimg(null); qc.invalidateQueries({ queryKey: ["admin-quizzes"] });
  };
  return (
    <div className="space-y-5">
      <section className={card}>
        <h2 className="mb-3 text-xl font-extrabold">مسابقة جديدة</h2>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المسابقة (مثال: مسابقة الأسبوع الأول)" />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-bold">⏰ وقت الفتح<Input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></label>
          <label className="text-xs font-bold">🔒 وقت القفل<Input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></label>
          <label className="cursor-pointer rounded-xl border-2 border-dashed border-border p-2 text-center text-xs font-bold hover:bg-muted">{qimg ? <img src={qimg} alt="" className="mx-auto h-12 rounded" /> : "📷 صورة المسابقة"}<input type="file" accept="image/*" className="hidden" onChange={(e) => pickImg(e, setQimg)} /></label>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">اترك الوقت فارغًا لتفتح فورًا ولا تُقفل. التصحيح تلقائي بعد كل سؤال والنقاط تُضاف للمجموع، والمشترك لا يستطيع إعادة الحل.</p>
        {qs.map((q, i) => (
          <div key={i} className="mt-3 rounded-2xl bg-muted p-3">
            <div className="flex gap-2"><Input value={q.question} onChange={(e) => upd(i, { question: e.target.value })} placeholder={`السؤال ${i + 1}`} />
              <Input type="number" className="w-20" value={q.points} onChange={(e) => upd(i, { points: +e.target.value })} title="الدرجة" />
              <label className="cursor-pointer rounded-lg bg-card px-2 py-1 text-lg" title="صورة للسؤال">📷<input type="file" accept="image/*" className="hidden" onChange={(e) => pickImg(e, (u) => upd(i, { image_url: u }))} /></label>
              {qs.length > 1 && <button onClick={() => setQs(qs.filter((_, j) => j !== i))} className="text-destructive">✕</button>}</div>
            {q.image_url && <div className="mt-2 flex items-center gap-2"><img src={q.image_url} alt="" className="h-16 rounded-lg" /><button onClick={() => upd(i, { image_url: null })} className="text-xs text-destructive">إزالة</button></div>}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">{q.options.map((o, k) => (
              <label key={k} className="flex items-center gap-2"><input type="radio" checked={q.correct === k} onChange={() => upd(i, { correct: k })} title="الإجابة الصحيحة" />
                <Input value={o} onChange={(e) => upd(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} placeholder={`اختيار ${k + 1}`} /></label>
            ))}</div>
            <p className="mt-1 text-xs text-muted-foreground">حدد الدائرة بجوار الإجابة الصحيحة.</p>
          </div>
        ))}
        <div className="mt-3 flex gap-2"><button onClick={() => setQs([...qs, blank()])} className="rounded-xl bg-muted px-4 py-2 font-bold">+ سؤال</button>
          <button onClick={create} className="rounded-xl bg-primary px-5 py-2 font-extrabold text-primary-foreground">نشر المسابقة</button></div>
      </section>
      <section className="space-y-2">{quizzes?.map((z) => (
        <div key={z.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
          <span className="font-extrabold">🧠 {z.title} <span className="text-xs text-muted-foreground">{new Date(z.created_at).toLocaleDateString("ar-EG")}{z.opens_at && ` · يفتح ${new Date(z.opens_at).toLocaleString("ar-EG")}`}{z.closes_at && ` · يقفل ${new Date(z.closes_at).toLocaleString("ar-EG")}`}</span></span>
          <div className="flex gap-2"><button onClick={() => setResults({ id: z.id, title: z.title })} className="rounded-xl bg-secondary px-3 py-1.5 text-sm font-bold text-secondary-foreground">النتائج</button>
            <button onClick={async () => { await supabase.from("quizzes").update({ published: !z.published }).eq("id", z.id); qc.invalidateQueries({ queryKey: ["admin-quizzes"] }); }} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">{z.published ? "إخفاء" : "إظهار"}</button></div>
        </div>
      ))}</section>
      <Dialog open={!!results} onOpenChange={(o) => !o && setResults(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>نتائج: {results?.title}</DialogTitle></DialogHeader>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {!res?.length && <p className="text-muted-foreground">لم يشارك أحد بعد.</p>}
            {res?.map((r, i) => <div key={i} className="flex justify-between rounded-xl bg-muted p-2 text-sm"><span className="font-bold">{i + 1}. {r.full_name}</span><span>{r.score} / {r.max_score}</span></div>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WeekPicker({ off, setOff }: { off: number; setOff: (n: number) => void }) {
  return <div className="flex gap-2">{[["0", "هذا الأسبوع"], ["1", "الأسبوع الماضي"], ["2", "منذ أسبوعين"]].map(([k, l]) => (
    <button key={k} onClick={() => setOff(+k)} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${off === +k ? "bg-secondary text-secondary-foreground" : "bg-card"}`}>{l}</button>))}</div>;
}

function ServantsTab() {
  const [off, setOff] = useState(0);
  const [view, setView] = useState<string[] | null>(null);
  const { data: preps } = useQuery({ queryKey: ["admin-prep", off], queryFn: async () => { const { data, error } = await supabase.rpc("admin_prep_status", { _offset: off }); if (error) throw error; return data; } });
  const { data: visits } = useQuery({ queryKey: ["admin-visits", off], queryFn: async () => (await supabase.rpc("admin_visit_report", { _offset: off })).data ?? [] });
  const missing = preps?.filter((p) => !p.submitted) ?? [];
  const csv = () => {
    const rows = [["الخادم", "المشترك", "المرحلة", "الطريقة", "الملاحظات", "التاريخ"], ...(visits ?? []).map((v) => [v.servant, v.member, v.academic_year ?? "", v.method, v.note, new Date(v.created_at).toLocaleString("ar-EG")])];
    const blob = new Blob(["\ufeff" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `visits-week-${off}.csv`; a.click();
  };
  return (
    <div className="space-y-5">
      <WeekPicker off={off} setOff={setOff} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="pop rounded-3xl bg-accent p-4 text-accent-foreground"><div className="text-sm font-bold">أرسلوا التحضير</div><div className="font-display text-4xl font-extrabold">{(preps?.length ?? 0) - missing.length}</div></div>
        <div className="pop rounded-3xl bg-destructive p-4 text-destructive-foreground"><div className="text-sm font-bold">لم يرسلوا (الموعد الخميس)</div><div className="font-display text-4xl font-extrabold">{missing.length}</div></div>
        <div className="pop rounded-3xl bg-sky p-4 text-primary-foreground"><div className="text-sm font-bold">مرات الافتقاد</div><div className="font-display text-4xl font-extrabold">{visits?.length ?? 0}</div></div>
      </div>
      {!preps?.length && <p className="text-muted-foreground">لا يوجد خدام معتمدون بعد. الخادم يسجّل من صفحة الدخول «خادم» ثم توافق عليه من «طلبات التسجيل».</p>}
      <div className="grid gap-3 md:grid-cols-2">{preps?.map((p) => (
        <div key={p.user_id} className={`${card} ${p.submitted ? "" : "ring-2 ring-destructive"}`}>
          <div className="flex items-center justify-between"><b>📘 {p.full_name}</b>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.submitted ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"}`}>{p.submitted ? "✓ أرسل التحضير" : "✗ لم يرسل"}</span></div>
          <div className="mt-1 text-xs text-muted-foreground">افتقد {p.visits} مشترك{p.submitted_at && ` · ${new Date(p.submitted_at).toLocaleString("ar-EG")}`}</div>
          {p.notes && <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm">{p.notes}</p>}
          {!!p.images?.length && <div className="mt-2 flex flex-wrap gap-2">{p.images.map((s, i) => <img key={i} src={s} alt="" onClick={() => setView(p.images)} className="h-16 w-16 cursor-pointer rounded-lg object-cover" />)}</div>}
        </div>
      ))}</div>
      <section className={card}>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-xl font-extrabold">📞 تقرير الافتقاد الأسبوعي</h2><button onClick={csv} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">⬇️ CSV</button></div>
        {!visits?.length && <p className="text-muted-foreground">لا يوجد افتقاد مسجّل في هذا الأسبوع.</p>}
        <div className="space-y-1">{visits?.map((v, i) => (
          <div key={i} className="rounded-xl bg-muted p-2 text-sm"><b>{v.member}</b> <span className="text-xs text-muted-foreground">({v.academic_year ?? "—"})</span> ← {v.servant} · {{ call: "📞", visit: "🏠", message: "💬" }[v.method] ?? v.method}{v.note && <div className="text-xs">{v.note}</div>}</div>
        ))}</div>
      </section>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}><DialogContent><DialogHeader><DialogTitle>صور التحضير</DialogTitle></DialogHeader>
        <div className="max-h-[70vh] space-y-2 overflow-y-auto">{view?.map((s, i) => <img key={i} src={s} alt="" className="w-full rounded-xl" />)}</div></DialogContent></Dialog>
    </div>
  );
}

function AbsenceTab() {
  const [off, setOff] = useState(0);
  const [type, setType] = useState<"member" | "servant">("member");
  const { data } = useQuery({ queryKey: ["admin-absence", off, type], queryFn: async () => { const { data, error } = await supabase.rpc("admin_absence_by_type", { _offset: off, _type: type }); if (error) throw error; return data; } });
  const notify = async (y: string) => {
    const { data: n, error } = await supabase.rpc("admin_notify_absent", { _year: y });
    if (error) return toast.error(error.message);
    toast.success(`تم إرسال إشعار الغياب إلى ${n} مشترك`);
  };
  return (
    <div className="space-y-4">
      <WeekPicker off={off} setOff={setOff} />
      <div className="flex gap-2"><button onClick={() => setType("member")} className={`rounded-xl px-4 py-2 font-bold ${type === "member" ? "bg-primary text-primary-foreground" : "bg-card"}`}>👥 غياب المشتركين</button><button onClick={() => setType("servant")} className={`rounded-xl px-4 py-2 font-bold ${type === "servant" ? "bg-sky text-primary-foreground" : "bg-card"}`}>📘 غياب الخدام</button></div>
      <p className="text-xs text-muted-foreground">{type === "member" ? "الغائب = مشترك معتمد لم يسجّل أي نشاط خلال الأسبوع من الأحد إلى السبت." : "الغائب = خادم معتمد لم يرسل تحضيرًا ولم يسجّل افتقادًا خلال الأسبوع."}</p>
      <div className={`grid gap-4 ${type === "member" ? "md:grid-cols-3" : "md:grid-cols-2"}`}>{(type === "member" ? ACADEMIC_YEARS : ["الخدام"]).map((y, i) => {
        const rows = type === "member" ? (data ?? []).filter((r) => r.academic_year === y) : (data ?? []);
        return (
          <section key={y} className={card} style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-lg font-extrabold">{y}</h3><span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">{rows.length} غائب</span></div>
            <div className="max-h-72 space-y-1 overflow-y-auto">{rows.map((r) => (
              <div key={r.id} className="flex justify-between rounded-xl bg-muted p-2 text-sm"><span className="font-bold">{r.full_name}</span><span className="text-xs">{r.visited ? "✅ تم افتقاده" : "⏳ بدون افتقاد"}</span></div>
            ))}{!rows.length && <p className="text-sm text-muted-foreground">لا يوجد غياب 🎉</p>}</div>
             {type === "member" && off === 0 && !!rows.length && <button onClick={() => notify(y)} className="mt-3 w-full rounded-xl bg-secondary py-2 text-sm font-bold text-secondary-foreground">🔔 إرسال إشعار الغياب</button>}
          </section>
        );
      })}</div>
      {type === "member" && (data ?? []).some((r) => !ACADEMIC_YEARS.includes(r.academic_year)) && <p className="text-xs text-muted-foreground">يوجد {(data ?? []).filter((r) => !ACADEMIC_YEARS.includes(r.academic_year)).length} غائب بدون مرحلة محددة أو بمرحلة قديمة.</p>}
    </div>
  );
}
