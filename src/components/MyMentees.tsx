// @ts-nocheck
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cairoDate, fridayOf } from "@/lib/app";
import { buildWhatsAppUrl, WHATSAPP_TEMPLATES } from "@/lib/whatsapp";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VisitHistoryDialog } from "@/components/StaffMemberExtras";

const card = "pop float-in rounded-3xl border-2 border-border bg-card p-5";

function formatWhatsAppLink(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.startsWith("0") ? "2" + digits : digits.startsWith("2") ? digits : "20" + digits;
  return `https://wa.me/${intl}`;
}

export function MyMentees({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const currentFriday = useMemo(() => fridayOf(cairoDate(new Date())), []);

  const [recordVisitMember, setRecordVisitMember] = useState<any | null>(null);
  const [historyMember, setHistoryMember] = useState<any | null>(null);
  const [method, setMethod] = useState<"call" | "visit" | "message">("call");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // للمشرف: إدارة توزيع المخدومين
  const [showAdminManage, setShowAdminManage] = useState(false);
  const [selectedServantId, setSelectedServantId] = useState<string>(userId);

  // 1. جلب قائمة المخدومين المخصصين لهذا الخادم
  const { data: myMentees, isLoading: loadingMentees } = useQuery({
    queryKey: ["my-mentees", userId],
    queryFn: async () => {
      const { data: relations, error } = await supabase
        .from("servant_mentees")
        .select("mentee_id")
        .eq("servant_id", userId);
      if (error) throw error;
      if (!relations || relations.length === 0) return [];

      const menteeIds = relations.map((r) => r.mentee_id);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, avatar, photo_url, academic_year, phone")
        .in("id", menteeIds);
      if (pErr) throw pErr;
      return profiles || [];
    },
  });

  // 2. جلب افتقادات هذا الأسبوع للتأكد من حالة المتابعة
  const { data: thisWeekVisits } = useQuery({
    queryKey: ["my-mentees-visits", userId, currentFriday],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitations")
        .select("member_id, method, note")
        .eq("servant_id", userId)
        .eq("week_start", currentFriday);
      if (error) throw error;
      return data || [];
    },
  });

  // 3. جلب حضور الجمعة الحالية للمخدومين
  const { data: attendanceList } = useQuery({
    queryKey: ["my-mentees-attendance", currentFriday],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_attendance")
        .select("person_id, status")
        .eq("attendance_date", currentFriday);
      if (error) throw error;
      return data || [];
    },
  });

  // 4. للمشرف: جلب الخدام وكل المخدومين لإدارة التوزيع
  const { data: allServants } = useQuery({
    queryKey: ["all-servants-for-manage"],
    enabled: isAdmin && showAdminManage,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("account_type", "servant");
      return data || [];
    },
  });

  const { data: allStudents } = useQuery({
    queryKey: ["all-students-for-manage"],
    enabled: isAdmin && showAdminManage,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, academic_year")
        .neq("account_type", "servant")
        .order("full_name");
      return data || [];
    },
  });

  const { data: currentServantMentees, refetch: refetchServantMentees } = useQuery({
    queryKey: ["servant-assigned-mentees", selectedServantId],
    enabled: isAdmin && showAdminManage && !!selectedServantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("servant_mentees")
        .select("mentee_id")
        .eq("servant_id", selectedServantId);
      return (data || []).map((r) => r.mentee_id);
    },
  });

  // تسجيل الافتقاد
  async function handleSaveVisit() {
    if (!recordVisitMember) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("visitations").insert({
        servant_id: userId,
        member_id: recordVisitMember.id,
        method,
        note: note.trim(),
        week_start: currentFriday,
      });
      if (error) throw error;
      toast.success(`تم تسجيل افتقاد ${recordVisitMember.full_name} بنجاح ✅`);
      qc.invalidateQueries({ queryKey: ["my-mentees-visits"] });
      qc.invalidateQueries({ queryKey: ["visit-archive"] });
      setRecordVisitMember(null);
      setNote("");
    } catch (err: any) {
      toast.error(err.message || "فشل تسجيل الافتقاد");
    } finally {
      setIsSubmitting(false);
    }
  }

  // تبديل تعيين مخدوم لخادم (للمشرف)
  async function toggleAssign(menteeId: string) {
    const isAssigned = (currentServantMentees || []).includes(menteeId);
    try {
      if (isAssigned) {
        await supabase
          .from("servant_mentees")
          .delete()
          .eq("servant_id", selectedServantId)
          .eq("mentee_id", menteeId);
      } else {
        await supabase
          .from("servant_mentees")
          .insert({ servant_id: selectedServantId, mentee_id: menteeId });
      }
      refetchServantMentees();
      qc.invalidateQueries({ queryKey: ["my-mentees"] });
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء التحديث");
    }
  }

  const visitedMap = useMemo(() => {
    const map = new Map<string, any>();
    (thisWeekVisits || []).forEach((v) => map.set(v.member_id, v));
    return map;
  }, [thisWeekVisits]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, string>();
    (attendanceList || []).forEach((a) => map.set(a.person_id, a.status));
    return map;
  }, [attendanceList]);

  const visitedCount = useMemo(() => {
    return (myMentees || []).filter((m) => visitedMap.has(m.id)).length;
  }, [myMentees, visitedMap]);

  return (
    <section className="space-y-4">
      {/* رأس الصفحة والإحصائيات */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold flex items-center gap-2">
              <span>👥</span> مخدوميني للمتابعة والافتقاد
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              المخدومين المخصصين لك لمتابعة حضورهم، افتقادهم الأسبوعي، والتواصل معهم.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant={showAdminManage ? "secondary" : "outline"}
              className="rounded-2xl font-bold border-2"
              onClick={() => setShowAdminManage(!showAdminManage)}
            >
              ⚙️ {showAdminManage ? "إغلاق التوزيع" : "توزيع المخدومين (للمشرف)"}
            </Button>
          )}
        </div>

        {/* شريط الإنجاز الأسبوعي */}
        {!showAdminManage && (myMentees || []).length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-muted/60 p-3">
            <div className="font-bold text-sm">
              إنجاز افتقاد أسبوع ({currentFriday}):
            </div>
            <Badge className="bg-sky text-primary-foreground font-extrabold text-sm">
              تم افتقاد {visitedCount} من {(myMentees || []).length} مخدوم
            </Badge>
            {visitedCount === (myMentees || []).length && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                🎉 ممتاز! تم افتقاد جميع مخدوميك هذا الأسبوع.
              </span>
            )}
          </div>
        )}
      </div>

      {/* لوحة إدارة المشرف لتوزيع المخدومين */}
      {isAdmin && showAdminManage && (
        <div className={`${card} border-sky/50 bg-sky/5`}>
          <h3 className="text-lg font-extrabold mb-3">🛠️ توزيع المخدومين على الخدام</h3>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm">اختر الخادم:</span>
            <select
              value={selectedServantId}
              onChange={(e) => setSelectedServantId(e.target.value)}
              className="rounded-xl border-2 border-border bg-background p-2 font-bold text-sm"
            >
              {(allServants || []).map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            <p className="text-xs text-muted-foreground mb-2">ضع علامة صح أمام المخدوم لتعيينه لهذا الخادم:</p>
            {(allStudents || []).map((st) => {
              const checked = (currentServantMentees || []).includes(st.id);
              return (
                <label
                  key={st.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border-2 cursor-pointer transition ${
                    checked ? "border-sky bg-sky/10 font-bold" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssign(st.id)}
                      className="h-4 w-4 rounded"
                    />
                    <span>{st.full_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{st.academic_year || "عام"}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* قائمة كروت المخدومين للتقارير والتواصل */}
      {loadingMentees ? (
        <div className="text-center font-bold p-8">جاري تحميل مخدوميك...</div>
      ) : (myMentees || []).length === 0 ? (
        <div className={`${card} text-center py-10`}>
          <div className="text-5xl mb-2">🙋‍♂️</div>
          <div className="font-extrabold text-lg">لا يوجد مخدومين مخصصين لك بعد</div>
          <p className="text-sm text-muted-foreground mt-1">
            سيقوم المشرف بتوزيع مجموعة من المخدومين عليك لمتابعتهم، أو يمكنك التوزيع من زر المشرف في الأعلى.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {myMentees.map((m) => {
            const visited = visitedMap.get(m.id);
            const att = attendanceMap.get(m.id);
            const wa = formatWhatsAppLink(m.phone);

            return (
              <div key={m.id} className={`${card} flex flex-col justify-between gap-3`}>
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-2xl font-bold shrink-0 overflow-hidden border">
                    {m.photo_url ? (
                      <img src={m.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      m.avatar || "👤"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-base truncate">{m.full_name}</h4>
                    <p className="text-xs text-muted-foreground">{m.academic_year || "المرحلة الدراسية غير محددة"}</p>
                    
                    {/* شارات الحالة */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {visited ? (
                        <Badge className="bg-emerald-600 text-white font-bold text-[11px]">
                          ✅ افتُقد ({visited.method === "call" ? "مكالمة" : visited.method === "visit" ? "زيارة" : "رسالة"})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 font-bold text-[11px]">
                          ⚠️ لم يُفتقد هذا الأسبوع
                        </Badge>
                      )}

                      {att === "present" && (
                        <Badge className="bg-sky/20 text-sky border border-sky/30 font-bold text-[11px]">
                          حاضر الجمعة
                        </Badge>
                      )}
                      {att === "absent" && (
                        <Badge variant="destructive" className="font-bold text-[11px]">
                          غائب الجمعة
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* أزرار الاتصال والافتقاد */}
                <div className="border-t pt-3 flex flex-wrap items-center gap-2">
                  {m.phone && (
                    <>
                      <a
                        href={`tel:${m.phone}`}
                        className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted"
                      >
                        📞 اتصال
                      </a>
                                          {m.phone && (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {/* 1. قالب تذكير الخدمة (الخميس) */}
                          <a
                            href={buildWhatsAppUrl(m.phone, WHATSAPP_TEMPLATES.serviceReminder(m.full_name)) || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1.5 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                            title="إرسال تذكير الخدمة لميعاد بكرة"
                          >
                            🔔 تذكير الخدمة
                          </a>

                          {/* 2. قالب افتقاد الغياب (يبرز بلون مميز إذا كان غائباً الجمعة) */}
                          <a
                            href={buildWhatsAppUrl(m.phone, WHATSAPP_TEMPLATES.absence(m.full_name)) || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition flex items-center gap-1 shadow-sm ${
                              att === "absent"
                                ? "bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                            title="إرسال رسالة افتقاد لغياب الجمعة"
                          >
                            💬 افتقاد غياب
                          </a>

                          {/* 3. قالب تهنئة عيد الميلاد */}
                          <a
                            href={buildWhatsAppUrl(m.phone, WHATSAPP_TEMPLATES.birthday(m.full_name)) || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-pink-600 hover:bg-pink-700 text-white px-2.5 py-1.5 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                            title="إرسال تهنئة عيد الميلاد"
                          >
                            🎂 عيد ميلاد
                          </a>
                        </div>
                      )}

                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-bold text-xs mr-auto"
                    onClick={() => {
                      setRecordVisitMember(m);
                      setNote("");
                    }}
                  >
                    ✍️ تسجيل افتقاد
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl font-bold text-xs text-muted-foreground"
                    onClick={() => setHistoryMember({ id: m.id, name: m.full_name })}
                  >
                    📜 السجل
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة تسجيل الافتقاد */}
      <Dialog open={!!recordVisitMember} onOpenChange={(o) => !o && setRecordVisitMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>✍️ تسجيل افتقاد: {recordVisitMember?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold mb-1 block">طريقة الافتقاد:</label>
              <div className="flex gap-2">
                {[
                  ["call", "📞 مكالمة"],
                  ["visit", "🏠 زيارة"],
                  ["message", "💬 رسالة"],
                ].map(([mKey, label]) => (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => setMethod(mKey as any)}
                    className={`flex-1 rounded-xl border-2 py-2 text-xs font-bold transition ${
                      method === mKey ? "border-sky bg-sky text-primary-foreground" : "border-border bg-card"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold mb-1 block">ملاحظات وتقرير الافتقاد:</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="اكتب ما تم في الافتقاد، سبب الغياب إن وجد، أو أي احتياجات للمخدوم..."
                rows={3}
                className="rounded-xl"
              />
            </div>

            <Button
              onClick={handleSaveVisit}
              disabled={isSubmitting}
              className="w-full rounded-xl font-bold bg-sky text-primary-foreground"
            >
              {isSubmitting ? "جاري الحفظ..." : "حفظ تقرير الافتقاد ✅"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* نافذة السجل التراكمي للافتقاد للمخدوم */}
      <VisitHistoryDialog member={historyMember} onClose={() => setHistoryMember(null)} />
    </section>
  );
}
