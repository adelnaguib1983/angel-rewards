import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMe } from "@/lib/app";
import { SplashScreen } from "@/components/SplashScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أبطال الإيمان | تطبيق تحفيزي لمدارس الأحد" },
      { name: "description", content: "سجّل القداس والتناول والاعتراف وقراءة الكتاب والعطاء، واجمع النقاط والأوسمة والهدايا." },
      { property: "og:title", content: "أبطال الإيمان" },
      { property: "og:description", content: "تطبيق تحفيزي للفتيان في مدارس الأحد: نقاط وأوسمة وهدايا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const [splashFinished, setSplashFinished] = useState(false);

  useEffect(() => {
    // التوجيه التلقائي بمجرد انتهاء مدة الشاشة الافتتاحية وجلب بيانات الحساب
    if (!splashFinished || isLoading) return;

    if (!me) {
      // مستخدم غير مسجل -> صفحة تسجيل الدخول
      navigate({ to: "/auth", replace: true });
    } else if (me.isAdmin || me.profile?.account_type === "servant") {
      // خادم أو مسؤول -> صفحة الخادم
      navigate({ to: "/servant", replace: true });
    } else {
      // فتى / مشترك -> صفحة المشترك الرئيسية
      navigate({ to: "/home", replace: true });
    }
  }, [splashFinished, isLoading, me, navigate]);

  return (
    <div className="relative min-h-screen w-full bg-[#0f1a2e]">
      {/* الشاشة الافتتاحية تغطي الشاشة بالكامل أثناء التحميل والتوجيه */}
      <SplashScreen
        duration={2000}
        imageUrl="/icon-512.png.jpeg"
        onFinish={() => setSplashFinished(true)}
      />
    </div>
  );
}
