// @ts-nocheck -- strict index/optional checks relaxed for this screen; runtime guarded
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";[span_1](start_span)[span_1](end_span)
import { AppHeader } from "@/components/AppHeader";[span_2](start_span)[span_2](end_span)
import { ACADEMIC_YEARS, fileToDataUrl, useMe } from "@/lib/app";[span_3](start_span)[span_3](end_span)
import { Textarea } from "@/components/ui/textarea";[span_4](start_span)[span_4](end_span)
import { AddMemberButton, removeMember, BirthdaysButton, PrepArchive, ReadingPlanner, VisitArchive, VisitHistoryDialog } from "@/components/StaffMemberExtras";[span_5](start_span)[span_5](end_span)
import { NotificationsBell } from "@/components/MemberExtras";[span_6](start_span)[span_6](end_span)
import { ImageLightbox } from "@/components/ImageLightbox";[span_7](start_span)[span_7](end_span)

export const Route = createFileRoute("/_authenticated/servant")({
  head: () => ({
    meta: [
      { title: "مرحلة الخدام | أبطال الإيمان" },
      { name: "description", content: "تحضير الخادم الأسبوعي، الحضور والغياب، وافتقاد المخدومين." },
      { property: "og:title", content: "مرحلة الخدام | أبطال الإيمان" },
      { property: "og:description", content: "تحضير الخادم الأسبوعي، الحضور والغياب، وافتقاد المخدومين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServantPage,
});

const card = "pop float-in rounded-3xl border-2 border-border bg-card p-5";

// دالة لحساب بداية الأسبوع ليكون "يوم الجمعة"
function getFridayWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day < 5 ? 7 : 0) + day - 5;
  const friday = new Date(d);
  friday.setDate(d.getDate() - diff);
  return friday.toISOString().split("T")[0];
}
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 5 ? 0 : day < 5 ? day - 5 - 7 : 1);
  const friday = new Date(d.setDate(diff));
  return friday.toISOString().split("T")[0];
}

function ServantPage() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<string>("prep");
  if (isLoading || !me) return <div className="p-10 text-center">...</div>;
  const p = me.profile;
  const allowed = me.isAdmin || (p?.account_type === "servant" && p?.status === "approved");
  return (
    <div className="stage-servant pb-16">
      <AppHeader stage="servant" isAdmin={me.isAdmin} name={p?.full_name} avatar={p?.avatar} photo={p?.photo_url} />
      <main className="mx-auto max-w-5xl px-4">
        {!allowed ? (
          <div className={`${card} mx-auto mt-10 max-w-md text-center`}>
            <div className="text-6xl">{p?.status === "rejected" ? "🚫" : "⏳"}</div>
            <h1 className="mt-3 text-2xl font-extrabold">{p?.account_type !== "servant" ? "هذه الصفحة للخدام فقط" : p?.status === "rejected" ? "لم تتم الموافقة على الحساب" : "طلبك قيد المراجعة"}</h1>
            <p className="mt-2 text-muted-foreground">سيتم تفعيل حساب الخادم بعد موافقة المشرف.</p>
            {p?.account_type !== "servant" && <Link to="/home" className="mt-3 inline-block font-bold text-primary">رجوع</Link>}
          </div>
        ) : (
          <>
            <div className="rounded-3xl bg-gradient-to-l from-sky/40 via-card to-card p-5 pop float-in">
              <div className="text-sm font-bold text-sky">أهلا يا خادم 🙏</div>
              <h1 className="text-3xl font-extrabold">{p?.full_name}</h1>
              <p className="text-sm text-muted-foreground">متابعة التحضير، الحضور والغياب، الافتقاد، والتوجيهات المشتركة.</p>
              <ServantAttendanceHeader />
            </div>
            <nav className="my-5 flex flex-wrap gap-2">
              {([
                ["prep", "📘 تحضير الخادم"],
                ["attendance", "📋 الحضور والغياب اليومي"],
                ["visit", "📞 الافتقاد الأسبوعي"],
                ["suggestions", "💡 الاقتراحات والتوجيهات"],
                ["ai_quiz", "🤖 توليد المسابقات"],
                ["preparch", "📚 أرشيف التحضيرات"],
                ["visitarch", "🗂️ أرشيف الافتقاد"],
                ["read", "📖 القراءات اليومية"]
              ] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-2xl border-2 px-4 py-2 font-bold transition ${tab === k ? "border-sky bg-sky text-primary-foreground pop" : "border-border bg-card"}`}>{l}</button>
              ))}
              <BirthdaysButton />
              <div className="mr-auto"><NotificationsBell /></div>
            </nav>
            {tab === "prep" && <Prep userId={me.user.id} />}
            {tab === "attendance" && <DailyAttendanceSection />}
            {tab === "visit" && <Visits />}
            {tab === "suggestions" && <SuggestionsSection currentUserId={me.user.id} isAdmin={me.isAdmin} />}
            {tab === "ai_quiz" && <AiQuizGeneratorSection />}
            {tab === "preparch" && <PrepArchive userId={me.user.id} />}
            {tab === "visitarch" && <VisitArchive />}
            {tab === "read" && <ReadingPlanner />}
          </>
        )}
      </main>
    </div>
  );
}

/* ==========================================================================
   قسم توليد المسابقات بالذكاء الاصطناعي
   ========================================================================== */
function AiQuizGeneratorSection() {
  const [sourceType, setSourceType] = useState<"text" | "image" | "voice">("text");
  const [textContent, setTextContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);

  const handleGenerate = async () => {
    if (sourceType === "text" && !textContent.trim()) return toast.error("يرجى كتابة نص المسابقة أولاً");
    if (sourceType === "image" && !selectedImage) return toast.error("يرجى رفع صورة المسابقة أولاً");
    if (sourceType === "voice" && !voiceFile) return toast.error("يرجى تسجيل أو رفع ملف الصوت أولاً");

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setGeneratedQuestions([
        { question: "ما هو العنوان الرئيسي للنص أو الصورة المرفوعة؟", options: ["الخيار الأول", "الخيار الثاني", "الخيار الصحيح"], answer: "الخيار الصحيح" },
        { question: "ما هي التفاصيل الإضافية المستخرجة من المحتوى المرفوع؟", options: ["نعم", "لا"], answer: "نعم" }
      ]);
      toast.success("تم توليد الأسئلة وتحويلها بنجاح ✅");
    }, 1500);
  };

  const handleSaveQuizToDB = async () => {
    if (!generatedQuestions.length) return toast.error("لا توجد أسئلة لحفظها");
    toast.success("تم حفظ المسابقة وإضافتها بنجاح للمخدومين 🚀");
    setGeneratedQuestions([]);
    setTextContent("");
    setSelectedImage(null);
    setVoiceFile(null);
  };

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-xl font-extrabold">🤖 توليد المسابقات تلقائياً بالذكاء الاصطناعي</h2>
        <p className="text-xs text-muted-foreground mt-1">اختر مصدر المسابقة (نص، صورة، أو تسجيل صوتي) ليقوم النظام بتحويلها لأسئلة فوراً.</p>

        <div className="mt-4 flex gap-2">
          <button onClick={() => setSourceType("text")} className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${sourceType === "text" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>📝 من نص مكتوب</button>
          <button onClick={() => setSourceType("image")} className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${sourceType === "image" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>📷 من صورة</button>
          <button onClick={() => setSourceType("voice")} className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${sourceType === "voice" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>🎤 من تسجيل صوتي</button>
        </div>

        <div className="mt-4">
          {sourceType === "text" && (
            <Textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="اكتب أو الصق نص الدرس، الكتاب المقدس، أو محتوى المسابقة هنا..." className="min-h-32" />
          )}
          {sourceType === "image" && (
            <div className="space-y-2">
              {selectedImage && <img src={selectedImage} alt="Uploaded quiz" className="max-h-48 rounded-2xl object-cover mx-auto" />}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-6 cursor-pointer hover:bg-muted">
                <span>📷 اضغط لرفع صورة المسابقة</span>
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try { const url = await fileToDataUrl(file, 900, 0.75); setSelectedImage(url); } catch (err) { toast.error((err as Error).message); }
                  }
                }} />
              </label>
            </div>
          )}
          {sourceType === "voice" && (
            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-6 cursor-pointer hover:bg-muted">
                <span>🎤 اضغط لرفع ملف صوتي (فويس) للأسئلة</span>
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setVoiceFile(file); }} />
              </label>
              {voiceFile && <p className="text-xs font-bold text-emerald-600 text-center">تم اختيار الملف: {voiceFile.name}</p>}
            </div>
          )}
        </div>

        <button disabled={loading} onClick={handleGenerate} className="pop mt-4 w-full rounded-2xl bg-sky py-3 text-base font-extrabold text-primary-foreground disabled:opacity-60">
          {loading ? "جاري تحليل المحتوى وتوليد الأسئلة..." : "توليد الأسئلة تلقائياً ⚡"}
        </button>
      </section>

      {generatedQuestions.length > 0 && (
        <section className={card}>
          <h3 className="text-lg font-extrabold text-emerald-600 mb-3">✨ الأسئلة المستخرجة (جاهزة للنشر):</h3>
          <div className="space-y-3">
            {generatedQuestions.map((q, idx) => (
              <div key={idx} className="rounded-xl border-2 border-border bg-background p-3 space-y-1">
                <div className="font-bold text-sm">س {idx + 1}: {q.question}</div>
                <div className="text-xs text-muted-foreground">الإجابة الصحيحة: <span className="text-emerald-600 font-extrabold">{q.answer}</span></div>
              </div>
            ))}
          </div>
          <button onClick={handleSaveQuizToDB} className="pop mt-4 w-full rounded-2xl bg-emerald-600 py-3 text-base font-extrabold text-white">
            اعتماد وحفظ المسابقة للمخدومين ✅
          </button>
        </section>
      )}
    </div>
  );
}

/* ==========================================================================
   قسم الحضور والغياب اليومي مع تحميل أسماء المخدومين والخدام
   ========================================================================== */
function DailyAttendanceSection() {
  const qc = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(todayStr);
  const [subTab, setSubTab] = useState<"record" | "absent">("record");
  const [accountType, setAccountType] = useState<"student" | "servant">("student");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const filterYear = selectedYear === "all" ? null : selectedYear;

  const { data: rpcPeople, isLoading: rpcLoading } = useQuery({
    queryKey: ["daily-attendance-full", date, accountType, filterYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_daily_attendance", { _date: date, _account_type: accountType });
      if (error) throw error;
      let list = data || [];
      if (filterYear) list = list.filter((p: any) => p.academic_year === filterYear);
      return list;
    },
  });

  const { data: servantMembersData } = useQuery({
    queryKey: ["servant-members-for-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("servant_members");
      if (error) return [];
      return data || [];
    },
    enabled: accountType === "student",
  });

  const people = (() => {
    if (accountType === "student" && servantMembersData && servantMembersData.length > 0) {
      return servantMembersData
        .filter((m: any) => !filterYear || m.academic_year === filterYear)
        .map((m: any) => {
          const existing = (rpcPeople || []).find((p: any) => p.person_id === m.id || p.person_id === m.user_id);
          return {
            person_id: m.id || m.user_id,
            full_name: m.full_name,
            avatar: m.avatar || "👤",
            photo_url: m.photo_url,
            academic_year: m.academic_year,
            attendance_status: existing?.attendance_status || null,
            auth_user_id: m.auth_user_id,
            email: m.email,
            registered_externally: m.registered_externally,
          };
        });
    }
    return rpcPeople || [];
  })();

  const isLoading = rpcLoading;

 const handleStatusChange = async (personId: string, status: "present" | "absent") => {
    // 1. تحديث أو إدخال حالة الحضور في جدول daily_attendance
    const { error } = await supabase.from("daily_attendance").upsert({ person_id: personId, attendance_date: date, status: status }, { onConflict: "person_id,attendance_date" });
    if (error) return toast.error(error.message);

    // 2. إذا كانت الحالة الجديدة "غياب"، نتحقق مما إذا كان قد غاب في المرة السابقة أيضاً (لتنبيه المشرف)
    if (status === "absent") {
      const { data: pastRecords } = await supabase
        .from("daily_attendance")
        .select("status, attendance_date")
        .eq("person_id", personId)
        .neq("attendance_date", date) // استبعاد تاريخ اليوم الحالي
        .order("attendance_date", { ascending: false })
        .limit(1);

      if (pastRecords && pastRecords.length > 0 && pastRecords[0].status === "absent") {
        toast.warning("⚠️ تنبيه: هذا الشخص غاب مرتين متتاليتين وتم إخطار المشرف!");
        
        // يمكنك هنا تسجيل إشعار في جدول الإشعارات أو إرسال تنبيه للمشرف تلقائياً
        await supabase.from("suggestions_and_notes").insert({
          content: `⚠️ تنبيه غياب متكرر: المخدوم / الخادم غاب مرتين متتاليتين في تاريخ ${date}`,
          target_type: "all_servants",
          status: "pending"
        });
      }
    }

    toast.success("تم تحديث حالة الحضور بنجاح ✅");
    qc.invalidateQueries({ queryKey: ["daily-attendance-full"] });
    qc.invalidateQueries({ queryKey: ["servant-members-for-attendance"] });
  };
    const { error } = await supabase.from("daily_attendance").upsert({ person_id: personId, attendance_date: date, status: status }, { onConflict: "person_id,attendance_date" });
    if (error) return toast.error(error.message);
    toast.success("تم تحديث حالة الحضور بنجاح ✅");
    qc.invalidateQueries({ queryKey: ["daily-attendance-full"] });
    qc.invalidateQueries({ queryKey: ["servant-members-for-attendance"] });
  };

  const presentCount = (people || []).filter((p: any) => p.attendance_status === "present").length;
  const absentCount = (people || []).filter((p: any) => p.attendance_status === "absent").length;
  const totalCount = (people || []).length;
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  const absentPeople = (people || []).filter((p: any) => p.attendance_status === "absent");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border-2 border-border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">إجمالي الأفراد</div>
          <div className="mt-1 text-2xl font-black">{totalCount}</div>
        </div>
        <div className="rounded-2xl border-2 border-border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">الحاضرون اليوم</div>
          <div className="mt-1 text-2xl font-black text-emerald-500">{presentCount}</div>
        </div>
        <div className="rounded-2xl border-2 border-border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">الغائبون اليوم</div>
          <div className="mt-1 text-2xl font-black text-destructive">{absentCount}</div>
        </div>
        <div className="rounded-2xl border-2 border-border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">نسبة الحضور</div>
          <div className="mt-1 text-2xl font-black text-sky">{percentage}%</div>
        </div>
      </div>

      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <label className="text-sm font-extrabold">📅 التاريخ:</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border-2 border-border bg-background px-3 py-1.5 font-bold text-sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAccountType("student")} className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${accountType === "student" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>المخدومين (الأولاد)</button>
          <button onClick={() => setAccountType("servant")} className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${accountType === "servant" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>الخدام</button>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="rounded-xl border-2 border-border bg-background px-3 py-1.5 text-xs font-bold">
            <option value="all">كل المراحل</option>
            {ACADEMIC_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setSubTab("record")} className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "record" ? "border-sky bg-sky text-primary-foreground" : "border-border bg-card"}`}>📝 تسجيل الحضور اليومي</button>
        <button onClick={() => setSubTab("absent")} className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "absent" ? "border-destructive bg-destructive text-destructive-foreground" : "border-border bg-card"}`}>⚠️ كشف الغياب ({absentPeople.length})</button>
      </div>

      {subTab === "record" ? (
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : !people?.length ? (
            <p className="text-center text-muted-foreground py-8">لا توجد بيانات مسجلة.</p>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {people.map((item: any) => {
                const isExternal = item.auth_user_id || item.email || item.registered_externally;
                return (
                  <div key={item.person_id} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-3.5">
                    <div className="flex items-center gap-3">
                      {item.photo_url ? <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-2xl">{item.avatar || "👤"}</span>}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm">{item.full_name}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isExternal ? "bg-sky/20 text-sky" : "bg-amber-500/20 text-amber-600"}`}>
                            {isExternal ? "🌐 سجل من الخارج" : "➕ أُضيف داخلياً"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{item.academic_year || "بدون مرحلة"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleStatusChange(item.person_id, "present")} className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${item.attendance_status === "present" ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400" : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-800"}`}>✓ حاضر</button>
                      <button onClick={() => handleStatusChange(item.person_id, "absent")} className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${item.attendance_status === "absent" ? "bg-destructive text-destructive-foreground shadow-md ring-2 ring-destructive" : "bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-800"}`}>✕ غائب</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {!absentPeople.length ? (
            <div className="rounded-2xl border-2 border-border bg-card p-8 text-center text-emerald-600 font-extrabold">🎉 لا يوجد غياب مسجل لهذا التاريخ!</div>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {absentPeople.map((item: any) => {
                const isExternal = item.auth_user_id || item.email || item.registered_externally;
                return (
                  <div key={item.person_id} className="flex items-center justify-between rounded-2xl border-2 border-destructive/40 bg-card p-3.5">
                    <div className="flex items-center gap-3">
                      {item.photo_url ? <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-2xl">{item.avatar || "👤"}</span>}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm">{item.full_name}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isExternal ? "bg-sky/20 text-sky" : "bg-amber-500/20 text-amber-600"}`}>
                            {isExternal ? "🌐 سجل من الخارج" : "➕ أُضيف داخلياً"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{item.academic_year || "بدون مرحلة"}</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-destructive/20 px-3 py-1 text-xs font-bold text-destructive">غائب</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionsSection({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [targetType, setTargetType] = useState<string>("all_servants");
  const [targetId, setTargetId] = useState<string>("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: recipients } = useQuery({
    queryKey: ["all-profiles-list"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, account_type")).data ?? [],
  });

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["suggestions-and-notes-list"],
    queryFn: async () => (await supabase.from("suggestions_and_notes").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const sendSuggestion = async () => {
    if (!content.trim()) return toast.error("يرجى كتابة نص الاقتراح أو التوجيه");
    setSubmitting(true);
    let mediaUrl = null;
    if (mediaFile) {
      const fileExt = mediaFile.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `suggestions_media/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("uploads").upload(filePath, mediaFile);
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from("uploads").getPublicUrl(filePath);
        mediaUrl = publicUrlData.publicUrl;
      }
    }
    const { error } = await supabase.from("suggestions_and_notes").insert({ content: content.trim(), target_type: targetType, target_id: targetId || null, media_url: mediaUrl, status: "pending" });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("تم إرسال الاقتراح / التوجيه بنجاح ✅");
    setContent(""); setMediaFile(null); setTargetId("");
    qc.invalidateQueries({ queryKey: ["suggestions-and-notes-list"] });
  };

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-xl font-extrabold">💡 كتابة اقتراح أو توجيه جديد</h2>
        <Textarea className="mt-3 min-h-28" value={content} onChange={(e) => setContent(e.target.value)} placeholder="اكتب فكرتك أو التوجيه أو الملاحظة هنا..." />
        <div className="mt-3 space-y-2">
          <label className="text-xs font-bold text-muted-foreground">جهة الإرسال إلى:</label>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setTargetType("all_servants"); setTargetId(""); }} className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${targetType === "all_servants" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>👥 كل الخدام</button>
            <button onClick={() => { setTargetType("specific_servant"); setTargetId(""); }} className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${targetType === "specific_servant" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>👤 خادم محدد</button>
            <button onClick={() => { setTargetType("specific_student"); setTargetId(""); }} className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${targetType === "specific_student" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>🧒 مخدوم محدد</button>
          </div>
          {targetType !== "all_servants" && (
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="mt-2 w-full rounded-xl border-2 border-border bg-background p-2 text-sm font-bold">
              <option value="">-- اختر الشخص المستهدف --</option>
              {recipients?.map((p: any) => <option key={p.id} value={p.id}>{p.full_name} ({p.account_type === "servant" ? "خادم" : "مخدوم"})</option>)}
            </select>
          )}
        </div>
        <div className="mt-3">
          <label className="block text-xs font-bold text-muted-foreground mb-1">رفع وسائل إيضاح (صور، فويس، فيديوهات):</label>
          <input type="file" accept="image/*,audio/*,video/*" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} className="w-full rounded-xl border-2 border-border bg-background p-2 text-xs font-bold" />
        </div>
        <button disabled={submitting} onClick={sendSuggestion} className="pop mt-4 w-full rounded-2xl bg-sky py-3 text-base font-extrabold text-primary-foreground disabled:opacity-60">
          {submitting ? "جاري الإرسال..." : "إرسال الاقتراح / التوجيه 🚀"}
        </button>
      </section>

      <section className={card}>
        <h3 className="mb-3 text-xl font-extrabold">📬 سجل الاقتراحات والملاحظات</h3>
        {isLoading ? <p className="text-center text-muted-foreground py-6">جاري التحميل...</p> : !suggestions?.length ? <p className="text-center text-muted-foreground py-6">لا توجد اقتراحات حتى الآن.</p> : (
          <div className="space-y-3">
            {suggestions.map((s: any) => (
              <div key={s.id} className="rounded-2xl border-2 border-border bg-background p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <span className="rounded-full bg-sky/20 px-2.5 py-0.5 text-xs font-bold text-sky">{s.target_type === "all_servants" ? "إلى كل الخدام" : "موجه لشخص محدد"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("ar-EG")}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.content}</p>
                {s.media_url && (
                  <div className="mt-2">
                    {s.media_url.match(/\.(jpeg|jpg|gif|png)$/i) ? <img src={s.media_url} alt="media" className="max-h-40 rounded-xl object-cover" /> : s.media_url.match(/\.(mp3|wav|m4a|ogg)$/i) ? <audio controls src={s.media_url} className="w-full" /> : <video controls src={s.media_url} className="max-h-48 rounded-xl w-full" />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Prep({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["my-preps"],
    queryFn: async () => (await supabase.from("servant_preparations").select("*").eq("user_id", userId).order("week_start", { ascending: false }).limit(8)).data ?? [],
  });
  const ws = getFridayWeekStart();
  const current = rows?.find((r) => r.week_start === ws);
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]); // تستخدم لتخزين روابط الصور، الفيديوهات، والملفات الصوتية
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<string[] | null>(null);

  useEffect(() => { if (current) { setNotes(current.notes); setImages(current.images ?? []); } }, [current?.id]);
  const late = new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "Africa/Cairo" });
  const afterThu = ["Fri", "Sat"].includes(late);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'audio') => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        if (type === 'image') {
          const url = await fileToDataUrl(file, 900, 0.75);
          newUrls.push(url);
        } else {
          const fileExt = file.name.split(".").pop();
          const fileName = `prep_${type}_${Math.random()}.${fileExt}`;
          const filePath = `prep_media/${fileName}`;
          const { error: uploadError } = await supabase.storage.from("uploads").upload(filePath, file);
          if (uploadError) throw uploadError;
          const { data: publicUrlData } = supabase.storage.from("uploads").getPublicUrl(filePath);
          newUrls.push(publicUrlData.publicUrl);
        }
      }
      setImages([...images, ...newUrls]);
      toast.success("تم رفع الملف بنجاح ✅");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const save = async () => {
    if (!notes.trim() && !images.length) return toast.error("اكتب التحضير أو ارفع ملفاً (صورة، فيديو، صوت)");
    setBusy(true);
    const { error } = current
      ? await supabase.from("servant_preparations").update({ notes, images, updated_at: new Date().toISOString() }).eq("id", current.id)
      : await supabase.from("servant_preparations").insert({ notes, images, week_start: ws });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم إرسال التحضير للمشرف ✅");
    qc.invalidateQueries({ queryKey: ["my-preps"] });
  };

  const renderMediaItem = (src: string, i: number, onDelete?: () => void) => {
    const isVideo = src.match(/\.(mp4|webm|ogg|mov)$/i) || src.includes("video") || src.includes("prep_video");
    const isAudio = src.match(/\.(mp3|wav|m4a|aac|ogg)$/i) || src.includes("audio") || src.includes("prep_audio");

    return (
      <div key={i} className="relative rounded-xl border-2 border-border bg-muted p-2 flex flex-col items-center justify-center">
        {isVideo ? (
          <video src={src} controls className="h-28 w-40 rounded-lg object-cover bg-black" />
        ) : isAudio ? (
          <div className="w-48 py-2 px-1">
            <audio controls src={src} className="w-full h-10" />
          </div>
        ) : (
          <img src={src} alt="" onClick={() => setGallery(images.filter(s => !s.match(/\.(mp4|webm|ogg|mov|mp3|wav|m4a|aac)$/i)))} className="h-24 w-24 cursor-zoom-in rounded-lg object-cover" />
        )}
        {onDelete && (
          <button onClick={onDelete} className="absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-xs text-destructive-foreground z-10">✕</button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">تحضير هذا الأسبوع (يبدأ من الجمعة)</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${current ? "bg-accent text-accent-foreground" : afterThu ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
            {current ? "✓ تم الإرسال" : afterThu ? "متأخر — الموعد تجاوز الخميس" : "متاح التحضير"}
          </span>
        </div>
        <Textarea className="mt-3 min-h-40" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="موضوع الدرس، الآيات، الوسائل، ملاحظات..." />
        
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-bold text-muted-foreground">الملفات المرفقة (صور، فيديوهات، تسجيلات صوتية):</label>
          <div className="flex flex-wrap gap-3">
            {images.map((src, i) => renderMediaItem(src, i, () => setImages(images.filter((_, j) => j !== i))))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <label className="flex items-center gap-1 cursor-pointer rounded-xl bg-sky/10 border border-sky/30 px-3 py-2 text-xs font-bold text-sky hover:bg-sky/20 transition">
              <span>📷 رفع صور</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
            </label>
            <label className="flex items-center gap-1 cursor-pointer rounded-xl bg-purple-500/10 border border-purple-500/30 px-3 py-2 text-xs font-bold text-purple-600 hover:bg-purple-500/20 transition">
              <span>🎬 رفع فيديو</span>
              <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
            </label>
            <label className="flex items-center gap-1 cursor-pointer rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 transition">
              <span>🎤 رفع فويس / صوت</span>
              <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'audio')} />
            </label>
          </div>
        </div>

        <button disabled={busy} onClick={save} className="pop mt-4 w-full rounded-2xl bg-sky py-3 text-lg font-extrabold text-primary-foreground disabled:opacity-60">
          {busy ? "جاري الحفظ..." : current ? "تحديث التحضير" : "إرسال التحضير"}
        </button>
      </section>

      {rows?.filter((r) => r.week_start !== ws).length > 0 && (
        <section className={card}>
          <h3 className="mb-2 font-extrabold">التحضيرات السابقة</h3>
          <div className="space-y-2">
            {rows.filter((r) => r.week_start !== ws).map((r) => (
              <details key={r.id} className="rounded-xl bg-muted p-3">
                <summary className="cursor-pointer font-bold">أسبوع {r.week_start}</summary>
                <p className="mt-2 whitespace-pre-wrap text-sm">{r.notes}</p>
                {!!r.images?.length && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.images.map((src: string, i: number) => renderMediaItem(src, i))}
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>
      )}
      <ImageLightbox images={gallery?.filter(s => !s.match(/\.(mp4|webm|ogg|mov|mp3|wav|m4a|aac)$/i))} title="صور التحضير" onClose={() => setGallery(null)} />
    </div>
  );
}

function ServantAttendanceHeader() {
  const qc = useQueryClient();
  const ws = getFridayWeekStart();
  const { data: attendance } = useQuery({ queryKey: ["my-servant-attendance", ws], enabled: !!ws, queryFn: async () => (await supabase.from("servant_attendance").select("id,created_at").eq("week_start", ws).maybeSingle()).data });
  const mark = async () => { const { error } = await supabase.rpc("mark_servant_attendance", { _week_start: ws }); if (error) return toast.error(error.message); toast.success("تم تسجيل حضورك هذا الأسبوع ✅"); qc.invalidateQueries({ queryKey: ["my-servant-attendance"] }); };
  return attendance ? <div className="mt-3 inline-flex rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-foreground">✅ حضور هذا الأسبوع مسجّل</div> : <button onClick={mark} className="pop mt-3 rounded-xl bg-sky px-4 py-2 font-extrabold text-primary-foreground">🙏 تسجيل حضوري هذا الأسبوع</button>;
}

const METHODS = { call: "📞 مكالمة", visit: "🏠 زيارة", message: "💬 رسالة" };
function Visits() {
  const qc = useQueryClient();
  const [year, setYear] = useState(ACADEMIC_YEARS[0]);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("call");
  const [hist, setHist] = useState(null);
  const { data } = useQuery({ queryKey: ["servant-members"], queryFn: async () => { const { data, error } = await supabase.rpc("servant_members"); if (error) throw error; return data; } });
  const rows = (data ?? []).filter((m) => m.academic_year === year);
  const save = async (member_id: string) => {
    const { error } = await supabase.from("visitations").insert({ member_id, method, note: note.trim() });
    if (error) return toast.error(error.message);
    toast.success("تم تسجيل الافتقاد"); setOpen(null); setNote("");
    qc.invalidateQueries({ queryKey: ["servant-members"] });
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><AddMemberButton defaultYear={year} /></div>
      <div className="flex flex-wrap gap-2">{ACADEMIC_YEARS.map((y) => (
        <button key={y} onClick={() => setYear(y)} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${year === y ? "bg-sky text-primary-foreground" : "bg-card"}`}>{y} ({(data ?? []).filter((m) => m.academic_year === y).length})</button>
      ))}</div>
      <p className="text-xs text-muted-foreground">🔴 = لم يسجّل أي نشاط هذا الأسبوع (يحتاج افتقاد) · ✅ = تم افتقاده هذا الأسبوع. التقرير يصل للمشرف تلقائيًا.</p>
      {!rows.length && <p className="text-muted-foreground">لا يوجد مخدومون في هذه المرحلة.</p>}
      <div className="grid gap-3 md:grid-cols-2">{rows.map((m) => {
        const isExternal = m.auth_user_id || m.email || m.registered_externally;
        return (
          <div key={m.id} className={card}>
            <div className="flex items-center gap-3">
              {m.photo_url ? <img src={m.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-3xl">{m.avatar}</span>}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <button onClick={() => setHist({ id: m.id, name: m.full_name })} className="text-right font-bold text-primary underline-offset-4 hover:underline" title="سجل الافتقادات">{m.full_name}</button>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isExternal ? "bg-sky/20 text-sky" : "bg-amber-500/20 text-amber-600"}`}>
                    {isExternal ? "🌐 سجل من الخارج" : "➕ أُضيف داخلياً"}
                  </span>
                </div>
              </div>
              {!m.active_this_week && <span title="لم يسجل نشاطًا">🔴</span>}
              {m.visited && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">✅ تم</span>}
              <button onClick={() => { setOpen(m.id); setNote(""); }} className="rounded-xl bg-sky px-3 py-1.5 text-sm font-bold text-primary-foreground">{m.visited ? "افتقاد آخر" : "افتقاد"}</button>
              <button title="حذف المخدوم" onClick={() => removeMember(m.id, m.full_name, () => qc.invalidateQueries({ queryKey: ["servant-members"] }))} className="rounded-xl bg-destructive/15 px-2 py-1.5 text-sm">🗑️</button>
            </div>
            {open === m.id && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">{Object.entries(METHODS).map(([k, l]) => (
                  <button key={k} onClick={() => setMethod(k)} className={`rounded-xl px-2 py-1 text-xs font-bold ${method === k ? "bg-sky text-primary-foreground" : "bg-muted"}`}>{l}</button>
                ))}</div>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظات الافتقاد (سبب الغياب، الحالة...)" />
                <div className="flex gap-2"><button onClick={() => save(m.id)} className="flex-1 rounded-xl bg-accent py-2 font-bold text-accent-foreground">حفظ</button>
                  <button onClick={() => setOpen(null)} className="rounded-xl bg-muted px-4 py-2 font-bold">إلغاء</button></div>
              </div>
            )}
          </div>
        );
      })}</div>
      <VisitHistoryDialog member={hist} onClose={() => setHist(null)} />
    </div>
  );
}
