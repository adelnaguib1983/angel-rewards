import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function generateCoachMessage(input: { name: string; activities: string[]; verse: string; notes: string }) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (url, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(url, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      return res;
    },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system:
      "أنت خادم محب في مدارس الأحد القبطية الأرثوذكسية تكتب لفتى عمره ١١–١٤ سنة. اكتب بالعربية البسيطة الدافئة. " +
      "أخرج بالضبط قسمين بهذا الشكل:\nرسالة: (٣–٤ جمل تشجيع شخصية مرتبطة بأنشطته والآية إن وُجدت)\nهدف الأسبوع القادم: (هدف روحي عملي واحد محدد وقابل للقياس، جملة أو جملتان)\n" +
      "لا تستخدم Markdown. لا تذكر أنك ذكاء اصطناعي.",
    prompt: `الاسم: ${input.name}\nالأنشطة التي أنجزها هذا الأسبوع: ${input.activities.join("، ") || "لا شيء بعد"}\nالآية التي أثرت فيه: ${input.verse || "لم يكتب"}\nملاحظاته: ${input.notes || "لا يوجد"}`,
    providerOptions: {
      openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
    },
  });
  const text = await result.text;
  const [msgPart, goalPart] = text.split(/هدف الأسبوع القادم\s*:/);
  return {
    message: (msgPart ?? "").replace(/^\s*رسالة\s*:/, "").trim(),
    goal: (goalPart ?? "").trim(),
  };
}
