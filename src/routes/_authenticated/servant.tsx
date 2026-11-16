// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { generateQuizDraft } from "@/lib/quiz-ai.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ACADEMIC_YEARS, cairoDate, fileToDataUrl, fridayOf, useMe } from "@/lib/app";
import { uploadServantMedia } from "@/lib/media";
import { MediaView } from "@/components/MediaPlayers";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BirthdaysButton, PrepArchive, ReadingPlanner, VisitArchive, OT_BOOKS, NT_BOOKS } from "@/components/StaffMemberExtras";
import { NotificationsBell } from "@/components/MemberExtras";
import { ServantSuggestionsTab } from "@/components/ServantSuggestionsTab";
import { StageAbsenceAlerts } from "@/components/AbsenceAlertButtons";

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

export interface AbsentPerson {
  id: string;
  name: string;
  stage?: string;
  absent_count: number;
  phone?: string;
  absence_dates?: string[];
}

function formatWhatsAppLink(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // تحويل الرقم المصري (01xxxxxxxxx) إلى الصيغة الدولية (+201xxxxxxxxx)
  const intl = digits.startsWith("0") ? "2" + digits : digits.startsWith("2") ? digits : "20" + digits;
  return `https://wa.me/${intl}`;
}


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
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [mr, setMr] = useState<MediaRecorder | null>(null);
  const [saving, setSaving] = useState(false);
  const [gallery, setGallery] = useState<string[] | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const loadedRef = useRef(false);
  const weekStart = fridayOf(cairoDate(new Date()));

  const { data: mine } = useQuery({
    queryKey: ["my-prep", weekStart],
    queryFn: async () => (await supabase.from("servant_preparations").select("*").eq("user_id", userId).eq("week_start", weekStart).maybeSingle()).data,
  });
  useEffect(() => {
    if (mine && !loadedRef.current) {
      loadedRef.current = true;
      setContent(mine.notes || "");
      setImages(mine.images || []);
      setAudioUrl(mine.audio_url || null);
      setVideoUrl(mine.video_url || null);
    }
  }, [mine]);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        setVoiceFile(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }));
      };
      rec.start(); setMr(rec); setRecording(true);
    } catch { toast.error("تعذر الوصول إلى الميكروفون"); }
  };
  const stopRec = () => { mr?.stop(); setRecording(false); setMr(null); };

  const handleSave = async () => {
    if (!content.trim() && !images.length && !voiceFile && !audioUrl && !videoFile && !videoUrl) {
      return toast.error("يرجى كتابة التحضير أو إرفاق ملف أولاً");
    }
    setSaving(true);
    try {
      let audio = audioUrl;
      let video = videoUrl;
      if (voiceFile) audio = await uploadServantMedia(voiceFile, userId);
      if (videoFile) video = await uploadServantMedia(videoFile, userId);

      const { error } = await supabase.from("servant_preparations").upsert({
        user_id: userId,
        week_start: weekStart,
        notes: content.trim(),
        images,
        audio_url: audio,
        video_url: video,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,week_start" });

      if (error) { toast.error("فشل حفظ التحضير: " + error.message); return; }

      toast.success("تم حفظ التحضير الأسبوعي والمرفقات بنجاح ✅");
      setVoiceFile(null); setVideoFile(null);
      qc.invalidateQueries({ queryKey: ["my-prep"] });
      qc.invalidateQueries({ queryKey: ["prep-archive"] });
      qc.invalidateQueries({ queryKey: ["week-preps"] });
    } catch (err: any) {
      toast.error(err.message || "تعذر رفع المرفقات");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={card}>
      <h2 className="text-xl font-extrabold">📘 تحضير الخادم الأسبوعي</h2>
      <p className="text-xs text-muted-foreground mt-1">سجل تحضير الدرس، الآيات، وارفع عدة صور معًا، الفويس، أو الفيديو — والتحضير يبقى محفوظًا في الأرشيف دائمًا.</p>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="اكتب عناصر الدرس، الآيات، والنشاط هنا..."
        className="mt-3 min-h-32"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {images.map((s, i) => (
          <div key={i} className="relative">
            <img src={s} alt="" className="h-20 w-20 rounded-xl object-cover" />
            <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-xs text-destructive-foreground">✕</button>
          </div>
        ))}
        {images.length < 6 && (
          <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-center text-xs font-bold hover:bg-muted">
            📷<br />صور
            <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 6 - images.length);
              try {
                const urls = await Promise.all(files.map((f) => fileToDataUrl(f, 900, 0.75)));
                setImages((prev) => [...prev, ...urls]);
              } catch (err) { toast.error((err as Error).message); }
              e.target.value = "";
            }} />
          </label>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-3 text-center text-xs font-bold hover:bg-muted">
          🎤 {voiceFile ? voiceFile.name.slice(0, 18) : audioUrl ? "صوت محفوظ ✓ (استبدل بالرفع)" : "رفع فويس (صوت)"}
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => { setVoiceFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </label>
        <button type="button" onClick={() => (recording ? stopRec() : startRec())}
          className={`rounded-2xl border-2 p-3 text-xs font-bold transition ${recording ? "animate-pulse border-destructive bg-destructive/10 text-destructive" : "border-border hover:bg-muted"}`}>
          {recording ? "⏹ إيقاف التسجيل" : "🎙️ تسجيل فويس"}
        </button>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-3 text-center text-xs font-bold hover:bg-muted">
          🎬 {videoFile ? videoFile.name.slice(0, 18) : videoUrl ? "فيديو محفوظ ✓ (استبدل بالرفع)" : "رفع فيديو"}
          <input type="file" accept="video/*" className="hidden" onChange={(e) => { setVideoFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </label>
      </div>

      {(audioUrl || videoUrl) && (
        <div className="mt-3 space-y-2 rounded-2xl bg-muted/40 p-3">
          <div className="text-xs font-bold text-muted-foreground">المرفقات المحفوظة لهذا الأسبوع:</div>
          {audioUrl && <MediaView src={audioUrl} kind="audio" />}
          {videoUrl && <MediaView src={videoUrl} kind="video" />}
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="pop mt-4 w-full rounded-2xl bg-sky py-3 font-extrabold text-primary-foreground disabled:opacity-60">
        {saving ? "جاري الحفظ..." : "حفظ التحضير والمرفقات"}
      </button>

      <div className="mt-5 border-t border-border pt-4">
        <button onClick={() => setShowOthers(!showOthers)} className="mb-3 w-full rounded-2xl bg-muted py-2.5 font-extrabold">
          {showOthers ? "▾ إخفاء تحضيرات باقي الخدام" : "▸ استعراض تحضيرات باقي الخدام هذا الأسبوع"}
        </button>
        {showOthers && <OtherPreps weekStart={weekStart} userId={userId} />}
      </div>
      <ImageLightbox images={gallery} title="صور التحضير" onClose={() => setGallery(null)} />
    </section>
  );
}

function OtherPreps({ weekStart, userId }: { weekStart: string; userId: string }) {
  const [gallery, setGallery] = useState<string[] | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["week-preps", weekStart],
    queryFn: async () => { const { data, error } = await supabase.rpc("servant_week_preps", { _week: weekStart }); if (error) throw error; return data ?? []; },
  });
  const others = (data ?? []).filter((p: any) => p.user_id !== userId);
  if (isLoading) return <p className="text-center text-sm text-muted-foreground">جاري التحميل...</p>;
  if (!others.length) return <p className="text-center text-sm text-muted-foreground">لم يرسل باقي الخدام تحضيراتهم لهذا الأسبوع بعد.</p>;
  return (
    <div className="space-y-3">
      {others.map((p: any) => (
        <div key={p.user_id} className="rounded-2xl border-2 border-border bg-background p-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{p.avatar || "👤"}</span>
            <span className="font-extrabold">{p.full_name}</span>
            <span className="mr-auto text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{p.notes || "بدون نص"}</p>
          {!!p.images?.length && (
            <div className="mt-2 flex flex-wrap gap-2">
              {p.images.map((s: string, i: number) => (
                <img key={i} src={s} alt="" onClick={() => setGallery(p.images)} className="h-16 w-16 cursor-zoom-in rounded-lg object-cover" />
              ))}
            </div>
          )}
          {(p.audio_url || p.video_url) && (
            <div className="mt-2 space-y-2">
              {p.audio_url && <MediaView src={p.audio_url} kind="audio" />}
              {p.video_url && <MediaView src={p.video_url} kind="video" />}
            </div>
          )}
        </div>
      ))}
      <ImageLightbox images={gallery} title="صور التحضير" onClose={() => setGallery(null)} />
    </div>
  );
}


function AiQuizGeneratorSection() {
  const gen = useServerFn(generateQuizDraft as any);
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [sourceType, setSourceType] = useState<"text" | "image" | "audio" | "video" | "bible">("text");
  const [textContent, setTextContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [book, setBook] = useState(NT_BOOKS[0][1]);
  const [chapter, setChapter] = useState("1");
  const [chapterTo, setChapterTo] = useState("");
  const [verses, setVerses] = useState("");
  const [count, setCount] = useState<15 | 20>(15);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("مسابقة أبطال الملاك الأسبوعية");
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [editTimingQuiz, setEditTimingQuiz] = useState<any>(null);
  const [newOpens, setNewOpens] = useState("");
  const [newCloses, setNewCloses] = useState("");
  const [savingTiming, setSavingTiming] = useState(false);
  const [draft, setDraft] = useState<{ title: string; questions: { question: string; kind: "tf" | "mcq"; options: string[]; correct: number; points: number }[] } | null>(null);

  const { data: myQuizzes } = useQuery({
    queryKey: ["my-quizzes", me?.user.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("quizzes").select("id, title, status, created_at, opens_at, closes_at").eq("created_by", me!.user.id).order("created_at", { ascending: false })).data ?? [],
  });

  const toLocalDateTimeInput = (value: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  };

  const openEditTiming = (z: any) => {
    setEditTimingQuiz(z);
    setNewOpens(toLocalDateTimeInput(z.opens_at));
    setNewCloses(toLocalDateTimeInput(z.closes_at));
  };

  const handleSaveTiming = async () => {
    if (!editTimingQuiz) return;
    if (newOpens && newCloses && new Date(newCloses) <= new Date(newOpens)) {
      toast.error("وقت القفل لازم يكون بعد وقت الفتح");
      return;
    }
    setSavingTiming(true);
    try {
      const { error } = await supabase.rpc("update_quiz_schedule", {
        _quiz: editTimingQuiz.id,
        _opens_at: newOpens ? new Date(newOpens).toISOString() : null,
        _closes_at: newCloses ? new Date(newCloses).toISOString() : null,
      });
      if (error) throw error;
      toast.success("تم تحديث وقت المسابقة بنجاح ✅");
      setEditTimingQuiz(null);
      qc.invalidateQueries({ queryKey: ["my-quizzes"] });
      qc.invalidateQueries({ queryKey: ["admin-quizzes"] });
    } catch (e: any) {
      toast.error(e.message || "تعذر تحديث الوقت");
    } finally {
      setSavingTiming(false);
    }
  };

  const audioB64 = async (f: File) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split("base64,")[1] || ""); r.onerror = rej; r.readAsDataURL(f); });

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const data: any = { sourceType, count };
      if (sourceType === "text") {
        if (!textContent.trim()) { toast.error("اكتب نص المسابقة أولاً"); return; }
        data.text = textContent.trim();
      } else if (sourceType === "image") {
        if (!selectedImage) { toast.error("ارفع صورة المسابقة أولاً"); return; }
        data.imageDataUrl = selectedImage;
      } else if (sourceType === "audio") {
        if (!voiceFile) { toast.error("ارفع ملف الصوت أولاً"); return; }
        data.audioBase64 = await audioB64(voiceFile);
        data.audioMime = voiceFile.type || "audio/mpeg";
      } else if (sourceType === "video") {
        if (!videoFile) { toast.error("ارفع ملف الفيديو أولاً"); return; }
        data.videoBase64 = await audioB64(videoFile);
        data.videoMime = videoFile.type || "video/mp4";
      } else {
        if (!chapter || Number(chapter) < 1) { toast.error("حدد الأصحاح"); return; }
       data.bible = { 
  book, 
  chapter: Number(chapter), 
  ...(chapterTo && Number(chapterTo) > Number(chapter) ? { chapterTo: Number(chapterTo) } : {}),
  ...(verses.trim() ? (() => { const m = verses.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/); return m ? { from: Number(m[1]), to: m[2] ? Number(m[2]) : undefined } : {}; })() : {}) 
};
      }
      const out = await gen({ data } as any);
      if (!out?.questions?.length) throw new Error("لم يتم توليد أسئلة");
      setTitle(out.title || title);
      setDraft(out);
      toast.success(`تم توليد ${out.questions.length} سؤالًا — راجعها وحدد الإجابات قبل الإرسال ✅`);
    } catch (e: any) {
      toast.error(e.message || "تعذر توليد المسابقة");
    } finally {
      setLoading(false);
    }
  };

  const upd = (i: number, patch: any) => setDraft((d) => d && ({ ...d, questions: d.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));

  const handleSubmit = async () => {
    if (!draft) return;
    if (!title.trim()) return toast.error("اكتب عنوان المسابقة");
    const missing = draft.questions.findIndex((q) => q.correct < 0 || q.correct >= q.options.length);
    if (missing >= 0) return toast.error(`حدد الإجابة الصحيحة للسؤال ${missing + 1} قبل الإرسال`);
    if (opens && closes && new Date(closes) <= new Date(opens)) return toast.error("وقت القفل لازم يكون بعد وقت الفتح");
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("servant_submit_quiz", {
        _title: title.trim(),
        _questions: draft.questions,
        _opens_at: opens ? new Date(opens).toISOString() : null,
        _closes_at: closes ? new Date(closes).toISOString() : null,
        _source: sourceType === "image" ? selectedImage : null,
      });
      if (error) throw error;
      toast.success("تم إرسال المسابقة للمشرف للاعتماد قبل نشرها للمخدومين ✅");
      setDraft(null); setTextContent(""); setSelectedImage(null); setVoiceFile(null); setVideoFile(null);
      qc.invalidateQueries({ queryKey: ["my-quizzes"] });
      qc.invalidateQueries({ queryKey: ["admin-quizzes"] });
    } catch (e: any) {
      toast.error(e.message || "تعذر إرسال المسابقة");
    } finally {
      setSubmitting(false);
    }
  };

  const STATUS: Record<string, { l: string; c: string }> = {
    pending: { l: "⏳ قيد اعتماد المشرف", c: "bg-amber-500/20 text-amber-600" },
    published: { l: "✅ منشورة", c: "bg-emerald-500/20 text-emerald-600" },
    rejected: { l: "🚫 مرفوضة — عدّلها وأعد الإرسال", c: "bg-destructive/20 text-destructive" },
  };

  return (
    <div className="space-y-4">
      <section className={card}>
        <h2 className="text-xl font-extrabold">🤖 توليد المسابقات تلقائياً بالذكاء الاصطناعي</h2>
        <p className="text-xs text-muted-foreground mt-1">اختر المصدر وولّد ١٥ أو ٢٠ سؤالًا، راجعها كاملة بالأسفل، ثم أرسلها للمشرف للاعتماد قبل النشر.</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {([["text", "📝 نص مكتوب"], ["image", "📷 صورة"], ["audio", "🎤 فويس"], ["video", "🎬 فيديو"], ["bible", "📖 شاهد كتابي"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSourceType(k)} className={`rounded-xl py-2 text-xs font-bold transition ${sourceType === k ? "bg-sky text-primary-foreground" : "bg-muted"}`}>{l}</button>
          ))}
        </div>

        <div className="mt-4">
          {sourceType === "text" && <Textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="اكتب أو الصق نص الدرس هنا..." className="min-h-32" />}
          {sourceType === "image" && (
            <div className="space-y-2">
              {selectedImage && <img src={selectedImage} alt="" className="mx-auto max-h-48 rounded-2xl object-cover" />}
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 hover:bg-muted">
                <span>📷 اضغط لرفع صورة المسابقة</span>
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setSelectedImage(await fileToDataUrl(f, 900, 0.75)); } catch (err) { toast.error((err as Error).message); } } e.target.value = ""; }} />
              </label>
            </div>
          )}
          {sourceType === "audio" && (
            <div className="space-y-2">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 hover:bg-muted">
                <span>🎤 اضغط لرفع ملف صوتي (فويس)</span>
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => { setVoiceFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              </label>
              {voiceFile && <p className="text-center text-xs font-bold text-emerald-600">تم اختيار الملف الصوتي: {voiceFile.name}</p>}
            </div>
          )}
          {sourceType === "video" && (
            <div className="space-y-2">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 hover:bg-muted">
                <span>🎬 اضغط لرفع ملف فيديو</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => { setVideoFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              </label>
              {videoFile && <p className="text-center text-xs font-bold text-emerald-600">تم اختيار ملف الفيديو: {videoFile.name}</p>}
            </div>
          )}
         {sourceType === "bible" && (
  <div className="grid gap-2 sm:grid-cols-4">
    <label className="text-xs font-bold">السفر<select value={book} onChange={(e) => setBook(e.target.value)} className="rounded-xl border-2 border-border bg-background px-2 py-1.5 text-sm font-bold">{[...OT_BOOKS, ...NT_BOOKS].map(([, n]) => <option key={n}>{n}</option>)}</select></label>
    <label className="text-xs font-bold">من أصحاح<input type="number" min={1} value={chapter} onChange={(e) => setChapter(e.target.value)} className="rounded-xl border-2 border-border bg-background px-2 py-1.5 text-sm font-bold" /></label>
    <label className="text-xs font-bold">إلى أصحاح (اختياري)<input type="number" min={1} value={chapterTo} onChange={(e) => setChapterTo(e.target.value)} placeholder="اختياري" className="rounded-xl border-2 border-border bg-background px-2 py-1.5 text-sm font-bold" /></label>
    <label className="text-xs font-bold">الآيات (اختياري)<input value={verses} onChange={(e) => setVerses(e.target.value)} placeholder="مثال: 16 أو 1-5" className="rounded-xl border-2 border-border bg-background px-2 py-1.5 text-sm font-bold" /></label>
  </div>
)}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold">عدد الأسئلة: 
            <select value={count} onChange={(e) => setCount(Number(e.target.value) as 15 | 20)} className="mr-2 rounded-xl border-2 border-border bg-background px-2 py-1 text-sm font-bold">
              <option value={15}>١٥ سؤالًا</option>
              <option value={20}>٢٠ سؤالًا</option>
            </select>
          </label>
          <button disabled={loading} onClick={handleGenerate} className="pop mr-auto rounded-2xl bg-sky px-6 py-2.5 font-extrabold text-primary-foreground disabled:opacity-60">
            {loading ? "جاري التحليل والتوليد..." : "توليد الأسئلة تلقائياً ⚡"}
          </button>
        </div>
      </section>

      {draft && (
        <section className={card}>
          <h3 className="mb-3 text-lg font-extrabold text-emerald-600">✨ مراجعة وتعديل الأسئلة المولدة بالكامل ({draft.questions.length} سؤالًا):</h3>
          <div className="mb-4 space-y-3 rounded-2xl border border-border bg-muted/40 p-3">
            <div>
              <label className="text-xs font-bold">عنوان المسابقة:</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-bold">⏰ فتح المسابقة<input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-2 py-1 text-xs font-bold" /></label>
              <label className="text-xs font-bold">🔒 قفل المسابقة<input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-2 py-1 text-xs font-bold" /></label>
            </div>
          </div>

         <div className="space-y-3 pr-1">

            {draft.questions.map((q, idx) => (
              <div key={idx} className="space-y-2 rounded-xl border-2 border-border bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-sky/20 px-2 py-0.5 text-xs font-black text-sky">سؤال {idx + 1} · {q.kind === "tf" ? "صح/خطأ" : "اختيار من متعدد"}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold">الدرجة:</span>
                    <input type="number" value={q.points || 5} onChange={(e) => upd(idx, { points: Number(e.target.value) })} className="w-16 rounded-lg border border-border bg-card px-2 py-0.5 text-center text-xs font-bold" />
                    <button onClick={() => setDraft((d) => d && ({ ...d, questions: d.questions.filter((_, j) => j !== idx) }))} className="ml-1 text-xs text-destructive" title="حذف السؤال">✕</button>
                  </div>
                </div>
                <input type="text" value={q.question} onChange={(e) => upd(idx, { question: e.target.value })} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold" />
                <div className="grid gap-2 sm:grid-cols-3">
                  {q.options.map((o, k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="radio" checked={q.correct === k} onChange={() => upd(idx, { correct: k })} title="الإجابة الصحيحة" />
                      <input type="text" value={o} onChange={(e) => upd(idx, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} className={`w-full rounded-xl border px-2 py-1.5 text-xs font-extrabold ${q.correct === k ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : "border-border bg-card"}`} />
                    </label>
                  ))}
                </div>
                <p className={`text-xs font-bold ${q.correct < 0 || q.correct >= q.options.length ? "text-destructive" : "text-emerald-600"}`}>
                  {q.correct < 0 || q.correct >= q.options.length ? "⚠️ لم تحدد الإجابة الصحيحة — اضغط الدائرة بجوارها" : `✓ الإجابة الصحيحة: ${q.options[q.correct] || "اختيار " + (q.correct + 1)}`}
                </p>
              </div>
            ))}
          </div>
<button
  type="button"
  onClick={() => setDraft((d) => d && ({
    ...d,
    questions: [
      ...d.questions,
      { question: "", kind: "mcq", options: ["", "", ""], correct: 0, points: 5 }
    ]
  }))}
  className="w-full rounded-xl border-2 border-dashed border-sky p-2 text-xs font-bold text-sky hover:bg-sky/10"
>
  ➕ إضافة سؤال جديد يدوياً للمسابقة
</button>

          <button onClick={handleSubmit} disabled={submitting} className="pop mt-5 w-full rounded-2xl bg-emerald-600 py-3 text-base font-extrabold text-white shadow-lg disabled:opacity-60">
            {submitting ? "جاري الإرسال..." : "إرسال المسابقة للاعتماد 📨"}
          </button>
        </section>
      )}

      {!!myQuizzes?.length && (
        <section className={card}>
          <h3 className="mb-3 text-lg font-extrabold">📨 مسابقاتي المرسلة</h3>
          <div className="space-y-2">
            {myQuizzes.map((z: any) => (
              <div key={z.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3 text-sm">
                <div>
                  <span className="font-extrabold">🧠 {z.title}</span>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(z.created_at).toLocaleDateString("ar-EG")}
                    {z.opens_at && ` · يفتح: ${new Date(z.opens_at).toLocaleString("ar-EG")}`}
                    {z.closes_at && ` · يقفل: ${new Date(z.closes_at).toLocaleString("ar-EG")}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${STATUS[z.status]?.c ?? "bg-muted"}`}>{STATUS[z.status]?.l ?? z.status}</span>
                  <button type="button" onClick={() => openEditTiming(z)} className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-bold hover:bg-muted">
                    ⏰ تعديل الوقت
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!editTimingQuiz} onOpenChange={(open) => !open && setEditTimingQuiz(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>⏰ تعديل وقت المسابقة</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-bold text-muted-foreground">{editTimingQuiz?.title}</p>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold">
              ⏰ وقت الفتح:
              <input type="datetime-local" value={newOpens} onChange={(e) => setNewOpens(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold" />
            </label>
            <label className="block text-xs font-bold">
              🔒 وقت القفل:
              <input type="datetime-local" value={newCloses} onChange={(e) => setNewCloses(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditTimingQuiz(null)}>إلغاء</Button>
              <Button onClick={handleSaveTiming} disabled={savingTiming}>
                {savingTiming ? "جاري الحفظ..." : "حفظ التوقيت"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function getThisWeekFriday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 6 ? -1 : (5 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function getFridayList() {
  const currentFridayStr = getThisWeekFriday();
  const baseDate = new Date(currentFridayStr);
  const fridays: { date: string; label: string; isCurrent: boolean }[] = [];

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

function DailyAttendanceSection() {
  const qc = useQueryClient();
  const { fridaysList, defaultFriday } = useMemo(() => getFridayList(), []);
  const [date, setDate] = useState<string>(defaultFriday);

  const [subTab, setSubTab] = useState<"record" | "absent">("record");
  const [accountType, setAccountType] = useState<"student" | "servant">("student");
  const [selectedYear, setSelectedYear] = useState("all");
  const [statsDialogType, setStatsDialogType] = useState<"present" | "absent" | "total" | null>(null);
  
  const [loadingPersons, setLoadingPersons] = useState<Record<string, boolean>>({});

  const filterYear = selectedYear === "all" ? null : selectedYear;

    const { data: profilesData, isLoading } = useQuery({
    queryKey: ["profiles-attendance-all-fixed", accountType, date],
    queryFn: async () => {
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, avatar, photo_url, academic_year, account_type, status, phone");

      if (profErr) throw profErr;

      const { data: attendanceRecords } = await supabase
        .from("daily_attendance")
        .select("*")
        .eq("attendance_date", date);

      const { data: sy } = await supabase.from("service_years").select("start_date, end_date").eq("is_current", true).maybeSingle();
      let qAll = supabase.from("daily_attendance").select("person_id, status, attendance_date");
      if (sy) qAll = qAll.gte("attendance_date", sy.start_date).lte("attendance_date", sy.end_date);
      const { data: allAttendanceRecords } = await qAll;

      const countsMap: Record<string, { present: number, absent: number, absence_dates: string[] }> = {};
      (allAttendanceRecords || []).forEach((rec: any) => {
        if (!countsMap[rec.person_id]) {
          countsMap[rec.person_id] = { present: 0, absent: 0, absence_dates: [] };
        }
        if (rec.status === 'present') countsMap[rec.person_id].present++;
        if (rec.status === 'absent') {
          countsMap[rec.person_id].absent++;
          countsMap[rec.person_id].absence_dates.push(rec.attendance_date);
        }
      });

        const allProfiles = profiles || [];
      const filtered = allProfiles.filter((m: any) => {
        const type = (m.account_type || "").toLowerCase();
        const hasYear = Boolean(m.academic_year && m.academic_year.trim() !== "");

        if (accountType === "servant") {
          // السماح بالخدام، المشرفين، أو من ليس لديه سنة دراسية، مع دعم العربية والإنجليزية
          return type.includes("servant") || type.includes("admin") || type.includes("خادم") || !hasYear;
        } else {
          // السماح للمخدومين الذين لديهم سنة دراسية أو تصنيف مخدوم
          return hasYear || type.includes("student") || type.includes("member") || type.includes("مخدوم") || type === "";
        }
      });



      const listToUse = filtered.length > 0 ? filtered : allProfiles;

      return listToUse.map((m: any) => {
        const personId = m.id;
        const att = (attendanceRecords || []).find((a: any) => a.person_id === personId);
        const personCounts = countsMap[personId] || { present: 0, absent: 0, absence_dates: [] };

        const phoneVal = m.phone || null;

        return {
          person_id: personId,
          full_name: m.full_name || "بدون اسم",
          avatar: m.avatar || "👤",
          photo_url: m.photo_url,
          phone: phoneVal,
          academic_year: m.academic_year || "مرحلة عامة",
          attendance_status: att?.status === "present" ? "present" : att?.status === "absent" ? "absent" : null,
          present_count: personCounts.present,
          absent_count: personCounts.absent,
          absence_dates: personCounts.absence_dates,
        };
      });
    },
  });


  const people = profilesData || [];

console.log({ accountType, date, count: people.length, isLoading });

  const filteredPeople = filterYear 
    ? people.filter((p: any) => p.academic_year === filterYear) 
    : people;

  const handleStatusChange = async (personId: string, status: "present" | "absent", currentStatus: string | null) => {
    if (loadingPersons[personId] || currentStatus === status) return;

    setLoadingPersons((prev) => ({ ...prev, [personId]: true }));

    try {
      const { error } = await supabase.from("daily_attendance").upsert({
        person_id: personId,
        attendance_date: date,
        status: status
      }, { onConflict: "person_id,attendance_date" });

      if (error) { toast.error(error.message); return; }

      toast.success(status === "present" ? "تم تسجيل الحضور بنجاح ✅" : "تم تسجيل الغياب بنجاح ✕");
      qc.invalidateQueries({ queryKey: ["profiles-attendance-all-fixed"] });
    } finally {
      setLoadingPersons((prev) => {
        const next = { ...prev };
        delete next[personId];
        return next;
      });
    }
  };

  const handleClearAttendance = async (personId: string) => {
    if (loadingPersons[personId]) return;
    setLoadingPersons((prev) => ({ ...prev, [personId]: true }));

    try {
      const { error } = await supabase.from("daily_attendance").delete().eq("person_id", personId).eq("attendance_date", date);
      if (error) { toast.error(error.message); return; }
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

  const closeFriday = async () => {
    const unmarked = filteredPeople.filter((p: any) => !p.attendance_status);
    if (!unmarked.length) return toast.info("كل الأفراد مُرصدون بالفعل لهذه الجمعة");
    if (!confirm(`اعتماد جمعة ${date}؟ سيتم اعتبار ${unmarked.length} شخصًا غائبًا تلقائيًا.`)) return;
    const rows = unmarked.map((p: any) => ({ person_id: p.person_id, attendance_date: date, status: "absent" }));
    const { error } = await supabase.from("daily_attendance").upsert(rows, { onConflict: "person_id,attendance_date" });
    if (error) return toast.error(error.message);
    toast.success("تم اعتماد الجمعة بنجاح ✅");
    qc.invalidateQueries({ queryKey: ["profiles-attendance-all-fixed"] });
  };

  const presentCount = filteredPeople.filter((p: any) => p.attendance_status === "present").length;
  const absentCount = filteredPeople.filter((p: any) => p.attendance_status === "absent").length;
  const totalCount = filteredPeople.length;
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
  const absentPeople = filteredPeople.filter((p: any) => p.attendance_status === "absent");

  return (
    <div className="space-y-4">
      <StageAbsenceAlerts />

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
          <select value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border-2 border-border bg-background px-3 py-1.5 font-bold text-sm">
            {fridaysList.map((f) => (<option key={f.date} value={f.date}>{f.label}</option>))}
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

      <button onClick={closeFriday} className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-white hover:opacity-90">✅ اعتماد الجمعة: من لم يُرصد غائب</button>

      <div className="flex gap-2">
        <button onClick={() => setSubTab("record")} className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "record" ? "border-sky bg-sky text-primary-foreground" : "border-border bg-card"}`}>📝 تسجيل الحضور والغياب الأسبوعي</button>
        <button onClick={() => setSubTab("absent")} className={`flex-1 rounded-2xl border-2 py-2.5 font-extrabold transition ${subTab === "absent" ? "border-destructive bg-destructive text-destructive-foreground" : "border-border bg-card"}`}>⚠️ كشف الغياب ({absentPeople.length})</button>
      </div>

      {subTab === "record" ? (
        <div className="space-y-3">
          {isLoading ? <p className="text-center text-muted-foreground py-8">جاري التحميل...</p> : !filteredPeople.length ? <p className="text-center text-muted-foreground py-8">لا توجد بيانات مسجلة.</p> : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {filteredPeople.map((item: any) => (
                <div key={item.person_id} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-3.5">
                  <div className="flex items-center gap-3">
                    {item.photo_url ? <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-2xl">{item.avatar || "👤"}</span>}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm">{item.full_name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{item.academic_year}</div>
                    </div>
                  </div>

                                   <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={loadingPersons[item.person_id] || item.attendance_status === "present"}
                        onClick={() => handleStatusChange(item.person_id, "present", item.attendance_status)}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${item.attendance_status === "present" ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400" : "bg-muted text-muted-foreground hover:bg-emerald-100"}`}
                      >
                        <span>✓ حاضر</span>
                      </button>
                      <button
                        disabled={loadingPersons[item.person_id] || item.attendance_status === "absent"}
                        onClick={() => handleStatusChange(item.person_id, "absent", item.attendance_status)}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${item.attendance_status === "absent" ? "bg-destructive text-destructive-foreground shadow-md ring-2 ring-red-400" : "bg-muted text-muted-foreground hover:bg-red-100"}`}
                      >
                        <span>✕ غائب</span>
                      </button>
                      {item.attendance_status && (
                        <button type="button" title="مسح الرصد" disabled={loadingPersons[item.person_id]} onClick={() => handleClearAttendance(item.person_id)} className="rounded-lg p-1.5 text-xs text-muted-foreground hover:bg-muted">↺</button>
                      )}
                    </div>
                    {/* أزرار الاتصال والواتساب السريعة أسفل حاضر وغائب */}
                    <div className="flex items-center justify-end gap-2 w-full pt-1">
                      <a
                        href={item.phone ? `tel:${item.phone}` : undefined}
                        title={item.phone ? `اتصال: ${item.phone}` : "لا يوجد رقم مسجل"}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow transition text-sm ${
                          item.phone ? "bg-sky hover:opacity-90 active:scale-95" : "bg-muted text-muted-foreground opacity-30 pointer-events-none"
                        }`}
                      >
                        📞
                      </a>
                      <a
                        href={formatWhatsAppLink(item.phone) || undefined}
                        target="_blank"
                        rel="noreferrer"
                        title={item.phone ? `واتساب: ${item.phone}` : "لا يوجد رقم مسجل"}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow transition text-sm ${
                          item.phone ? "bg-emerald-600 hover:opacity-90 active:scale-95" : "bg-muted text-muted-foreground opacity-30 pointer-events-none"
                        }`}
                      >
                        💬
                      </a>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {absentPeople.length === 0 ? <p className="text-center text-muted-foreground py-8">لا يوجد غياب مسجل في هذا اليوم ✅</p> : (
            <div className="grid gap-2.5 md:grid-cols-2">
              {absentPeople.map((item: any) => (
                <div key={item.person_id} className="flex items-center justify-between rounded-2xl border-2 border-destructive/30 bg-card p-3.5">
                  <div className="flex items-center gap-3">
                    {item.photo_url ? <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-2xl">{item.avatar || "👤"}</span>}
                    <div>
                      <div className="font-extrabold text-sm text-destructive">{item.full_name}</div>
                      <div className="text-xs text-muted-foreground">{item.academic_year}</div>
                    </div>
                  </div>
                                   <div className="flex items-center gap-2">
                    <a
                      href={item.phone ? `tel:${item.phone}` : undefined}
                      title={item.phone ? `اتصال: ${item.phone}` : "لا يوجد رقم مسجل"}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow transition text-sm ${
                        item.phone ? "bg-sky hover:opacity-90 active:scale-95" : "bg-muted text-muted-foreground opacity-30 pointer-events-none"
                      }`}
                    >
                      📞
                    </a>
                    <a
                      href={formatWhatsAppLink(item.phone) || undefined}
                      target="_blank"
                      rel="noreferrer"
                      title={item.phone ? `واتساب: ${item.phone}` : "لا يوجد رقم مسجل"}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow transition text-sm ${
                        item.phone ? "bg-emerald-600 hover:opacity-90 active:scale-95" : "bg-muted text-muted-foreground opacity-30 pointer-events-none"
                      }`}
                    >
                      💬
                    </a>
                    <button disabled={loadingPersons[item.person_id]} onClick={() => handleStatusChange(item.person_id, "present", item.attendance_status)} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow">تعديل إلى حاضر ✓</button>
                  </div>

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
                {statsDialogType === "present" 
                  ? "👥 قائمة الحاضرين في الجمعة" 
                  : statsDialogType === "absent" 
                  ? "⚠️ قائمة الغائبين في الجمعة" 
                  : "📊 إجمالي الأفراد"}
              </h3>
              <button onClick={() => setStatsDialogType(null)} className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold">✕ إغلاق</button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto space-y-2.5 pr-1">
              {(statsDialogType === "present" 
                ? filteredPeople.filter((p: any) => p.attendance_status === "present")
                : statsDialogType === "absent" 
                ? filteredPeople.filter((p: any) => p.attendance_status === "absent")
                : filteredPeople
              ).map((item: any) => (
                <div key={item.person_id} className="flex items-center justify-between rounded-2xl border border-border bg-background p-3.5 shadow-sm">
                  <div className="flex items-center gap-3">
                    {item.photo_url ? <img src={item.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="text-2xl">{item.avatar || "👤"}</span>}
                    <div>
                      <div className="font-extrabold text-sm">{item.full_name}</div>
                      <div className="text-xs text-muted-foreground">{item.academic_year}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="rounded-xl bg-emerald-500/10 px-2.5 py-1 text-emerald-600">حضر: {item.present_count || 0}</span>
                    <span className="rounded-xl bg-destructive/10 px-2.5 py-1 text-destructive">غاب: {item.absent_count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
