import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Users, Calendar, UserX } from 'lucide-react';

export interface AbsentPerson {
  id: string;
  name: string;
  stage?: string;
  absent_count: number;
  phone?: string;
  // يمكن استقبال تواريخ الغياب أو الأسابيع إذا كانت متوفرة، أو عرضها بناءً على البيانات
  absence_dates?: string[]; // تاريخ أيام الجمعة التي غاب فيها
}

interface AbsenceAlertButtonsProps {
  absentPersons?: AbsentPerson[];
  absentServants?: AbsentPerson[];
}

// 1. أزرار غياب المخدومين حسب المرحلة (ترتيب الأسابيع وأيام الجمعة)
export const ConsecutiveAbsenceAlertButtons = ({
  absentPersons = [],
}: {
  absentPersons: AbsentPerson[];
}) => {
  const [selectedStage, setSelectedStage] = useState<{ match: string; label: string } | null>(null);

  const stages = [
    { id: 'prep_1', label: 'تنبيه غياب أولى إعدادي', match: 'أولى' },
    { id: 'prep_2', label: 'تنبيه غياب ثانية إعدادي', match: 'ثانية' },
    { id: 'prep_3', label: 'تنبيه غياب ثالثة إعدادي', match: 'ثالثة' },
  ];

  const getStageList = (matchText: string) =>
    absentPersons.filter(
      (p) => (p.stage?.includes(matchText) || false) && p.absent_count >= 2
    );

  const activeList = selectedStage
    ? absentPersons.filter(
        (p) => (p.stage?.includes(selectedStage.match) || false) && p.absent_count >= 2
      )
    : [];

  // تنظيم البيانات لتظهر مقسمة حسب أيام الجمعة/الأسابيع
  // سنقوم بتجميع الغياب بناءً على تواريخ الجمعة المسجلة لكل شخص، أو افتراضياً حسب تواريخ الغياب
  const groupByFriday = () => {
    const fridaysMap: Record<string, string[]> = {};
    
    activeList.forEach((person) => {
      // إذا كان الشخص لديه تواريخ غياب مسجلة، نوزعها، وإلا نضعها تحت تصنيف عام أو تاريخ الخدمة
      const dates = person.absence_dates && person.absence_dates.length > 0 
        ? person.absence_dates 
        : ["الأسابيع الأخيرة المتتالية"];

      dates.forEach((fridayDate) => {
        if (!fridaysMap[fridayDate]) {
          fridaysMap[fridayDate] = [];
        }
        fridaysMap[fridayDate].push(person.name);
      });
    });

    return fridaysMap;
  };

  const fridaysData = groupByFriday();
  const sortedFridays = Object.keys(fridaysData).sort().reverse();

  return (
    <>
      <div className="space-y-2 w-full my-3">
        {stages.map((stg) => {
          const list = getStageList(stg.match);
          const count = list.length;

          return (
            <Button
              key={stg.id}
              variant={count > 0 ? "destructive" : "outline"}
              className="w-full flex justify-between items-center text-right dir-rtl"
              onClick={() => setSelectedStage({ match: stg.match, label: stg.label })}
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {stg.label}
              </span>
              {count > 0 && (
                <Badge variant="secondary" className="bg-background text-foreground">
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      <Dialog open={!!selectedStage} onOpenChange={(open) => !open && setSelectedStage(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto text-right dir-rtl">
          <DialogHeader dir="rtl">
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Calendar className="h-5 w-5" />
              أرشيف أيام الجمعة - {selectedStage?.label}
            </DialogTitle>
          </DialogHeader>

          {sortedFridays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-2">
              <UserX className="h-10 w-10 mx-auto opacity-40" />
              <p>لا توجد تنبيهات غياب مسجلة لهذه المرحلة.</p>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {sortedFridays.map((friday) => (
                <div key={friday} className="p-3 bg-muted/50 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-sm text-primary flex items-center gap-1">
                      📅 جمعة: {friday}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {fridaysData[friday].length} غائبين
                    </Badge>
                  </div>
                  <ul className="space-y-1 pr-2">
                    {fridaysData[friday].map((name, idx) => (
                      <li key={idx} className="text-sm text-foreground flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// 2. زر تنبيه غياب الخدام (لصفحة المشرف)
export const ServantsAbsenceAlertButton = ({
  absentServants = [],
}: {
  absentServants: AbsentPerson[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const count = absentServants.length;

  return (
    <>
      <Button
        variant={count > 0 ? "destructive" : "outline"}
        className="w-full flex justify-between items-center text-right dir-rtl my-2"
        onClick={() => setIsOpen(true)}
      >
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          تنبيه غياب الخدام
        </span>
        {count > 0 && (
          <Badge variant="secondary" className="bg-background text-foreground">
            {count}
          </Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto text-right dir-rtl">
          <DialogHeader dir="rtl">
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Users className="h-5 w-5" />
              الخدام المتغيبين مرتين متتاليتين أو أكثر
            </DialogTitle>
          </DialogHeader>

          {count === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-2">
              <UserX className="h-10 w-10 mx-auto opacity-40" />
              <p>لا توجد تنبيهات غياب للخدام حالياً.</p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {absentServants.map((servant) => (
                <div
                  key={servant.id}
                  className="p-3 bg-muted rounded-lg flex justify-between items-center text-sm border"
                >
                  <div>
                    <span className="font-semibold block">{servant.name}</span>
                    {servant.phone && (
                      <span className="text-xs text-muted-foreground">{servant.phone}</span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                    غائب {servant.absent_count} مرات متتالية
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
