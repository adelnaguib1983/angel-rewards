const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const QUIZ_MODEL = "openai/gpt-6-astra";
const MEDIA_MODEL = "google/gemini-3.8-flash";

const QUIZ_SCHEMA = {
  name: "quiz_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "questions"],
    properties: {
      title: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "kind", "options", "correct", "points"],
          properties: {
            question: { type: "string" },
            kind: { type: "string", enum: ["tf", "mcq"] },
            options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
            correct: { type: "integer", minimum: 0, maximum: 2 },
            points: { type: "integer", minimum: 1, maximum: 20 },
          },
        },
      },
    },
  },
} as const;

const SYSTEM = [
  "أنت مساعد خدام مدارس الأحد القبطية الأرثوذكسية، متخصص في إعداد مسابقات تربوية للفتيان من ١١ إلى ١٤ سنة.",
  "مهمتك: تحويل المصدر المعطى (نص، صورة، تسجيل صوتي، فيديو، أو مرجع كتابي) إلى مسابقة قيّمة.",
  "أخرج من ١٥ إلى ٢٠ سؤالًا حسب غنى المحتوى: نحو نصفها صح/خطأ (خياران فقط: «صح» و«خطأ» بنفس هذا النص) ونصفها اختيار من متعدد بثلاثة خيارات فقط.",
  "لا تكرر سؤالًا، ولا تجعل أكثر من خمسة أسئلة متتالية من نفس النوع، واجعل الأسئلة تغطي المحتوى كله بمستويات متنوعة (حفظ، فهم، استنتاج).",
  "الإجابة الصحيحة موزعة بين المواضع بشكل عشوائي (لا تركز على موقع واحد). درجة كل سؤال 5.",
  "الأسئلة والخيارات بالعربية البسيطة الواضحة. الخيارات قصيرة. لا تستخدم Markdown.",
  "أخرج بصيغة JSON فقط مطابقة للمخطط المطلوب دون أي نص إضافي.",
].join("\n");

type QuizDraft = {
  title: string;
  questions: { question: string; kind: "tf" | "mcq"; options: string[]; correct: number; points: number }[];
};

type QuizInput = {
  sourceType: "text" | "image" | "audio" | "video" | "bible";
  text?: string | undefined;
  imageDataUrl?: string | undefined;
  audioBase64?: string | undefined;
  audioMime?: string | undefined;
  videoBase64?: string | undefined;
  videoMime?: string | undefined;
 bible?: { book: string; chapter: number; chapterTo?: number | undefined; from?: number | undefined; to?: number | undefined } | undefined;

  count: 15 | 20;
};

function gatewayKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");
  return key;
}

function gatewayError(status: number, body: string): Error {
  let msg = "";
  try { msg = JSON.parse(body)?.error?.message || ""; } catch { /* ignore */ }
  if (status === 429) return new Error("ضغط كبير على خدمة الذكاء الاصطناعي، حاول بعد قليل");
  if (status === 402) return new Error(msg || "انتهت أرصدة خدمة الذكاء الاصطناعي، أخبر المشرف");
  if (status === 401) return new Error("خدمة الذكاء الاصطناعي غير مهيأة");
  if (status === 403) return new Error(msg || "تم رفض الطلب من مزود الذكاء الاصطناعي");
  if (status === 400) return new Error(msg || "تعذر تحليل الطلب");
  return new Error(msg || "تعذر الاتصال بخدمة الذكاء الاصطناعي");
}

/** تفريغ صوتي/وصف فيديو عبر نموذج متعدد الوسائط ليصبح نصًا جاهزًا للتوليد */
async function describeMedia(kind: "audio" | "video", base64: string, mime: string): Promise<string> {
  const sub = (mime.split(";")[0] || "").split("/")[1] || (kind === "audio" ? "mp3" : "mp4");
  const part = kind === "audio"
    ? { type: "input_audio", input_audio: { data: base64, format: sub } }
    : { type: "file", file: { filename: `clip.${sub}`, file_data: `data:${mime || "video/mp4"};base64,${base64}` } };
  const ask = kind === "audio"
    ? "هذا تسجيل صوتي من خادم مدارس الأحد. انسخ نصه بالعربية كاملًا (تفريغ حرفي)، وإن كان بدون كلام صِف محتواه. أخرج النص فقط."
    : "هذا فيديو من خادم مدارس الأحد. صِف محتواه بالعربية بالتفصيل الكافي لتوليد أسئلة منه: الأحداث، المعلومات، والنصوص الظاهرة أو المسموعة. أخرج الوصف فقط.";
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayKey()}`, "Lovable-API-Key": gatewayKey(), "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MEDIA_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: ask }, part] }],
      max_completion_tokens: 4000,
    }),
  });
  if (!res.ok) throw gatewayError(res.status, await res.text());
  const data = await res.json();
  const text = (data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("تعذر تحليل الملف المرفق، جرّب ملفًا آخر");
  return text;
}

/** استدعاء Responses API ببث SSE وصارم بمخطط JSON */
async function generateQuizJson(input: QuizInput): Promise<QuizDraft> {
  const parts: object[] = [];
  let userText = "";
  if (input.sourceType === "text") userText = `المصدر (نص مكتوب):\n${(input.text || "").trim()}`;
   } else if (input.sourceType === "bible") {
    const b = input.bible!;
    const chRange = b.chapterTo && b.chapterTo > b.chapter ? `الأصحاحات من ${b.chapter} إلى ${b.chapterTo}` : `أصحاح ${b.chapter}`;
    const range = b.from && b.to && b.to > b.from ? `الآيات ${b.from}-${b.to}` : b.from ? `الآية ${b.from}` : (b.chapterTo && b.chapterTo > b.chapter ? `كاملة` : `الأصحاح كاملًا`);
    userText = `المصدر (شاهد كتابي): سفر ${b.book}، ${chRange}، ${range}. استخدم معرفتك بالنص الكتابي نفسه لتوليد الأسئلة، والتزم بدقة بما ورد فيه.`;
  }

  } else if (input.sourceType === "image") {
    userText = "المصدر: صورة مرفوعة. اقرأ كل ما فيها بدقة (نصوص ومعلومات) وولّد الأسئلة منها.";
  } else {
    const transcript = await describeMedia(input.sourceType === "audio" ? "audio" : "video", (input.sourceType === "audio" ? input.audioBase64 : input.videoBase64)!, (input.sourceType === "audio" ? input.audioMime : input.videoMime) || "");
    userText = `المصدر (${input.sourceType === "audio" ? "تسجيل صوتي" : "فيديو"}) بعد تفريغه:\n${transcript}`;
  }
  parts.push({ type: "input_text", text: userText });
  if (input.sourceType === "image") parts.push({ type: "input_image", image_url: input.imageDataUrl!, detail: "high" });

  const body = {
    model: QUIZ_MODEL,
    stream: true,
    store: false,
    instructions: SYSTEM,
    input: [{ role: "user", content: parts }],
    max_output_tokens: 12000,
    reasoning: { effort: "medium", summary: "auto" },
    text: { format: { type: "json_schema", ...QUIZ_SCHEMA } },
  };

  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayKey()}`, "Lovable-API-Key": gatewayKey(), "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw gatewayError(res.status, await res.text());
  if (!res.body) throw new Error("تعذر استقبال الرد");

  let out = "";
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let ev: { type?: string; delta?: string; error?: { message?: string } };
      try { ev = JSON.parse(payload); } catch { continue; }
      if (ev.type === "output_text.delta" && ev.delta) out += ev.delta;
      if (ev.type === "error") throw new Error(ev.error?.message || "خطأ أثناء التوليد");
    }
  }
  const cleaned = out.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let draft: QuizDraft;
  try { draft = JSON.parse(cleaned); } catch { throw new Error("تعذر توليد مسابقة سليمة، حاول مرة أخرى"); }
  if (!draft?.title || !Array.isArray(draft.questions) || draft.questions.length < 5) throw new Error("المحتوى غير كافٍ لتوليد مسابقة، جرّب مصدرًا أغنى");
  draft.questions = draft.questions.map((q) => {
    const opts = (q.options || []).map((o) => String(o).trim()).filter(Boolean).slice(0, 3);
    const kind: "tf" | "mcq" = q.kind === "tf" && opts.length >= 2 ? "tf" : "mcq";
    const correct = Math.max(0, Math.min(opts.length - 1, Number(q.correct) || 0));
    return { question: String(q.question || "").trim(), kind, options: opts, correct, points: Math.max(1, Math.min(20, Number(q.points) || 5)) };
  }).filter((q) => q.question && q.options.length >= 2);
  if (draft.questions.length < 5) throw new Error("تعذر توليد أسئلة كافية، جرّب مصدرًا آخر");
  return draft;
}

export async function generateQuiz(input: QuizInput): Promise<QuizDraft> {
  return generateQuizJson(input);
}
