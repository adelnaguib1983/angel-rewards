// @ts-nocheck
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const card = "rounded-3xl border-2 border-border bg-card p-5";

export function MonthlyProgram({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [monthValue, setMonthValue] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [newTitles, setNewTitles] = useState<Record<number, string>>({});
  const [year, month] = monthValue.split("-").map(Number);

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["service-month", year, month],
    queryFn: async () => {
      const { error: ensureError } = await supabase.rpc("ensure_service_month", {
        _year: year,
        _month: month,
      });
      if (ensureError) throw ensureError;

      const { data, error } = await supabase.rpc("service_month_data", {
        _year: year,
        _month: month,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: servants = [] } = useQuery({
    queryKey: ["service-month-servants"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_servants");
      if (error) throw error;
      return (data ?? []).filter((person) => person.status === "approved");
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["service-month", year, month] });

  const claim = useMutation({
    mutationFn: async ({ itemId, servantId }: { itemId: string; servantId: string }) => {
      const { error } = await supabase.rpc("claim_service_month_item", {
        _item_id: itemId,
        _servant_id: servantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل اختيار الفقرة ✅");
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "تعذر حفظ الاختيار"),
  });

  const addItem = useMutation({
    mutationFn: async ({ week, title }: { week: number; title: string }) => {
      const { error } = await supabase.rpc("add_service_month_item", {
        _year: year,
        _month: month,
        _week: week,
        _title: title,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success("تمت إضافة الفقرة ✅");
      setNewTitles((current) => ({ ...current, [variables.week]: "" }));
      refresh();
    },
    onError: (error: any) => toast.error(error.message || "تعذرت إضافة الفقرة"),
  });

  const weeks = [1, 2, 3, 4].map((weekNo) => ({
    weekNo,
    items: items.filter((item) => item.week_no === weekNo),
  }));

  if (isLoading) return <div className={card}>جاري تحميل برنامج الشهر…</div>;
  if (error) return <div className={card}>تعذر تحميل البرنامج: {error.message}</div>;

  return (
    <section className="space-y-4" dir="rtl">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">🗓️ برنامج الشهر</h2>
            <p className="mt-1 text-sm text-muted-foreground">خطة أسابيع خدمة الجمعة واختيار المسؤول عن كل فقرة.</p>
          </div>
          <label className="text-sm font-bold">
            الشهر
            <input
              type="month"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
              className="mr-2 rounded-xl border-2 border-border bg-background px-3 py-2"
            />
          </label>
        </div>
      </div>

      {weeks.map(({ weekNo, items: weekItems }) => {
        const serviceDate = weekItems[0]?.service_date;
        const dateLabel = serviceDate
          ? new Date(`${serviceDate}T12:00:00`).toLocaleDateString("ar-EG", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
          : "تاريخ الجمعة";

        return (
          <article key={weekNo} className={`${card} space-y-4`}>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <h3 className="text-lg font-black">الأسبوع {weekNo}</h3>
              <span className="rounded-full bg-sky/20 px-3 py-1 text-sm font-bold">📅 {dateLabel}</span>
            </header>

                      <div className="grid grid-cols-2 gap-2.5">
              {weekItems.map((item) => (
                <div key={item.item_id} className="flex flex-col justify-between gap-2.5 rounded-2xl bg-muted/50 p-3">
                  <div>
                    <div className="font-extrabold text-sm sm:text-base">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.assigned_servant_id
                        ? `المسؤول: ${item.servant_name || "خادم"}`
                        : "لم يتم اختيار مسؤول بعد"}
                    </div>
                  </div>

                  {!item.assigned_servant_id && !isAdmin && (
                    <button
                      type="button"
                      disabled={claim.isPending}
                      onClick={() => claim.mutate({ itemId: item.item_id, servantId: userId })}
                      className="w-full rounded-xl bg-primary px-3 py-1.5 text-xs sm:text-sm font-bold text-primary-foreground disabled:opacity-50"
                    >
                      أختار تقديمها 🙋
                    </button>
                  )}

                  {!item.assigned_servant_id && isAdmin && (
                    <select
                      defaultValue=""
                      disabled={claim.isPending}
                      onChange={(event) => {
                        if (event.target.value) {
                          claim.mutate({ itemId: item.item_id, servantId: event.target.value });
                        }
                      }}
                      className="w-full rounded-xl border-2 border-border bg-background px-2 py-1.5 text-xs sm:text-sm font-bold"
                    >
                      <option value="">تعيين خادم…</option>
                      {servants.map((servant) => (
                        <option key={servant.id} value={servant.id}>{servant.full_name}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
              {!weekItems.length && <p className="col-span-2 text-sm text-muted-foreground">لا توجد فقرات لهذا الأسبوع بعد.</p>}
            </div>


            {isAdmin && (
              <form
                className="flex flex-wrap gap-2 border-t border-border pt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const title = (newTitles[weekNo] ?? "").trim();
                  if (!title) return toast.error("اكتب اسم الفقرة أولاً");
                  addItem.mutate({ week: weekNo, title });
                }}
              >
                <input
                  value={newTitles[weekNo] ?? ""}
                  onChange={(event) => setNewTitles((current) => ({ ...current, [weekNo]: event.target.value }))}
                  maxLength={100}
                  placeholder="فقرة إضافية لهذا الأسبوع"
                  className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2"
                />
                <button
                  type="submit"
                  disabled={addItem.isPending}
                  className="rounded-xl bg-secondary px-4 py-2 font-bold text-secondary-foreground disabled:opacity-50"
                >
                  + إضافة فقرة
                </button>
              </form>
            )}
          </article>
        );
      })}
    </section>
  );
}
