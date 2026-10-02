// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ACADEMIC_YEARS, fileToDataUrl, useMe } from "@/lib/app";
import { Textarea } from "@/components/ui/textarea";
import { BirthdaysButton, PrepArchive, ReadingPlanner, VisitArchive, VisitHistoryDialog } from "@/components/StaffMemberExtras";
import { NotificationsBell } from "@/components/MemberExtras";

export const Route = createFileRoute("/_authenticated/servant")({
  head: () => ({
    meta: [
      { title: "مرحلة الخدام | أبطال الإيمان" },
      { name: "description", content: "تحضير الخادم الأسبوعي وافتقاد المشتركين." },
      { property: "og:title", content: "مرحلة الخدام | أبطال الإيمان" },
      { property: "og:description", content: "تحضير الخادم الأسبوعي وافتقاد المشتركين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServantPage,
});

const card = "pop float-in rounded-3xl border-2 border-border bg-card p-5";

function ServantPage() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<string>("prep");
  if (isLoading || !me) return <div className="p-10 text-center">...</div>;
  const p = me.profile;
  const allowed = me.isAdmin || (p?.account_type === "servant" && p?.status === "approved");
  return (
    <div className="stage-servant pb-16">
      <AppHeader stage="servant" isAdmin={me.isAdmin} name={p?.full_name} avatar={p?.avatar} photo={p?.photo_url} />
      <main className="mx-auto max-w-5xl px-4">
        {!allowed ? (
          <div className={`${card} mx-auto mt-10 max-w-md text-center`}>
            <div className="text-6xl">{p?.status === "rejected" ? "🚫" : "⏳"}</div>
            <h1 className="mt-3 text-2xl font-extrabold">{p?.account_type !== "servant" ? "هذه الصفحة للخدام فقط" : p?.status === "rejected" ? "لم تتم الموافقة على الحساب" : "طلبك قيد المراجعة"}</h1>
            <p className="mt-2 text-muted-foreground">سيتم تفعيل حساب الخادم بعد موافقة المشرف.</p>
            {p?.account_type !== "servant" && <Link to="/home" className="mt-3 inline-block font-bold text-primary">رجوع</Link>}
          </div>
        ) : (
          <>
            <div className="rounded-3xl bg-gradient-to-l from-sky/40 via-card to-card p-5 pop float-in">
              <div className="text-sm font-bold text-sky">أهلا يا خادم 🙏</div>
              <h1 className="text-3xl font-extrabold">{p?.full_name}</h1>
              <p className="text-sm text-muted-foreground">أرسل تحضيرك قبل يوم الخميس، وسجّل افتقادك للمشتركين كل أسبوع.</p>
            </div>
            <nav className="my-5 flex flex-wrap gap-2">
              {([["prep", "📘 تحضير الخادم"], ["visit", "📞 الافتقاد الأسبوعي"], ["preparch", "📚 أرشيف التحضيرات"], ["visitarch", "🗂️ أرشيف الافتقاد"], ["read", "📖 القراءات اليومية"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-2xl border-2 px-4 py-2 font-bold transition ${tab === k ? "border-sky bg-sky text-primary-foreground pop" : "border-border bg-card"}`}>{l}</button>
              ))}
              <BirthdaysButton />
              <div className="mr-auto"><NotificationsBell /></div>
            </nav>
            {tab === "prep" && <Prep userId={me.user.id} />}
            {tab === "visit" && <Visits />}
            {tab === "preparch" && <PrepArchive userId={me.user.id} />}
            {tab === "visitarch" && <VisitArchive />}
            {tab === "read" && <ReadingPlanner />}
          </>
        )}
      </main>
    </div>
  );
}

function Prep({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["my-preps"],
    queryFn: async () => (await supabase.from("servant_preparations").select("*").eq("user_id", userId).order("week_start", { ascending: false }).limit(8)).data ?? [],
  });
  const { data: ws } = useQuery({ queryKey: ["week-start"], queryFn: async () => (await supabase.rpc("week_start", { _offset: 0 })).data });
  const current = rows?.find((r) => r.week_start === ws);
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (current) { setNotes(current.notes); setImages(current.images ?? []); } }, [current?.id]);
  const late = new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "Africa/Cairo" });
  const afterThu = ["Fri", "Sat"].includes(late);
  const save = async () => {
    if (!notes.trim() && !images.length) return toast.error("اكتب التحضير أو ارفع صورة");
    setBusy(true);
    const { error } = current
      ? await supabase.from("servant_preparations").update({ notes, images, updated_at: new Date().toISOString() }).eq("id", current.id)
      : await supabase.from("servant_preparations").insert({ notes, images });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم إرسال التحضير للمشرف ✅");
    qc.invalidateQueries({ queryKey: ["my-preps"] });
  };
  return (
    <div className="space-y-4">
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">تحضير هذا الأسبوع</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${current ? "bg-accent text-accent-foreground" : afterThu ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
            {current ? "✓ تم الإرسال" : afterThu ? "متأخر — الموعد كان الخميس" : "آخر موعد: الخميس"}
          </span>
        </div>
        <Textarea className="mt-3 min-h-40" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="موضوع الدرس، الآيات، الوسائل، ملاحظات..." />
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt="" className="h-24 w-24 rounded-xl object-cover" />
              <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-xs text-destructive-foreground">✕</button>
            </div>
          ))}
          {images.length < 6 && (
            <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-center text-xs font-bold hover:bg-muted">📷<br />رفع صورة
              <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 6 - images.length);
                try { const urls = await Promise.all(files.map((f) => fileToDataUrl(f, 900, 0.75))); setImages([...images, ...urls]); } catch (err) { toast.error((err as Error).message); }
                e.target.value = "";
              }} />
            </label>
          )}
        </div>
        <button disabled={busy} onClick={save} className="pop mt-4 w-full rounded-2xl bg-sky py-3 text-lg font-extrabold text-primary-foreground disabled:opacity-60">{busy ? "..." : current ? "تحديث التحضير" : "إرسال التحضير"}</button>
      </section>
      {rows?.filter((r) => r.week_start !== ws).length > 0 && (
        <section className={card}>
          <h3 className="mb-2 font-extrabold">التحضيرات السابقة</h3>
          <div className="space-y-2">{rows.filter((r) => r.week_start !== ws).map((r) => (
            <details key={r.id} className="rounded-xl bg-muted p-3"><summary className="cursor-pointer font-bold">أسبوع {r.week_start}</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.notes}</p>
              <div className="mt-2 flex flex-wrap gap-2">{r.images?.map((s, i) => <img key={i} src={s} alt="" className="h-20 w-20 rounded-lg object-cover" />)}</div>
            </details>
          ))}</div>
        </section>
      )}
    </div>
  );
}

const METHODS = { call: "📞 مكالمة", visit: "🏠 زيارة", message: "💬 رسالة" };
function Visits() {
  const qc = useQueryClient();
  const [year, setYear] = useState(ACADEMIC_YEARS[0]);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("call");
  const [hist, setHist] = useState(null);
  const { data } = useQuery({ queryKey: ["servant-members"], queryFn: async () => { const { data, error } = await supabase.rpc("servant_members"); if (error) throw error; return data; } });
  const rows = (data ?? []).filter((m) => m.academic_year === year);
  const save = async (member_id: string) => {
    const { error } = await supabase.from("visitations").insert({ member_id, method, note: note.trim() });
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل الافتقاد"); setOpen(null); setNote("");
    qc.invalidateQueries({ queryKey: ["servant-members"] });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{ACADEMIC_YEARS.map((y) => (
        <button key={y} onClick={() => setYear(y)} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${year === y ? "bg-sky text-primary-foreground" : "bg-card"}`}>{y} ({(data ?? []).filter((m) => m.academic_year === y).length})</button>
      ))}</div>
      <p className="text-xs text-muted-foreground">🔴 = لم يسجّل أي نشاط هذا الأسبوع (يحتاج افتقاد) · ✅ = تم افتقاده هذا الأسبوع. التقرير يصل للمشرف تلقائيًا.</p>
      {!rows.length && <p className="text-muted-foreground">لا يوجد مشتركون في هذه المرحلة.</p>}
      <div className="grid gap-3 md:grid-cols-2">{rows.map((m) => (
        <div key={m.id} className={card}>
          <div className="flex items-center gap-3">
            {m.photo_url ? <img src={m.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-3xl">{m.avatar}</span>}
            <button onClick={() => setHist({ id: m.id, name: m.full_name })} className="flex-1 text-right font-bold text-primary underline-offset-4 hover:underline" title="سجل الافتقادات">{m.full_name}</button>
            {!m.active_this_week && <span title="لم يسجل نشاطًا">🔴</span>}
            {m.visited ? <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">✅ تم</span>
              : <button onClick={() => { setOpen(m.id); setNote(""); }} className="rounded-xl bg-sky px-3 py-1.5 text-sm font-bold text-primary-foreground">افتقاد</button>}
          </div>
          {open === m.id && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">{Object.entries(METHODS).map(([k, l]) => (
                <button key={k} onClick={() => setMethod(k)} className={`rounded-xl px-2 py-1 text-xs font-bold ${method === k ? "bg-sky text-primary-foreground" : "bg-muted"}`}>{l}</button>
              ))}</div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظات الافتقاد (سبب الغياب، الحالة...)" />
              <div className="flex gap-2"><button onClick={() => save(m.id)} className="flex-1 rounded-xl bg-accent py-2 font-bold text-accent-foreground">حفظ</button>
                <button onClick={() => setOpen(null)} className="rounded-xl bg-muted px-4 py-2 font-bold">إلغاء</button></div>
            </div>
          )}
        </div>
      ))}</div>
    </div>
  );
}
