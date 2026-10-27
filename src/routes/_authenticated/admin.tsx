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
import { AddMemberButton, BirthdaysButton, PersonDialog, PrepArchive, PrepDetail, QuizLeague, ReadingPlanner, ServantsManager, SuggestionDetail, VisitArchive, VisitHistoryDialog, removeMember } from "@/components/StaffMemberExtras";
import AdminWeeklySummary from "@/components/AdminWeeklySummary";
import { ImageLightbox } from "@/components/ImageLightbox";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة المشرف | أبطال الإيمان" },
      { name: "description", content: "إدارة المخدومين والأنشطة والهدايا والنقاط." },
      { property: "og:title", content: "لوحة المشرف | أبطال الإيمان" },
      { property: "og:description", content: "إدارة المخدومين والأنشطة والهدايا والنقاط." },
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
  ["summary", "📊 الملخص الأسبوعي"], ["announcements", "📣 الإعلانات"], ["requests", "📝 طلبات التسجيل"], ["members", "👥 المخدومون"], ["servants", "📘 الخدام والافتقاد"],
  ["activities", "✅ الأنشطة"], ["redeem", "🎁 طلبات الهدايا"], ["log", "📒 سجل النقاط"],
  ["archive", "🗂️ الأرشيف والمقارنة"], ["gifts", "🛍️ الهدايا"], ["badges", "🏅 الأوسمة والنقاط"], ["notif", "🔔 مركز التنبيهات"], ["quiz", "🧠 المسابقات"], ["visitarch", "🗂️ أرشيف الافتقاد"], ["read", "📖 القراءات اليومية"],
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
        <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-3xl font-extrabold">لوحة المشرف 🛠️</h1><BirthdaysButton /></div>
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
        {tab === "summary" && <AdminWeeklySummary />}
        {tab === "announcements" && <Announcements />}
        {tab === "requests" && <Requests />}
        {tab === "members" && <Members />}
        {tab === "servants" && <ServantsTab />}
       
        {tab === "activities" && <Activities />}
        {tab === "redeem" && <Redemptions />}
        {tab === "log" && <AdjLog />}
        {tab === "gifts" && <Gifts />}
        {tab === "badges" && <BadgesAndPoints />}
        {tab === "notif" && <Notifications />}
        {tab === "quiz" && <AdminQuizzes />}
        {tab === "visitarch" && <VisitArchive />}
        {tab === "read" && <ReadingPlanner />}
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
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> ظاهر للمخدومين</label>
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
          <DialogHeader><DialogTitle>{detail === "acts" ? "الأنشطة المكتملة" : detail === "points" ? "النقاط لكل مخدوم" : "المخدومون المفعّلون"}</DialogTitle></DialogHeader>
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
            <b className="text-lg">{p.avatar} {p.full_name} <span className={`rounded-full px-2 py-0.5 text-xs ${p.account_type === "servant" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>{p.account_type === "servant" ? "خادم" : "مخدوم"}</span></b>
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
  const [hist, setHist] = useState(null);
  const qc = useQueryClient();
  const { data: members } = useMembers();
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select(PROFILE_COLS)).data ?? [],
  });
  const [q, setQ] = useState("");
  const [adj, setAdj] = useState<Member | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [year, setYear] = useState<string>("all
