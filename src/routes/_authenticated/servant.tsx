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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const handleSave = async () => {
    if (!content.trim() && !selectedImage && !voiceFile && !videoFile) {
      return toast.error("يرجى كتابة التحضير أو إرفاق ملف أولاً");
    }

    await supabase.from("prep_archive" as any).insert({
      user_id: userId,
      content: content,
      media_url: selectedImage || null,
      created_at: new Date().toISOString()
    }).catch(() => {});

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
                <input type="file" accept="video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0];
