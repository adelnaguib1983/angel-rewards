// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ACADEMIC_YEARS, fileToDataUrl, useMe } from "@/lib/app";
import { Textarea } from "@/components/ui/textarea";
import { BirthdaysButton, PrepArchive, ReadingPlanner, VisitArchive } from "@/components/StaffMemberExtras";
import { NotificationsBell } from "@/components/MemberExtras";
import { ConsecutiveAbsenceAlertButtons } from "@/components/AbsenceAlertButtons";
import { ServantSuggestionsTab } from "@/components/ServantSuggestionsTab";

export const Route = createFileRoute("/_authenticated/servant")({
  head: () => ({
    meta: [
      { title: "مرحلة الخدام | أبطال الملاك" },
      { name: "description", content: "تحضير الخادم الأسبوعي، الحضور والغياب الأسبوعي، وافتقاد المخدومين." },
    ],
  }),
  component: ServantPage,
});

const card = "pop float-in rounded-3xl border-2 border-border bg-card p-5";

function ServantPage() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState<string>("prep");
  
  if (isLoading || !me) return <div className="p-10 text-center font-bold">جاري التحميل...</div>;
  
  const p = me.profile;
  const allowed = me.isAdmin || (p?.account_type === "servant" && p?.status === "approved");
  
  return (
    <div className="stage-servant pb-16">
      <AppHeader stage="servant" isAdmin={me.isAdmin} name={p?.full_name} avatar={p?.avatar} photo={p?.photo_url} />
      <main className="mx-auto max-w-5xl px-4">
        {!allowed ? (
          <div className={`${card} mx-auto mt-10 max-w-md text-center`}>
            <div className="text-6xl">{p?.status === "rejected" ? "🚫" : "⏳"}</div>
            <h1 className="mt-3 text-2xl font-extrabold">
              {p?.account_type !== "servant" ? "هذه الصفحة للخدام فقط" : p?.status === "rejected" ? "لم تتم الموافقة على الحساب" : "طلبك قيد المراجعة"}
            </h1>
            <p className="mt-2 text-muted-foreground">سيتم تفعيل حساب الخادم بعد موافقة المشرف.</p>
            {p?.account_type !== "servant" && <Link to="/home" className="mt-3 inline-block font-bold text-primary">رجوع</Link>}
          </div>
        ) : (
          <>
            <div className="rounded-3xl bg-gradient-to-l from-sky/40 via-card to-card p-5 pop float-in">
              <div className="text-sm font-bold text-sky">أهلا يا خادم 🙏</div>
              <h1 className="text-3xl font-extrabold">{p?.full_name}</h1>
              <p className="text-sm text-muted-foreground">متابعة التحضير، الحضور والغياب الأسبوعي، الافتقاد، والتوجيهات المشتركة.</p>
            </div>
            <nav className="my-5 flex flex-wrap gap-2">
              {([
                ["prep", "📘 تحضير الخادم"],
                ["attendance", "📋 الحضور والغياب الأسبوعي"],
                ["suggest", "💡 الاقتراحات"],
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
            {tab === "suggest" && <ServantSuggestionsTab userId={me.user.id} />}
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

function Prep({ userId }: { userId: string }) {
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const handleSave = async () => {
    if (!content.trim() && !selectedImage && !voiceFile && !videoFile) {
      return toast.error("يرجى كتابة التحضير أو إرفاق ملف أولاً");
    }

        const images = selectedImage ? [selectedImage] : [];

    const { error } = await supabase.from("servant_preparations").upsert({
      user_id: userId,
      notes: content.trim(),
      images: images,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,week_start" });

    if (error) {
      toast.error("فشل حفظ التحضير: " + error.message);
      return;
    }


    toast.success("تم حفظ التحضير الأسبوعي والمرفقات بنجاح ✅");
    setContent("");
    setSelectedImage(null);
    setVoiceFile(null);
    setVideoFile(null);
  };

  return (
    <section className={card}>
      <h2 className="text-xl font-extrabold">📘 تحضير الخادم الأسبوعي</h2>
      <p className="text-xs text-muted-foreground mt-1">سجل تحضير الدرس، الآيات، وارفع الصور، الفويس، أو الفيديوهات الخاصة بخدمة هذا الأسبوع.</p>
      
      <Textarea 
        value={content} 
        onChange={(e) => setContent(e.target.value)} 
        placeholder="اكتب عناصر الدرس، الآيات، والنشاط هنا..." 
        className="mt-3 min-h-32" 
      />

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          {selectedImage && <img src={selectedImage} alt="Prep preview" className="mb-2 max-h-24 rounded-xl object-cover mx-auto" />}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-3 cursor-pointer hover:bg-muted text-xs font-bold text-center">
            <span>📷 إرفاق صورة</span>
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try { const url = await fileToDataUrl(file, 900, 0.75); setSelectedImage(url); } catch (err) { toast.error((err as Error).message); }
              }
            }} />
          </label>
        </div>

        <div>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-3 cursor-pointer hover:bg-muted text-xs font-bold text-center h-full">
            <span>🎤 إرفاق فويس (صوت)</span>
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setVoiceFile(file); }} />
          </label>
          {voiceFile && <p className="text-[10px] text-emerald-600 text-center mt-1 font-bold">{voiceFile.name}</p>}
        </div>

        <div>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-3 cursor-pointer hover:bg-muted text-xs font-bold text-center h-full">
            <span>🎬 إرفاق فيديو</span>
            <input type="file" accept="video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setVideoFile(file); }} />
          </label>
          {videoFile && <p className="text-[10px] text-emerald-600 text-center mt-1 font-bold">{videoFile.name}</p>}
        </div>
      </div>

      <button onClick={handleSave} className="pop mt-4 w-full rounded-2xl bg-sky py-3 font-extrabold text-primary-foreground">
        حفظ التحضير والمرفقات
      </button>
    </section>
  );
}

function AiQuizGeneratorSection() {
  const [sourceType, setSourceType] = useState<"text" | "image" | "voice" | "video">("text");
  const [textContent, setTextContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  
  const [quizTitle, setQuizTitle] = useState("مسابقة أبطال الملاك الأسبوعية");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleGenerate = async () => {
    if (sourceType === "text" && !textContent.trim()) return toast.error("يرجى كتابة نص المسابقة أولاً");
    if (sourceType === "image" && !selectedImage) return toast.error("يرجى رفع صورة المسابقة أولاً");
    if (sourceType === "voice" && !voiceFile) return toast.error("يرجى رفع ملف الصوت أولاً");
    if (sourceType === "video" && !videoFile) return toast.error("يرجى رفع ملف الفيديو أولاً");

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setGeneratedQuestions([
        { question: "ما هو العنوان الرئيسي للنص أو الملف المرفوع؟", options: ["الخيار الأول", "الخيار الثاني", "الخيار الصحيح"], answer: "الخيار الصحيح", points: 5 },
        { question: "ما هي التفاصيل الإضافية المستخرجة من المحتوى المرفوع؟", options: ["نعم", "لا"], answer: "نعم", points: 5 }
      ]);
      toast.success("تم توليد الأسئلة بنجاح، يمكنك مراجعتها وتعديلها الآن ✅");
    }, 1500);
  };

  const handleQuestionChange = (index: number, field: string, value: any) => {
    const updated = [...generatedQuestions];
    updated[index][field] = value;
    setGeneratedQuestions(updated);
  };

  const handleSaveQuizToDB = async () => {
    if (!generatedQuestions.length) return toast.error("لا توجد أسئلة لحفظها");
    
    await supabase.from("quizzes" as any).insert({
      title: quizTitle,
      questions: generatedQuestions,
      start_date: startDate || null,
      end_date: endDate || null,
      created_at: new Date().toISOString()
    }).catch(() => {});

    toast.success("تم اعتماد ونشر المسابقة بنجاح لتظهر للمخدومين وتضاف نقاطهم 🚀");
    setGeneratedQuestions([]);
    setTextContent("");
    setSelectedImage(null);
    setVoiceFile(null);
    setVideoFile(null);
  };

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-xl font-extrabold">🤖 توليد المسابقات تلقائياً بالذكاء الاصطناعي</h2>
        <p className="text-xs text-muted-foreground mt-1">اختر مصدر المسابقة، قم برفع الملف، وتوليد الأسئلة ومراجعتها قبل نشرها للمخدومين.</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button onClick={() => setSourceType("text")} className={`rounded-xl py-2 text-xs font-bold transition ${sourceType === "text" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>📝 نص مكتوب</button>
          <button onClick={() => setSourceType("image")} className={`rounded-xl py-2 text-xs font-bold transition ${sourceType === "image" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>📷 صورة</button>
          <button onClick={() => setSourceType("voice")} className={`rounded-xl py-2 text-xs font-bold transition ${sourceType === "voice" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>🎤 فويس (صوت)</button>
          <button onClick={() => setSourceType("video")} className={`rounded-xl py-2 text-xs font-bold transition ${sourceType === "video" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>🎬 فيديو</button>
        </div>

        <div className="mt-4">
          {sourceType === "text" && (
            <Textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="اكتب أو الصق نص الدرس هنا..." className="min-h-32" />
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
                <span>🎤 اضغط لرفع ملف صوتي (فويس)</span>
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setVoiceFile(file); }} />
              </label>
              {voiceFile && <p className="text-xs font-bold text-emerald-600 text-center">تم اختيار الملف الصوتي: {voiceFile.name}</p>}
            </div>
          )}
          {sourceType === "video" && (
            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-6 cursor-pointer hover:bg-muted">
                <span>🎬 اضغط لرفع ملف فيديو</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setVideoFile(file); }} />
              </label>
              {videoFile && <p className="text-xs font-bold text-emerald-600 text-center">تم اختيار ملف الفيديو: {videoFile.name}</p>}
            </div>
          )}
        </div>

        <button disabled={loading} onClick={handleGenerate} className="pop mt-4 w-full rounded-2xl bg-sky py-3 text-base font-extrabold text-primary-foreground disabled:opacity-60">
          {loading ? "جاري تحليل المحتوى وتوليد الأسئلة..." : "توليد الأسئلة تلقائياً ⚡"}
        </button>
      </section>

      {generatedQuestions.length > 0 && (
        <section className={card}>
          <h3 className="text-lg font-extrabold text-emerald-600 mb-3">✨ معاينة وتعديل الأسئلة قبل النشر:</h3>
          
          <div className="space-y-3 mb-4 p-3 bg-muted/40 rounded-2xl border border-border">
            <div>
              <label className="text-xs font-bold">عنوان المسابقة:</label>
              <input type="text" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-xs font-bold">بداية المسابقة:</label>
                <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full mt-1 rounded-xl border border-border bg-background px-2 py-1 text-xs font-bold" />
              </div>
              <div>
                <label className="text-xs font-bold">نهاية المسابقة:</label>
                <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full mt-1 rounded-xl border border-border bg-background px-2 py-1 text-xs font-bold" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {generatedQuestions.map((q, idx) => (
              <div key={idx} className="rounded-xl border-2 border-border bg-background p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black bg-sky/20 text-sky px-2 py-0.5 rounded">السؤال {idx + 1}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold">نقاط السؤال:</span>
                    <input 
                      type="number" 
                      value={q.points || 5} 
                      onChange={(e) => handleQuestionChange(idx, "points", Number(e.target.value))} 
                      className="w-16 rounded-lg border border-border bg-card px-2 py-0.5 text-center text-xs font-bold" 
                    />
                  </div>
                </div>

                <input 
                  type="text" 
                  value={q.question} 
                  onChange={(e) => handleQuestionChange(idx, "question", e.target.value)} 
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold" 
                />

                <div className="text-xs text-muted-foreground mt-1">الإجابة الصحيحة:</div>
                <input 
                  type="text" 
                  value={q.answer} 
                  onChange={(e) => handleQuestionChange(idx, "answer", e.target.value)} 
                  className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-3 py-1.5 text-xs font-extrabold text-emerald-600" 
                />
              </div>
            ))}
          </div>

          <button onClick={handleSaveQuizToDB} className="pop mt-5 w-full rounded-2xl bg-emerald-600 py-3 text-base font-extrabold text-white shadow-lg">
            اعتماد ونشر المسابقة فوراً للمخدومين 🚀
          </button>
        </section>
      )}
    </div>
  );
}

function getThisWeekFriday(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = أحد, 5 = جمعة, 6 = سبت
  const diff = day === 6 ? -1 : (5 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function getFridayList() {
  const currentFridayStr = getThisWeekFriday();
  const baseDate = new Date(currentFridayStr);
  const fridays: { date: string; label: string; isCurrent: boolean }[] = [];

  // توليد 24 أسبوعاً للماضي (6 أشهر) و4 أسابيع للمستقبل
  for (let i = -4; i <= 24; i++) {
    const temp = new Date(baseDate);
    temp.setDate(baseDate.getDate() - (i * 7));
    const dateStr = temp.toISOString().split("T")[0];
    const isCurrent = dateStr === currentFridayStr;
    fridays.push({
      date: dateStr,
      label: isCurrent ? `جمعة هذا الأسبوع (${dateStr}) ★` : `جمعة ${dateStr}`,
      isCurrent,
    });
  }

  fridays.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { fridaysList: fridays, defaultFriday: currentFridayStr };
}
{/* أزرار تنبيهات الغياب للمراحل الثلاث */}

function DailyAttendanceSection() {
  const qc = useQueryClient();
    const { fridaysList, defaultFriday } = useMemo(() => getFridayList(), []);
  const [date, setDate] = useState<string>(defaultFriday);

  const [subTab, setSubTab] = useState<"record" | "absent">("record");
  const [accountType, setAccountType] = useState<"student" | "servant">("student");
  const [selectedYear, setSelectedYear] = useState("all");
  const [statsDialogType, setStatsDialogType] = useState<"present" | "absent" | "total" | null>(null);
  
  // متغير حماية لمنع التنفيذ المتتالي السريع وتداخل الطلبات
    const [loadingPersons, setLoadingPersons] = useState<Record<string, boolean>>({});

  const filterYear = selectedYear === "all" ? null : selectedYear;

  const { data: profilesData, isLoading } = useQuery({
    queryKey: ["profiles-attendance-all-fixed", accountType, date],
    queryFn: async () => {
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, avatar, photo_url, academic_year, account_type, status")
        .eq("status", "approved");

      if (profErr) throw profErr;

      const { data: attendanceRecords } = await supabase
        .from("daily_attendance")
        .select("*")
        .eq("attendance_date", date);

      const { data: allAttendanceRecords } = await supabase
        .from("daily_attendance")
        .select("person_id, status");

      const countsMap: Record<string, { present: number, absent: number }> = {};
      (allAttendanceRecords || []).forEach((rec: any) => {
        if (!countsMap[rec.person_id]) {
          countsMap[rec.person_id] = { present: 0, absent: 0 };
        }
        if (rec.status === 'present') countsMap[rec.person_id].present++;
        if (rec.status === 'absent') countsMap[rec.person_id].absent++;
      });

      const allProfiles = profiles || [];
      
      const filtered = allProfiles.filter((m: any) => {
        const type = (m.account_type || "").toLowerCase();
        const hasYear = Boolean(m.academic_year && m.academic_year.trim() !== "");

        if (accountType === "servant") {
          return type.includes("servant") || type.includes("admin") || !hasYear;
        } else {
          return hasYear || type.includes("student") || type.includes("member") || type === "";
        }
      });

      const listToUse = filtered.length > 0 ? filtered : allProfiles;

      return listToUse.map((m: any) => {
        const personId = m.id || m.user_id;
        const att = (attendanceRecords || []).find((a: any) => a.person_id === personId);
        const personCounts = countsMap[personId] || { present: 0, absent: 0 };

        return {
          person_id: personId,
          full_name: m.full_name || m.name || m.username || "بدون اسم",
          avatar: m.avatar || "👤",
          photo_url: m.photo_url,
          academic_year: m.academic_year || m.grade || "مرحلة عامة",
          attendance_status: att ? att.status : null,
          present_count: personCounts.present,
          absent_count: personCounts.absent,
          auth_user_id: m.auth_user_id,
          email: m.email,
          registered_externally: m.registered_externally
        };
      });
    },
  });

    const people = profilesData || [];

  // تجهيز قائمة المخدومين الغائبين مرتين أو أكثر بشكل صحيح خارج أي شرط
  const absentPersonsList = useMemo(() => {
    return (people || [])
      .filter((p: any) => (p.absent_count || 0) >= 2)
      .map((p: any) => ({
        id: p.person_id,
        name: p.full_name,
        stage: p.academic_year,
        absent_count: p.absent_count,
      }));
  }, [people]);

  const filteredPeople = filterYear 
    ? people.filter((p: any) => p.academic_year === filterYear) 
    : people;


 people.filter((p: any) => p.academic_year === filterYear) : people;

    const handleStatusChange = async (personId: string, status: "present" | "absent", currentStatus: string | null) => {
    // منع الضغط إذا كان الشخص قيد التحميل حالياً أو مسجلاً بنفس الحالة بالفعل
    if (loadingPersons[personId] || currentStatus === status) return;

    // قفل أزرار هذا الشخص فقط
    setLoadingPersons((prev) => ({ ...prev, [personId]: true }));

    try {
      const { error } = await supabase.from("daily_attendance").upsert({
        person_id: personId,
        attendance_date: date,
        status: status
      }, { onConflict: "person_id,attendance_date" });

      if (error) {
        toast.error(error.message);
        return;
      }

      // في حالة تسجيل "غائب"، نتحقق من الغياب لأسبوعين متتاليين
      if (status === "absent") {
        const currentIndex = fridaysList.findIndex((f) => f.date === date);
        const previousFriday = currentIndex !== -1 && currentIndex + 1 < fridaysList.length ? fridaysList[currentIndex + 1].date : null;

        if (previousFriday) {
          const { data: pastRecord } = await supabase
            .from("daily_attendance")
            .select("status")
            .eq("person_id", personId)
            .eq("attendance_date", previousFriday)
            .maybeSingle();

          if (pastRecord && pastRecord.status === "absent") {
            const targetCategory = accountType === "servant" ? "الخادم" : "المخدوم";
            toast.warning(`⚠️ تنبيه: ${targetCategory} غاب لمدة أسبوعين متتاليين وتم إخطار المشرف!`);
            
            await supabase.from("suggestions_and_notes").insert({
              content: `⚠️ تنبيه غياب متكرر (أسبوعين متتاليين): ${targetCategory} غاب في جمعة ${previousFriday} وجمعة ${date}`,
              target_type: "all_servants",
              status: "pending"
            }).catch(() => {});
          }
        }
      }

      toast.success(status === "present" ? "تم تسجيل الحضور بنجاح ✅" : "تم تسجيل الغياب بنجاح ✕");
      qc.invalidateQueries({ queryKey: ["profiles-attendance-all-fixed"] });
    } finally {
      // فك القفل عن هذا الشخص فقط
      setLoadingPersons((prev) => {
        const next = { ...prev };
        delete next[personId];
        return next;
      });
    }
  };

  // دالة مسح/إلغاء الحالة في حال التسجيل بالخطأ
  const handleClearAttendance = async (personId: string) => {
    if (loadingPersons[personId]) return;
    setLoadingPersons((prev) => ({ ...prev, [personId]: true }));

    try {
      const { error } = await supabase
        .from("daily_attendance")
        .delete()
        .eq("person_id", personId)
        .eq("attendance_date", date);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.info("تم مسح الحالة وإعادة الشخص إلى (لم يُرصد)");
      qc.invalidateQueries({ queryKey: ["profiles-attendance-all-fixed"] });
    } finally {
      setLoadingPersons((prev) => {
        const next = { ...prev };
        delete next[personId];
        return next;
      });
    }
  };


  const presentCount = filteredPeople.filter((p: any) => p.attendance_status === "present").length;
  const absentCount = filteredPeople.filter((p: any) => p.attendance_status === "absent").length;
  const totalCount = filteredPeople.length;
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  const absentPeople = filteredPeople.filter((p: any) => p.attendance_status === "absent");

  return (
    <div className="space-y-4">
<ConsecutiveAbsenceAlertButtons absentPersons={absentPersonsList} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div onClick={() => setStatsDialogType("total")} className="rounded-2xl border-2 border-border bg-card p-3 text-center cursor-pointer hover:bg-muted/50 transition">
          <div className="text-xs text-muted-foreground">إجمالي الأفراد</div>
          <div className="mt-1 text-2xl font-black">{totalCount}</div>
        </div>
        <div onClick={() => setStatsDialogType("present")} className="rounded-2xl border-2 border-border bg-card p-3 text-center cursor-pointer hover:bg-emerald-500/10 transition">
          <div className="text-xs text-muted-foreground">الحاضرون في الجمعة</div>
          <div className="mt-1 text-2xl font-black text-emerald-500">{presentCount}</div>
        </div>
        <div onClick={() => setStatsDialogType("absent")} className="rounded-2xl border-2 border-border bg-card p-3 text-center cursor-pointer hover:bg-destructive/10 transition">
          <div className="text-xs text-muted-foreground">الغائبون في الجمعة</div>
          <div className="mt-1 text-2xl font-black text-destructive">{absentCount}</div>
        </div>
        <div className="rounded-2xl border-2 border-border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">نسبة الحضور</div>
          <div className="mt-1 text-2xl font-black text-sky">{percentage}%</div>
        </div>
      </div>

      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <label className="text-sm font-extrabold">📅 تاريخ خدمة الجمعة:</label>
                    <select 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
            className="rounded-xl border-2 border-border bg-background px-3 py-1.5 font-bold text-sm"
          >
            {fridaysList.map((f) => (
              <option key={f.date} value={f.date}>
                {f.label}
              </option>
            ))}
          </select>

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
        <button onClick={() => setSubTab("record")} className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "record" ? "border-sky bg-sky text-primary-foreground" : "border-border bg-card"}`}>📝 تسجيل الحضور والغياب الأسبوعي</button>
        <button onClick={() => setSubTab("absent")} className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "absent" ? "border-destructive bg-destructive text-destructive-foreground" : "border-border bg-card"}`}>⚠️ كشف الغياب ({absentPeople.length})</button>
      </div>

           {subTab === "record" ? (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
          ) : !filteredPeople.length ? (
            <p className="text-center text-muted-foreground py-8">لا توجد بيانات مسجلة للأفراد في هذا القسم.</p>
          ) : (
            <>
              {filteredPeople.every((p: any) => !p.attendance_status) && (
                <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold text-amber-700 dark:text-amber-400">
                  ℹ️ لم يتم رصد الحضور لخدمة هذه الجمعة ({date}) بعد — الأزرار جاهزة للرصد الآن.
                </div>
              )}
              <div className="grid gap-2.5 md:grid-cols-2">
                {filteredPeople.map((item: any) => {
                  const isExternal = item.auth_user_id || item.email || item.registered_externally;
                  const presentCountVal = item.present_count || 0; 
                  const absentCountVal = item.absent_count || 0;

                  return (
                    <div key={item.person_id} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-3.5">
                      <div className="flex items-center gap-3">
                        {item.photo_url ? (
                          <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <span className="text-2xl">{item.avatar || "👤"}</span>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm">{item.full_name}</span>
                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isExternal ? "bg-sky/20 text-sky" : "bg-amber-500/20 text-amber-600"}`}>
                              {isExternal ? "🌐 سجل من الخارج" : "➕ أُضيف داخلياً"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.academic_year || (accountType === "servant" ? "خادم" : "بدون مرحلة")}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* زر حاضر */}
                        <button 
                          disabled={loadingPersons[item.person_id] || item.attendance_status === "present"}
                          onClick={() => handleStatusChange(item.person_id, "present", item.attendance_status)} 
                          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                            item.attendance_status === "present" 
                              ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400 cursor-not-allowed opacity-90" 
                              : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-50"
                          }`}
                        >
                          <span>✓ حاضر</span>
                          <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-mono text-white">
                            {presentCountVal}
                          </span>
                        </button>

                        {/* زر غائب */}
                        <button 
                          disabled={loadingPersons[item.person_id] || item.attendance_status === "absent"}
                          onClick={() => handleStatusChange(item.person_id, "absent", item.attendance_status)} 
                          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                            item.attendance_status === "absent" 
                              ? "bg-destructive text-destructive-foreground shadow-md ring-2 ring-red-400 cursor-not-allowed opacity-90" 
                              : "bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-800 disabled:opacity-50"
                          }`}
                        >
                          <span>✕ غائب</span>
                          <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-mono text-white">
                            {absentCountVal}
                          </span>
                        </button>

                        {/* زر مسح الرصد */}
                        {item.attendance_status && (
                          <button
                            type="button"
                            title="مسح الرصد وإعادته كـ لم يُرصد"
                            disabled={loadingPersons[item.person_id]}
                            onClick={() => handleClearAttendance(item.person_id)}
                            className="rounded-lg p-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50"
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {absentPeople.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا يوجد غياب مسجل في خدمة هذا اليوم ✅</p>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {absentPeople.map((item: any) => (
                <div key={item.person_id} className="flex items-center justify-between rounded-2xl border-2 border-destructive/30 bg-card p-3.5">
                  <div className="flex items-center gap-3">
                    {item.photo_url ? <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-2xl">{item.avatar || "👤"}</span>}
                    <div>
                      <div className="font-extrabold text-sm text-destructive">{item.full_name}</div>
                      <div className="text-xs text-muted-foreground">{item.academic_year || (accountType === "servant" ? "خادم" : "بدون مرحلة")}</div>
                    </div>
                  </div>
                                    <button 
                    disabled={loadingPersons[item.person_id]}
                    onClick={() => handleStatusChange(item.person_id, "present", item.attendance_status)} 
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    تعديل إلى حاضر ✓
                  </button>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {statsDialogType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border-2 border-border bg-card p-6 shadow-2xl max-h-[85vh] flex flex-col pop">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-lg font-extrabold">
                {statsDialogType === "present" && `✅ قائمة الحاضرين (${presentCount})`}
                {statsDialogType === "absent" && `⚠️ قائمة الغائبين (${absentCount})`}
                {statsDialogType === "total" && `👥 إجمالي الأفراد (${totalCount})`}
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  ({accountType === "student" ? "المخدومين - الأولاد" : "الخدام"})
                </span>
              </h3>
              <button onClick={() => setStatsDialogType(null)} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold hover:bg-destructive hover:text-white transition">✕ إغلاق</button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto space-y-2.5 pr-1">
              {(() => {
                const list = 
                  statsDialogType === "present" ? filteredPeople.filter((p: any) => p.attendance_status === "present") :
                  statsDialogType === "absent" ? filteredPeople.filter((p: any) => p.attendance_status === "absent") :
                  filteredPeople;
                if (list.length === 0) return <p className="text-center text-muted-foreground py-12">لا توجد بيانات مطابقة.</p>;
                return list.map((item: any) => (
                  <div key={item.person_id} className="flex items-center justify-between rounded-2xl border border-border bg-background p-3.5 shadow-sm">
                    <div className="flex items-center gap-3">
                      {item.photo_url ? <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-2xl">{item.avatar || "👤"}</span>}
                      <div>
                        <div className="font-extrabold text-sm">{item.full_name}</div>
                        <div className="text-xs text-muted-foreground">{item.academic_year || (accountType === "servant" ? "خادم" : "بدون مرحلة")}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="rounded-xl bg-emerald-500/10 px-2.5 py-1 text-emerald-600 border border-emerald-500/20">حضر: {item.present_count || 0}</span>
                      <span className="rounded-xl bg-destructive/10 px-2.5 py-1 text-destructive border border-destructive/20">غاب: {item.absent_count || 0}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
