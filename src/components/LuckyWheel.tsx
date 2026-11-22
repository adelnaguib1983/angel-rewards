// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// أقسام عجلة الحظ الستة
const SECTORS = [
  { id: "dogma", label: "لاهوت وعقيدة", color: "#8B5CF6", icon: "✝️" },
  { id: "rites", label: "طقس وألحان", color: "#EC4899", icon: "🕯️" },
  { id: "bible", label: "كتاب مقدس", color: "#3B82F6", icon: "📖" },
  { id: "saints", label: "سير قديسين", color: "#10B981", icon: "🕊️" },
  { id: "history", label: "تاريخ الكنيسة", color: "#F59E0B", icon: "🏛️" },
  { id: "sacraments", label: "أسرار وأصوام", color: "#EF4444", icon: "🍞" },
];

// بنك أسئلة أرثوذكسية متنوع ومباشر
const QUESTIONS_BANK = {
  dogma: [
    {
      q: "ما معنى كلمة (أومواوسيوس) التي وُضعت في مجمع نيقية؟",
      opts: ["مساوي للآب في الجوهر", "مشابه للآب", "مخلوق من الآب", "ابن بالتبني"],
      ans: 0,
    },
    {
      q: "كم عدد المجامع المسكونية المعترف بها في كنيستنا الأرثوذكسية؟",
      opts: ["ثلاثة مجامع", "أربعة مجامع", "سبعة مجامع", "مجمع واحد"],
      ans: 0,
    },
    {
      q: "أي الأقانيم الإلهية الذي تجسد وفدانا على الصليب؟",
      opts: ["الابن الكلمة (الأقنوم الثاني)", "الآب", "الروح القدس", "كل الأقانيم معاً بالجسد"],
      ans: 0,
    },
  ],
  rites: [
    {
      q: "ما هو اللحن الذي يقال في أسبوع الآلام قبل قراءة الإنجيل؟",
      opts: ["ثوك تي تي جوم", "إبؤورو", "تين أو أويه", "بي إيكليرومينوس"],
      ans: 0,
    },
    {
      q: "كم عدد القراءات (البولس، الكاثوليكون، الإبركسيس) قبل الإنجيل في القداس؟",
      opts: ["3 قراءات", "2 فقط", "4 قراءات", "قراءة واحدة"],
      ans: 0,
    },
    {
      q: "إلى أي جهة يتجه المذبح والمصلون في الكنيسة القبطية؟",
      opts: ["الشرق", "الغرب", "الشمال", "الجنوب"],
      ans: 0,
    },
  ],
  bible: [
    {
      q: "كم عدد أسفار العهد الجديد؟",
      opts: ["27 سفراً", "39 سفراً", "46 سفراً", "66 سفراً"],
      ans: 0,
    },
    {
      q: "من هو كاتب سفر الرؤيا؟",
      opts: ["يوحنا الحبيب", "بولس الرسول", "بطرس الرسول", "لوقا الإنجيلي"],
      ans: 0,
    },
    {
      q: "في أي إنجيل تبدأ سلسلة الأنساب بـ (كتاب ميلاد يسوع المسيح ابن داود ابن إبراهيم)؟",
      opts: ["إنجيل متى", "إنجيل مرقس", "إنجيل لوقا", "إنجيل يوحنا"],
      ans: 0,
    },
  ],
  saints: [
    {
      q: "من هو حامي الإيمان وبطل مجمع نيقية والبابا العشرون؟",
      opts: ["البابا أثناسيوس الرسولي", "البابا كيرلس عمود الدين", "البابا ديسقورس", "الأنبا أنطونيوس"],
      ans: 0,
    },
    {
      q: "من هو الملقب بـ (أمير الشهداء)؟",
      opts: ["مارجرجس", "الشهيد أبانوب", "مارمينا", "أبو سيفين"],
      ans: 0,
    },
    {
      q: "من هو مؤسس الرهبنة في العالم كله؟",
      opts: ["الأنبا أنطونيوس الكبير", "الأنبا بولا", "الأنبا باخوميوس", "الأنبا شنودة"],
      ans: 0,
    },
  ],
  history: [
    {
      q: "من هو مؤسس وكاروز الكنيسة القبطية الأرثوذكسية في مصر؟",
      opts: ["القديس مارمرقس الرسول", "القديس بولس الرسول", "القديس بطرس", "القديس لوقا"],
      ans: 0,
    },
    {
      q: "في أي عام ميلادي عُقد مجمع نيقية المسكوني الأول؟",
      opts: ["325 م", "381 م", "431 م", "451 م"],
      ans: 0,
    },
  ],
  sacraments: [
    {
      q: "كم عدد أسرار الكنيسة السبعة؟",
      opts: ["7 أسرار", "5 أسرار", "12 سراً", "3 أسرار"],
      ans: 0,
    },
    {
      q: "أي سر من أسرار الكنيسة يسمى (سر الشكر)؟",
      opts: ["سر الإفخارستيا (التناول)", "سر المعمودية", "سر التوبة والاعتراف", "سر الميرون"],
      ans: 0,
    },
    {
      q: "كم يوماً مدة صوم يونان (نينوى)؟",
      opts: ["3 أيام", "7 أيام", "15 يوماً", "40 يوماً"],
      ans: 0,
    },
  ],
};

const MAX_DAILY_SPINS = 2; // الحد الأقصى مرتين يومياً

export function LuckyWheel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [activeSector, setActiveSector] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [spinsToday, setSpinsToday] = useState(0);

  // مفتاح تتبع المحاولات اليومية لكل مستخدم
  const todayKey = `wheel_spins_${userId}_${new Date().toISOString().slice(0, 10)}`;

  useEffect(() => {
    const saved = localStorage.getItem(todayKey);
    setSpinsToday(saved ? parseInt(saved, 10) : 0);
  }, [todayKey]);

  const canSpin = spinsToday < MAX_DAILY_SPINS;

  // دوران العجلة
  const spinWheel = () => {
    if (spinning || !canSpin) return;

    setSpinning(true);
    setActiveSector(null);
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);

    // اختيار قطاع عشوائي
    const sectorCount = SECTORS.length;
    const sectorAngle = 360 / sectorCount;
    const chosenIndex = Math.floor(Math.random() * sectorCount);
    
    // عدد دورات كاملة (بين 5 إلى 8 دورات) مع زاوية التوقف
    const extraRounds = (5 + Math.floor(Math.random() * 3)) * 360;
    // حساب الزاوية بحيث يتوقف المؤشر في منتصف القطاع المختار
    const targetAngle = extraRounds + (360 - (chosenIndex * sectorAngle + sectorAngle / 2));
    const newRotation = rotation + targetAngle;

    setRotation(newRotation);

    setTimeout(() => {
      setSpinning(false);
      const sector = SECTORS[chosenIndex];
      setActiveSector(sector);

      // اختيار سؤال عشوائي من القسم
      const questions = QUESTIONS_BANK[sector.id] || QUESTIONS_BANK.dogma;
      const q = questions[Math.floor(Math.random() * questions.length)];
      setCurrentQuestion(q);

      // تسجيل المحاولة اليومية
      const nextCount = spinsToday + 1;
      setSpinsToday(nextCount);
      localStorage.setItem(todayKey, nextCount.toString());
    }, 4000);
  };

  // التحقق من الإجابة وإضافة النقاط
  const submitAnswer = async (index: number) => {
    if (isAnswerSubmitted || !currentQuestion) return;

    setSelectedAnswer(index);
    setIsAnswerSubmitted(true);

    const isCorrect = index === currentQuestion.ans;

    if (isCorrect) {
      toast.success("إجابة صحيحة وممتازة! 🎉 تم إضافة 5 نقاط إلى رصيدك");

      // محاولة إضافة النقاط لقاعدة البيانات
      try {
        await supabase.rpc("spin_wheel_reward", { _points: 5 });
      } catch (err) {
        console.error("Points adjustment error:", err);
      }

      // تحديث إحصائيات ونقاط الواجهة فوراً
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    } else {
      toast.error("إجابة غير صحيحة، حاول التركيز في المرة القادمة! 🙏");
    }
  };

  return (
    <div className="mx-auto max-w-xl text-center space-y-6 py-4">
      {/* رأس الصفحة والمحاولات */}
      <div className="rounded-3xl border-2 border-border bg-card p-6 shadow-sm">
        <h2 className="text-2xl font-black text-foreground flex items-center justify-center gap-2">
          <span>🎡</span>
          <span>عجلة الحظ والمعرفة الأرثوذكسية</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          لف العجلة كل يوم، جاوب على أسئلة العقيدة والطقس واكسب <b className="text-primary font-bold">+5 نقاط</b> لكل إجابة صحيحة!
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-xs font-bold">
          <span>المحاولات المتبقية اليوم:</span>
          <span className={`px-2 py-0.5 rounded-full text-white ${canSpin ? "bg-emerald-600" : "bg-destructive"}`}>
            {MAX_DAILY_SPINS - spinsToday} من {MAX_DAILY_SPINS}
          </span>
        </div>
      </div>

      {/* العجلة الدوارة مع المؤشر */}
      <div className="relative mx-auto flex flex-col items-center justify-center">
        {/* سهم التحديد (المؤشر) */}
        <div className="z-20 -mb-4 flex flex-col items-center">
          <div className="h-0 w-0 border-x-[14px] border-x-transparent border-t-[24px] border-t-red-600 drop-shadow-md" />
        </div>

        {/* جسم العجلة SVG */}
        <div className="relative h-72 w-72 sm:h-80 sm:w-80 overflow-hidden rounded-full border-4 border-primary shadow-2xl">
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full transition-transform duration-[4000ms] ease-out"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {SECTORS.map((sector, i) => {
              const count = SECTORS.length;
              const angle = 360 / count;
              const startAngle = (i * angle - 90) * (Math.PI / 180);
              const endAngle = ((i + 1) * angle - 90) * (Math.PI / 180);

              const x1 = 50 + 50 * Math.cos(startAngle);
              const y1 = 50 + 50 * Math.sin(startAngle);
              const x2 = 50 + 50 * Math.cos(endAngle);
              const y2 = 50 + 50 * Math.sin(endAngle);

              const midAngle = ((i + 0.5) * angle - 90) * (Math.PI / 180);
              const textX = 50 + 32 * Math.cos(midAngle);
              const textY = 50 + 32 * Math.sin(midAngle);

              return (
                <g key={sector.id}>
                  <path
                    d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                    fill={sector.color}
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                  <text
                    x={textX}
                    y={textY}
                    fill="#ffffff"
                    fontSize="4.2"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${i * angle + angle / 2}, ${textX}, ${textY})`}
                  >
                    {sector.icon} {sector.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* النواة المركزية للعجلة */}
          <div className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-card shadow-lg">
            <span className="text-xl">✝️</span>
          </div>
        </div>

        {/* زر التدوير */}
        <div className="mt-6">
          <button
            onClick={spinWheel}
            disabled={spinning || !canSpin}
            className="rounded-2xl bg-primary px-8 py-3.5 text-lg font-black text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
          >
            {spinning ? "العجلة تدور... 🎡" : canSpin ? "لف العجلة الآن 🎯" : "انتهت محاولاتك اليوم ⏳"}
          </button>
          {!canSpin && (
            <p className="mt-2 text-xs text-muted-foreground">
              تتجدد المحاولات يومياً عند منتصف الليل. نراك غداً! ✨
            </p>
          )}
        </div>
      </div>

      {/* نافذة السؤال المنبثقة عند توقف العجلة */}
      <Dialog open={!!currentQuestion} onOpenChange={(open) => !open && !spinning && setCurrentQuestion(null)}>
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <span>{activeSector?.icon}</span>
              <span>سؤال قسم: {activeSector?.label}</span>
            </DialogTitle>
          </DialogHeader>

          {currentQuestion && (
            <div className="space-y-4 pt-2">
              <div className="rounded-2xl bg-muted/60 p-4 border border-border text-base font-bold leading-relaxed">
                {currentQuestion.q}
              </div>

              {/* الاختيارات */}
              <div className="space-y-2">
                {currentQuestion.opts.map((opt: string, idx: number) => {
                  let btnStyle = "border-border bg-card text-foreground hover:bg-muted";

                  if (isAnswerSubmitted) {
                    if (idx === currentQuestion.ans) {
                      btnStyle = "bg-emerald-600 text-white border-emerald-600 font-black";
                    } else if (idx === selectedAnswer) {
                      btnStyle = "bg-destructive text-white border-destructive";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswerSubmitted}
                      onClick={() => submitAnswer(idx)}
                      className={`w-full rounded-xl border-2 p-3 text-right text-sm font-semibold transition-all ${btnStyle}`}
                    >
                      <span className="ml-2 inline-block h-6 w-6 rounded-full bg-black/10 text-center leading-6 text-xs font-bold">
                        {idx + 1}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* النتيجة وزر المتابعة بعد الإجابة */}
              {isAnswerSubmitted && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => setCurrentQuestion(null)}
                    className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
                  >
                    حسناً، استمرار ✨
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
