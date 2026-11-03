import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fileToDataUrl } from "@/lib/app";
import { uploadServantMedia, MEDIA_BUCKET } from "@/lib/media";
import { MediaView } from "@/components/MediaPlayers";
import { ImageLightbox } from "@/components/ImageLightbox";

/** تسجيل مقطع صوتي من الميكروفون مباشرة */
function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [mr, setMr] = useState<MediaRecorder | null>(null);
  const start = async (onDone: (file: File) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        onDone(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }));
      };
      rec.start();
      setMr(rec);
      setRecording(true);
    } catch {
      toast.error("تعذر الوصول إلى الميكروفون");
    }
  };
  const stop = () => {
    mr?.stop();
    setRecording(false);
    setMr(null);
  };
  return { recording, start, stop };
}

export function ServantSuggestionsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [newBody, setNewBody] = useState("");
  const [publishTarget, setPublishTarget] = useState<"servants_only" | "all">("servants_only");
  const [images, setImages] = useState<string[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [gallery, setGallery] = useState<string[] | null>(null);
  const rec = useRecorder();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["servant-suggestions-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suggestions")
        .select(`
          id, body, images, audio_url, video_url, target_type, created_at, user_id,
          profiles:user_id (full_name, avatar, academic_year, account_type)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleAddSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBody.trim() && !images.length && !audioFile && !videoFile) return toast.error("اكتب الاقتراح أو أرفق ملفًا");

    setSaving(true);
    try {
      let audio_url: string | null = null;
      let video_url: string | null = null;
      if (audioFile) audio_url = await uploadServantMedia(audioFile, userId);
      if (videoFile) video_url = await uploadServantMedia(videoFile, userId);

      const { error } = await supabase.from("suggestions").insert({
        body: newBody.trim() || "📎 اقتراح بمرفقات",
        user_id: userId,
        images,
        audio_url,
        video_url,
        target_type: publishTarget === "all" ? "all" : "all_servants",
      });

      if (error) throw error;
      toast.success("تم إرسال الاقتراح بنجاح!");
      setNewBody(""); setImages([]); setAudioFile(null); setVideoFile(null);
      qc.invalidateQueries({ queryKey: ["servant-suggestions-feed"] });
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء الإرسال");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border-2 border-border bg-card p-5 pop float-in">
        <h2 className="text-xl font-extrabold mb-3 flex items-center gap-2">
          <span>💡</span> إضافة اقتراح / فكرة جديدة
        </h2>
        <form onSubmit={handleAddSuggestion} className="space-y-4">
          <Textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="اكتب اقتراحك، ملاحظاتك، أو الأفكار الخاصة بالخدمة هنا..."
            className="rounded-2xl border-2 border-border min-h-[100px]"
          />

          {/* الصور */}
          <div className="flex flex-wrap gap-2">
            {images.map((s, i) => (
              <div key={i} className="relative">
                <img src={s} alt="" className="h-20 w-20 rounded-xl object-cover" />
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-xs text-destructive-foreground">✕</button>
              </div>
            ))}
            {images.length < 4 && (
              <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border text-center text-xs font-bold hover:bg-muted">
                📷<br />صور
                <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []).slice(0, 4 - images.length);
                  try {
                    const urls = await Promise.all(files.map((f) => fileToDataUrl(f, 900, 0.75)));
                    setImages([...images, ...urls]);
                  } catch (err) { toast.error((err as Error).message); }
                  e.target.value = "";
                }} />
              </label>
            )}
          </div>

          {/* الصوت والفيديو */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-3 text-center text-xs font-bold hover:bg-muted">
              🎤 {audioFile ? audioFile.name.slice(0, 18) : "رفع مقطع صوتي"}
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => { setAudioFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
            <button type="button" onClick={() => (rec.recording ? rec.stop((f) => { setAudioFile(f); toast.success("تم التسجيل ✅"); }) : rec.start((f) => setAudioFile(f)))}
              className={`rounded-2xl border-2 p-3 text-xs font-bold transition ${rec.recording ? "animate-pulse border-destructive bg-destructive/10 text-destructive" : "border-border hover:bg-muted"}`}>
              {rec.recording ? "⏹ إيقاف التسجيل" : "🎙️ تسجيل فويس"}
            </button>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-3 text-center text-xs font-bold hover:bg-muted">
              🎬 {videoFile ? videoFile.name.slice(0, 18) : "رفع فيديو"}
              <input type="file" accept="video/*" className="hidden" onChange={(e) => { setVideoFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-muted-foreground">تحديد النشر:</label>
              <select
                value={publishTarget}
                onChange={(e: any) => setPublishTarget(e.target.value)}
                className="rounded-xl border-2 border-border bg-background px-3 py-1.5 text-sm font-bold"
              >
                <option value="servants_only">🔒 خاص باجتماع الخدام والمشرفين</option>
                <option value="all">📢 متاح لجميع الخدام والمخدومين</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-sky px-5 py-2 font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "جاري الإرسال..." : "إرسال الاقتراح"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border-2 border-border bg-card p-5 pop float-in">
        <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2">
          <span>📬</span> سجل الاقتراحات والملاحظات
        </h2>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-bold">جاري تحميل الاقتراحات...</div>
        ) : suggestions?.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">لا توجد اقتراحات مسجلة حتى الآن.</div>
        ) : (
          <div className="space-y-3">
            {suggestions?.map((item: any) => {
              const author = item.profiles;
              const dateStr = new Date(item.created_at).toLocaleDateString("ar-EG", {
                year: "numeric", month: "short", day: "numeric",
              });

              return (
                <div key={item.id} className="space-y-2 rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{author?.avatar || "👤"}</span>
                      <span className="text-sm font-extrabold">{author?.full_name || "مستخدم"}</span>
                      {author?.academic_year && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{author.academic_year}</span>
                      )}
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${item.target_type === "all" ? "bg-sky/20 text-sky" : "bg-amber-500/20 text-amber-600"}`}>
                        {item.target_type === "all" ? "📢 للجميع" : "🔒 خاص بالخدام"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{dateStr}</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-foreground/90 whitespace-pre-line">{item.body}</p>
                  {!!item.images?.length && (
                    <div className="flex flex-wrap gap-2">
                      {item.images.map((s: string, i: number) => (
                        <img key={i} src={s} alt="" onClick={() => setGallery(item.images)} className="h-20 w-20 cursor-zoom-in rounded-xl object-cover" />
                      ))}
                    </div>
                  )}
                  {(item.audio_url || item.video_url) && (
                    <div className="space-y-2">
                      {item.audio_url && <MediaView src={item.audio_url} kind="audio" />}
                      {item.video_url && <MediaView src={item.video_url} kind="video" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ImageLightbox images={gallery} title="صور الاقتراح" onClose={() => setGallery(null)} />
    </div>
  );
}
