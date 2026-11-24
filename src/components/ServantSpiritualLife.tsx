import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DailySpiritualTracker } from "@/components/DailySpiritualTracker";
import { toast } from "sonner";
import { Church, Users, HeartHandshake, CheckCircle2, ChevronRight, ChevronLeft, Calendar } from "lucide-react";
import { MONTHS } from "@/lib/app";

interface Props {
  userId: string;
}

export function ServantSpiritualLife({ userId }: Props) {
  const qc = useQueryClient();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [fatherName, setFatherName] = useState("");
  const [confessionDate, setConfessionDate] = useState(now.toISOString().slice(0, 10));

  const shift = (d: number) => {
    let m = ym.m + d, y = ym.y;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setYm({ y, m });
  };

  // جلب تسجيلات الشهر الحالي للخادم
  const { data: logs = [] } = useQuery({
    queryKey: ["servant_spiritual_logs", userId, ym.y, ym.m],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spiritual_daily_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("year", ym.y)
        .eq("month", ym.m);
      if (error) throw error;
      return data ?? [];
    },
  });

  const isWeeklyChecked = (type: string, week: number) => {
    return logs.some((l) => l.activity_type === type && l.day === week);
  };

  const toggleWeekly = useMutation({
    mutationFn: async ({ type, week }: { type: string; week: number }) => {
      const existing = logs.find((l) => l.activity_type === type && l.day === week);
      if (existing) {
        const { error } = await supabase.from("spiritual_daily_logs").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("spiritual_daily_logs").insert({
          user_id: userId,
          year: ym.y,
          month: ym.m,
          day: week,
          activity_type: type,
          points: 10,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servant_spiritual_logs", userId, ym.y, ym.m] });
      toast.success("تم تحديث التسجيل بنجاح");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // تسجيل جلسة اعتراف
  const addConfession = useMutation({
    mutationFn: async () => {
      if (!fatherName.trim()) throw new Error("يرجى كتابة اسم أب الاعتراف");
      const d = new Date(confessionDate);
      const { error } = await supabase.from("spiritual_daily_logs").insert({
        user_id: userId,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        activity_type: "confession",
        notes: fatherName.trim(),
        points: 20,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servant_spiritual_logs"] });
      setFatherName("");
      toast.success("تم تسجيل سر الاعتراف بنجاح، بركة صلوات أب اعترافك 🙏");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const confessions = logs.filter((l) => l.activity_type === "confession");
  const weeks = [1, 2, 3, 4, 5];

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* شريط اختيار الشهر */}
      <div className="flex items-center justify-between rounded-3xl border-2 border-border bg-card p-4 shadow-sm">
        <button onClick={() => shift(-1)} className="rounded-xl bg-muted p-2 hover:bg-muted/80">
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-xs text-muted-foreground font-bold">متابعة شهر</div>
          <h2 className="text-xl font-black">{MONTHS[ym.m - 1]} {ym.y}</h2>
        </div>
        <button onClick={() => shift(1)} className="rounded-xl bg-muted p-2 hover:bg-muted/80">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {/* الجزء الأول: شبكة الصلاة وقراءة الكتاب المقدس اليومية */}
      <DailySpiritualTracker userId={userId} year={ym.y} month={ym.m} />

      {/* الجزء الثاني: الالتزامات الأسبوعية (القداس والخدمة) */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* حضور القداس الإلهي */}
        <div className="rounded-3xl border-2 border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
              <Church className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">حضور القداس الإلهي</h3>
              <p className="text-xs text-muted-foreground">التسجيل الأسبوعي للقداس</p>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {weeks.map((w) => {
              const ok = isWeeklyChecked("liturgy", w);
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleWeekly.mutate({ type: "liturgy", week: w })}
                  className={`flex flex-col items-center justify-center rounded-2xl py-3 border-2 transition ${
                    ok
                      ? "border-amber-500 bg-amber-500 text-white font-bold"
                      : "border-border bg-muted/30 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className={`h-5 w-5 mb-1 ${ok ? "text-white" : "opacity-30"}`} />
                  <span className="text-xs">أسبوع {w}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* حضور الخدمة الأسبوعية */}
        <div className="rounded-3xl border-2 border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky/10 text-sky">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">حضور الخدمة ومدارس الأحد</h3>
              <p className="text-xs text-muted-foreground">التسجيل الأسبوعي لاجتماع الخدمة</p>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {weeks.map((w) => {
              const ok = isWeeklyChecked("service", w);
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleWeekly.mutate({ type: "service", week: w })}
                  className={`flex flex-col items-center justify-center rounded-2xl py-3 border-2 transition ${
                    ok
                      ? "border-sky bg-sky text-primary-foreground font-bold"
                      : "border-border bg-muted/30 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className={`h-5 w-5 mb-1 ${ok ? "text-primary-foreground" : "opacity-30"}`} />
                  <span className="text-xs">أسبوع {w}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* الجزء الثالث: سر الاعتراف */}
      <div className="rounded-3xl border-2 border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/10 text-rose-600">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg">سر الاعتراف والإرشاد الروحي</h3>
            <p className="text-xs text-muted-foreground">تسجيل ومتابعة جلسات الاعتراف الدورية</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold block mb-1">اسم أب الاعتراف</label>
            <input
              type="text"
              value={fatherName}
              onChange={(e) => setFatherName(e.target.value)}
              placeholder="أبونا القمص / القس..."
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold"
            />
          </div>
          <div className="w-44">
            <label className="text-xs font-bold block mb-1">تاريخ الجلسة</label>
            <input
              type="date"
              value={confessionDate}
              onChange={(e) => setConfessionDate(e.target.value)}
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold"
            />
          </div>
          <div className="self-end">
            <button
              type="button"
              onClick={() => addConfession.mutate()}
              disabled={addConfession.isPending}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground hover:opacity-90"
            >
              + تسجيل الاعتراف
            </button>
          </div>
        </div>

        {confessions.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <h4 className="text-xs font-extrabold text-muted-foreground mb-2">جلسات الاعتراف المسجلة هذا الشهر:</h4>
            <div className="space-y-2">
              {confessions.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-xs">
                  <span className="font-bold">🙏 أب الاعتراف: {c.notes || "غير محدد"}</span>
                  <span className="text-muted-foreground font-medium">يوم {c.day} من الشهر</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
