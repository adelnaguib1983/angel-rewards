// @ts-nocheck -- runtime guarded
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MONTHS, currentWeek, useSettings } from "@/lib/app";
import { getWeeklyCoach } from "@/lib/coach.functions";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

export const STREAK_BADGES = [
  { weeks: 2, emoji: "🔥", name: "شعلة البداية" },
  { weeks: 4, emoji: "🌟", name: "شهر أمانة" },
  { weeks: 8, emoji: "💎", name: "ثابت كالصخر" },
  { weeks: 12, emoji: "🦁", name: "أسد الإيمان" },
  { weeks: 24, emoji: "👑", name: "بطل الاستمرارية" },
];

const slot = (y: number, m: number, w: number) => y * 48 + (m - 1) * 4 + (w - 1);

export function useAllMyLogs() {
  return useQuery({
    queryKey: ["logs", "all"],
    queryFn: async () => (await supabase.from("activity_logs").select("year,month,week,activity,status")).data ?? [],
  });
}

export function useStreak() {
  const { data } = useAllMyLogs();
  return useMemo(() => {
    const set = new Set((data ?? []).filter((l) => l.status !== "rejected").map((l) => slot(l.year, l.month, l.week)));
    const now = new Date();
    let cur = slot(now.getFullYear(), now.getMonth() + 1, currentWeek(now));
    if (!set.has(cur)) cur--; // this week not logged yet — keep streak alive
    let current = 0;
    while (set.has(cur - current)) current++;
    const sorted = [...set].sort((a, b) => a - b);
    let best = 0, run = 0;
    sorted.forEach((s, i) => { run = i && sorted[i - 1] === s - 1 ? run + 1 : 1; best = Math.max(best, run); });
    const next = STREAK_BADGES.find((b) => b.weeks > best);
    return { current, best, next };
  }, [data]);
}

export function StreakCard() {
  const { current, best, next } = useStreak();
  return (
    <section className="pop mb-6 rounded-3xl border-2 border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">أسابيع متتالية</div>
          <div className="font-display text-4xl font-extrabold">🔥 {current} <span className="text-base text-muted-foreground">· أفضل سلسلة {best}</span></div>
        </div>
        <div className="flex gap-2">
          {STREAK_BADGES.map((b) => (
            <div key={b.weeks} title={`${b.name} · ${b.weeks} أسابيع`} className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ${best >= b.weeks ? "bg-primary pop" : "bg-muted opacity-50 grayscale"}`}>{b.emoji}</div>
          ))}
        </div>
      </div>
      {next ? (
        <>
          <Progress value={(current / next.weeks) * 100} className="mt-4 h-3" />
          <div className="mt-1 text-xs text-muted-foreground">باقي {Math.max(0, next.weeks - current)} أسبوع متتالي لوسام {next.emoji} {next.name}</div>
        </>
      ) : <div className="mt-3 text-sm font-bold">حصلت على كل أوسمة الاستمرارية! 👑</div>}
    </section>
  );
}

export function StreakBadges() {
  const { best } = useStreak();
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-xl font-extrabold">أوسمة الاستمرارية 🔥</h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {STREAK_BADGES.map((b) => {
          const got = best >= b.weeks;
          return (
            <div key={b.weeks} className={`rounded-3xl border-2 p-5 text-center ${got ? "border-primary bg-card pop" : "border-border bg-muted/40 opacity-60 grayscale"}`}>
              <div className="text-5xl">{b.emoji}</div>
              <div className="mt-2 font-display font-extrabold">{b.name}</div>
              <div className="mt-1 text-xs font-bold">{got ? "✓ حصلت عليه" : `${b.weeks} أسابيع متتالية`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const WEEK_CLS = ["bg-primary text-primary-foreground", "bg-secondary text-secondary-foreground", "bg-accent text-accent-foreground", "bg-sky text-primary-foreground"];
const DAYS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

export function CalendarView() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [selWeek, setSelWeek] = useState(ym.y === now.getFullYear() && ym.m === now.getMonth() + 1 ? currentWeek(now) : 1);
  const { data: settings } = useSettings();
  const { data: all } = useAllMyLogs();
  const logs = (all ?? []).filter((l) => l.year === ym.y && l.month === ym.m);
  const total = settings?.length ?? 0;
  const days = new Date(ym.y, ym.m, 0).getDate();
  const lead = new Date(ym.y, ym.m - 1, 1).getDay();
  const weekOf = (d: number) => Math.min(4, Math.ceil(d / 7));
  const doneIn = (w: number) => logs.filter((l) => l.week === w && l.status === "approved").length;
  const shift = (d: number) => { let m = ym.m + d, y = ym.y; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } setYm({ y, m }); setSelWeek(1); };
  const isToday = (d: number) => ym.y === now.getFullYear() && ym.m === now.getMonth() + 1 && d === now.getDate();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="rounded-xl bg-card px-4 py-2 font-bold hover:bg-muted">→</button>
        <h2 className="text-2xl font-extrabold">{MONTHS[ym.m - 1]} {ym.y}</h2>
        <button onClick={() => shift(1)} className="rounded-xl bg-card px-4 py-2 font-bold hover:bg-muted">←</button>
      </div>
      <div className="pop rounded-3xl border-2 border-border bg-card p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">{DAYS.map((d) => <div key={d}>{d}</div>)}</div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
            const w = weekOf(d); const done = doneIn(w); const full = total && done >= total;
            return (
              <button key={d} onClick={() => setSelWeek(w)}
                className={`relative aspect-square rounded-xl text-sm font-extrabold transition hover:scale-105 ${full ? WEEK_CLS[w - 1] : done ? "bg-muted ring-2 ring-inset ring-primary/60" : "bg-muted/50"} ${selWeek === w ? "outline outline-2 outline-foreground" : ""} ${isToday(d) ? "ring-4 ring-foreground" : ""}`}>
                {d}
                {done > 0 && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px]">{done}/{total}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>🟩 أسبوع مكتمل</span><span>⭕ أسبوع فيه إنجازات</span><span>⬜ لم يبدأ</span>
        </div>
      </div>
      <div className="pop rounded-3xl border-2 border-border bg-card p-4">
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {[1, 2, 3, 4].map((w) => (
            <button key={w} onClick={() => setSelWeek(w)} className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-bold ${selWeek === w ? WEEK_CLS[w - 1] : "bg-muted"}`}>الأسبوع {w} · {doneIn(w)}/{total}</button>
          ))}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {settings?.map((s) => {
            const log = logs.find((l) => l.activity === s.key && l.week === selWeek);
            const st = !log ? { t: "متبقي", c: "border-dashed border-border", i: "⏳" }
              : log.status === "approved" ? { t: "مكتمل", c: "border-transparent bg-accent text-accent-foreground", i: "✅" }
              : log.status === "rejected" ? { t: "مرفوض", c: "border-destructive bg-destructive/20", i: "❌" }
              : { t: "قيد المراجعة", c: "border-primary bg-primary/10", i: "🕒" };
            return (
              <li key={s.key} className={`flex items-center justify-between rounded-2xl border-2 p-3 ${st.c}`}>
                <span className="font-bold"><span className="text-xl">{s.emoji}</span> {s.label}</span>
                <span className="text-sm font-bold">{st.i} {st.t}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">لتسجيل نشاط، استخدم تبويب «إنجازاتي».</p>
      </div>
    </section>
  );
}

export function WeeklyCoach() {
  const { data: settings } = useSettings();
  const now = new Date();
  const { data: all } = useAllMyLogs();
  const thisWeek = (all ?? []).filter((l) => l.year === now.getFullYear() && l.month === now.getMonth() + 1 && l.week === currentWeek(now) && l.status !== "rejected");
  const [picked, setPicked] = useState<string[] | null>(null);
  const sel = picked ?? thisWeek.map((l) => l.activity);
  const [verse, setVerse] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ message: string; goal: string } | null>(null);
  const run = useServerFn(getWeeklyCoach);
  const toggle = (k: string) => setPicked(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]);

  async function go() {
    setBusy(true); setOut(null);
    try {
      const labels = (settings ?? []).filter((s) => sel.includes(s.key)).map((s) => s.label);
      setOut(await run({ data: { activities: labels, verse: verse.trim(), notes: notes.trim() } }));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="pop space-y-4 rounded-3xl border-2 border-border bg-card p-5">
        <h2 className="text-2xl font-extrabold">✨ مرشدي الأسبوعي</h2>
        <p className="text-sm text-muted-foreground">اختر ما أنجزته هذا الأسبوع واكتب الآية التي أثرت فيك، وسنكتب لك رسالة تشجيع وهدفًا للأسبوع القادم.</p>
        <div className="flex flex-wrap gap-2">
          {settings?.map((s) => (
            <button key={s.key} onClick={() => toggle(s.key)} className={`rounded-2xl border-2 px-3 py-2 text-sm font-bold ${sel.includes(s.key) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{s.emoji} {s.label}</button>
          ))}
        </div>
        <Textarea rows={3} maxLength={500} value={verse} onChange={(e) => setVerse(e.target.value)} placeholder="📜 الآية التي أثرت فيك (مثال: في 4: 13)" />
        <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="شيء تريد أن تحكيه عن أسبوعك (اختياري)" />
        <button disabled={busy} onClick={go} className="pop w-full rounded-2xl bg-primary py-3 font-extrabold text-primary-foreground disabled:opacity-60">{busy ? "جاري الكتابة... ✍️" : "اكتب لي رسالة تشجيع"}</button>
      </div>
      <div className="pop rounded-3xl border-2 border-border bg-card p-5">
        {!out && !busy && <div className="grid h-full place-items-center text-center text-muted-foreground"><div><div className="text-6xl">💌</div><p className="mt-2">رسالتك ستظهر هنا</p></div></div>}
        {busy && <div className="grid h-full place-items-center text-5xl animate-pulse">🕊️</div>}
        {out && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted p-4"><div className="mb-1 text-sm font-bold text-primary">💌 رسالة لك</div><p className="leading-relaxed">{out.message}</p></div>
            {out.goal && <div className="rounded-2xl bg-accent p-4 text-accent-foreground"><div className="mb-1 text-sm font-bold">🎯 هدف الأسبوع القادم</div><p className="font-bold leading-relaxed">{out.goal}</p></div>}
          </div>
        )}
      </div>
    </section>
  );
}
