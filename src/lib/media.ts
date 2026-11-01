import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "servant-media";

/** data: URLs وروابط الويب تُعرض كما هي؛ ما عدا ذلك يعتبر مسارًا داخل حاوية التخزين */
export function isStoredPath(v?: string | null): boolean {
  return !!v && !v.startsWith("data:") && !v.startsWith("http");
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || "");
      const i = res.indexOf("base64,");
      resolve(i >= 0 ? res.slice(i + 7) : res);
    };
    r.onerror = () => reject(new Error("تعذر قراءة الملف"));
    r.readAsDataURL(file);
  });
}

/** يرفع الملف إلى حاوية التخزين ويعيد مساره (يُخزن في قاعدة البيانات) */
export async function uploadServantMedia(file: File, uid: string): Promise<string> {
  const safe = (file.name.replace(/[^\w.\-]/g, "_").slice(-60)) || "file";
  const path = `${uid}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file);
  if (error) throw new Error(error.message.includes("exceeded") ? "حجم الملف أكبر من المسموح (٥٠ ميجابايت)" : "تعذر رفع الملف: " + error.message);
  return path;
}

/** رابط موقّع مؤقت للعرض من الحاوية الخاصة */
export function useSignedMedia(path?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!path) return;
    if (!isStoredPath(path)) { setUrl(path); return; }
    supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)
      .then(({ data }) => { if (alive && data) setUrl(data.signedUrl); })
      .catch(() => { if (alive) setUrl(null); });
    return () => { alive = false; };
  }, [path]);
  return url;
}
