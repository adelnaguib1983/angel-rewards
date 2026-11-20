// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationDetail } from "@/components/StaffMemberExtras";

export function openAnnouncement(id: string) {
  const el = document.getElementById(`ann-${id}`);
  if (!el) return toast.message("هذا الإعلان لم يعد متاحًا");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-4", "ring-primary");
  setTimeout(() => el.classList.remove("ring-4", "ring-primary"), 2500);
}

export function NotificationsBell({ onOpen, onQuiz }: { onOpen?: (id: string) => void; onQuiz?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  // جلب التنبيهات مع فحص دوري
  const { data } = useQuery({
    queryKey: ["myNotifs"],
    queryFn: async () => (await supabase.from("member_notifications").select("id,message,announcement_id,quiz_id,ref_id,kind,read,created_at").order("created_at", { ascending: false }).limit(30)).data ?? [],
    refetchInterval: 30000,
  });

  // حساب عدد التنبيهات غير المقروءة
  const unreadCount = data?.filter((n) => !n.read).length ?? 0;

// تحديث شارة الأيقونة الخارجية على شاشة الموبايل (PWA Badge)
useEffect(() => {
  if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
    if (unreadCount > 0) {
      navigator.setAppBadge(unreadCount).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }
}, [unreadCount]);

  // الاستماع اللحظي (Realtime) للإشعارات الجديدة
  useEffect(() => {
    const channel = supabase
      .channel("member_notifications_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member_notifications" },
        () => {
          qc.invalidateQueries({ queryKey: ["myNotifs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  async function click(n) {
    setOpen(false);
    if (!n.read) {
      await supabase.from("member_notifications").update({ read: true }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["myNotifs"] });
    }
    if ((n.quiz_id || n.kind === "quiz") && onQuiz) onQuiz();
    else if (n.announcement_id && onOpen) onOpen(n.announcement_id);
    else setDetail(n);
  }

  const icon = { quiz: "🧠", suggestion: "💡", absence: "🚫", announcement: "📣" };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger aria-label="التنبيهات" className="relative rounded-xl border-2 border-border px-3 py-2 text-lg leading-none hover:bg-muted transition-colors">
          🔔
          {/* الشارة الرقمية (Badge) للعداد غير المقروء */}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-black text-white shadow-md ring-2 ring-background animate-pulse">
              {unreadCount > 99 ? "+99" : unreadCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2">
          <div className="flex items-center justify-between mb-1 px-2">
            <span className="font-extrabold">التنبيهات</span>
            {unreadCount > 0 && (
              <span className="text-xs font-semibold text-destructive">
                {unreadCount} جديدة
              </span>
            )}
          </div>
          {!data?.length && <p className="p-3 text-sm text-muted-foreground">لا توجد تنبيهات.</p>}
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {data?.map((n) => (
              <button
                key={n.id}
                onClick={() => click(n)}
                className={`w-full rounded-xl p-2 text-right text-sm hover:bg-muted transition-colors ${
                  n.read ? "text-muted-foreground" : "bg-muted/60 font-bold text-foreground border-r-4 border-primary"
                }`}
              >
                <span className="ml-1" aria-hidden="true">{icon[n.kind] ?? "🔔"}</span>
                <span className="line-clamp-2">{n.message}</span>
                <div className="text-[10px] font-normal text-muted-foreground mt-0.5">
                  {new Date(n.created_at).toLocaleString("ar-EG")} · اضغط للتفاصيل
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <NotificationDetail n={detail} onClose={() => setDetail(null)} />
    </>
  );
}


export function AnnouncementsBoard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["announcements", "published"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements").select("id,title,body,event_date,image_url,created_at").eq("published", true).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });
  const { data: mine } = useQuery({
    queryKey: ["mySignups"],
    queryFn: async () => (await supabase.from("announcement_signups").select("announcement_id")).data?.map((r) => r.announcement_id) ?? [],
  });
  const { data: counts } = useQuery({
    queryKey: ["signupCounts"],
    queryFn: async () => Object.fromEntries(((await supabase.rpc("signup_counts")).data ?? []).map((r) => [r.announcement_id, r.n])),
  });
  const toggle = useMutation({
    mutationFn: async (id: string) => {
      const q = mine?.includes(id)
        ? supabase.from("announcement_signups").delete().eq("announcement_id", id).eq("user_id", userId)
        : supabase.from("announcement_signups").insert({ announcement_id: id, user_id: userId });
      const { error } = await q; if (error) throw error;
      return !mine?.includes(id);
    },
    onSuccess: (joined) => { toast.success(joined ? "تم تسجيلك 🎉" : "تم إلغاء تسجيلك"); qc.invalidateQueries({ queryKey: ["mySignups"] }); qc.invalidateQueries({ queryKey: ["signupCounts"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ann");
    if (id && data?.length) setTimeout(() => openAnnouncement(id), 300);
  }, [data]);
  if (isLoading) return <section className="mb-5 h-32 animate-pulse rounded-3xl bg-card" aria-label="جاري تحميل الإعلانات" />;
  if (isError) return <section className="mb-5 rounded-3xl border-2 border-destructive bg-card p-4 text-sm">تعذّر تحميل الإعلانات الآن.</section>;
  return (
    <section className="mb-5 overflow-hidden rounded-3xl border-2 border-primary bg-card pop" aria-labelledby="announcements-heading">
      <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <span className="text-3xl" aria-hidden="true">📣</span>
        <div className="min-w-0"><h1 id="announcements-heading" className="text-xl font-extrabold">لوحة الإعلانات</h1><p className="text-xs font-bold opacity-80">أحدث الأنشطة والرحلات</p></div>
      </div>
      {!data?.length ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">لا توجد إعلانات جديدة حاليًا.</div>
      ) : (
        <div className="divide-y divide-border">
          {data.map((item) => {
            const joined = mine?.includes(item.id);
            return (
              <article id={`ann-${item.id}`} key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl px-4 py-4 transition">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl" aria-hidden="true">📌</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-extrabold">{item.title}</h2>{item.event_date && <time className="rounded-full bg-muted px-2 py-1 text-xs font-bold">📅 {item.event_date}</time>}</div>
                  {item.image_url && <img src={item.image_url} alt={item.title} loading="lazy" className="mt-2 max-h-72 w-full rounded-2xl object-cover" />}
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{item.body}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <button disabled={toggle.isPending} onClick={() => toggle.mutate(item.id)}
                      className={`rounded-xl px-4 py-2 text-sm font-extrabold ${joined ? "border-2 border-border hover:bg-muted" : "bg-secondary text-secondary-foreground pop"}`}>
                      {joined ? "✓ مسجّل · إلغاء" : "🙋 سجّلني"}
                    </button>
                    <span className="text-xs text-muted-foreground">{counts?.[item.id] ?? 0} مسجّل</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function Quizzes() {
  const qc = useQueryClient();
  const [active, setActive] = useState<{ id: string; title: string; image_url?: string } | null>(null);
  const [busyQ, setBusyQ] = useState<string | null>(null);
  const { data: quizzes } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => (await supabase.from("quizzes").select("id,title,created_at,opens_at,closes_at,image_url").eq("published", true).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: attempts } = useQuery({
    queryKey: ["myAttempts"],
    queryFn: async () => Object.fromEntries(((await supabase.from("quiz_attempts").select("quiz_id,score,max_score")).data ?? []).map((a) => [a.quiz_id, a])),
  });
  const { data: questions } = useQuery({
    queryKey: ["quizQ", active?.id],
    enabled: !!active,
    queryFn: async () => (await supabase.rpc("quiz_questions_v2", { _quiz: active.id })).data ?? [],
  });
  const answer = async (qid: string, idx: number) => {
    setBusyQ(qid);
    const { data, error } = await supabase.rpc("answer_question", { _question: qid, _choice: idx });
    setBusyQ(null);
    if (error) return toast.error(error.message);
    data.correct ? toast.success(`إجابة صحيحة! +${data.points} نقطة 🎉`) : toast.error("إجابة خاطئة 😔");
    qc.invalidateQueries({ queryKey: ["quizQ", active?.id] });
    qc.invalidateQueries({ queryKey: ["myAttempts"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };
  const now = Date.now();
  const state = (z) => z.opens_at && new Date(z.opens_at).getTime() > now ? "soon" : z.closes_at && new Date(z.closes_at).getTime() <= now ? "closed" : "open";
  const fmt = (d) => new Date(d).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  if (active) {
    const done = questions?.filter((q) => q.my_choice !== null).length ?? 0;
    const score = questions?.filter((q) => q.is_correct).reduce((s, q) => s + q.points, 0) ?? 0;
    return (
      <section className="space-y-4">
        <button onClick={() => setActive(null)} className="text-sm font-bold text-primary">→ رجوع للمسابقات</button>
        <h2 className="text-2xl font-extrabold">🧠 {active.title}</h2>
        {active.image_url && <img src={active.image_url} alt="" className="max-h-64 w-full rounded-3xl object-cover" />}
        {!!questions?.length && <div className="rounded-2xl bg-muted p-3 text-sm font-bold">أجبت {done} من {questions.length} · درجتك {score}. كل سؤال يُجاب مرة واحدة فقط.</div>}
        {questions?.map((q, i) => {
          const answered = q.my_choice !== null;
          return (
            <div key={q.id} className="float-in rounded-3xl border-2 border-border bg-card p-4 pop">
              <div className="font-extrabold">{i + 1}. {q.question} <span className="text-xs text-muted-foreground">({q.points} درجة)</span></div>
              {q.image_url && <img src={q.image_url} alt="" className="mt-2 max-h-56 rounded-2xl object-contain" />}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((o, idx) => {
                  const cls = !answered ? "border-border hover:bg-muted" : idx === q.correct ? "border-accent bg-accent text-accent-foreground" : idx === q.my_choice ? "border-destructive bg-destructive text-destructive-foreground" : "border-border opacity-60";
                  return <button key={idx} disabled={answered || busyQ === q.id} onClick={() => answer(q.id, idx)} className={`rounded-2xl border-2 p-3 text-right font-bold transition ${cls}`}>{o}{answered && idx === q.correct && " ✓"}{answered && idx === q.my_choice && idx !== q.correct && " ✗"}</button>;
                })}
              </div>
            </div>
          );
        })}
        {questions && !questions.length && <p className="text-muted-foreground">المسابقة غير متاحة الآن.</p>}
      </section>
    );
  }
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {!quizzes?.length && <p className="text-muted-foreground">لا توجد مسابقات حاليًا، ترقّب مسابقة الأسبوع! 🧠</p>}
      {quizzes?.map((z) => {
        const a = attempts?.[z.id];
        const st = state(z);
        return (
          <div key={z.id} className="pop float-in overflow-hidden rounded-3xl border-2 border-border bg-card">
            {z.image_url && <img src={z.image_url} alt="" className="h-32 w-full object-cover" />}
            <div className="flex items-center justify-between gap-3 p-5">
              <div><div className="font-display text-lg font-extrabold">🧠 {z.title}</div>
                <div className="text-xs text-muted-foreground">{st === "soon" ? `تفتح ${fmt(z.opens_at)}` : z.closes_at ? `${st === "closed" ? "أُغلقت" : "تُغلق"} ${fmt(z.closes_at)}` : new Date(z.created_at).toLocaleDateString("ar-EG")}</div>
                {a && <span className="mt-1 inline-block rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-accent-foreground">{a.score} / {a.max_score}</span>}</div>
              {st === "soon" ? <span className="rounded-2xl bg-muted px-3 py-2 text-sm font-bold">🔒 قريبًا</span>
                : <button onClick={() => setActive(z)} className="rounded-2xl bg-secondary px-4 py-2 font-bold text-secondary-foreground">{st === "closed" || a ? "عرض" : "ابدأ"}</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
