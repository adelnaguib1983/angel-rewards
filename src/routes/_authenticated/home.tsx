import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ACADEMIC_YEARS, validateContact, AVATARS, MONTHS, REDEEM_STATUS, currentWeek, levelOf, useMe, useSettings } from "@/lib/app";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "لوحتي | أبطال الإيمان" },
      { name: "description", content: "إنجازاتك الأسبوعية ونقاطك وأوسمتك." },
      { property: "og:title", content: "لوحتي | أبطال الإيمان" },
      { property: "og:description", content: "إنجازاتك الأسبوعية ونقاطك وأوسمتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

const TABS = [
  ["track", "🗓️ إنجازاتي"], ["badges", "🏅 الأوسمة"], ["shop", "🎁 الهدايا"], ["board", "🏆 لوحة الشرف"],
] as const;

function Home() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("track");
  if (isLoading || !me) return <div className="p-10 text-center">...</div>;
  const p = me.profile;

  if (!p || p.status !== "approved") {
    return (
      <>
        <AppHeader name={p?.full_name} avatar={p?.avatar} />
        <div className="mx-auto mt-16 max-w-md rounded-3xl border-2 border-border bg-card p-8 text-center pop">
          <div className="text-6xl">{p?.status === "rejected" ? "🚫" : "⏳"}</div>
          <h1 className="mt-4 text-2xl font-extrabold">{p?.status === "rejected" ? "لم تتم الموافقة على الحساب" : "طلبك قيد المراجعة"}</h1>
          <p className="mt-2 text-muted-foreground">{p?.status === "rejected" ? "تواصل مع خادم الفصل." : "سيتم تفعيل حسابك بعد موافقة الخادم. ارجع قريبًا!"}</p>
        </div>
      </>
    );
  }

  return (
    <div className="pb-16">
      <AppHeader name={p.full_name} avatar={p.avatar} isAdmin={me.isAdmin} />
      <main className="mx-auto max-w-6xl px-4">
        <StatsHero name={p.full_name} avatar={p.avatar} />
        <nav className="my-6 flex gap-2 overflow-x-auto">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`whitespace-nowrap rounded-2xl border-2 px-4 py-2 font-bold transition ${tab === k ? "border-primary bg-primary text-primary-foreground pop" : "border-border bg-card hover:bg-muted"}`}>
              {l}
            </button>
          ))}
        </nav>
        {tab === "track" && <Tracker userId={me.user.id} />}
        {tab === "badges" && <Badges />}
        {tab === "shop" && <Shop />}
        {tab === "board" && <Board myId={me.user.id} />}
      </main>
    </div>
  );
}

function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_stats");
      if (error) throw error;
      return data as { points: number; balance: number };
    },
  });
}

function StatsHero({ name, avatar }: { name: string; avatar: string }) {
  const { data } = useStats();
  const qc = useQueryClient();
  const [pick, setPick] = useState(false);
  const [edit, setEdit] = useState(false);
  const pts = data?.points ?? 0;
  const lv = levelOf(pts);
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="pop flex items-center gap-4 rounded-3xl border-2 border-border bg-card p-5 md:col-span-2">
        <button onClick={() => setPick(true)} className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-secondary text-5xl" title="غيّر الشخصية">{avatar}</button>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">المستوى {lv.index}</div>
          <h2 className="text-2xl font-extrabold">{name} · {lv.emoji} {lv.name} <button onClick={() => setEdit(true)} className="align-middle text-sm font-bold text-primary">✏️ بياناتي</button></h2>
          <Progress value={lv.progress} className="mt-3 h-3" />
          <div className="mt-1 text-xs text-muted-foreground">{lv.next ? `باقي ${lv.next.min - pts} نقطة للوصول إلى ${lv.next.name}` : "وصلت لأعلى مستوى! 👑"}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="pop rounded-3xl bg-primary p-4 text-primary-foreground">
          <div className="text-sm font-bold">مجموع النقاط</div>
          <div className="font-display text-4xl font-extrabold">{pts}</div>
        </div>
        <div className="pop rounded-3xl bg-accent p-4 text-accent-foreground">
          <div className="text-sm font-bold">رصيد الهدايا</div>
          <div className="font-display text-4xl font-extrabold">{data?.balance ?? 0}</div>
        </div>
      </div>
      <ContactDialog open={edit} onOpenChange={setEdit} />
      <Dialog open={pick} onOpenChange={setPick}>
        <DialogContent>
          <DialogHeader><DialogTitle>اختر شخصيتك</DialogTitle></DialogHeader>
          <div className="grid grid-cols-5 gap-3">
            {AVATARS.map((a) => (
              <button key={a} className="rounded-2xl bg-muted p-3 text-4xl hover:bg-primary"
                onClick={async () => {
                  const { data: prof } = await supabase.from("profiles").select("full_name,class_name").single();
                  await supabase.rpc("update_my_profile", { _name: prof?.full_name ?? name, _avatar: a, _class: prof?.class_name ?? "" });
                  qc.invalidateQueries({ queryKey: ["me"] }); setPick(false);
                }}>{a}</button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Tracker({ userId }: { userId: string }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [verseFor, setVerseFor] = useState<{ week: number } | null>(null);
  const [verse, setVerse] = useState("");
  const { data: logs } = useQuery({
    queryKey: ["logs", ym.y, ym.m],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_logs").select("*").eq("year", ym.y).eq("month", ym.m);
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async (v: { activity: string; week: number; verse?: string }) => {
      const { error } = await supabase.from("activity_logs").insert({ user_id: userId, year: ym.y, month: ym.m, activity: v.activity, week: v.week, verse: v.verse ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      const s = settings?.find((x) => x.key === v.activity);
      toast.success(`رائع! +${s?.points ?? 0} نقطة ${s?.emoji ?? ""}`);
      qc.invalidateQueries({ queryKey: ["logs"] }); qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e) => toast.error((e as Error).message.includes("duplicate") ? "سجّلت هذا النشاط بالفعل" : (e as Error).message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from("activity_logs").delete({ count: "exact" }).eq("id", id);
      if (error) throw error;
      if (!count) throw new Error("لا يمكن إلغاء هذا التسجيل الآن");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["logs"] }); qc.invalidateQueries({ queryKey: ["stats"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const isNow = ym.y === now.getFullYear() && ym.m === now.getMonth() + 1;
  const cw = isNow ? currentWeek(now) : 0;
  const shift = (d: number) => {
    let m = ym.m + d, y = ym.y;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setYm({ y, m });
  };
  const colors = ["bg-primary text-primary-foreground", "bg-secondary text-secondary-foreground", "bg-accent text-accent-foreground", "bg-sky text-primary-foreground"];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="rounded-xl bg-card px-4 py-2 font-bold hover:bg-muted">→</button>
        <h2 className="text-2xl font-extrabold">{MONTHS[ym.m - 1]} {ym.y}</h2>
        <button onClick={() => shift(1)} className="rounded-xl bg-card px-4 py-2 font-bold hover:bg-muted">←</button>
      </div>
      <div className="overflow-x-auto rounded-3xl border-2 border-border bg-card p-3 pop">
        <table className="w-full min-w-[640px] border-separate border-spacing-2">
          <thead>
            <tr>
              <th className="text-right text-sm text-muted-foreground">النشاط</th>
              {[1, 2, 3, 4].map((w) => (
                <th key={w}><div className={`rounded-xl py-2 text-sm font-extrabold ${colors[w - 1]} ${cw === w ? "ring-4 ring-foreground/60" : ""}`}>الأسبوع {w}</div></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {settings?.map((s) => (
              <tr key={s.key}>
                <td className="whitespace-nowrap font-bold"><span className="text-2xl">{s.emoji}</span> {s.label}<div className="text-xs text-muted-foreground">+{s.points} نقطة</div></td>
                {[1, 2, 3, 4].map((w) => {
                  const log = logs?.find((l) => l.activity === s.key && l.week === w);
                  const done = log && log.status === "approved";
                  return (
                    <td key={w} className="text-center">
                      <button
                        title={log?.verse ?? log?.admin_note ?? ""}
                        onClick={() => {
                          if (log) { if (confirm("إلغاء هذا التسجيل؟")) remove.mutate(log.id); return; }
                          if (s.key === "bible") { setVerse(""); setVerseFor({ week: w }); return; }
                          add.mutate({ activity: s.key, week: w });
                        }}
                        className={`h-14 w-full rounded-2xl border-2 text-2xl transition-all hover:scale-105 ${done ? `${colors[w - 1]} border-transparent pop` : log ? "border-destructive bg-destructive/20" : "border-dashed border-border hover:bg-muted"}`}>
                        {done ? "✓" : log ? "✗" : "+"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Verses logs={logs ?? []} />
      <Dialog open={!!verseFor} onOpenChange={(o) => !o && setVerseFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>📜 أكثر آية لمست قلبك</DialogTitle></DialogHeader>
          <Textarea rows={4} value={verse} onChange={(e) => setVerse(e.target.value)} placeholder="اكتب الآية وشاهدها (مثال: يو 3: 16)" />
          <button className="pop rounded-2xl bg-primary py-3 font-extrabold text-primary-foreground"
            onClick={() => { if (!verse.trim()) return toast.error("اكتب الآية"); add.mutate({ activity: "bible", week: verseFor!.week, verse }); setVerseFor(null); }}>
            حفظ
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Verses({ logs }: { logs: { id: string; verse: string | null; week: number }[] }) {
  const vs = logs.filter((l) => l.verse);
  if (!vs.length) return null;
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      {vs.map((l) => (
        <blockquote key={l.id} className="rounded-2xl border-r-4 border-primary bg-card p-4">
          <div className="text-xs text-muted-foreground">آية الأسبوع {l.week}</div>
          <p className="mt-1 text-lg leading-relaxed">«{l.verse}»</p>
        </blockquote>
      ))}
    </div>
  );
}

function Badges() {
  const { data: stats } = useStats();
  const { data: badges } = useQuery({
    queryKey: ["badges"],
    queryFn: async () => (await supabase.from("badges").select("*").order("threshold")).data ?? [],
  });
  const pts = stats?.points ?? 0;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {badges?.map((b) => {
        const got = pts >= b.threshold;
        return (
          <div key={b.id} className={`rounded-3xl border-2 p-5 text-center transition ${got ? "border-primary bg-card pop" : "border-border bg-muted/40 opacity-60 grayscale"}`}>
            <div className={`text-6xl ${got ? "animate-bounce" : ""}`} style={{ animationIterationCount: 2 }}>{b.emoji}</div>
            <div className="mt-2 font-display text-lg font-extrabold">{b.name}</div>
            <div className="text-xs text-muted-foreground">{b.description}</div>
            <div className="mt-2 text-xs font-bold">{got ? "✓ حصلت عليه" : `${b.threshold} نقطة`}</div>
          </div>
        );
      })}
    </div>
  );
}

function Shop() {
  const qc = useQueryClient();
  const { data: stats } = useStats();
  const { data: gifts } = useQuery({
    queryKey: ["gifts"],
    queryFn: async () => (await supabase.from("gifts").select("*").eq("active", true).order("cost")).data ?? [],
  });
  const { data: mine } = useQuery({
    queryKey: ["myRedemptions"],
    queryFn: async () => (await supabase.from("redemptions").select("*, gifts(name, emoji)").order("created_at", { ascending: false })).data ?? [],
  });
  const redeem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc("redeem_gift", { _gift_id: id }); if (error) throw error; },
    onSuccess: () => { toast.success("تم إرسال طلبك للخادم 🎉"); qc.invalidateQueries(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const bal = stats?.balance ?? 0;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {gifts?.map((g) => {
          const can = bal >= g.cost && g.stock > 0;
          return (
            <div key={g.id} className="pop flex flex-col rounded-3xl border-2 border-border bg-card p-5 text-center">
              <div className="text-6xl">{g.emoji}</div>
              <div className="mt-2 font-display text-lg font-extrabold">{g.name}</div>
              <div className="flex-1 text-xs text-muted-foreground">{g.description}</div>
              <div className="mt-3 font-display text-2xl font-extrabold text-primary">{g.cost} ⭐</div>
              <div className="text-xs text-muted-foreground">متبقي {g.stock}</div>
              <button disabled={!can || redeem.isPending} onClick={() => confirm(`استبدال ${g.cost} نقطة بـ ${g.name}؟`) && redeem.mutate(g.id)}
                className="mt-3 rounded-2xl bg-secondary py-2 font-bold text-secondary-foreground disabled:bg-muted disabled:text-muted-foreground">
                {g.stock <= 0 ? "نفدت" : can ? "استبدل" : `ينقصك ${g.cost - bal}`}
              </button>
            </div>
          );
        })}
      </div>
      <div>
        <h3 className="mb-3 text-xl font-extrabold">طلباتي</h3>
        {!mine?.length && <p className="text-muted-foreground">لا توجد طلبات بعد.</p>}
        <div className="space-y-2">
          {mine?.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl bg-card p-3">
              <div><span className="text-2xl">{r.gifts?.emoji}</span> <b>{r.gifts?.name}</b> <span className="text-sm text-muted-foreground">· {r.cost} نقطة</span>
                {r.admin_note && <div className="text-xs text-muted-foreground">{r.admin_note}</div>}</div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${REDEEM_STATUS[r.status]?.cls}`}>{REDEEM_STATUS[r.status]?.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Board({ myId }: { myId: string }) {
  const [mode, setMode] = useState<"week" | "last" | "all">("week");
  const { data } = useQuery({
    queryKey: ["leaderboard", mode],
    queryFn: async () => {
      if (mode === "all") return ((await supabase.rpc("leaderboard")).data ?? []).map((r, i, a) => ({ ...r, rank: a.findIndex((x) => x.points === r.points) + 1 }));
      return (await supabase.rpc("weekly_leaderboard", { _offset: mode === "week" ? 0 : 1 })).data ?? [];
    },
  });
  const medals = ["🥇", "🥈", "🥉"];
  const top = data?.slice(0, 3) ?? [];
  return (
    <div>
      <div className="mb-4 flex justify-center gap-2">
        {([["week", "أوائل هذا الأسبوع"], ["last", "الأسبوع الماضي"], ["all", "الترتيب العام"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${mode === k ? "bg-secondary text-secondary-foreground" : "bg-card"}`}>{l}</button>
        ))}
      </div>
      {mode !== "all" && <p className="mb-4 text-center text-xs text-muted-foreground">الأسبوع من الأحد إلى السبت ويبدأ الترتيب من جديد كل أحد. المتساوون في النقاط يأخذون نفس المركز.</p>}
      {!data?.length && <p className="text-center text-muted-foreground">لا توجد إنجازات بعد — كن الأول! 🚀</p>}
      <div className="mb-6 flex items-end justify-center gap-3">
        {[1, 0, 2].map((i) => top[i] && (
          <div key={top[i].id} className="text-center">
            <div className="text-5xl">{top[i].avatar}</div>
            <div className="font-bold">{top[i].full_name}</div>
            <div className={`pop mt-2 grid w-24 place-items-center rounded-t-2xl ${i === 0 ? "h-32 bg-primary text-primary-foreground" : i === 1 ? "h-24 bg-sky text-primary-foreground" : "h-16 bg-secondary text-secondary-foreground"}`}>
              <div className="text-3xl">{medals[top[i].rank - 1] ?? top[i].rank}</div><div className="font-extrabold">{top[i].points}</div>
            </div>
          </div>
        ))}
      </div>
      <ol className="space-y-2">
        {data?.map((r, i) => (
          <li key={r.id} className={`flex items-center gap-3 rounded-2xl p-3 ${r.id === myId ? "bg-primary/20 ring-2 ring-primary" : "bg-card"}`}>
            <span className="w-8 text-center font-display text-xl font-extrabold">{medals[r.rank - 1] ?? r.rank}</span>
            <span className="text-2xl">{r.avatar}</span>
            <span className="flex-1 font-bold">{r.full_name}</span>
            <span className="font-display text-xl font-extrabold text-primary">{r.points}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ContactDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const p = me?.profile;
  const [f, setF] = useState({ full_name: "", academic_year: "", birth_date: "", phone: "", address: "" });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!open || !p || loaded) return;
    setLoaded(true);
    supabase.rpc("my_contact").then(({ data }) => {
      const c = data?.[0];
      setF({ full_name: p.full_name ?? "", academic_year: p.academic_year ?? "", birth_date: c?.birth_date ?? "", phone: c?.phone ?? "", address: c?.address ?? "" });
    });
  }, [open, p, loaded]);
  async function save() {
    const bad = validateContact(f) || (!f.full_name.trim() ? "الاسم مطلوب" : null);
    if (bad) return toast.error(bad);
    const { error } = await supabase.rpc("update_my_contact", { _name: f.full_name, _academic_year: f.academic_year, _birth_date: (f.birth_date || null) as string, _phone: f.phone, _address: f.address });
    if (error) return toast.error(error.message);
    toast.success("تم حفظ بياناتك"); qc.invalidateQueries({ queryKey: ["me"] }); onOpenChange(false); setLoaded(false);
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setLoaded(false); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>بيانات التواصل</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">🔒 لا يرى هذه البيانات إلا أنت والخدام المشرفون.</p>
        <div className="space-y-3">
          <div><Label>الاسم</Label><Input value={f.full_name} maxLength={80} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div><Label>العام الدراسي</Label>
            <select value={f.academic_year} onChange={(e) => setF({ ...f, academic_year: e.target.value })} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="" className="bg-card">اختر</option>
              {ACADEMIC_YEARS.map((y) => <option key={y} className="bg-card">{y}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>تاريخ الميلاد</Label><Input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></div>
            <div><Label>الموبايل</Label><Input dir="ltr" maxLength={11} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} /></div>
          </div>
          <div><Label>العنوان</Label><Input maxLength={200} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        </div>
        <button onClick={save} className="pop rounded-2xl bg-primary py-3 font-extrabold text-primary-foreground">حفظ</button>
      </DialogContent>
    </Dialog>
  );
}
