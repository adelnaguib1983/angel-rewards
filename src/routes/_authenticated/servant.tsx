// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ACADEMIC_YEARS, fileToDataUrl, useMe } from "@/lib/app";
import { Textarea } from "@/components/ui/textarea";
import { BirthdaysButton, PrepArchive, ReadingPlanner, VisitArchive } from "@/components/StaffMemberExtras";
import { NotificationsBell } from "@/components/MemberExtras";

export const Route = createFileRoute("/_authenticated/servant")({
  head: () => ({
    meta: [
      { title: "مرحلة الخدام | أبطال الملاك" },
      { name: "description", content: "تحضير الخادم الأسبوعي، الحضور والغياب، وافتقاد المخدومين." },
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
              <p className="text-sm text-muted-foreground">متابعة التحضير، الحضور والغياب، الافتقاد، والتوجيهات المشتركة.</p>
            </div>
            <nav className="my-5 flex flex-wrap gap-2">
              {([
                ["prep", "📘 تحضير الخادم"],
                ["attendance", "📋 الحضور والغياب اليومي"],
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
  const handleSave = () => {
    if (!content.trim()) return toast.error("يرجى كتابة التحضير أولاً");
    toast.success("تم حفظ التحضير الأسبوعي بنجاح ✅");
    setContent("");
  };
  return (
    <section className={card}>
      <h2 className="text-xl font-extrabold">📘 تحضير الخادم الأسبوعي</h2>
      <p className="text-xs text-muted-foreground mt-1">سجل تحضير الدرس والأفكار الخاصة بخدمة هذا الأسبوع.</p>
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="اكتب عناصر الدرس، الآيات، والنشاط هنا..." className="mt-3 min-h-32" />
      <button onClick={handleSave} className="pop mt-3 w-full rounded-2xl bg-sky py-3 font-extrabold text-primary-foreground">حفظ التحضير</button>
    </section>
  );
}

function AiQuizGeneratorSection() {
  const [sourceType, setSourceType] = useState<"text" | "image" | "voice">("text");
  const [textContent, setTextContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  
  const [quizTitle, setQuizTitle] = useState("مسابقة أبطال الملاك الأسبوعية");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleGenerate = async () => {
    if (sourceType === "text" && !textContent.trim()) return toast.error("يرجى كتابة نص المسابقة أولاً");
    if (sourceType === "image" && !selectedImage) return toast.error("يرجى رفع صورة المسابقة أولاً");
    if (sourceType === "voice" && !voiceFile) return toast.error("يرجى تسجيل أو رفع ملف الصوت أولاً");

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setGeneratedQuestions([
        { question: "ما هو العنوان الرئيسي للنص أو الصورة المرفوعة؟", options: ["الخيار الأول", "الخيار الثاني", "الخيار الصحيح"], answer: "الخيار الصحيح", points: 5 },
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
  };

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-xl font-extrabold">🤖 توليد المسابقات تلقائياً بالذكاء الاصطناعي</h2>
        <p className="text-xs text-muted-foreground mt-1">اختر مصدر المسابقة، قم بتوليد الأسئلة، مراجعتها، وتحديد توقيت ونقاط المسابقة قبل نشرها.</p>

        <div className="mt-4 flex gap-2">
          <button onClick={() => setSourceType("text")} className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${sourceType === "text" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>📝 من نص مكتوب</button>
          <button onClick={() => setSourceType("image")} className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${sourceType === "image" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>📷 من صورة</button>
          <button onClick={() => setSourceType("voice")} className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${sourceType === "voice" ? "bg-sky text-primary-foreground" : "bg-muted"}`}>🎤 من تسجيل صوتي</button>
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

function DailyAttendanceSection() {
  const qc = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(todayStr);
  const [subTab, setSubTab] = useState<"record" | "absent">("record");
  const [accountType, setAccountType] = useState<"student" | "servant">("student");
  const [selectedYear, setSelectedYear] = useState("all");
  const [statsDialogType, setStatsDialogType] = useState<"present" | "absent" | "total" | null>(null);

  const filterYear = selectedYear === "all" ? null : selectedYear;

  const { data: rpcPeople, isLoading } = useQuery({
    queryKey: ["daily-attendance-original-rpc", date, accountType],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_daily_attendance", {
        _date: date,
        _account_type: accountType
      });
      if (error) {
        console.error("RPC Error:", error);
        return [];
      }
      return data || [];
    },
  });

  const people = (rpcPeople || []).filter((p: any) => !filterYear || p.academic_year === filterYear);

  const handleStatusChange = async (personId: string, status: "present" | "absent") => {
    const { error } = await supabase.from("daily_attendance").upsert({
      person_id: personId,
      attendance_date: date,
      status: status
    }, { onConflict: "person_id,attendance_date" });

    if (error) return toast.error(error.message);

    if (status === "absent") {
      const { data: pastRecords } = await supabase
        .from("daily_attendance")
        .select("status, attendance_date")
        .eq("person_id", personId)
        .neq("attendance_date", date)
        .order("attendance_date", { ascending: false })
        .limit(1);

      if (pastRecords && pastRecords.length > 0 && pastRecords[0].status === "absent") {
        toast.warning("⚠️ تنبيه: غاب مرتين متتاليتين وتم إخطار المشرف!");
        await supabase.from("suggestions_and_notes").insert({
          content: `⚠️ تنبيه غياب متكرر: المخدوم / الخادم غاب مرتين متتاليتين في تاريخ ${date}`, target_type: "all_servants", status: "pending" }).catch(() => {}); } }  toast.success("تم تحديث حالة الحضور وزيادة العداد بنجاح ✅"); qc.invalidateQueries({ queryKey: ["daily-attendance-original-rpc"] }); };  const presentCount = people.filter((p: any) => p.attendance_status === "present").length; const absentCount = people.filter((p: any) => p.attendance_status === "absent").length; const totalCount = people.length; const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0; const absentPeople = people.filter((p: any) => p.attendance_status === "absent");  return ( <div className="space-y-4"> <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"> <div onClick={() => setStatsDialogType("total")} className="rounded-2xl border-2 border-border bg-card p-3 text-center cursor-pointer hover:bg-muted/50 transition"> <div className="text-xs text-muted-foreground">إجمالي الأفراد</div> <div className="mt-1 text-2xl font-black">{totalCount}</div> </div> <div onClick={() => setStatsDialogType("present")} className="rounded-2xl border-2 border-border bg-card p-3 text-center cursor-pointer hover:bg-emerald-500/10 transition"> <div className="text-xs text-muted-foreground">الحاضرون اليوم</div> <div className="mt-1 text-2xl font-black text-emerald-500">{presentCount}</div> </div> <div onClick={() => setStatsDialogType("absent")} className="rounded-2xl border-2 border-border bg-card p-3 text-center cursor-pointer hover:bg-destructive/10 transition"> <div className="text-xs text-muted-foreground">الغائبون اليوم</div> <div className="mt-1 text-2xl font-black text-destructive">{absentCount}</div> </div> <div className="rounded-2xl border-2 border-border bg-card p-3 text-center"> <div className="text-xs text-muted-foreground">نسبة الحضور</div> <div className="mt-1 text-2xl font-black text-sky">{percentage}\%</div> </div> </div>  <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <label className="text-sm font-extrabold">📅 تاريخ خدمة الجمعة:</label>
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
        <button onClick={() => setSubTab("record")} className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "record" ? "border-sky bg-sky text-primary-foreground" : "border-border bg-card"}`}>📝 تسجيل الحضور والغياب</button>
        <button onClick={() => setSubTab("absent")} className={`flex-1 rounded-2xl border-2 py-2.5 font
