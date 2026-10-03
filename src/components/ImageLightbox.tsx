import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { images: string[] | null; start?: number; title?: string; onClose: () => void };

export function ImageLightbox({ images, start = 0, title = "مستعرض الصور", onClose }: Props) {
  const [index, setIndex] = useState(start);
  const [zoom, setZoom] = useState(1);
  useEffect(() => { setIndex(start); setZoom(1); }, [images, start]);
  useEffect(() => {
    if (!images?.length) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i + 1) % images.length);
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(3, z + .25));
      if (e.key === "-") setZoom((z) => Math.max(.5, z - .25));
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [images]);
  const src = images?.[index];
  return <Dialog open={!!src} onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-5xl overflow-hidden p-3">
    <DialogHeader><DialogTitle>{title} <span className="text-sm text-muted-foreground">{images?.length ? `${index + 1}/${images.length}` : ""}</span></DialogTitle></DialogHeader>
    <div className="flex items-center justify-center overflow-auto rounded-xl bg-muted" style={{ height: "min(70vh,700px)" }}>
      {src && <img src={src} alt="" className="max-h-full max-w-full object-contain transition-transform" style={{ transform: `scale(${zoom})` }} />}
    </div>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button aria-label="الصورة السابقة" title="الصورة السابقة" onClick={() => setIndex((i) => (i - 1 + (images?.length ?? 1)) % (images?.length ?? 1))} className="rounded-xl bg-muted px-4 py-2 font-bold">→</button>
      <button aria-label="تصغير" title="تصغير" onClick={() => setZoom((z) => Math.max(.5, z - .25))} className="rounded-xl bg-muted px-4 py-2 font-bold">−</button>
      <span className="min-w-14 text-center text-sm font-bold">{Math.round(zoom * 100)}٪</span>
      <button aria-label="تكبير" title="تكبير" onClick={() => setZoom((z) => Math.min(3, z + .25))} className="rounded-xl bg-muted px-4 py-2 font-bold">+</button>
      <button aria-label="ملء الشاشة" title="ملء الشاشة" onClick={() => document.documentElement.requestFullscreen?.()} className="rounded-xl bg-muted px-4 py-2 font-bold">⛶</button>
      <button aria-label="الصورة التالية" title="الصورة التالية" onClick={() => setIndex((i) => (i + 1) % (images?.length ?? 1))} className="rounded-xl bg-muted px-4 py-2 font-bold">←</button>
    </div>
  </DialogContent></Dialog>;
}
