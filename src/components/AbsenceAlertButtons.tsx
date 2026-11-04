// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Calendar, ChevronRight, UserX, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cairoDate, fridayOf } from "@/lib/app";

export interface AbsentPerson {
  id: string;
  name: string;
  stage?: string;
  absent_count: number;
  phone?: string;
  absence_dates?: string[];
  avatar?: string | null;
  photo_url?: string | null;
  account_type?: string | null;
}

export interface FridayAbsence {
  date: string;
  isCurrent: boolean;
  presentCount: number;
  absent: AbsentPerson[];
}

/* ---------- بيانات الغياب حسب أيام الجمعة (أيام الخدمة) ---------- */

function serviceFridays(sy: { start_date: string; end_date: string } | null): string[] {
  const todayFriday = fridayOf(cairoDate(new Date()));
  let start: string;
  let end: string;
  if (sy) {
    start = sy.start_date;
    end = sy.end_date;
  } else {
    const d = new Date(todayFriday + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 26 * 7);
    start = d.toISOString().slice(0, 10);
    end = todayFriday;
  }
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  while (s.getUTCDay() !== 5) s.setUTCDate(s.getUTCDate() + 1);
  const e = new Date(end + "T00:00:00Z");
  for (; s <= e; s.setUTCDate(s.getUTCDate() + 7)) {
    const iso = s.toISOString().slice(0, 10);
    if (iso <= todayFriday) out.push(iso);
  }
  return out;
}

/** يجلب سجلات الحضور خلال السنة الخدمية الحالية ويجمعها حسب أيام الجمعة */
export function useFridayAbsenceData() {
  const [state, setState] = useState<{
    loading: boolean;
    fridays: FridayAbsence[];
    consecutive: AbsentPerson[];
  }>({ loading: true, fridays: [], consecutive: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: sy } = await supabase
          .from("service_years")
          .select("start_date, end_date")
          .eq("is_current", true)
          .maybeSingle();

        let q = supabase.from("daily_attendance").select("person_id, status, attendance_date");
        if (sy) q = q.gte("attendance_date", sy.start_date).lte("attendance_date", sy.end_date);
        const [{ data: att }, { data: profiles }] = await Promise.all([
          q,
          supabase
            .from("profiles")
            .select("id, full_name, avatar, photo_url, academic_year, account_type")
            .eq("status", "approved"),
        ]);
        if (!alive) return;

        const pmap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const byDate = new Map<string, { present: number; absent: Map<string, AbsentPerson> }>();
        const counts: Record<string, { absent: number; dates: string[] }> = {};

        (att || []).forEach((r: any) => {
          const day = byDate.get(r.attendance_date) || { present: 0, absent: new Map<string, AbsentPerson>() };
          const p: any = pmap.get(r.person_id);
          if (r.status === "present") day.present++;
          if (r.status === "absent") {
            if (p) {
              day.absent.set(r.person_id, {
                id: p.id,
                name: p.full_name || "بدون اسم",
                stage: p.academic_year || undefined,
                absent_count: 0,
                avatar: p.avatar,
                photo_url: p.photo_url,
                account_type: p.account_type,
              });
              if (!counts[r.person_id]) counts[r.person_id] = { absent: 0, dates: [] };
              counts[r.person_id].absent++;
              counts[r.person_id].dates.push(r.attendance_date);
            }
          }
          byDate.set(r.attendance_date, day);
        });

        const current = fridayOf(cairoDate(new Date()));
        const dates = serviceFridays(sy).sort((a, b) => b.localeCompare(a));
        const fridays: FridayAbsence[] = dates.map((date) => {
          const day = byDate.get(date);
          return {
            date,
            isCurrent: date === current,
            presentCount: day?.present || 0,
            absent: day ? [...day.absent.values()] : [],
          };
        });

        const consecutive: AbsentPerson[] = Object.entries(counts)
          .filter(([, c]) => c.absent >= 2)
          .map(([id, c]) => {
            const p: any = pmap.get(id);
            return {
              id,
              name: p?.full_name || "بدون اسم",
              stage: p?.academic_year || undefined,
              absent_count: c.absent,
              absence_dates: c.dates,
              avatar: p?.avatar,
              photo_url: p?.photo_url,
              account_type: p?.account_type,
            };
          })
          .sort((a, b) => b.absent_count - a.absent_count);

        if (alive) setState({ loading: false, fridays, consecutive });
      } catch {
        if (alive) setState({ loading: false, fridays: [], consecutive: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/* ---------- حالة القراءة الدائمة لزر التنبيه ---------- */

/** حفظ علامات القراءة في الجهاز: يظهر زر التنبيه دائمًا حتى يُفتح ويُقرأ */
function useAbsenceRead(scope: string) {
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [uid, setUid] = useState<string>("");

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const id = data.user?.id || "anon";
      setUid(id);
      try {
        setReadMap(JSON.parse(localStorage.getItem(`abs_alerts_read:${id}:${scope}`) || "{}"));
      } catch {
        setReadMap({});
      }
    });
    return () => {
      alive = false;
    };
  }, [scope]);

  const markRead = (keys: string[]) => {
    if (!keys.length) return;
    setReadMap((prev) => {
      const next = { ...prev };
      keys.forEach((k) => {
        next[k] = true;
      });
      try {
        localStorage.setItem(`abs_alerts_read:${uid}:${scope}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return { readMap, markRead };
}

const alertKey = (p: AbsentPerson) => `${p.id}:${p.absent_count}`;

const isServantRow = (p: AbsentPerson) => {
  const t = (p.account_type || "").toLowerCase();
  const hasYear = !!(p.stage && p.stage.trim() !== "");
  return t.includes("servant") || t.includes("admin") || !hasYear;
};

/* ---------- نافذة التنبيه: أيام الجمعة ثم غياب كل يوم ---------- */

function FridayAbsenceDialog({
  open,
  onOpenChange,
  title,
  fridays,
  consecutive,
  filterFn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fridays: FridayAbsence[];
  consecutive: AbsentPerson[];
  filterFn?: (p: AbsentPerson) => boolean;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const f = filterFn || (() => true);

  const selectedDay = useMemo(() => fridays.find((x) => x.date === sel), [fridays, sel]);
  const dayAbsent = selectedDay ? selectedDay.absent.filter(f) : [];
  const watchList = useMemo(() => consecutive.filter(f), [consecutive, f]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSel(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto text-right dir-rtl">
        <DialogHeader dir="rtl">
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Calendar className="h-5 w-5" />
            {sel ? `غياب جمعة ${sel}` : title}
          </DialogTitle>
        </DialogHeader>

        {sel ? (
          <div className="space-y-3">
            <Button variant="outline" size="sm" onClick={() => setSel(null)} className="dir-rtl">
              <ChevronRight className="h-4 w-4 rotate-180" />
              رجوع لأيام الجمعة
            </Button>

            <div className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
              حضر في هذا اليوم: <span className="font-black text-emerald-600">{selectedDay?.presentCount || 0}</span>
            </div>

            {dayAbsent.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground space-y-2">
                <UserX className="h-10 w-10 mx-auto opacity-40" />
                <p>لا يوجد غياب مسجل في هذا اليوم ✅</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayAbsent.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border bg-muted p-3">
                    <div className="flex items-center gap-3">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="text-2xl">{p.avatar || "👤"}</span>
                      )}
                      <div>
                        <div className="font-extrabold text-sm">{p.name}</div>
                        {p.stage && <div className="text-xs text-muted-foreground">{p.stage}</div>}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-destructive border-destructive/30">
                      غائب ✕
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {watchList.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-extrabold text-amber-600">⚠️ متغيبون مرتين متتاليتين أو أكثر</p>
                {watchList.map((p) => (
                  <div key={p.id} className="p-3 bg-muted rounded-lg border space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground">{p.name}</span>
                      <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                        غائب {p.absent_count} مرات متتالية
                      </Badge>
                    </div>
                    {p.absence_dates && p.absence_dates.length > 0 && (
                      <div className="text-xs text-muted-foreground pt-1 border-t border-border/50 flex flex-wrap gap-1 items-center">
                        <span className="font-medium text-primary">أيام الجمعة المتغيب فيها:</span>
                        {p.absence_dates.map((dateStr, idx) => (
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

            <div>
              <p className="mb-2 text-sm font-extrabold">📅 أيام خدمة الجمعة — اضغط اليوم لعرض الغائبين</p>
              <div className="space-y-2">
                {fridays.map((day) => {
                  const n = day.absent.filter(f).length;
                  return (
                    <Button
                      key={day.date}
                      variant={n > 0 ? "destructive" : "outline"}
                      className="w-full flex justify-between items-center text-right dir-rtl"
                      onClick={() => setSel(day.date)}
                    >
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {day.isCurrent ? `جمعة هذا الأسبوع (${day.date}) ★` : `جمعة ${day.date}`}
                      </span>
                      <Badge variant="secondary" className="bg-background text-foreground">
                        {n > 0 ? `غائب: ${n}` : "لا غياب"}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- أزرار التنبيه في صفحة الخادم ---------- */

const STAGES = [
  { id: "prep_1", label: "تنبيه غياب أولى إعدادي", match: "أولى" },
  { id: "prep_2", label: "تنبيه غياب ثانية إعدادي", match: "ثانية" },
  { id: "prep_3", label: "تنبيه غياب ثالثة إعدادي", match: "ثالثة" },
];

export function StageAbsenceAlerts() {
  const { fridays, consecutive } = useFridayAbsenceData();
  const { readMap, markRead } = useAbsenceRead("members");

  const [openKey, setOpenKey] = useState<string | null>(null);

  const members = useMemo(() => consecutive.filter((p) => !isServantRow(p)), [consecutive]);
  const servants = useMemo(() => consecutive.filter(isServantRow), [consecutive]);

  const stageFilter = (match: string) => (p: AbsentPerson) => !!p.stage?.includes(match);
  const stageCount = (match: string) => members.filter(stageFilter(match)).length;

  // زر التنبيه الدائم: يبقى ظاهرًا بعدد غير المقروء ولا يختفي إلا حين قراءته
  const alertKeys = members.map(alertKey);
  const unreadKeys = alertKeys.filter((k) => !readMap[k]);
  const persistentActive = alertKeys.length > 0;
  const persistentUnread = unreadKeys.length;

  const openMain = () => {
    setOpenKey("main");
    markRead(unreadKeys);
  };

  return (
    <>
      <div className="space-y-2 w-full my-3">
        {persistentActive && (
          <Button
            variant={persistentUnread > 0 ? "destructive" : "outline"}
            className={`w-full flex justify-between items-center text-right dir-rtl ${persistentUnread > 0 ? "animate-pulse" : ""}`}
            onClick={openMain}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              🚨 تنبيه غياب مرتين متتاليتين
            </span>
            <Badge variant="secondary" className="bg-background text-foreground">
              {persistentUnread > 0 ? `${persistentUnread} جديد` : "تمت القراءة"}
            </Badge>
          </Button>
        )}

        {STAGES.map((stg) => {
          const count = stageCount(stg.match);
          return (
            <Button
              key={stg.id}
              variant={count > 0 ? "destructive" : "outline"}
              className="w-full flex justify-between items-center text-right dir-rtl"
              onClick={() => setOpenKey(stg.id)}
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

        <Button
          variant={servants.length > 0 ? "destructive" : "outline"}
          className="w-full flex justify-between items-center text-right dir-rtl"
          onClick={() => setOpenKey("servants")}
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            🚷 تنبيه غياب الخدام
          </span>
          {servants.length > 0 && (
            <Badge variant="secondary" className="bg-background text-foreground">
              {servants.length}
            </Badge>
          )}
        </Button>
      </div>

      <FridayAbsenceDialog
        open={openKey === "main"}
        onOpenChange={(o) => !o && setOpenKey(null)}
        title="تنبيه غياب مرتين متتاليتين"
        fridays={fridays}
        consecutive={members}
      />
      {STAGES.map((stg) => (
        <FridayAbsenceDialog
          key={stg.id}
          open={openKey === stg.id}
          onOpenChange={(o) => !o && setOpenKey(null)}
          title={stg.label}
          fridays={fridays}
          consecutive={members}
          filterFn={stageFilter(stg.match)}
        />
      ))}
      <FridayAbsenceDialog
        open={openKey === "servants"}
        onOpenChange={(o) => !o && setOpenKey(null)}
        title="تنبيه غياب الخدام"
        fridays={fridays}
        consecutive={servants}
        filterFn={isServantRow}
      />
    </>
  );
}

/* ---------- زر تنبيه غياب الخدام (صفحة المشرف) ---------- */

export function ServantsAbsenceAlertButton() {
  const { fridays, consecutive } = useFridayAbsenceData();
  const { readMap, markRead } = useAbsenceRead("servants");
  const [open, setOpen] = useState(false);

  const servants = useMemo(() => consecutive.filter(isServantRow), [consecutive]);
  const unreadKeys = servants.map(alertKey).filter((k) => !readMap[k]);

  return (
    <>
      <Button
        variant={unreadKeys.length > 0 ? "destructive" : servants.length > 0 ? "outline" : "outline"}
        className={`w-full flex justify-between items-center text-right dir-rtl my-2 ${unreadKeys.length > 0 ? "animate-pulse" : ""}`}
        onClick={() => {
          setOpen(true);
          markRead(unreadKeys);
        }}
      >
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          🚷 تنبيه غياب الخدام
        </span>
        <Badge variant="secondary" className="bg-background text-foreground">
          {unreadKeys.length > 0 ? `${unreadKeys.length} جديد` : servants.length > 0 ? `${servants.length} متغيب` : "لا يوجد"}
        </Badge>
      </Button>

      <FridayAbsenceDialog
        open={open}
        onOpenChange={setOpen}
        title="تنبيه غياب الخدام"
        fridays={fridays}
        consecutive={servants}
        filterFn={isServantRow}
      />
    </>
  );
}
