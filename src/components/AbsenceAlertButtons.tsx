import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Users, Calendar, UserX } from 'lucide-react';

export interface AbsentPerson {
  id: string;
  name: string;
  stage?: string;
  absent_count: number;
  phone?: string;
  // يمكن استقبال تواريخ الغياب أو الأسابيع إذا كانت متوفرة، أو عرضها بناءً على البيانات
  absence_dates?: string[]; // تاريخ أيام الجمعة التي غاب فيها
}

interface AbsenceAlertButtonsProps {
  absentPersons?: AbsentPerson[];
  absentServants?: AbsentPerson[];
}

// 1. أزرار غياب المخدومين حسب المرحلة (ترتيب الأسابيع وأيام الجمعة)
export const ConsecutiveAbsenceAlertButtons = ({
  absentPersons = [],
}: {
  absentPersons: AbsentPerson[];
}) => {
  const [selectedStage, setSelectedStage] = useState<{ match: string; label: string } | null>(null);

  const stages = [
    { id: 'prep_1', label: 'تنبيه غياب أولى إعدادي', match: 'أولى' },
    { id: 'prep_2', label: 'تنبيه غياب ثانية إعدادي', match: 'ثانية' },
    { id: 'prep_3', label: 'تنبيه غياب ثالثة إعدادي', match: 'ثالثة' },
  ];

  const getStageList = (matchText: string) =>
    absentPersons.filter(
      (p) => (p.stage?.includes(matchText) || false) && p.absent_count >= 2
    );

  const activeList = selectedStage
    ? absentPersons.filter(
        (p) => (p.stage?.includes(selectedStage.match) || false) && p.absent_count >= 2
      )
    : [];

  // تنظيم البيانات لتظهر مقسمة حسب أيام الجمعة/الأسابيع
  // سنقوم بتجميع الغياب بناءً على تواريخ الجمعة المسجلة لكل شخص، أو افتراضياً حسب تواريخ الغياب
  const groupByFriday = () => {
    const fridaysMap: Record = {};
    
    activeList.forEach((person) => {
      // إذا كان الشخص لديه تواريخ غياب مسجلة، نوزعها، وإلا نضعها تحت تصنيف عام أو تاريخ الخدمة
      const dates = person.absence_dates && person.absence_dates.length > 0 
        ? person.absence_dates 
        : ["الأسابيع الأخيرة المتتالية"];

      dates.forEach((fridayDate) => {
        if (!fridaysMap[fridayDate]) {
          fridaysMap[fridayDate] = [];
        }
        fridaysMap[fridayDate].push(person.name);
      });
    });

    return fridaysMap;
  };

  const fridaysData = groupByFriday();
  const sortedFridays = Object.keys(fridaysData).sort().reverse();

  return (
    <>
      
        {stages.map((stg) => {
          const list = getStageList(stg.match);
          const count = list.length;

          return (
            
              key={stg.id}
              variant={count > 0 ? "destructive" : "outline"}
              className="w-full flex justify-between items-center text-right dir-rtl"
              onClick={() => setSelectedStage({ match: stg.match, label: stg.label })}
            >
              
                
                {stg.label}
              
              {count > 0 && (
                
                  {count}
                
              )}
            
          );
        })}
      

       !open && setSelectedStage(null)}>
        
          
            
              
              أرشيف أيام الجمعة - {selectedStage?.label}
            
          

          {sortedFridays.length === 0 ? (
            
              
              
لا توجد تنبيهات غياب مسجلة لهذه المرحلة.

            
          ) : (
            
              {sortedFridays.map((friday) => (
                
                  
                    
                      📅 جمعة: {friday}
                    
                    
                      {fridaysData[friday].length} غائبين
                    
                  
                  
                    {fridaysData[friday].map((name, idx) => (
                      
                        
                        {name}
                      
                    ))}
                  
                
              ))}
            
          )}
        
      
    
  );
};

// 2. زر تنبيه غياب الخدام (لصفحة المشرف)
export const ServantsAbsenceAlertButton = ({
  absentServants = [],
}: {
  absentServants: AbsentPerson[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const count = absentServants.length;

  return (
    <>
      
        variant={count > 0 ? "destructive" : "outline"}
        className="w-full flex justify-between items-center text-right dir-rtl my-2"
        onClick={() => setIsOpen(true)}
      >
        
          
          تنبيه غياب الخدام
        
        {count > 0 && (
          
            {count}
          
        )}
      

      
        
          
            
              
              الخدام المتغيبين مرتين متتاليتين أو أكثر
            
          

          {count === 0 ? (
            
              
              
لا توجد تنبيهات غياب للخدام حالياً.

            
          ) : (
            
              {absentServants.map((servant) => (
                
                  key={servant.id}
                  className="p-3 bg-muted rounded-lg flex justify-between items-center text-sm border"
                >
                  

                    {servant.name}
                    {servant.phone && (
                      {servant.phone}
                    )}
                  

                  
                    غائب {servant.absent_count} مرات متتالية
                  
                
              ))}
            
          )}
        
      
    
  );
};
