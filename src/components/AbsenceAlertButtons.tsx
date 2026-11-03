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
  absence_dates?: string[]; // تواريخ أيام الجمعة (مثال: ["2026-11-06", "2026-10-30"])
}

interface AbsenceAlertButtonsProps {
  absentPersons?: AbsentPerson[];
  absentServants?: AbsentPerson[];
}

// 1. أزرار غياب المخدومين حسب المرحلة (مع عرض تواريخ الجمعة باليوم والشهر والعام)
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
              أرشيف غياب {selectedStage?.label}
            </DialogTitle>
          </DialogHeader>

          {activeList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-2">
              <UserX className="h-10 w-10 mx-auto opacity-40" />
              <p>لا توجد تنبيهات غياب مسجلة لهذه المرحلة.</p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {activeList.map((person) => (
                <div
                  key={person.id}
                  className="p-3 bg-muted rounded-lg border space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">{person.name}</span>
                    <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                      غائب {person.absent_count} مرات متتالية
                    </Badge>
                  </div>

                  {/* عرض تواريخ أيام الجمعة بالتحديد (اليوم والشهر والعام) إن وجدت */}
                  {person.absence_dates && person.absence_dates.length > 0 ? (
                    <div className="text-xs text-muted-foreground pt-1 border-t border-border/50 flex flex-wrap gap-1 items-center">
                      <span className="font-medium text-primary">أيام الجمعة المتغيب فيها:</span>
                      {person.absence_dates.map((dateStr, idx) => (
                        <span key={idx} className="bg-background px-2 py-0.5 rounded border text-[11px]">
                          📅 {dateStr}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                      <span>📅 الغياب مسجل خلال الأسابيع الأخيرة المتتالية</span>
                    </div>
                  )}
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
              <UserX className="h-10 w-10 mx-auto opacity-40" / >
              <p>لا توجد تنبيهات غياب للخدام حالياً.</p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {absentServants.map((servant) => (
                <div
                  key={servant.id}
                  className="p-3 bg-muted rounded-lg border space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">{servant.name}</span>
                    <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                      غائب {servant.absent_count} مرات متتالية
                    </Badge>
                  </div>
                  {servant.absence_dates && servant.absence_dates.length > 0 && (
                    <div className="text-xs text-muted-foreground pt-1 border-t border-border/50 flex flex-wrap gap-1 items-center">
                      <span className="font-medium text-primary">أيام الجمعة المتغيب فيها:</span>
                      {servant.absence_dates.map((dateStr, idx) => (
                        <span key={idx} className="bg-background px-2 py-0.5 rounded border text-[11px]">
                          📅 {dateStr}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
