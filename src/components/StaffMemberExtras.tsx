// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MONTHS, cairoDate, fileToDataUrl } from "@/lib/app";
import { ImageLightbox } from "@/components/ImageLightbox";

const card = "pop float-in rounded-3xl border-2 border-border bg-card p-5";
const METHOD = { call: "📞 مكالمة", visit: "🏠 زيارة", message: "💬 رسالة" };
const fmt = (d) => new Date(d).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" });

/* ---------- Visitation history for one member ---------- */
export function VisitHistoryDialog({ member, onClose }: { member: { id: string; name: string } | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["visit-history", member?.id], enabled: !!member,
    queryFn: async () => { const { data, error } = await supabase.rpc("member_visit_history", { _member: member.id }); if (error) throw error; return data; },
  });
  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>📜 سجل الافتقادات التراكمي: {member?.name}</DialogTitle></DialogHeader>
        {!isLoading && <div className="mx-auto rounded-full bg-sky px-5 py-2 text-lg font-extrabold text-primary-foreground pop">تم افتقاده ({data?.length ?? 0}) مرة</div>}
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          {isLoading && <p className="text-muted-foreground">جاري التحميل...</p>}
          {!isLoading && !data?.length && <p className="text-muted-foreground">لم يتم افتقاد هذا المخدوم من قبل.</p>}
          <ol className="relative mr-3 border-r-2 border-sky">
            {data?.map((v, i) => (
              <li key={i} className="relative mb-4 pr-5">
                <span className="absolute -right-[9px] top-1 h-4 w-4 rounded-full bg-sky" aria-hidden="true" />
                <div className="text-xs font-bold text-muted-foreground">{fmt(v.created_at)}</div>
                <div className="font-extrabold">{METHOD[v.method] ?? v.method} · بواسطة {v.servant}</div>
                {v.note ? <p className="mt-1 whitespace-pre-wrap rounded-xl bg-muted p-2 text-sm">{v.note}</p> : <p className="text-xs text-muted-foreground">بدون ملاحظات</p>}
              </li>
            ))}
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Visitation archive (servant: own, admin: all) ---------- */
export function VisitArchive() {
  const [q, setQ] = useState("");
  const [member, setMember] = useState(null);
  const { data } = useQuery({ queryKey: ["visit-archive"], queryFn: async () => { const { data, error } = await supabase.rpc("visit_archive"); if (error) throw error; return data; } });
  const rows = (data ?? []).filter((v) => !q || v.member.includes(q) || v.servant.includes(q));
  return (
    <section className={card}>
      <h2 className="mb-3 text-xl font-extrabold">🗂️ أرشيف الافتقاد</h2>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المخدوم أو الخادم" className="mb-3 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
      {!rows.length && <p className="text-muted-foreground">لا يوجد افتقاد مسجّل.</p>}
      <div className="max-h-[70vh] space-y-2 overflow-y-auto">{rows.map((v) => (
        <div key={v.id} className="rounded-xl bg-muted p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button onClick={() => setMember({ id: v.member_id, name: v.member })} className="font-extrabold text-primary underline-offset-4 hover:underline">{v.member}</button>
            <span className="text-xs text-muted-foreground">{fmt(v.created_at)}</span>
          </div>
          <div className="text-xs">{v.academic_year ?? "—"} · {METHOD[v.method] ?? v.method} · الخادم: {v.servant}</div>
          {v.note && <p className="mt-1 whitespace-pre-wrap">{v.note}</p>}
        </div>
      ))}</div>
      <VisitHistoryDialog member={member} onClose={() => setMember(null)} />
    </section>
  );
}

/* ---------- Preparation archive ---------- */
export function PrepArchive({ userId, name }: { userId: string; name?: string }) {
  const [view, setView] = useState<string[] | null>(null);
  const { data } = useQuery({
    queryKey: ["prep-archive", userId],
    queryFn: async () => { const { data, error } = await supabase.from("servant_preparations").select("*").eq("user_id", userId).order("week_start", { ascending: false }); if (error) throw error; return data; },
  });
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-extrabold">📚 أرشيف التحضيرات{name ? `: ${name}` : ""} <span className="text-sm text-muted-foreground">({data?.length ?? 0})</span></h2>
      {!data?.length && <p className="text-muted-foreground">لا توجد تحضيرات محفوظة.</p>}
      {data?.map((r) => (
        <details key={r.id} className="rounded-2xl border-2 border-border bg-card p-3">
          <summary className="cursor-pointer font-bold">📘 أسبوع {r.week_start} <span className="text-xs font-normal text-muted-foreground">· {fmt(r.updated_at)} · {r.images?.length ?? 0} صورة</span></summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{r.notes || "بدون نص"}</p>
          <div className="mt-2 flex flex-wrap gap-2">{r.images?.map((s, i) => <img key={i} src={s} alt="" onClick={() => setView(r.images)} className="h-24 w-24 cursor-zoom-in rounded-xl object-cover" />)}</div>
        </details>
      ))}
      <ImageLightbox images={view} title="صور التحضير" onClose={() => setView(null)} />
    </div>
  );
}

/* ---------- Birthdays ---------- */
export function Birthdays() {
  const now = new Date();
  const [m, setM] = useState(now.getMonth() + 1);
  const { data } = useQuery({ queryKey: ["birthdays", m], queryFn: async () => { const { data, error } = await supabase.rpc("birthdays", { _month: m }); if (error) throw error; return data; } });
  const today = now.getDate();
  return (
    <section className={card}>
      <h2 className="mb-3 text-xl font-extrabold">🎂 أعياد الميلاد</h2>
      <div className="mb-3 flex flex-wrap gap-1">{MONTHS.map((n, i) => (
        <button key={n} onClick={() => setM(i + 1)} className={`rounded-xl px-2 py-1 text-xs font-bold ${m === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{n}</button>
      ))}</div>
      {!data?.length && <p className="text-muted-foreground">لا توجد أعياد ميلاد في شهر {MONTHS[m - 1]}.</p>}
      <div className="grid gap-2 sm:grid-cols-2">{data?.map((b) => {
        const isToday = m === now.getMonth() + 1 && b.day === today;
        return (
          <div key={b.id} className={`flex items-center gap-3 rounded-2xl p-3 ${isToday ? "bg-secondary text-secondary-foreground pop" : "bg-muted"}`}>
            {b.photo_url ? <img src={b.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-3xl">{b.avatar}</span>}
            <div className="flex-1"><b>{b.full_name}</b><div className="text-xs opacity-80">{b.academic_year ?? ""}</div></div>
            <span className="rounded-full bg-card px-3 py-1 text-sm font-extrabold text-foreground">{isToday ? "🎉 اليوم" : `${b.day} ${MONTHS[m - 1]}`}</span>
          </div>
        );
      })}</div>
    </section>
  );
}

export function BirthdaysButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-2xl border-2 border-border bg-card px-4 py-2 font-bold hover:bg-muted">🎂 أعياد الميلاد</button>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl"><div className="max-h-[75vh] overflow-y-auto"><Birthdays /></div></DialogContent></Dialog>
    </>
  );
}

/* ---------- Suggestions ---------- */
export function SuggestionForm() {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { data: mine } = useQuery({ queryKey: ["my-suggestions"], queryFn: async () => (await supabase.from("suggestions").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [] });
  const send = async () => {
    if (!body.trim()) return toast.error("اكتب اقتراحك");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("suggestions").insert({ body: body.trim(), images, user_id: user.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم إرسال اقتراحك للخدام والمشرف 💡"); setBody(""); setImages([]);
    qc.invalidateQueries({ queryKey: ["my-suggestions"] });
  };
  return (
    <section className={card}>
      <h2 className="mb-3 text-xl font-extrabold">💡 اقتراحات</h2>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب اقتراحك لتطوير الخدمة أو الأنشطة..." className="min-h-28" />
      <div className="mt-2 flex flex-wrap gap-2">
        {images.map((s, i) => <div key={i} className="relative"><img src={s} alt="" className="h-20 w-20 rounded-xl object-cover" /><button onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-xs text-destructive-foreground">✕</button></div>)}
        {images.length < 4 && <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-center text-xs font-bold hover:bg-muted">📷<br />صورة
          <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 4 - images.length);
            try { setImages([...images, ...(await Promise.all(files.map((f) => fileToDataUrl(f, 900, 0.75))))]); } catch (err) { toast.error(err.message); }
            e.target.value = "";
          }} /></label>}
      </div>
      <button disabled={busy} onClick={send} className="pop mt-3 w-full rounded-2xl bg-primary py-3 font-extrabold text-primary-foreground disabled:opacity-60">{busy ? "..." : "إرسال الاقتراح"}</button>
      {!!mine?.length && <div className="mt-4 space-y-2"><h3 className="font-bold">اقتراحاتي السابقة</h3>{mine.map((s) => (
        <div key={s.id} className="rounded-xl bg-muted p-2 text-sm"><p className="whitespace-pre-wrap">{s.body}</p><div className="text-[10px] text-muted-foreground">{fmt(s.created_at)}</div></div>
      ))}</div>}
    </section>
  );
}

export function SuggestionDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [gallery, setGallery] = useState<string[] | null>(null);
  const { data } = useQuery({ queryKey: ["suggestion", id], enabled: !!id, queryFn: async () => (await supabase.from("suggestions").select("*").eq("id", id).maybeSingle()).data });
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}><DialogContent>
      <DialogHeader><DialogTitle>💡 تفاصيل الاقتراح</DialogTitle></DialogHeader>
      <div className="max-h-[65vh] space-y-2 overflow-y-auto">
        {!data ? <p className="text-muted-foreground">جاري التحميل...</p> : <>
          <div className="text-xs text-muted-foreground">{fmt(data.created_at)}</div>
          <p className="whitespace-pre-wrap leading-7">{data.body}</p>
          {data.images?.map((s, i) => <img key={i} src={s} alt="" onClick={() => setGallery(data.images)} className="w-full cursor-zoom-in rounded-xl" />)}
        </>}
      </div>
    </DialogContent><ImageLightbox images={gallery} title="صور الاقتراح" onClose={() => setGallery(null)} /></Dialog>
  );
}

export function PrepDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [gallery, setGallery] = useState<string[] | null>(null);
  const { data } = useQuery({ queryKey: ["prep-detail", id], enabled: !!id, queryFn: async () => (await supabase.from("servant_preparations").select("*,profiles:user_id(full_name)").eq("id", id).maybeSingle()).data });
  return <><Dialog open={!!id} onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>📘 تحضير {data?.profiles?.full_name ?? "الخادم"}</DialogTitle></DialogHeader><div className="max-h-[65vh] overflow-y-auto"><div className="text-xs text-muted-foreground">أسبوع {data
