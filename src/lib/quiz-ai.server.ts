const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"];

export type QuizDraft = {
  title: string;
  questions: { question: string; kind: "tf" | "mcq"; options: string[]; correct: number; points: number }[];
};

export type QuizInput = {
  sourceType: "text" | "image" | "audio" | "video" | "bible";
  text?: string | undefined;
  imageDataUrl?: string | undefined;
  audioBase64?: string | undefined;
  audioMime?: string | undefined;
  videoBase64?: string | undefined;
  videoMime?: string | undefined;
  bible?: { book: string; chapter: number; chapterTo?: number | undefined; from?: number | undefined; to?: number | undefined } | undefined;
  count: number;
  pointsPerQuestion?: number | undefined;
};


const SYSTEM_INSTRUCTION = [
  "أنت مساعد خدام مدارس الأحد القبطية الأرثوذكسية، متخصص في إعداد مسابقات تربوية للفتيان من ١١ إلى ١٤ سنة.",
  "مهمتك: تحويل المصدر المعطى (نص، صورة، تسجيل صوتي، فيديو، أو مرجع كتابي) إلى مسابقة قيّمة.",
  "اكتب العدد المطلوب بالضبط من الأسئلة: نصفها تقريبًا صح/خطأ (خياران فقط: «صح» و«خطأ» بنفس هذا النص) ونصفها اختيار من متعدد بثلاثة خيارات فقط.",
  "لا تكرر سؤالًا، ولا تجعل أكثر من خمسة أسئلة متتالية من نفس النوع، واجعل الأسئلة تغطي المحتوى كله بمستويات متنوعة (حفظ، فهم، استنتاج).",
  "الإجابة الصحيحة موزعة بين المواضع بشكل عشوائي (لا تركز على موقع واحد). درجة كل سؤال 5.",
  "الأسئلة والخيارات بالعربية البسيطة الواضحة. الخيارات قصيرة. لا تستخدم Markdown.",
  "أخرج بصيغة JSON فقط مطابقة للمخطط المطلوب دون أي نص إضافي.",
].join("\n");

const QUIZ_SCHEMA = {
  type: "OBJECT",
  required: ["title", "questions"],
  properties: {
    title: { type: "STRING" },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["question", "kind", "options", "correct", "points"],
        properties: {
          question: { type: "STRING" },
          kind: { type: "STRING", enum: ["tf", "mcq"] },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correct: { type: "INTEGER" },
          points: { type: "INTEGER" },
        },
      },
    },
  },
};

export async function generateQuiz(input: QuizInput): Promise<QuizDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("مفتاح GEMINI_API_KEY غير مهيأ في إعدادات البيئة.");
  }

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
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
    const match = input.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("صيغة بيانات الصورة غير مدعومة.");
    parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    userText = "المصدر: صورة مرفوعة. اقرأ كل ما فيها بدقة (نصوص ومعلومات) وولّد الأسئلة منها.";
  } else if (input.sourceType === "audio") {
    if (!input.audioBase64) throw new Error("أرفق ملف الصوت أولًا.");
    parts.push({ inlineData: { mimeType: input.audioMime || "audio/mpeg", data: input.audioBase64 } });
    userText = "المصدر: تسجيل صوتي مرفوع لخادم مدارس الأحد. استمع لمحتواه بدقة وولّد الأسئلة منه.";
  } else if (input.sourceType === "video") {
    if (!input.videoBase64) throw new Error("أرفق ملف الفيديو أولًا.");
    parts.push({ inlineData: { mimeType: input.videoMime || "video/mp4", data: input.videoBase64 } });
    userText = "المصدر: فيديو مرفوع لخادم مدارس الأحد. حلل الأحداث والمعلومات الواردة فيه بدقة وولّد الأسئلة منها.";
  }
parts.push({ text: `${userText}\n\nالمطلوب: أنشئ بالضبط ${input.count} سؤالًا بالعدد والمواصفات المحددة، واجعل درجة كل سؤال ${pts}.` });

const pts = input.pointsPerQuestion || 3;


  const payload = {
    systemInstruction: {
  parts: [{ text: `${SYSTEM_INSTRUCTION}\nعدد الأسئلة المطلوب بالضبط: ${input.count}.\nدرجة كل سؤال: ${pts}.` }],
},

    contents: [
      {
        role: "user",
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: QUIZ_SCHEMA,
    },
  };

  let response: Response | null = null;
  let lastErrorMessage = "";

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) break;

        // إذا كان خطأ مؤقت في السيرفر أو طلبات كثيرة، انتظر وحاول مجدداً
        if (response.status === 503 || response.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        // إذا كان الخطأ 404 (موديل غير متاح)، اخرج وجرب الموديل التالي
        if (response.status === 404) {
          const errText = await response.text().catch(() => "");
          lastErrorMessage = `النموذج ${model} غير متاح: ${errText.slice(0, 100)}`;
          break;
        }

        break;
      } catch (err: any) {
        lastErrorMessage = err?.message || "فشل الاتصال بسيرفر Gemini";
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
    if (response && response.ok) break;
  }

  if (!response || !response.ok) {
    if (response?.status === 503) {
      throw new Error("سيرفرات الذكاء الاصطناعي تواجه ضغطاً مؤقتاً، يرجى المحاولة بعد قليل.");
    }
    if (response?.status === 429) {
      throw new Error("تم تجاوز حد الطلبات في Gemini مؤقتًا. انتظر دقيقة ثم حاول ثانية.");
    }
    if (response?.status === 400 || response?.status === 403) {
      throw new Error("مفتاح Gemini API غير صالح أو تنقصه الصلاحية. تحقق من الإعدادات.");
    }
    const errBody = (await response?.text().catch(() => "")) || lastErrorMessage || "";
    throw new Error(`تعذر إنشاء المسابقة (${response?.status || 500}): ${errBody.slice(0, 150)}`);
  }

  const result = await response.json();
  const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("لم تصل استجابة صالحة من Gemini. راجع الملف أو النص وحاول مجددًا.");
  }

  let draft: QuizDraft;
  try {
    draft = JSON.parse(rawText) as QuizDraft;
  } catch {
    throw new Error("تعذر قراءة بيانات المسابقة المولدة. حاول مرة أخرى.");
  }

  if (!draft.title?.trim() || !Array.isArray(draft.questions) || draft.questions.length !== input.count) {
    throw new Error(`لم تكتمل المسابقة بالعدد المطلوب (${input.count} سؤالًا). جرّب مصدرًا أوضح.`);
  }

  draft.questions = draft.questions.map((question) => {
    const options = (question.options || []).map((opt) => String(opt).trim()).filter(Boolean).slice(0, 3);
    const kind: "tf" | "mcq" = question.kind === "tf" && options.length >= 2 ? "tf" : "mcq";
    const correct = Math.max(0, Math.min(options.length - 1, Number(question.correct) || 0));
    return {
      question: String(question.question || "").trim(),
      kind,
      options,
      correct,
points: Math.max(1, Math.min(50, Number(question.points) || pts)),

    };
  }).filter((q) => q.question && q.options.length >= 2);

  if (draft.questions.length !== input.count) {
    throw new Error("بعض الأسئلة التي تم توليدها غير مكتملة. حاول مجددًا.");
  }

  return draft;
}
