import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, UserX, AlertTriangle } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  grade?: string | null;
}

interface AbsenceRecord {
  member_id: string;
  friday_date: string;
}

interface AbsenceAlertButtonsProps {
  members: Profile[];
  absenceRecords?: AbsenceRecord[];
  getStageName?: (grade?: string | null) => string;
}

export function AbsenceAlertButtons({
  members,
  absenceRecords = [],
  getStageName = (grade) => grade || "غير محدد",
}: AbsenceAlertButtonsProps) {
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);

  // تجميع الغياب لكل مرحلة حسب تاريخ الجمعة (الأسبوع)
  const archiveByGrade = useMemo(() => {
    const grades = ["أولى إعدادي", "ثانية إعدادي", "ثالثة إعدادي"];
    const result: Record<string, Record<string, string[]>> = {
      "أولى إعدادي": {},
      "ثانية إعدادي": {},
      "ثالثة إعدادي": {},
    };

    const memberMap = new Map<string, Profile>();
    members.forEach((m) => memberMap.set(m.id, m));

    absenceRecords.forEach((record) => {
      const member = memberMap.get(record.member_id);
      if (!member) return;

      const stage = getStageName(member.grade);
      if (grades.includes(stage)) {
        const date = record.friday_date || "تاريخ غير محدد";
        if (!result[stage][date]) {
          result[stage][date] = [];
        }
        result[stage][date].push(member.full_name);
      }
    });

    return result;
  }, [members, absenceRecords, getStageName]);

  const gradesList = [
    { label: "تنبيه غياب أولى إعدادي", value: "أولى إعدادي" },
    { label: "تنبيه غياب ثانية إعدادي", value: "ثانية إعدادي" },
    { label: "تنبيه غياب ثالثة إعدادي", value: "ثالثة إعدادي" },
  ];

  const currentArchive = selectedGrade ? archiveByGrade[selectedGrade] || {} : {};
  const dates = Object.keys(currentArchive).sort().reverse();

  return (
    <>
      <div className="space-y-2 w-full my-3">
        {gradesList.map((g) => (
          <Button
            key={g.value}
            variant="outline"
            className="w-full justify-between dir-rtl text-right border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10"
            onClick={() => setSelectedGrade(g.value)}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {g.label}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              عرض الأرشيف
            </span>
          </Button>
        ))}
      </div>

      <Dialog open={!!selectedGrade} onOpenChange={(open) => !open && setSelectedGrade(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto text-right dir-rtl">
          <DialogHeader dir="rtl">
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Calendar className="h-5 w-5" />
              أرشيف غياب {selectedGrade}
            </DialogTitle>
          </DialogHeader>

          {dates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-2">
              <UserX className="h-10 w-10 mx-auto opacity-40" />
              <p>لا يوجد سجلات غياب محفوظة لهذه المرحلة حتى الآن.</p>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {dates.map((date) => {
                const names = currentArchive[date];
                return (
                  <div key={date} className="p-3 border rounded-lg bg-card/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded">
                      <span>جمعة: {date}</span>
                      <span>عدد الغائبين: {names.length}</span>
                    </div>
                    <ul className="text-sm space-y-1 pr-2 border-r-2 border-amber-500/40">
                      {names.map((name, idx) => (
                        <li key={idx} className="text-foreground">
                          • {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
