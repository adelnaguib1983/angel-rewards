import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const bible = z.object({
  book: z.string().max(60),
  chapter: z.number().int().min(1).max(200),
  chapterTo: z.number().int().min(1).max(200).optional(),
  from: z.number().int().min(1).max(200).optional(),
  to: z.number().int().min(1).max(200).optional(),
});


const inputSchema = z.object({
  sourceType: z.enum(["text", "image", "audio", "video", "bible"]),
  text: z.string().max(20000).optional(),
  imageDataUrl: z.string().max(4_000_000).optional(),
  audioBase64: z.string().max(15_000_000).optional(),
  audioMime: z.string().max(80).optional(),
  videoBase64: z.string().max(30_000_000).optional(),
  videoMime: z.string().max(80).optional(),
  bible: bible.optional(),
    count: z.number().int().min(1).max(50),
  pointsPerQuestion: z.number().int().min(1).max(50).optional(),

});

export const generateQuizDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: prof }, { data: servantOk }] = await Promise.all([
      context.supabase.from("profiles").select("status").eq("id", context.userId).maybeSingle(),
      context.supabase.rpc("is_servant", { _uid: context.userId }),
    ]);
    if (prof?.status !== "approved" || !servantOk) throw new Error("هذه الميزة للخدام المعتمدين فقط");
    const { generateQuiz } = await import("./quiz-ai.server");
    try {
      return await generateQuiz(data);
    } catch (e) {
      const msg = (e as Error).message || "تعذر توليد المسابقة الآن";
      throw new Error(msg);
    }
  });
