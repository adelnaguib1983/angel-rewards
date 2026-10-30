import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Users } from 'lucide-react';

export interface AbsentPerson {
  id: string;
  name: string;
  stage?: string;
  absent_count: number;
  phone?: string;
}

// 1. أزرار غياب المخدومين حسب المرحلة (لصفحة الخادم)
export const ConsecutiveAbsenceAlertButtons = ({
  absentPersons = [],
}: {
  absentPersons: AbsentPerson[];
}) => {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

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
        (p) =>
          (p.stage?.includes(selectedStage) || false) && p.absent_count >= 2
      )
    : [];

  return (
    <div className="flex flex-wrap gap-2 my-4">
      {stages.map((stg) => {
        const list = getStageList(stg.match);
        const count = list.length;

        return (
          <Button
            key={stg.id}
            variant={count > 0 ? "destructive" : "outline"}
            className="flex items-center gap-2 relative"
            onClick={() => setSelectedStage(stg.match)}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>{stg.label}</span>
            {count > 0 && (
              <Badge variant="secondary" className="mr-1 px-1.5 py-0.5 text-xs">
                {count}
              </Badge>
            )}
          </Button>
        );
      })}

      <Dialog open={!!selectedStage} onOpenChange={() => setSelectedStage(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>المخدومين المتغيبين أسبوعين متتاليين أو أكثر</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4 max-h-80 overflow-y-auto">
            {activeList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                لا توجد تنبيهات غياب مسجلة لهذه المرحلة.
              </p>
            ) : (
              activeList.map((person) => (
                <div
                  key={person.id}
                  className="p-3 bg-muted rounded-lg flex justify-between items-center text-sm"
                >
                  <span className="font-semibold">{person.name}</span>
                  <Badge variant="destructive">
                    غائب {person.absent_count} مرات متتالية
                  </Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
        className="flex items-center gap-2"
        onClick={() => setIsOpen(true)}
      >
        <Users className="h-4 w-4" />
        <span>تنبيه غياب الخدام</span>
        {count > 0 && (
          <Badge variant="secondary" className="mr-1 px-1.5 py-0.5 text-xs">
            {count}
          </Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>الخدام المتغيبين مرتين متتاليتين أو أكثر</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4 max-h-80 overflow-y-auto">
            {count === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                لا توجد تنبيهات غياب للخدام حالياً.
              </p>
            ) : (
              absentServants.map((servant) => (
                <div
                  key={servant.id}
                  className="p-3 bg-muted rounded-lg flex justify-between items-center text-sm"
                >
                  <div>
                    <span className="font-semibold block">{servant.name}</span>
                    {servant.phone && (
                      <span className="text-xs text-muted-foreground">{servant.phone}</span>
                    )}
                  </div>
                  <Badge variant="destructive">
                    غائب {servant.absent_count} مرات متتالية
                  </Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
