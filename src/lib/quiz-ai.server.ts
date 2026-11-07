import { GatewayError, generateChatCompletion, generateResponse } from "@lovable.dev/ai-gateway";

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
  "اكتب العدد المطلوب بالضبط من الأسئلة: نصفها تقريبًا صح/خطأ (خياران فقط: «صح» و«خطأ» بنفس هذا النص) ونصفها اختيار من متعدد بثلاثة خيارات فقط.",
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

function gatewayFailure(error: GatewayError): Error {
  console.error("[quiz-ai] Gateway request failed", {
    code: error.code,
    httpStatus: error.httpStatus,
    outcome: error.outcome,
    recovery: error.recovery,
    remote: error.remote,
    ids: error.ids,
  });

  const messages: Record<string, string> = {
    configuration_error: "خدمة إنشاء المسابقات غير مهيأة حاليًا. أبلغ المشرف.",
    authentication_error: "تعذر الاتصال بخدمة إنشاء المسابقات. أبلغ المشرف.",
    request_rejected: "تعذر قبول طلب التوليد. راجع النص أو الملف وحاول مرة أخرى.",
    payment_required: "رصيد خدمة إنشاء المسابقات غير كافٍ حاليًا. أبلغ المشرف.",
    permission_denied: "صلاحية استخدام خدمة إنشاء المسابقات غير متاحة حاليًا. أبلغ المشرف.",
    rate_limited: "الخدمة مزدحمة الآن. انتظر قليلًا قبل المحاولة مرة أخرى.",
    operation_failed: "لم يكتمل التوليد. راجع مصدر المسابقة وحاول مرة أخرى.",
    network_error: "انقطع الاتصال أثناء التوليد. تحقق من الاتصال ثم حاول مرة أخرى.",
    timeout: "استغرق التوليد وقتًا أطول من المتوقع. حاول مرة أخرى بعد قليل.",
    cancelled: "تم إيقاف عملية التوليد.",
    invalid_response: "وصل رد غير مكتمل من خدمة التوليد. حاول مرة أخرى.",
    unknown: "تعذر إكمال التوليد حاليًا. حاول مرة أخرى بعد قليل.",
  };
  return new Error(messages[error.code] ?? messages.unknown);
}

function toUserError(error: unknown): Error {
  if (error instanceof GatewayError) return gatewayFailure(error);
  if (error instanceof Error) return error;
  return new Error("تعذر إكمال إنشاء المسابقة. تحقق من المصدر وحاول مرة أخرى.");
}

function responseText(response: Awaited<ReturnType<typeof generateResponse>>): string {
  return response.output
    .flatMap((item) => item.type === "message" ? item.content : [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text)
    .join("")
    .trim();
}

/** تفريغ صوت أو وصف فيديو عبر النموذج متعدد الوسائط. */
async function describeMedia(kind: "audio" | "video", base64: string, mime: string): Promise<string> {
  const subtype = (mime.split(";")[0] || "").split("/")[1] || (kind === "audio" ? "mp3" : "mp4");
  const ask = kind === "audio"
    ? "هذا تسجيل صوتي من خادم مدارس الأحد. انسخ نصه بالعربية كاملًا (تفريغ حرفي)، وإن كان بدون كلام صِف محتواه. أخرج النص فقط."
    : "هذا فيديو من خادم مدارس الأحد. صِف محتواه بالعربية بالتفصيل الكافي لتوليد أسئلة منه: الأحداث، المعلومات، والنصوص الظاهرة أو المسموعة. أخرج الوصف فقط.";
  const media = kind === "audio"
    ? { type: "input_audio" as const, input_audio: { data: base64, format: subtype === "mpeg" ? "mp3" : subtype } }
    : { type: "video_url" as const, video_url: { url: `data:${mime || "video/mp4"};base64,${base64}`, processing: "static" as const } };

  try {
    const response = await generateChatCompletion({
      model: MEDIA_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: ask }, media] }],
      max_completion_tokens: 4000,
    });
    const text = response.choices[0]?.message.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("تعذر تحليل الملف المرفق، جرّب ملفًا آخر.");
    }
    return text.trim();
  } catch (error) {
    throw toUserError(error);
  }
}

async function generateQuizJson(input: QuizInput): Promise<QuizDraft> {
  let userText = "";
  if (input.sourceType === "text") {
    userText = `المصدر (نص مكتوب):\n${(input.text || "").trim()}`;
  } else if (input.sourceType === "bible") {
    const bible = input.bible;
    if (!bible) throw new Error("حدد الشاهد الكتابي أولًا.");
    const chapterRange = bible.chapterTo && bible.chapterTo > bible.chapter
      ? `الأصحاحات من ${bible.chapter} إلى ${bible.chapterTo}`
      : `أصحاح ${bible.chapter}`;
    const verseRange = bible.from && bible.to && bible.to > bible.from
      ? `الآيات ${bible.from}-${bible.to}`
      : bible.from
        ? `الآية ${bible.from}`
        : bible.chapterTo && bible.chapterTo > bible.chapter
          ? "كاملة"
          : "الأصحاح كاملًا";
    userText = `المصدر (شاهد كتابي): سفر ${bible.book}، ${chapterRange}، ${verseRange}. استخدم معرفتك بالنص الكتابي نفسه لتوليد الأسئلة، والتزم بدقة بما ورد فيه.`;
  } else if (input.sourceType === "image") {
    if (!input.imageDataUrl) throw new Error("أرفق صورة المسابقة أولًا.");
    userText = "المصدر: صورة مرفوعة. اقرأ كل ما فيها بدقة (نصوص ومعلومات) وولّد الأسئلة منها.";
  } else {
    const isAudio = input.sourceType === "audio";
    const mediaBase64 = isAudio ? input.audioBase64 : input.videoBase64;
    if (!mediaBase64) throw new Error(isAudio ? "أرفق ملف الصوت أولًا." : "أرفق ملف الفيديو أولًا.");
    const transcript = await describeMedia(
      isAudio ? "audio" : "video",
      mediaBase64,
      (isAudio ? input.audioMime : input.videoMime) || (isAudio ? "audio/mpeg" : "video/mp4"),
    );
    userText = `المصدر (${isAudio ? "تسجيل صوتي" : "فيديو"}) بعد تحليله:\n${transcript}`;
  }

  const content = [{ type: "input_text" as const, text: `${userText}\n\nأنشئ بالضبط ${input.count} سؤالًا.` }];
  if (input.sourceType === "image" && input.imageDataUrl) {
    content.push({ type: "input_image" as const, image_url: input.imageDataUrl, detail: "high" as const });
  }

  try {
    const response = await generateResponse({
      model: QUIZ_MODEL,
      store: false,
      instructions: `${SYSTEM}\nعدد الأسئلة المطلوب بالضبط: ${input.count}.`,
      input: [{ role: "user", content }],
      max_output_tokens: 12000,
      reasoning: { effort: "medium", summary: "auto" },
      text: { format: { type: "json_schema", ...QUIZ_SCHEMA } },
    });
    if (response.status !== "completed") {
      throw new Error("لم يكتمل رد خدمة التوليد. حاول مرة أخرى.");
    }

    const cleaned = responseText(response).replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let draft: QuizDraft;
    try {
      draft = JSON.parse(cleaned) as QuizDraft;
    } catch {
      throw new Error("وصل رد غير مكتمل للمسابقة. راجع المصدر وحاول مرة أخرى.");
    }
    if (!draft.title?.trim() || !Array.isArray(draft.questions) || draft.questions.length !== input.count) {
      throw new Error(`لم يكتمل إنشاء المسابقة بالعدد المطلوب (${input.count} سؤالًا). جرّب مصدرًا أوضح.`);
    }

    draft.questions = draft.questions.map((question) => {
      const options = (question.options || []).map((option) => String(option).trim()).filter(Boolean).slice(0, 3);
      const kind: "tf" | "mcq" = question.kind === "tf" && options.length >= 2 ? "tf" : "mcq";
      const correct = Math.max(0, Math.min(options.length - 1, Number(question.correct) || 0));
      return {
        question: String(question.question || "").trim(),
        kind,
        options,
        correct,
        points: Math.max(1, Math.min(20, Number(question.points) || 5)),
      };
    }).filter((question) => question.question && question.options.length >= 2);
    if (draft.questions.length !== input.count) {
      throw new Error("بعض الأسئلة التي وصلت غير مكتملة. جرّب مصدرًا أوضح.");
    }
    return draft;
  } catch (error) {
    throw toUserError(error);
  }
}

export async function generateQuiz(input: QuizInput): Promise<QuizDraft> {
  return generateQuizJson(input);
}