import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWeeklyCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      activities: z.array(z.string().max(60)).max(20),
      verse: z.string().max(500),
      notes: z.string().max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: prof } = await context.supabase.from("profiles").select("full_name,status").eq("id", context.userId).maybeSingle();
    if (prof?.status !== "approved") throw new Error("الحساب غير مفعّل");
    const { generateCoachMessage } = await import("./coach.server");
    try {
      return await generateCoachMessage({ name: prof.full_name ?? "", ...data });
    } catch (e) {
      const s = (e as { statusCode?: number }).statusCode;
      if (s === 429) throw new Error("ضغط كبير الآن، حاول بعد دقيقة");
      if (s === 402) throw new Error("انتهى رصيد خدمة الذكاء الاصطناعي، أخبر الخادم");
      throw new Error("تعذر إنشاء الرسالة الآن");
    }
  });
