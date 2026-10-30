import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// 1. هوك حساب الغائبين مرتين متتاليتين لكل مرحلة
export function useConsecutiveAbsence(people: any[], fridaysList: { date: string }[], currentDate: string) {
  return useMemo(() => {
    // تحديد الجمعة السابقة مباشرة للجمعة المختارة
    const curIdx = fridaysList.findIndex((f) => f.date === currentDate);
    const prevFriday = curIdx !== -1 && curIdx + 1 < fridaysList.length ? fridaysList[curIdx + 1].date : null;

    // فلترة الأشخاص حسب المراحل الثلاث
    const grades = {
      first: { label: "أولى إعدادي", list: [] as any[] },
      second: { label: "ثانية إعدادي", list: [] as any[] },
      third: { label: "ثالثة إعدادي", list: [] as any[] },
    };

    if (!prevFriday) return grades;

    people.forEach((p) => {
      // شرط الغياب المتتالي: غائب في الجمعة الحالية ولديه سجل غياب سابق
      if (p.attendance_status === "absent" && (p.absent_count >= 2)) {
        if (p.academic_year === "أولى إعدادي") grades.first.list.push(p);
        else if (p.academic_year === "ثانية إعدادي") grades.second.list.push(p);
        else if (p.academic_year === "ثالثة إعدادي") grades.third.list.push(p);
      }
    });

    return grades;
  }, [people, fridaysList, currentDate]);
}

// 2. مكون أزرار التنبيهات التفاعلية الثلاثة
export function ConsecutiveAbsenceAlertButtons({ 
  people, 
  fridaysList, 
  currentDate 
}: { 
  people: any[]; 
  fridaysList: { date: string }[]; 
  currentDate: string; 
}) {
  const alerts = useConsecutiveAbsence(people, fridaysList, currentDate);
  const [selectedGrade, setSelectedGrade] = useState<{ label: string; list: any[] } | null>(null);

  const buttons = [
    { key: "first", label: "تنبيه غياب أولى إعدادي", data: alerts.first },
    { key: "second", label: "تنبيه غياب ثانية إعدادي", data: alerts.second },
    { key: "third", label: "تنبيه غياب ثالثة إعدادي", data: alerts.third },
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-3">
        {buttons.map((btn) => {
          const count = btn.data.list.length;
          return (
            <button
              key={btn.key}
              onClick={() => setSelectedGrade(btn.data)}
              className={`relative flex items-center justify-between rounded-2xl border-2 p-3 font-extrabold transition shadow-sm ${
                count > 0 
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20" 
                  : "border-border bg-card text-muted-foreground opacity-80"
              }`}
            >
              <span className="text-xs sm:text-sm">{btn.label}</span>
              <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-black ${
                count > 0 ? "bg-amber-500 text-white animate-pulse" : "bg-muted text-muted-foreground"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* نافذة عرض الأسماء عند الضغط */}
      <Dialog open={!!selectedGrade} onOpenChange={(o) => !o && setSelectedGrade(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>⚠️ الغائبون أسبوعين متتاليين ({selectedGrade?.label})</DialogTitle>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {!selectedGrade?.list.length ? (
              <p className="p-4 text-center text-sm text-muted-foreground">لا يوجد غياب متتالي مسجل لهذه المرحلة ✅</p>
            ) : (
              selectedGrade.list.map((item) => (
                <div key={item.person_id} className="flex items-center justify-between rounded-xl bg-muted p-2.5 text-sm">
                  <div className="font-extrabold">{item.full_name}</div>
                  <span className="text-xs font-bold text-destructive">إجمالي الغياب: {item.absent_count}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
