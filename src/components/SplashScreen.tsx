import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinish?: () => void;
  duration?: number;
  imageUrl?: string;
}

export function SplashScreen({
  onFinish,
  duration = 2000,
  imageUrl = "/icon-512.png.jpeg",
}: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // بدء تأثير التلاشي الناعم قبل الانتهاء بنصف ثانية
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, Math.max(0, duration - 500));

    // إنهاء العرض وإزالة الشاشة
    const finishTimer = setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [duration, onFinish]);

  if (!isVisible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center overflow-hidden bg-[#0f1a2e] transition-opacity duration-500 ease-in-out ${
        isFading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <img
        src={imageUrl}
        alt="رئيس الملائكة ميخائيل"
        className="h-full w-full object-cover object-center select-none"
      />
    </div>
  );
}
