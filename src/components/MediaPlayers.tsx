import { useSignedMedia } from "@/lib/media";

function detectKind(src?: string | null, fallback: "image" | "audio" | "video" = "image"): "image" | "audio" | "video" {
  const s = (src || "").toLowerCase();
  if (s.startsWith("data:audio") || /\.(mp3|wav|ogg|m4a|aac|webm)(\?|$)/.test(s)) return "audio";
  if (s.startsWith("data:video") || /\.(mp4|mov|webm|avi|mkv)(\?|$)/.test(s)) return "video";
  if (s.startsWith("data:image") || /\.(png|jpe?g|gif|webp)(\?|$)/.test(s)) return "image";
  return fallback;
}

/** يعرض صورة أو صوتًا أو فيديو، ويحلل الروابط الموقعة للحاوية الخاصة تلقائيًا */
export function MediaView({ src, kind, className }: { src?: string | null; kind?: "image" | "audio" | "video"; className?: string }) {
  const url = useSignedMedia(src);
  if (!src || !url) return null;
  const k = kind || detectKind(url);
  if (k === "audio") return <audio src={url} controls className={className || "w-full"} preload="metadata" />;
  if (k === "video") return <video src={url} controls className={className || "w-full max-h-72 rounded-xl"} preload="metadata" />;
  return <img src={url} alt="" className={className || "rounded-xl object-cover"} />;
}
