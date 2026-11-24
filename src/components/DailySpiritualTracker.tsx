import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, BookOpen, Sun, Moon } from "lucide-react";

interface Props {
  userId: string;
  year: number;
  month: number;
}

export function DailySpiritualTracker({ userId, year, month }: Props) {
  const qc = useQueryClient();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // جلب تسجيلات الشهر الحالي للمستخدم
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["spiritual_daily_logs", userId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spiritual_daily_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("year", year)
        .eq("month", month);
      if (error) throw error;
      return data ?? [];
    },
  });

  // التحقق من حالة نشاط معين في يوم معين
  const isLogged = (day: number, type: string) => {
    return logs.some((l) => l.day === day && l.activity_type === type);
  };

  // تبديل حالة النشاط (تسجيل أو إلغاء)
  const toggleActivity = useMutation({
    mutationFn: async ({ day, type, points }: { day: number; type: string; points: number }) => {
      const existing = logs.find((l) => l.day === day && l.activity_type === type);
      if (existing) {
        const { error } = await supabase.from("spiritual_daily_logs").delete().eq("id", existing.id);
        if (error) throw error;
        return { action: "removed", type };
      } else {
        const { error } = await supabase.from("spiritual_daily_logs").insert({
          user_id: userId,
          year,
          month,
          day,
          activity_type: type,
          points,
        });
        if (error) throw error;
        return { action: "added", type };
      }
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["spiritual_daily_logs", userId, year, month] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      if (res.action === "added") {
        toast.success(res.type.includes("prayer") ? "تم تسجيل الصلاة بنجاح 🙏" : "تم تسجيل قراءة الإنجيل 📖");
      } else {
        toast.info("تم إلغاء التسجيل");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء التسجيل");
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground font-bold">جاري تحميل الأنشطة...</div>;
  }

  return (
    <div className="space-y-8 my-6" dir="rtl">
      {/* 1. نشاط الصلاة */}
      <div className="rounded-3xl border-2 border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🙏</span>
            <h3 className="text-2xl font-black">نشاط الصلاة</h3>
          </div>
          <span className="rounded-full bg-pink-100 dark:bg-pink-950/40 px-4 py-1.5 text-xs font-bold text-pink-700 dark:text-pink-300">
            ٦٠ اختيار شهرياً · ١ نقطة لكل صلاة
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          اختر صلاة باكر (☀️) وغروب (🌙) لكل يوم من الشهر:
        </p>

        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 justify-items-center">
          {days.map((day) => {
            const hasMorning = isLogged(day, "prayer_morning");
            const hasSunset = isLogged(day, "prayer_sunset");

            return (
              <div
                key={day}
                className="flex flex-col items-center justify-between w-14 h-16 rounded-full border-2 border-amber-200/70 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40 p-1.5 shadow-sm"
              >
                <span className="text-[11px] font-bold text-muted-foreground">يوم {day}</span>
                <div className="flex items-center gap-1.5 mb-1">
                  {/* صلاة الغروب */}
                  <button
                    type="button"
                    title="صلاة الغروب"
                    onClick={() => toggleActivity.mutate({ day, type: "prayer_sunset", points: 1 })}
                    className={`grid h-6 w-6 place-items-center rounded-full transition active:scale-90 ${
                      hasSunset
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-amber-500/80 hover:bg-amber-200/50"
                    }`}
                  >
                    {hasSunset ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Moon className="h-3.5 w-3.5" />}
                  </button>

                  {/* صلاة باكر */}
                  <button
                    type="button"
                    title="صلاة باكر"
                    onClick={() => toggleActivity.mutate({ day, type: "prayer_morning", points: 1 })}
                    className={`grid h-6 w-6 place-items-center rounded-full transition active:scale-90 ${
                      hasMorning
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-amber-500/80 hover:bg-amber-200/50"
                    }`}
                  >
                    {hasMorning ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Sun className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. قراءة الكتاب المقدس */}
      <div className="rounded-3xl border-2 border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-3xl">📖</span>
            <h3 className="text-2xl font-black">قراءة الكتاب المقدس</h3>
          </div>
          <span className="rounded-full bg-pink-100 dark:bg-pink-950/40 px-4 py-1.5 text-xs font-bold text-pink-700 dark:text-pink-300">
            ٣٠ اختيار شهرياً · +٢ نقطة لكل يوم
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          متابعة القراءة اليومية لكل يوم من الشهر:
        </p>

        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 justify-items-center">
          {days.map((day) => {
            const hasRead = isLogged(day, "bible");

            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleActivity.mutate({ day, type: "bible", points: 2 })}
                className={`flex flex-col items-center justify-center w-14 h-16 rounded-full border-2 border-dashed transition active:scale-90 ${
                  hasRead
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 shadow-sm"
                    : "border-amber-300 dark:border-amber-800 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {hasRead ? (
                  <Check className="h-5 w-5 stroke-[3] text-emerald-600" />
                ) : (
                  <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400 opacity-75" />
                )}
                <span className="text-[10px] font-bold mt-1">يوم {day}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
