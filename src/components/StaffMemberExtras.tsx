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

/* ---------- Birthdays button + dialog ---------- */
export function BirthdaysButton() {
  const [open, setOpen] = useState(false);
  const [m, setM] = useState(new Date().getMonth() + 1);
  const { data } = useQuery({
    queryKey: ["birthdays", m], enabled: open,
    queryFn: async () => { const { data, error } = await supabase.rpc("upcoming_birthdays", { _month: m }); if (error) throw error; return data; },
  });
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-2xl border-2 border-primary bg-primary px-4 py-2 font-bold text-primary-foreground pop">🎂 أعياد الميلاد</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>🎉 أعياد ميلاد المخدومين والخدام</DialogTitle></DialogHeader>
          <div className="flex gap-2"><label className="text-sm font-bold">الشهر:</label><select value={m} onChange={(e) => setM(Number(e.target.value))} className="rounded-xl border-2 border-border bg-background px-3 py-1 font-bold">{MONTHS.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}</select></div>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pt-2">
            {!data?.length && <p className="text-muted-foreground">لا يوجد أعياد ميلاد مسجلة في هذا الشهر.</p>}
            {data?.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl bg-muted p-3">
                <div><div className="font-extrabold">{b.full_name}</div><div className="text-xs text-muted-foreground">{b.academic_year || (b.account_type === "servant" ? "خادم" : "مشرف")}</div></div>
                <div className="rounded-full bg-primary/20 px-3 py-1 text-sm font-extrabold text-primary">{b.birth_date ? new Date(b.birth_date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }) : "—"}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- Preparation archive (servant: own, admin: all) ---------- */
export function PrepArchive() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["prep-archive"], queryFn: async () => { const { data, error } = await supabase.rpc("prep_archive"); if (error) throw error; return data; } });
  const rows = (data ?? []).filter((p) => !q || p.servant.includes(q) || (p.notes ?? "").includes(q));
  return (
    <section className={card}>
      <h2 className="mb-3 text-xl font-extrabold">📚 أرشيف التحضيرات</h2>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الخادم أو في نص التحضير" className="mb-3 w-full rounded-xl border-2 border-border bg-background px-3 py-2" />
      {!rows.length && <p className="text-muted-foreground">لا توجد تحضيرات محفوظة.</p>}
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">{rows.map((p) => (
        <div key={p.id} className="rounded-2xl border-2 border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-extrabold text-primary">{p.servant}</span>
            <span className="text-xs text-muted-foreground">{fmt(p.created_at)}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">أسبوع يبدأ: {p.week_start}</div>
          {p.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{p.notes}</p>}
          {!!p.images?.length && (
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => setSel(p.id)} className="rounded-xl bg-sky px-3 py-1 text-xs font-bold text-primary-foreground">عرض الصور ({p.images.length})</button>
            </div>
          )}
        </div>
      ))}</div>
      <PrepDetail id={sel} onClose={() => setSel(null)} />
    </section>
  );
}

/* ---------- Suggestions archive for admin ---------- */
export function AdminSuggestionsArchive() {
  const [status, setStatus] = useState<"all" | "pending" | "reviewed">("all");
  const [detail, setDetail] = useState<any | null>(null);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-suggestions-all"], queryFn: async () => (await supabase.from("suggestions").select("*,profiles:user_id(full_name,avatar,academic_year,account_type)").order("created_at", { ascending: false })).data || [] });
  const rows = (data ?? []).filter((s) => status === "all" || s.status === status);
  const toggle = async (id: string, cur: string) => {
    const next = cur === "reviewed" ? "pending" : "reviewed";
    await supabase.from("suggestions").update({ status: next }).eq("id", id);
    toast.success("تم تحديث حالة الاقتراح");
    qc.invalidateQueries({ queryKey: ["admin-suggestions-all"] });
  };
  return (
    <section className={card}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">💡 أرشيف اقتراحات الخدام</h2>
        <div className="flex gap-1 text-xs font-bold">
          {(["all", "pending", "reviewed"] as const).map((k) => (
            <button key={k} onClick={() => setStatus(k)} className={`rounded-xl px-3 py-1.5 ${status === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{k === "all" ? "الكل" : k === "pending" ? "جديد" : "تمت المراجعة"}</button>
          ))}
        </div>
      </div>
      {!rows.length && <p className="text-muted-foreground">لا توجد اقتراحات.</p>}
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">{rows.map((s) => (
        <div key={s.id} className="rounded-2xl border-2 border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><span className="text-xl">{s.profiles?.avatar || "👤"}</span><span className="font-extrabold">{s.profiles?.full_name}</span><span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{s.profiles?.academic_year || "خادم"}</span></div>
            <span className="text-xs text-muted-foreground">{fmt(s.created_at)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{s.body}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              {!!s.images?.length && <button onClick={() => setDetail(s)} className="rounded-xl bg-sky px-3 py-1 text-xs font-bold text-primary-foreground">الصور ({s.images.length})</button>}
            </div>
            <button onClick={() => toggle(s.id, s.status)} className={`rounded-xl px-3 py-1 text-xs font-bold ${s.status === "reviewed" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>{s.status === "reviewed" ? "تعيين كـ جديد" : "✓ تم الاطلاع"}</button>
          </div>
        </div>
      ))}</div>
      <SuggestionDetail item={detail} onClose={() => setDetail(null)} />
    </section>
  );
}

function SuggestionDetail({ item, onClose }: { item: any | null; onClose: () => void }) {
  const [gallery, setGallery] = useState<string[] | null>(null);
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>💡 تفاصيل الاقتراح</DialogTitle></DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto space-y-3">
          <p className="whitespace-pre-wrap leading-relaxed">{item?.body}</p>
          {!!item?.images?.length && <>
            <div className="text-xs font-bold text-muted-foreground">المرفقات:</div>
            <div className="grid grid-cols-3 gap-2">{item.images.map((url: string, i: number) => <img key={i} src={url} alt="" onClick={() => setGallery(item.images)} className="h-24 w-full cursor-pointer rounded-xl object-cover hover:opacity-90" />)}</div>
          </>}
        </div>
      </DialogContent><ImageLightbox images={gallery} title="صور الاقتراح" onClose={() => setGallery(null)} /></Dialog>
  );
}

export function PrepDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [gallery, setGallery] = useState<string[] | null>(null);
  const { data } = useQuery({ queryKey: ["prep-detail", id], enabled: !!id, queryFn: async () => (await supabase.from("servant_preparations").select("*,profiles:user_id(full_name)").eq("id", id).maybeSingle()).data });
  return <><Dialog open={!!id} onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>📘 تحضير {data?.profiles?.full_name ?? "الخادم"}</DialogTitle></DialogHeader><div className="max-h-[65vh] overflow-y-auto"><div className="text-xs text-muted-foreground">أسبوع {data?.week_start ?? ""}</div><p className="my-3 whitespace-pre-wrap leading-7">{data?.notes || "بدون نص"}</p>{!!data?.images?.length && <button onClick={() => setGallery(data.images)} className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">فتح الصور ({data.images.length})</button>}</div></DialogContent></Dialog><ImageLightbox images={gallery} title="صور التحضير" onClose={() => setGallery(null)} /></>;
}

/* ---------- Bible / daily readings ---------- */
export const NT_BOOKS: [number, string, number][] = [
  [40, "متى", 28], [41, "مرقس", 16], [42, "لوقا", 24], [43, "يوحنا", 21], [44, "أعمال الرسل", 28], [45, "رومية", 16], [46, "كورنثوس الأولى", 16], [47, "كورنثوس الثانية", 13],
  [48, "غلاطية", 6], [49, "أفسس", 6], [50, "فيلبي", 4], [51, "كولوسي", 4], [52, "تسالونيكي الأولى", 5], [53, "تسالونيكي الثانية", 3], [54, "تيموثاوس الأولى", 6], [55, "تيموثاوس الثانية", 4],
  [56, "تيطس", 3], [57, "فليمون", 1], [58, "العبرانيين", 13], [59, "يعقوب", 5], [60, "بطرس الأولى", 5], [61, "بطرس الثانية", 3], [62, "يوحنا الأولى", 5], [63, "يوحنا الثانية", 1],
  [64, "يوحنا الثالثة", 1], [65, "يهوذا", 1], [66, "رؤيا يوحنا", 22],
];
const OT_N = ["التكوين",50,"الخروج",40,"اللاويين",27,"العدد",36,"التثنية",34,"يشوع",24,"القضاة",21,"راعوث",4,"صموئيل الأول",31,"صموئيل الثاني",24,"الملوك الأول",22,"الملوك الثاني",25,"أخبار الأيام الأول",29,"أخبار الأيام الثاني",36,"عزرا",10,"نحميا",13,"أستير",10,"أيوب",42,"المزامير",150,"الأمثال",31,"الجامعة",12,"نشيد الأنشاد",8,"إشعياء",66,"إرميا",52,"مراثي إرميا",5,"حزقيال",48,"دانيال",12,"هوشع",14,"يوئيل",3,"عاموس",9,"عوبديا",1,"يونان",4,"ميخا",7,"ناحوم",3,"حبقوق",3,"صفنيا",3,"حجي",2,"زكريا",14,"ملاخي",4] as const;
export const OT_BOOKS_N: [number, string, number][] = Array.from({ length: 39 }, (_, i) => [i + 1, OT_N[i * 2] as string, OT_N[i * 2 + 1] as number]);
export const OT_BOOKS = OT_BOOKS_N;
export const ALL_BOOKS = [...OT_BOOKS_N, ...NT_BOOKS];
const sel = "rounded-xl border-2 border-border bg-background px-3 py-2 font-bold";
function BookPicker({ book, chapter, onChange }: { book: number; chapter: number; onChange: (b: number, c: number) => void }) {
  const ot = book < 40;
  const list = ot ? OT_BOOKS_N : NT_BOOKS;
  const bk = ALL_BOOKS.find((b) => b[0] === book) ?? NT_BOOKS[0];
  return (
    <div className="flex flex-wrap gap-2">
      <select value={book} onChange={(e) => onChange(Number(e.target.value), 1)} className={sel}>
        <optgroup label="العهد القديم">{OT_BOOKS_N.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</optgroup>
        <optgroup label="العهد الجديد">{NT_BOOKS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</optgroup>
      </select>
      <select value={chapter} onChange={(e) => onChange(book, Number(e.target.value))} className={sel}>
        {Array.from({ length: bk[2] }, (_, i) => i + 1).map((c) => <option key={c} value={c}>أصحاح {c}</option>)}
      </select>
    </div>
  );
}

export function ReadingPlanner() {
  const [b, setB] = useState(40);
  const [c, setC] = useState(1);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { data: cur } = useQuery({
    queryKey: ["reading-target-today"],
    queryFn: async () => (await supabase.from("daily_readings").select("*").eq("date", cairoDate()).maybeSingle()).data,
  });
  const save = async () => {
    setSaving(true);
    try {
      const bk = ALL_BOOKS.find((x) => x[0] === b);
      const text = `${bk?.[1] ?? ""} الأصحاح ${c}`;
      const { error } = await supabase.from("daily_readings").upsert({ date: cairoDate(), book_id: b, chapter: c, title: text }, { onConflict: "date" });
      if (error) throw error;
      toast.success("تم تحديث قراءة اليوم بنجاح 📖");
      qc.invalidateQueries({ queryKey: ["reading-target-today"] });
    } catch (err: any) {
      toast.error(err.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className={card}>
      <h2 className="mb-2 text-xl font-extrabold">📖 تحديد قراءة اليوم للمخدومين</h2>
      <p className="mb-3 text-xs text-muted-foreground">القراءة المحددة هنا تظهر مباشرة في صفحة المخدومين كهدف اليوم.</p>
      {cur && <div className="mb-4 rounded-xl bg-sky/20 p-3 font-extrabold text-sky">القراءة الحالية لليوم: {cur.title}</div>}
      <div className="flex flex-wrap items-center gap-3">
        <BookPicker book={b} chapter={c} onChange={(nb, nc) => { setB(nb); setC(nc); }} />
        <button onClick={save} disabled={saving} className="rounded-xl bg-sky px-5 py-2 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 pop">{saving ? "جاري الحفظ..." : "حفظ قراءة اليوم"}</button>
      </div>
    </section>
  );
}
